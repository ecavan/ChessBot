/**
 * The coach's questions to Stockfish: judge a move, find the opponent's threat, suggest a plan.
 * Each runs a couple of short searches (tag 'coach', so a bot move pre-empts them) and hands the
 * facts to coach.js for the words.
 */
import { Chess } from 'chess.js';
import { engine } from '../engine/engine.js';
import { explainMove, describeThreat, planIdeas, nullFen } from './coach.js';
import { winPct, cpOf } from './review.js';

const search = (fen, ms, multipv = 1) => engine.search({ fen, movetime: ms, multipv, tag: 'coach', stops: ['eval'] });

function classify(drop, isBest, wBest, secondGap) {
  if (isBest) return secondGap >= 10 && wBest < 97 && wBest > 20 ? 'great' : 'best';
  if (drop <= 2) return 'excellent';
  if (drop <= 5) return 'good';
  if (drop <= 10) return 'inaccuracy';
  if (drop <= 20) return 'mistake';
  return 'blunder';
}

/**
 * Judge `uci` played from `fen`. before: optional engine result for `fen` ({ lines }).
 * Returns { cls, drop, wBefore, wAfter, bestUci, explanation: { headline, points, arrows } } or null.
 */
export async function judgeMove(fen, uci, before = null, ms = 700) {
  const g = new Chess(fen);
  const me = g.turn();
  let m;
  try { m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch { return null; }
  const b = before?.lines?.length >= 2 ? before : await search(fen, ms, 2);
  if (!b?.lines?.length) return null;
  const sgn = me === 'w' ? 1 : -1;
  let afterLines = [], wAfter;
  if (g.isCheckmate()) wAfter = 100;
  else if (g.isDraw()) wAfter = 50;
  else {
    const a = await search(g.fen(), ms);
    if (!a?.lines?.length) return null;
    afterLines = a.lines;
    wAfter = winPct(sgn * cpOf(a.lines[0]));
  }
  const wBest = winPct(sgn * cpOf(b.lines[0]));
  const second = b.lines[1] ? winPct(sgn * cpOf(b.lines[1])) : wBest;
  const bestUci = b.lines[0].pv?.[0];
  const drop = Math.max(0, wBest - wAfter);
  const isBest = bestUci === uci || drop <= 0.5;
  const cls = classify(drop, isBest, wBest, wBest - second);
  const explanation = explainMove(fen, uci, {
    cls, drop, bestUci, bestLine: b.lines[0].pv || [], afterLine: afterLines[0]?.pv || [],
    afterMate: afterLines[0]?.mate != null && afterLines[0].mate * sgn < 0,
  });
  return { cls, drop, wBefore: wBest, wAfter, bestUci, san: m.san, explanation, bestLine: b.lines[0].pv || [], afterLine: afterLines[0]?.pv || [], uci, bestScore: b.lines[0], afterScore: afterLines[0] || null };
}

/** What does the side NOT to move threaten? (a "null move" search). */
export async function threatNow(fen, current = null) {
  const nf = nullFen(fen);
  if (!nf) return null;
  const them = nf.split(' ')[1];
  const sgn = them === 'w' ? 1 : -1;
  const cur = current?.lines?.[0] ? current : await search(fen, 450);
  const t = await search(nf, 650);
  if (!cur?.lines?.[0] || !t?.lines?.[0]?.pv?.length) return null;
  const gain = sgn * (cpOf(t.lines[0]) - cpOf(cur.lines[0]));
  return describeThreat(fen, t.lines[0].pv, gain);
}

/** Plan ideas for `color` (default: side to move). */
export async function planNow(fen, color = null) {
  const side = color || fen.split(' ')[1];
  let pv = [];
  if (side === fen.split(' ')[1]) {
    const r = await search(fen, 1500);
    pv = r?.lines?.[0]?.pv || [];
  } else {
    const nf = nullFen(fen);
    if (nf) { const r = await search(nf, 1500); return planIdeas(nf, side, r?.lines?.[0]?.pv || []); }
  }
  return planIdeas(fen, side, pv);
}
