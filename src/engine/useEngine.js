/** React hooks around the shared engine. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { engine } from './engine.js';

export function useEngineStatus() {
  return useSyncExternalStore((f) => engine.subscribe(() => f()), () => engine.status);
}

/** A live line is shown only once this deep, and once its first move has held for `STEADY` depths. */
const MIN_DEPTH = 12;
const STEADY = 2;

/**
 * Live analysis of `fen` while `on`: the lines update as the search deepens, but only once they
 * have settled, so the arrow and the eval don't wiggle through the shallow depths: a line is
 * published at depth 12 or more, when its first move has been the same for the last two depths
 * (or when the search ends). Until then the previous settled lines stay, with `depth` ticking
 * and `settling: true`. Searches `movetime` ms (default 4 s), then stops; changing fen restarts.
 */
export function useLiveEval(fen, { on = true, multipv = 1, movetime = 4000, tag = 'eval', steady = true } = {}) {
  const [state, setState] = useState({ fen: null, lines: [], done: false, depth: 0, settling: false });
  const cur = useRef(null);
  useEffect(() => {
    if (!on || !fen) { setState({ fen: null, lines: [], done: false, depth: 0, settling: false }); return undefined; }
    let alive = true;
    cur.current = fen;
    setState(s => ({ fen, lines: s.fen === fen ? s.lines : [], done: false, depth: 0, settling: true }));
    const firsts = []; // the first move of line 1 at each depth seen
    const t = setTimeout(() => {
      engine.search({
        fen, movetime, multipv, tag, preempt: true,
        onInfo: (lines) => {
          if (!alive || cur.current !== fen) return;
          const top = lines[0];
          const depth = top?.depth || 0;
          if (top?.pv?.[0] && firsts[firsts.length - 1]?.depth !== depth) firsts.push({ depth, move: top.pv[0] });
          const recent = firsts.slice(-STEADY);
          const settled = !steady || (depth >= MIN_DEPTH && recent.length === STEADY && recent.every(f => f.move === recent[0].move));
          setState(s => (settled
            ? { fen, lines: lines.map(l => ({ ...l })), done: false, depth, settling: false }
            : { ...s, fen, depth, settling: true }));
        },
      }).then((r) => { if (alive && r && cur.current === fen) setState({ fen, lines: r.lines, done: true, depth: r.lines[0]?.depth || 0, settling: false }); });
    }, 80);
    return () => { alive = false; clearTimeout(t); engine.cancel([tag]); };
  }, [fen, on, multipv, movetime, tag, steady]);
  return state.fen === fen ? state : { fen, lines: [], done: false, depth: 0, settling: true };
}
