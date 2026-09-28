/**
 * Walk through an engine line one move at a time, slowly, with the reason for each move.
 * Used by Review ("show me the best line", "what happens after my move") and by the coach in Play.
 *
 * The host keeps `walk` state ({ title, fen, pv, you, score }) and renders the board from
 * walkBoard(walk); <WalkPanel> is the panel with the controls and the explanations.
 */
import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { motifOf, explainMove, lineGain } from '../lib/coach.js';
import { fmtScore } from './kit.jsx';

const MAX = 8;
const worth = (g) => (g >= 8 ? 'the queen' : g >= 4.5 ? 'a rook' : g >= 2.5 ? 'a piece' : g >= 1.5 ? 'two pawns' : 'a pawn');

/** Steps of a line: [{ before, after, move, note }] (up to MAX plies). */
export function walkSteps(fen, pv, prevUci = null) {
  const g = new Chess(fen);
  const out = [];
  let prev = prevUci;
  for (const u of pv.slice(0, MAX)) {
    const before = g.fen();
    let m;
    try { m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; }
    let note = motifOf(before, u, prev);
    if (!note || /is a check that gains time/.test(note)) {
      const ex = explainMove(before, u, { cls: 'best', prevUci: prev });
      note = ex.points[0] ? `${m.san}: ${ex.points[0].charAt(0).toLowerCase()}${ex.points[0].slice(1)}` : note || (m.captured ? `${m.san} takes the ${({ p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' })[m.captured]}.` : `${m.san}.`);
    }
    if (g.isCheckmate()) note = `${m.san} is checkmate.`;
    out.push({ before, after: g.fen(), move: m, note });
    prev = u;
  }
  return out;
}

export function walkBoard(walk, i) {
  if (!walk) return null;
  const steps = walk.steps;
  const fen = i === 0 ? walk.fen : steps[i - 1].after;
  const next = steps[i];
  return {
    fen,
    lastMove: i > 0 ? steps[i - 1].move : null,
    arrows: next ? [{ from: next.move.from, to: next.move.to, color: 'rgba(16,185,129,.55)' }] : [],
  };
}

/** Build a walk. you: 'w'|'b'|null (whose point of view the summary takes). */
export function makeWalk({ title, fen, pv, you = null, score = null, prevUci = null }) {
  return { title, fen, pv, you, score, steps: walkSteps(fen, pv, prevUci) };
}

export function WalkPanel({ walk, i, setI, onClose }) {
  const [auto, setAuto] = useState(false);
  const n = walk.steps.length;
  useEffect(() => {
    if (!auto) return undefined;
    if (i >= n) { setAuto(false); return undefined; }
    const t = setTimeout(() => setI(i + 1), i === 0 ? 700 : 2200);
    return () => clearTimeout(t);
  }, [auto, i, n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); setI(Math.min(n, i + 1)); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); setI(Math.max(0, i - 1)); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  });
  const summary = useMemo(() => {
    if (!walk.you || !n) return null;
    const gain = lineGain(walk.fen, walk.pv.slice(0, n), walk.you, n);
    if (gain.mate) return 'The line ends in checkmate.';
    if (gain.gain >= 1) return `By the end you are up ${worth(gain.gain)}.`;
    if (gain.gain <= -1) return `By the end you are down ${worth(-gain.gain)}.`;
    return 'Material stays level; the gain is in the position (activity, king safety, structure).';
  }, [walk, n]);
  const who = (m) => (walk.you ? (m.color === walk.you ? 'You' : 'They') : m.color === 'w' ? 'White' : 'Black');
  const moveNo = (st) => { const [, t, , , , full] = st.before.split(' '); return `${full}${t === 'w' ? '.' : '…'}`; };
  return (
    <div className="panel panel-pad space-y-3 fade-up !border-emerald-700/50">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="h-sec !text-emerald-300">Step through</div>
          <div className="font-semibold text-white leading-tight">{walk.title}</div>
        </div>
        <button className="btn btn-sm shrink-0" onClick={onClose}>Done</button>
      </div>
      <div className="min-h-[76px]">
        {i === 0 ? (
          <p className="text-sm text-ink-200">Starting position. Press ▶ to see the first move{n > 1 ? ` (${n} moves in all)` : ''}. The green arrow shows what comes next.</p>
        ) : (
          <div key={i} className="fade-up">
            <div className="text-xs text-ink-400 mb-0.5">Move {i} of {n} · {who(walk.steps[i - 1].move)}</div>
            <p className="text-[15px] text-white leading-snug"><b>{moveNo(walk.steps[i - 1])} {walk.steps[i - 1].move.san}</b> {walk.steps[i - 1].note.startsWith(walk.steps[i - 1].move.san) ? walk.steps[i - 1].note.slice(walk.steps[i - 1].move.san.length).replace(/^[:\s]+/, '— ') : `— ${walk.steps[i - 1].note}`}</p>
            {i === n && (summary || walk.score) && <p className="text-sm text-emerald-200 mt-2">{summary}{walk.score ? ` Stockfish: ${fmtScore(walk.score, walk.you || 'w')}.` : ''}</p>}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {walk.steps.map((st, k) => (
          <button key={k} onClick={() => setI(k + 1)} className={`px-2 py-1 rounded-md text-sm font-semibold ${k + 1 === i ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/60' : k + 1 < i ? 'text-ink-100' : 'text-ink-400'}`}>
            {st.move.color === 'w' || k === 0 ? `${moveNo(st)} ` : ''}{st.move.san}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button className="ibtn !w-auto" onClick={() => { setAuto(false); setI(0); }} disabled={i === 0} aria-label="Back to the start">⏮</button>
        <button className="ibtn !w-auto" onClick={() => { setAuto(false); setI(Math.max(0, i - 1)); }} disabled={i === 0} aria-label="Previous">◀</button>
        <button className="ibtn !w-auto" onClick={() => { setAuto(false); setI(Math.min(n, i + 1)); }} disabled={i >= n} aria-label="Next">▶</button>
        <button className={`ibtn !w-auto ${auto ? '!border-emerald-500 !text-emerald-300' : ''}`} onClick={() => { if (i >= n) setI(0); setAuto(a => !a); }} aria-label="Play slowly">{auto ? '❚❚' : '▶▶'}</button>
      </div>
      <p className="text-[11px] text-ink-400">▶▶ plays it slowly, one move every two seconds. Arrow keys work too.</p>
    </div>
  );
}
