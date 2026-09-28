/**
 * Game review, chess.com style, from Stockfish evaluations.
 *
 * Everything is measured in winning chances, not pawns: a pawn matters when the game is level and
 * hardly at all when you're already up a rook. The curve is Lichess's:
 *     win% = 50 + 50 · (2 / (1 + e^(−0.00368208 · cp)) − 1)
 * A move's cost is the drop in the mover's win% from the best move to the move played.
 *
 *   Best        the engine's top move (or as good)
 *   Excellent   loses ≤ 2%      Good ≤ 5%      Inaccuracy ≤ 10%
 *   Mistake     ≤ 20%           Blunder > 20%
 *   Great       the only good move: the best, when the second-best is ≥ 10% worse
 *   Brilliant   a real sacrifice that is the best move, in a position that isn't already won
 *   Miss        the opponent just blundered and you didn't punish it (≥ 10% left on the table)
 *   Book        a known opening position (and nothing better was missed)
 *
 * Move accuracy (Lichess): 103.1668 · e^(−0.04354 · Δwin%) − 3.1669, clamped to 0–100.
 * Game accuracy: the average of a volatility-weighted mean and the harmonic mean of those.
 */
import { Chess } from 'chess.js';
import { VALUE } from './chessutil.js';

export const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

/** Engine line → centipawns from White's side (mates as ±10000 minus distance). */
export function cpOf(line) {
  if (!line) return 0;
  if (line.mate === 0) return line.cp ?? 0; // a finished game: cp carries who won
  if (line.mate != null) return line.mate > 0 ? 10000 - 10 * line.mate : -10000 - 10 * line.mate;
  return line.cp ?? 0;
}

export const moveAccuracy = (drop) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, drop)) - 3.1669));

export const CLASSES = {
  brilliant: { label: 'Brilliant', sym: '!!', color: '#22d3ee' },
  great: { label: 'Great', sym: '!', color: '#60a5fa' },
  best: { label: 'Best', sym: '★', color: '#34d399' },
  excellent: { label: 'Excellent', sym: '👍', color: '#6ee7b7' },
  good: { label: 'Good', sym: '✓', color: '#a3e635' },
  book: { label: 'Book', sym: '📖', color: '#c4a484' },
  inaccuracy: { label: 'Inaccuracy', sym: '?!', color: '#facc15' },
  mistake: { label: 'Mistake', sym: '?', color: '#fb923c' },
  miss: { label: 'Miss', sym: '✗', color: '#f472b6' },
  blunder: { label: 'Blunder', sym: '??', color: '#f43f5e' },
};
export const CLASS_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
// text-safe symbols for badges
export const BADGE = { brilliant: '!!', great: '!', best: '★', excellent: '👍', good: '✓', book: 'B', inaccuracy: '?!', mistake: '?', miss: '×', blunder: '??' };

/** Is `move` (chess.js verbose, played from `before`) a real sacrifice? */
function isSacrifice(before, move) {
  const g = new Chess(before);
  g.move(move.san);
  const opp = g.turn();
  const val = VALUE[move.piece] || 0;
  const got = move.captured ? VALUE[move.captured] : 0;
  if (val - got < 2) return false; // an exchange, not a sac
  if (move.piece === 'p') return false;
  // is the moved piece now attackable by something cheaper, or undefended and attacked?
  const attackers = g.moves({ verbose: true }).filter(m => m.to === move.to && m.captured);
  if (!attackers.length) return false;
  const cheapest = Math.min(...attackers.map(m => VALUE[m.piece] || 0));
  return cheapest < val || !defended(g, move.to, move.color);
}

function defended(g, sq, color) {
  // flip side to move and ask whether `color` could recapture on sq
  const parts = g.fen().split(' ');
  parts[1] = color;
  parts[3] = '-';
  try {
    const h = new Chess(parts.join(' '));
    const piece = h.get(sq);
    h.remove(sq);
    h.put({ type: 'p', color: color === 'w' ? 'b' : 'w' }, sq);
    return h.moves({ verbose: true }).some(m => m.to === sq);
  } catch { return false; }
}

/**
 * Classify every move. positions[i] = { fen, lines: [best, second] } for the position before move
 * i (lines from White's side, as the engine gives them); positions[n] is the final position.
 * moves[i] = chess.js verbose move. book = Set of position keys that are known openings.
 */
export function classifyGame(positions, moves, isBook = () => false) {
  const out = [];
  let prevDrop = 0;
  for (let i = 0; i < moves.length; i++) {
    const before = positions[i], after = positions[i + 1];
    const white = moves[i].color === 'w';
    const pov = (cp) => (white ? cp : -cp);
    const bestCp = pov(cpOf(before.lines[0]));
    const secondCp = before.lines[1] ? pov(cpOf(before.lines[1])) : null;
    const afterCp = pov(after.terminal != null ? after.terminal : cpOf(after.lines[0]));
    const wBest = winPct(bestCp), wAfter = winPct(afterCp);
    const drop = Math.max(0, wBest - wAfter);
    const playedUci = moves[i].from + moves[i].to + (moves[i].promotion || '');
    const isBest = before.lines[0]?.pv?.[0] === playedUci || drop <= 0.5;
    let cls;
    if (isBest) cls = 'best';
    else if (drop <= 2) cls = 'excellent';
    else if (drop <= 5) cls = 'good';
    else if (drop <= 10) cls = 'inaccuracy';
    else if (drop <= 20) cls = 'mistake';
    else cls = 'blunder';
    // a missed punishment: he just blundered, you had a big edge and gave much of it back
    if ((cls === 'mistake' || cls === 'inaccuracy' || cls === 'blunder') && prevDrop >= 20 && wBest >= 70 && drop >= 10 && cls !== 'blunder') cls = 'miss';
    if (cls === 'best') {
      if (secondCp != null && winPct(bestCp) - winPct(secondCp) >= 10 && wBest < 97 && wBest > 20) cls = 'great';
      try { if (wBest < 90 && wAfter >= 45 && isSacrifice(before.fen, moves[i])) cls = 'brilliant'; } catch { /* ignore */ }
    }
    if (isBook(after.fen) && drop <= 5 && i < 30) cls = 'book';
    out.push({ cls, drop, acc: moveAccuracy(drop), wBest, wAfter, bestUci: before.lines[0]?.pv?.[0], bestLine: before.lines[0]?.pv || [], afterLine: after.lines[0]?.pv || [] });
    prevDrop = drop;
  }
  return out;
}

/** Game accuracy for one side (Lichess method, simplified). */
export function gameAccuracy(classified, positions, color) {
  const idx = classified.map((c, i) => i).filter(i => (i % 2 === 0) === (positions[0].fen.split(' ')[1] === color));
  if (!idx.length) return null;
  const wins = positions.map(p => winPct(p.terminal != null ? p.terminal : cpOf(p.lines[0])));
  const window = Math.max(2, Math.min(8, Math.floor(positions.length / 10)));
  const weights = idx.map(i => {
    const seg = wins.slice(Math.max(0, i - window), i + window + 1);
    const m = seg.reduce((a, b) => a + b, 0) / seg.length;
    const sd = Math.sqrt(seg.reduce((a, b) => a + (b - m) ** 2, 0) / seg.length);
    return Math.max(0.5, Math.min(12, sd));
  });
  const accs = idx.map(i => classified[i].acc);
  const wmean = accs.reduce((a, x, k) => a + x * weights[k], 0) / weights.reduce((a, b) => a + b, 0);
  const hmean = accs.length / accs.reduce((a, x) => a + 1 / Math.max(1, x), 0);
  return Math.round((wmean + hmean) / 2 * 10) / 10;
}

/** A rough playing strength from accuracy (for a feel, not a rating). */
export function ratingFromAccuracy(acc) {
  if (acc == null) return null;
  const pts = [[40, 300], [55, 700], [65, 1000], [72, 1300], [78, 1600], [84, 1900], [89, 2200], [93, 2500], [96, 2800], [99, 3100]];
  if (acc <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) {
    if (acc <= pts[k][0]) {
      const [a0, r0] = pts[k - 1], [a1, r1] = pts[k];
      return Math.round((r0 + ((acc - a0) / (a1 - a0)) * (r1 - r0)) / 50) * 50;
    }
  }
  return 3100;
}

export function counts(classified, color, firstColor) {
  const c = Object.fromEntries(CLASS_ORDER.map(k => [k, 0]));
  classified.forEach((m, i) => { const mover = (i % 2 === 0) === (firstColor === 'w') ? 'w' : 'b'; if (mover === color) c[m.cls]++; });
  return c;
}

/** Game phase of a position for insights: opening (≤ move 10 or book), endgame (little material), else middlegame. */
export function phaseOf(fen, ply) {
  let mat = 0, queens = 0;
  for (const ch of fen.split(' ')[0]) {
    const t = ch.toLowerCase();
    if ('nbrq'.includes(t)) mat += VALUE[t];
    if (t === 'q') queens++;
  }
  if (mat <= 26 || (queens === 0 && mat <= 30)) return 'endgame';
  if (ply < 20) return 'opening';
  return 'middlegame';
}
