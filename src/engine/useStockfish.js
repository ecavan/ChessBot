import { useState, useEffect, useRef, useCallback } from 'react';

export function useStockfish() {
  const workerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [bestMove, setBestMove] = useState(null);
  const [topLines, setTopLines] = useState([]);
  const resolveRef = useRef(null);
  const latestEvalRef = useRef(null);
  const readyCallbackRef = useRef(null);
  const pendingAnalyzeRef = useRef(false);

  useEffect(() => {
    const worker = new Worker('/stockfish/stockfish-17.1-lite-single-03e3232.js');
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);

      if (line === 'uciok') {
        setIsReady(true);
      }

      if (line === 'readyok') {
        if (readyCallbackRef.current) {
          const cb = readyCallbackRef.current;
          readyCallbackRef.current = null;
          cb();
        }
      }

      if (line.startsWith('info depth')) {
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const pvMatch = line.match(/ pv (.+)/);
        const multiPvMatch = line.match(/multipv (\d+)/);
        const depthMatch = line.match(/^info depth (\d+)/);

        const pvIndex = multiPvMatch ? parseInt(multiPvMatch[1]) - 1 : 0;
        const depth = depthMatch ? parseInt(depthMatch[1]) : 0;

        if ((cpMatch || mateMatch) && depth >= 4) {
          const evalValue = cpMatch
            ? parseInt(cpMatch[1]) / 100
            : (parseInt(mateMatch[1]) > 0 ? 100 : -100);
          const pv = pvMatch ? pvMatch[1].split(' ') : [];

          setTopLines((prev) => {
            const updated = [...prev];
            updated[pvIndex] = { eval: evalValue, moves: pv, depth };
            return updated;
          });

          if (pvIndex === 0) {
            latestEvalRef.current = evalValue;
          }
        }
      }

      if (line.startsWith('bestmove')) {
        const move = line.split(' ')[1];
        setBestMove(move);
        if (pendingAnalyzeRef.current) {
          setEvaluation(latestEvalRef.current);
          pendingAnalyzeRef.current = false;
        }
        if (resolveRef.current) {
          resolveRef.current({ move, eval: latestEvalRef.current });
          resolveRef.current = null;
        }
      }
    };

    worker.onerror = (err) => {
      console.error('Stockfish worker error:', err);
    };

    worker.postMessage('uci');
    worker.postMessage('isready');

    return () => worker.terminate();
  }, []);

  const analyze = useCallback((fen, depth = 12) => {
    const w = workerRef.current;
    if (!w) return;
    // Cancel any pending getBestMove — stale bestmove from stop would resolve it incorrectly
    if (resolveRef.current) {
      resolveRef.current(null);
      resolveRef.current = null;
    }
    readyCallbackRef.current = null;
    pendingAnalyzeRef.current = true;
    setTopLines([]);
    setBestMove(null);
    w.postMessage('stop');
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go depth ${depth}`);
  }, []);

  const getBestMove = useCallback((fen, depth = 12) => {
    return new Promise((resolve) => {
      const w = workerRef.current;
      if (!w) { resolve(null); return; }

      // Cancel any pending resolve so the stale bestmove from 'stop' doesn't interfere
      if (resolveRef.current) {
        resolveRef.current(null);
        resolveRef.current = null;
      }

      pendingAnalyzeRef.current = false;
      setTopLines([]);
      setBestMove(null);
      w.postMessage('stop');

      // Use isready as a fence: Stockfish processes commands in order,
      // so readyok arrives AFTER the stale bestmove from stop is emitted.
      // By the time readyok fires, resolveRef is still null, so the stale
      // bestmove was harmlessly ignored. Now we set the real resolve and start.
      readyCallbackRef.current = () => {
        resolveRef.current = resolve;
        w.postMessage(`position fen ${fen}`);
        w.postMessage(`go depth ${depth}`);
      };
      w.postMessage('isready');
    });
  }, []);

  const setSkillLevel = useCallback((level) => {
    workerRef.current?.postMessage(`setoption name Skill Level value ${level}`);
  }, []);

  const setMultiPV = useCallback((n) => {
    workerRef.current?.postMessage(`setoption name MultiPV value ${n}`);
  }, []);

  const newGame = useCallback(() => {
    const w = workerRef.current;
    if (!w) return;
    if (resolveRef.current) {
      resolveRef.current(null);
      resolveRef.current = null;
    }
    readyCallbackRef.current = null;
    pendingAnalyzeRef.current = false;
    w.postMessage('stop');
    w.postMessage('ucinewgame');
    w.postMessage('isready');
    setEvaluation(null);
    setBestMove(null);
    setTopLines([]);
    latestEvalRef.current = null;
  }, []);

  const stop = useCallback(() => {
    workerRef.current?.postMessage('stop');
  }, []);

  return {
    isReady, evaluation, bestMove, topLines,
    analyze, getBestMove, setSkillLevel, setMultiPV, newGame, stop,
  };
}
