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
 *   Best        the engine's first choice, and only that
 *   Great       the first choice when it is the only good move (the second-best gives up 8 points
 *               or more) and it punishes the opponent's error
 *   Brilliant   a sound sacrifice (best or within 3%), in a position that isn't already won: the
 *               engine's line after it takes material and you don't simply take it back
 *   Miss        the opponent had just gone wrong and you let it go with a mistake of your own; or
 *               you had a forced mate and played a move that lets it go
 *   Book        a known opening position (and nothing better was missed)
 *   The cuts, the eval scale and the Best / Great / Miss rules were set against chess.com's own
 *   Game Review, move by move, on 13 games (scripts/qa/cc-moves/): 64% of moves get the same label,
 *   93% land in the same band (fine / inaccuracy / mistake-or-worse). Most of the rest is Best
 *   against Excellent, where the two engines simply prefer different first moves.
 *
 * Accuracy (moveAccuracy, gameAccuracy below) is fitted to chess.com's numbers.
 */
import { Chess } from 'chess.js';
import { VALUE } from './chessutil.js';

export const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

/**
 * Winning chances the way chess.com's Game Review grades moves, from a Stockfish 17 evaluation.
 *
 * Two things were measured on 13 of chess.com's own reviews, move by move (scripts/qa/cc-moves/):
 * its evaluations run larger than Stockfish 17's once a side is clearly better (+2.7 here reads
 * about +4.5 there, +4.5 about +8.2, and it stops near +12), and its labels follow the win chance
 * lost under 100 / (1 + e^(−0.003 × its centipawns)) with cuts near 3, 6, 10 and 22 points
 * (CUTS below). CC_SCALE is that eval-to-eval table; clsWin composes the two.
 */
const CC_SCALE = [[0, 0], [25, 20], [70, 70], [120, 137], [170, 217], [230, 333], [270, 451], [340, 669], [445, 818], [525, 891], [720, 991], [855, 1115], [1010, 1180], [2000, 1300]];
export function ccEval(cp) {
  const x = Math.abs(cp);
  let i = 0;
  while (i < CC_SCALE.length - 2 && CC_SCALE[i + 1][0] <= x) i++;
  const [x0, y0] = CC_SCALE[i], [x1, y1] = CC_SCALE[i + 1];
  return Math.sign(cp) * Math.min(1300, y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
}
export const clsWin = (cp) => 100 / (1 + Math.exp(-0.003 * ccEval(cp)));
/** Win chance lost, in points: at most this much is Excellent, Good, an Inaccuracy, a Mistake; more is a Blunder. */
export const CUTS = { excellent: 3, good: 6, inaccuracy: 10, mistake: 22 };

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
// refitted on 220 player-games across ratings 100-2100 (scripts/qa/fit-accuracy.py): mean error 3.4 points, no lean
const ACC = { k: 0.0026, a: 0.04691, p: 1.55307, q: 0.41275 };
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
  let prevDrop = 0, prevBase = 50;
  for (let i = 0; i < moves.length; i++) {
    const before = positions[i], after = positions[i + 1];
    const white = moves[i].color === 'w';
    const pov = (cp) => (white ? cp : -cp);
    const bestCp = pov(cpOf(before.lines[0]));
    const playedUci = moves[i].from + moves[i].to + (moves[i].promotion || '');
    // The eval after the move: from the same search as the best move when the move was one of its
    // two lines (so a near-best move isn't marked down by jitter between two different searches),
    // otherwise from the next position's search.
    let afterCp, source;
    if (after.terminal != null) { afterCp = pov(after.terminal); source = 'terminal'; }
    else if (before.lines[0]?.pv?.[0] === playedUci) { afterCp = bestCp; source = 'pv1'; }
    else if (before.lines[1]?.pv?.[0] === playedUci) { afterCp = pov(cpOf(before.lines[1])); source = 'pv2'; }
    else { afterCp = pov(cpOf(after.lines[0])); source = 'next'; }
    const wBest = clsWin(bestCp), wAfter = clsWin(afterCp);
    const drop = Math.max(0, wBest - wAfter);
    // Best is the engine's first choice and nothing else, as on chess.com: a move that scores the
    // same but isn't it is Excellent
    const isBest = before.lines[0]?.pv?.[0] === playedUci;
    let cls;
    if (isBest) cls = 'best';
    else if (drop <= CUTS.excellent) cls = 'excellent';
    else if (drop <= CUTS.good) cls = 'good';
    else if (drop <= CUTS.inaccuracy) cls = 'inaccuracy';
    else if (drop <= CUTS.mistake) cls = 'mistake';
    else cls = 'blunder';
    // a forced mate let go: you had mate on the board and played something else
    const hadMate = pov(before.lines[0]?.mate ?? 0) > 0;
    const keptMate = after.terminal != null ? pov(after.terminal) > 0 : source === 'pv1' ? true : source === 'pv2' ? pov(before.lines[1]?.mate ?? 0) > 0 : pov(after.lines[0]?.mate ?? 0) > 0;
    if (hadMate && !keptMate && cls !== 'best') cls = 'miss';
    // a slower mate is still a mate: never a mistake or blunder
    if (hadMate && keptMate && (cls === 'mistake' || cls === 'blunder' || cls === 'inaccuracy')) cls = 'good';
    // Miss, chess.com's way: he had just gone wrong (an inaccuracy's worth or more) and you let it
    // go with a mistake of your own, without ending up clearly worse than before he erred. Ending
    // up worse than that is your own Mistake or Blunder.
    if ((cls === 'mistake' || cls === 'blunder') && prevDrop >= CUTS.inaccuracy && wAfter >= prevBase - 10) cls = 'miss';
    // Great: the engine's first choice when it is the only good move (the second-best gives up 8
    // points or more) and it punishes his error. The only legal move doesn't count.
    if (cls === 'best' && prevDrop >= CUTS.inaccuracy && before.lines[1]?.pv?.length) {
      const gap = wBest - clsWin(pov(cpOf(before.lines[1])));
      if (gap >= 8) cls = 'great';
    }
    // a sound sacrifice, played when the game wasn't already won: the best move or close to it
    if (drop <= 3 && wBest < 90 && wAfter >= 45) { try { if (isSacrifice(before.fen, moves[i], after.lines?.[0]?.pv)) cls = 'brilliant'; } catch { /* ignore */ } }
    if (isBook(after.fen) && drop <= 5 && i < 30) cls = 'book';
    out.push({ cls, drop, acc: moveAccuracy(bestCp, afterCp), wBest, wAfter, cpBest: bestCp, cpAfter: afterCp, source, bestUci: before.lines[0]?.pv?.[0], bestLine: before.lines[0]?.pv || [], afterLine: after.lines[0]?.pv || [], mateIn: hadMate ? pov(before.lines[0].mate) : null });
    prevBase = 100 - wBest; // the next mover's chances before this move: what a Miss is measured against
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
 * Game rating, the way chess.com's Game Review gives it: the player's own rating, moved by the
 * accuracy. Measured on 48 player-games of chess.com's own reviews (scripts/qa/cc-moves/): for
 * blitz games between ~290-rated players it gives 100-150 below 60 accuracy, the player's rating
 * at about 64, +450 at 72, +650 at 85 and +770 at 93 (mean error against chess.com on those: 40
 * points). Daily games are held to a higher standard, about 8 accuracy points (seven daily
 * games: thinner evidence). It does not look at the opponent.
 *
 *   gameRating(acc, { rating, timeClass })
 * `rating`: the player's rating in that game; for a bot game, your rating against the bots.
 * Without one it assumes 300, the pool the curve was measured in.
 */
const GR_DELTA = [[40, -770], [45, -620], [50, -470], [55, -320], [60, -170], [62.5, -40], [65, 5], [67.5, 130], [70, 200], [72.5, 455], [75, 485], [80, 565], [85, 640], [90, 760], [100, 800]];
export function gameRating(acc, { rating = null, timeClass = null } = {}) {
  if (acc == null) return null;
  const a = acc - (timeClass === 'daily' ? 8 : 0);
  const T = GR_DELTA;
  let d;
  if (a <= T[0][0]) d = T[0][1];
  else if (a >= T[T.length - 1][0]) d = T[T.length - 1][1];
  else { let i = 0; while (T[i + 1][0] < a) i++; d = T[i][1] + ((a - T[i][0]) / (T[i + 1][0] - T[i][0])) * (T[i + 1][1] - T[i][1]); }
  return Math.max(100, Math.round(((rating ?? 300) + d) / 50) * 50);
}
/** A game rating against chess.com's own: off by about this much on average (blitz). */
export const GAME_RATING_MAE = 150;

/** Your level from recent game ratings: their average, rounded (null with fewer than 3). */
export function levelFrom(ratings) {
  return levelStats(ratings)?.level ?? null;
}

/** Your level with a rough ±: the average of the game ratings and their spread over √n. Null with fewer than 3. */
export function levelStats(ratings) {
  const r = ratings.filter(x => x != null);
  if (r.length < 3) return null;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1));
  return { level: Math.round(mean / 50) * 50, se: Math.max(20, Math.round(sd / Math.sqrt(r.length) / 10) * 10), n: r.length };
}

export function counts(classified, color, firstColor) {
  const c = Object.fromEntries(CLASS_ORDER.map(k => [k, 0]));
  classified.forEach((m, i) => { const mover = (i % 2 === 0) === (firstColor === 'w') ? 'w' : 'b'; if (mover === color) c[m.cls]++; });
  return c;
}

/**
 * How each side played each phase: { opening, middlegame, endgame } → { w, b } with { acc, n, grade },
 * or null for a side with fewer than 2 moves in that phase. The accuracy is the game accuracy's own
 * mean, over that phase's moves; the grade is the move class that accuracy reads as.
 */
export const PHASES = ['opening', 'middlegame', 'endgame'];
export const phaseGrade = (acc) => (acc >= 90 ? 'best' : acc >= 80 ? 'excellent' : acc >= 70 ? 'good' : acc >= 55 ? 'inaccuracy' : acc >= 40 ? 'mistake' : 'blunder');
export function phaseAccuracy(classified, fens) {
  const out = Object.fromEntries(PHASES.map(p => [p, { w: [], b: [] }]));
  classified.forEach((c, i) => {
    const [, side, , , , full] = fens[i].split(' ');
    out[phaseOf(fens[i], (Number(full) - 1) * 2 + (side === 'b' ? 1 : 0))][side].push(Math.max(1, c.acc));
  });
  const mean = (a) => (a.length < 2 ? null : (() => { const acc = Math.round(((a.reduce((s, x) => s + x ** ACC.q, 0) / a.length) ** (1 / ACC.q)) * 10) / 10; return { acc, n: a.length, grade: phaseGrade(acc) }; })());
  return Object.fromEntries(PHASES.map(p => [p, { w: mean(out[p].w), b: mean(out[p].b) }]));
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
