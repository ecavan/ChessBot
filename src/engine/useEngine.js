/** React hooks around the shared engine. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { engine } from './engine.js';

export function useEngineStatus() {
  return useSyncExternalStore((f) => engine.subscribe(() => f()), () => engine.status);
}

/**
 * Live analysis of `fen` while `on`: lines update as the search deepens.
 * Searches `movetime` ms (default 4 s), then stops; changing fen restarts.
 */
export function useLiveEval(fen, { on = true, multipv = 1, movetime = 4000, tag = 'eval' } = {}) {
  const [state, setState] = useState({ fen: null, lines: [], done: false });
  const cur = useRef(null);
  useEffect(() => {
    if (!on || !fen) { setState({ fen: null, lines: [], done: false }); return undefined; }
    let alive = true;
    cur.current = fen;
    setState(s => ({ fen, lines: s.fen === fen ? s.lines : [], done: false }));
    const t = setTimeout(() => {
      engine.search({
        fen, movetime, multipv, tag, preempt: true,
        onInfo: (lines) => { if (alive && cur.current === fen) setState({ fen, lines: lines.map(l => ({ ...l })), done: false }); },
      }).then((r) => { if (alive && r && cur.current === fen) setState({ fen, lines: r.lines, done: true }); });
    }, 80);
    return () => { alive = false; clearTimeout(t); engine.cancel([tag]); };
  }, [fen, on, multipv, movetime, tag]);
  return state.fen === fen ? state : { fen, lines: [], done: false };
}
