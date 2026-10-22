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
 *   Great       the best move when it punishes the opponent's mistake (his last move cost him
 *               ≥ 15%), or starts a forced mate he allowed
 *   Brilliant   a sound sacrifice (best or within 3%), in a position that isn't already won: the
 *               engine's line after it takes material and you don't simply take it back
 *   Miss        you had a forced mate and played a move that lets it go
 *   Book        a known opening position (and nothing better was missed)
 *   Great, Brilliant and Miss are set to match chess.com's labels on Eli's reviewed games
 *   (scripts/qa/cc-relabel.mjs).
 *
 * Accuracy (moveAccuracy, gameAccuracy below) is fitted to chess.com's numbers.
 */
import { Chess } from 'chess.js';
import { VALUE } from './chessutil.js';
import GAME_RATING from '../data/gameRating.json' with { type: 'json' };

export const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

/** Engine line → centipawns from White's side (mates as ±10000 minus distance). */
export function cpOf(line) {
  if (!line) return 0;
  if (line.mate === 0) return line.cp ?? 0; // a finished game: cp carries who won
  if (line.mate != null) return line.mate > 0 ? 10000 - 10 * line.mate : -10000 - 10 * line.mate;
  return line.cp ?? 0;
}

/**
 * Accuracy uses its own, flatter winning-chances curve, fitted to chess.com's accuracies on 57 of
 * Eli's games (114 sides; scripts/qa/acc-fit.py): off by 3.8 points on average on games left out of
 * the fit. A flatter curve is what chess.com's rating-aware model looks like at club level: a pawn
 * up is a smaller edge when either side can still blunder it back.
 */
const ACC = { k: 0.00195, a: 0.07688, p: 1.32769, q: 0.32082 };
const accWin = (cp) => 100 / (1 + Math.exp(-ACC.k * Math.max(-2000, Math.min(2000, cp))));
/** Accuracy of one move (0–100) from the evaluation with the best move and after the move played. */
export const moveAccuracy = (bestCp, afterCp) => 100 * Math.exp(-ACC.a * Math.max(0, accWin(bestCp) - accWin(afterCp)) ** ACC.p);

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

/** Material on the board from `color`'s side (pawns 1, minors 3, rooks 5, queens 9). */
function material(fen, color) {
  let m = 0;
  for (const ch of fen.split(' ')[0]) {
    const v = VALUE[ch.toLowerCase()];
    if (v) m += (ch === ch.toUpperCase()) === (color === 'w') ? v : -v;
  }
  return m;
}

/**
 * Is `move` (chess.js verbose, played from `before`) a sacrifice? It is when the engine's best line
 * after it (`pv`) starts with the opponent taking material that leaves the mover at least two points
 * down, and the mover doesn't simply take back on that square to come out level. Winning the
 * material back later with a tactic (Bxf7+ Kxf7 Qf4+ and Qxg4) still counts, as on chess.com, and so
 * does leaving a different piece en prise. A trade (Nxd5 exd5 Bxd5) doesn't, and neither does a piece
 * left hanging that the opponent should decline: without the line where he takes it we can't tell
 * a sacrifice from a blunder he ignored.
 */
export function isSacrifice(before, move, pv) {
  if (move.piece === 'p' || move.piece === 'k' || !pv?.length) return false;
  const g = new Chess(before);
  g.move(move.san);
  const start = material(before, move.color);
  const step = (u) => g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  const reply = step(pv[0]);
  if (!reply.captured) return false;
  const afterReply = material(g.fen(), move.color) - start;
  if (afterReply > -2) return false;
  if (!pv[1]) return true;
  const back = step(pv[1]);
  // taking straight back on the same square: a sacrifice only if he's still down (a bishop for two pawns)
  if (back.to === reply.to && back.captured) return material(g.fen(), move.color) - start <= -1;
  return true;
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
    // a forced mate let go: you had mate on the board and played something else
    const hadMate = pov(before.lines[0]?.mate ?? 0) > 0;
    const keptMate = after.terminal != null ? pov(after.terminal) > 0 : pov(after.lines[0]?.mate ?? 0) > 0;
    if (hadMate && !keptMate && cls !== 'best') cls = 'miss';
    // Great: punishing his mistake (his last move cost him 15% or more) or starting the forced mate
    // he allowed, with the best move. The only legal move doesn't count.
    if (drop <= 1 && (prevDrop >= 15 || (hadMate && keptMate && prevDrop >= 5))) {
      let forced = false;
      try { forced = new Chess(before.fen).moves().length <= 1; } catch { /* ignore */ }
      if (!forced) cls = 'great';
    }
    // a sound sacrifice, played when the game wasn't already won: the best move or close to it
    if (drop <= 3 && wBest < 90 && wAfter >= 45) { try { if (isSacrifice(before.fen, moves[i], after.lines?.[0]?.pv)) cls = 'brilliant'; } catch { /* ignore */ } }
    if (isBook(after.fen) && drop <= 5 && i < 30) cls = 'book';
    out.push({ cls, drop, acc: moveAccuracy(bestCp, afterCp), wBest, wAfter, bestUci: before.lines[0]?.pv?.[0], bestLine: before.lines[0]?.pv || [], afterLine: after.lines[0]?.pv || [] });
    prevDrop = drop;
  }
  return out;
}

/**
 * Game accuracy for one side: a power mean (exponent about 1/3) of its move accuracies, book moves
 * included. It sits between the plain average and the harmonic mean, so one blunder costs more than
 * it would in an average but doesn't sink the game.
 */
export function gameAccuracy(classified, positions, color) {
  const firstIsColor = positions[0].fen.split(' ')[1] === color;
  const accs = classified.filter((c, i) => (i % 2 === 0) === firstIsColor).map(c => Math.max(1, c.acc));
  if (!accs.length) return null;
  const m = (accs.reduce((s, x) => s + x ** ACC.q, 0) / accs.length) ** (1 / ACC.q);
  return Math.round(m * 10) / 10;
}

/**
 * Game rating: how strong the play in one game was, from both sides' accuracy and the game's
 * length, on chess.com's rapid scale. Fitted on 17,000 chess.com rapid games where Game Review
 * gave both accuracies (scripts/qa/fit-rating.py), with every rating band weighted the same: it
 * rates the moves, not the player, so it isn't pulled towards your own rating the way chess.com's
 * is. One game is a rough guide (±500 on average): `levelFrom` averages several.
 */
export function gameRating(acc, accOpp, plies) {
  if (acc == null) return null;
  const G = GAME_RATING;
  const pi = G.plies.reduce((b, p, i) => (Math.abs(p - plies) < Math.abs(G.plies[b] - plies) ? i : b), 0);
  const grid = G.grid[pi];
  const at = (axis, v) => {
    const x = Math.max(axis[0], Math.min(axis[axis.length - 1], v));
    let i = 0;
    while (i < axis.length - 2 && axis[i + 1] <= x) i++;
    return [i, (x - axis[i]) / (axis[i + 1] - axis[i])];
  };
  const [ai, af] = at(G.acc, acc);
  const [oi, of] = at(G.opp, accOpp ?? acc);
  const v = (1 - af) * ((1 - of) * grid[ai][oi] + of * grid[ai][oi + 1]) + af * ((1 - of) * grid[ai + 1][oi] + of * grid[ai + 1][oi + 1]);
  return Math.round(v / 50) * 50;
}
export const GAME_RATING_MAE = GAME_RATING.mae;

/** Your level from recent game ratings: their average, rounded (null with fewer than 3). */
export function levelFrom(ratings) {
  const r = ratings.filter(x => x != null);
  if (r.length < 3) return null;
  return Math.round(r.reduce((a, b) => a + b, 0) / r.length / 50) * 50;
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
