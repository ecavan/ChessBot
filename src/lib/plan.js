/**
 * This week's plan: the one kind of mistake that costs you most in your recent games, the Basics
 * lesson that fixes it, and whether it is happening less since you started.
 *
 * Every mistake, miss and blunder of yours in a reviewed game is put in one category:
 *   - what he could do after it (Stockfish's reply): take a piece you left loose → Free pieces;
 *     fork, pin, skewer, discovered attack or mate → Blunder check (you missed his threat);
 *   - otherwise what you missed (Stockfish's move): a fork → Forks, a pin → Pins, … a mate → Mate in
 *     one, a free piece → Free pieces.
 * Mistakes that fit none (positional, or a long line) aren't counted.
 */
import { motifOf } from './coach.js';
import { load, save } from './store.js';
import { lessonById } from '../data/lessons.js';

const KEY = 'chess.plan.v1';
const WEEK = 7 * 86400000;
const BAD = new Set(['mistake', 'miss', 'blunder']);

/** What a motif sentence (coach.js) is about, as a lesson id. */
function lessonOfMotif(t) {
  if (!t) return null;
  if (/checkmate/.test(t)) return 'mate1';
  if (/forks/.test(t)) return 'fork';
  if (/pins/.test(t)) return 'pin';
  if (/skewers/.test(t)) return 'skewer';
  if (/uncovers/.test(t)) return 'discovered';
  if (/left undefended|wins material/.test(t)) return 'hanging';
  return null;
}

/** Category (lesson id) of your move i in a classified game, or null. */
export function mistakeKind(c, i) {
  const x = c.cls[i];
  if (!BAD.has(x.cls)) return null;
  const uci = c.moves[i].from + c.moves[i].to + (c.moves[i].promotion || '');
  // what his best reply does
  const reply = c.positions[i + 1]?.lines?.[0]?.pv?.[0];
  if (reply) {
    const k = lessonOfMotif(motifOf(c.fens[i + 1], reply, uci));
    if (k === 'hanging') return 'hanging';
    if (k) return 'defend';
  }
  // what you missed
  if (x.bestUci) {
    const k = lessonOfMotif(motifOf(c.fens[i], x.bestUci, i > 0 ? c.moves[i - 1].from + c.moves[i - 1].to : null));
    if (k) return k;
  }
  return null;
}

/** The rows weeklyPlan needs, from saved summaries (summary.kinds): your reviewed games, oldest first. */
export function rowsFromGames(games) {
  return games.filter(g => g.you && g.review?.summary?.kinds).map(g => ({ id: g.id, at: g.at, counts: g.review.summary.kinds })).sort((a, b) => a.at - b.at);
}

/** Your mistakes by kind in one classified game ({ fens, moves, positions, cls }). */
export function kindsOf(c, you) {
  const first = c.fens[0].split(' ')[1];
  const out = {};
  c.cls.forEach((_, i) => {
    if (((i % 2 === 0) === (first === 'w') ? 'w' : 'b') !== you) return;
    const k = mistakeKind(c, i);
    if (k) out[k] = (out[k] || 0) + 1;
  });
  return out;
}

const sum = (rows, k) => rows.reduce((a, r) => a + (r.counts[k] || 0), 0);

/** The totals by kind over the last n games, biggest first. */
export function topKinds(rows, n = 20) {
  const last = rows.slice(-n);
  const tot = {};
  for (const r of last) for (const [k, v] of Object.entries(r.counts)) tot[k] = (tot[k] || 0) + v;
  return Object.entries(tot).map(([k, v]) => ({ k, n: v, perGame: v / Math.max(1, last.length), lesson: lessonById(k) })).sort((a, b) => b.n - a.n);
}

/**
 * This week's plan, made (or renewed after a week) from your recent games. Returns null with fewer
 * than 5 reviewed games. { lesson, start, base: per-game rate before, since: { games, rate } }.
 */
export function weeklyPlan(rows, { renew = false } = {}) {
  if (rows.length < 5) return null;
  let plan = load(KEY, null);
  if (!plan || renew || Date.now() - plan.start > WEEK || !lessonById(plan.lesson)) {
    // a renewal picks the next kind if the top one is the same lesson you just had
    const kinds = topKinds(rows);
    if (!kinds.length) return null;
    const pickK = renew && plan && kinds[0].k === plan.lesson && kinds[1] ? kinds[1] : kinds[0];
    const before = rows.slice(-20);
    plan = { lesson: pickK.k, start: Date.now(), base: sum(before, pickK.k) / before.length, baseGames: before.length };
    save(KEY, plan);
  }
  const after = rows.filter(r => r.at >= plan.start);
  return { ...plan, lessonData: lessonById(plan.lesson), since: { games: after.length, rate: after.length ? sum(after, plan.lesson) / after.length : null } };
}
