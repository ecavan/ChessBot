import { useState, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board';
import EvalBar from '../components/EvalBar';
import ReviewPanel from '../components/ReviewPanel';
import { classifyMove, explainMove } from '../engine/analysis';

function uciToSan(uci, fen) {
  try {
    const game = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = game.move({ from, to, promotion });
    return move ? move.san : uci;
  } catch {
    return uci;
  }
}

export default function ReviewMode({ engine, initialPgn }) {
  const [pgnInput, setPgnInput] = useState(initialPgn || '');
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const displayGameRef = useRef(new Chess());
  const [displayFen, setDisplayFen] = useState(displayGameRef.current.fen());
  const [arrows, setArrows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const cancelRef = useRef(false);

  const analyzeGame = useCallback(async (pgn) => {
    setIsAnalyzing(true);
    setError(null);
    cancelRef.current = false;

    let game;
    try {
      game = new Chess();
      game.loadPgn(pgn);
    } catch {
      setError('Invalid PGN. Please check the format and try again.');
      setIsAnalyzing(false);
      return;
    }

    const moves = game.history({ verbose: true });
    if (moves.length === 0) {
      setError('No moves found in PGN.');
      setIsAnalyzing(false);
      return;
    }

    const results = [];
    const replay = new Chess();

    for (let i = 0; i < moves.length; i++) {
      if (cancelRef.current) break;

      setProgress(Math.round((i / moves.length) * 100));

      const fenBefore = replay.fen();
      const isWhite = replay.turn() === 'w';

      // Get engine eval + best move of position before the move
      const resultBefore = await engine.getBestMove(fenBefore, 12);
      const evalBefore = resultBefore?.eval ?? 0;
      const bestMoveUci = resultBefore?.move ?? '';

      // Make the actual move
      replay.move(moves[i].san);
      const fenAfter = replay.fen();

      // Get engine eval after the move
      const resultAfter = await engine.getBestMove(fenAfter, 12);
      const evalAfter = resultAfter?.eval ?? 0;

      const classification = classifyMove(evalBefore, evalAfter, isWhite);
      const bestMoveSan = uciToSan(bestMoveUci, fenBefore);
      const explanation = explainMove(classification, bestMoveSan);

      results.push({
        moveNumber: Math.floor(i / 2) + 1,
        san: moves[i].san,
        fen: fenBefore,
        fenAfter,
        isWhite,
        classification,
        bestMove: bestMoveUci,
        bestMoveSan,
        evalBefore,
        evalAfter,
        explanation,
        playerMove: moves[i],
      });
    }

    if (!cancelRef.current) {
      const blunders = results.filter((r) => r.classification.type === 'blunder').length;
      const mistakes = results.filter((r) => r.classification.type === 'mistake').length;
      const inaccuracies = results.filter((r) => r.classification.type === 'inaccuracy').length;

      setSummary({ blunders, mistakes, inaccuracies, totalMoves: moves.length });
      setAnalysis(results);
      setProgress(100);

      // Show first position
      if (results.length > 0) {
        displayGameRef.current = new Chess(results[0].fen);
        setDisplayFen(results[0].fen);
        setCurrentIndex(0);
        if (results[0].bestMove) {
          const from = results[0].bestMove.slice(0, 2);
          const to = results[0].bestMove.slice(2, 4);
          setArrows([[from, to, 'rgb(0, 180, 0)']]);
        }
      }
    }

    setIsAnalyzing(false);
  }, [engine]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    engine.stop();
  }, [engine]);

  const navigateToMove = useCallback((index) => {
    if (!analysis || index < 0 || index >= analysis.length) return;

    setCurrentIndex(index);
    const entry = analysis[index];
    displayGameRef.current = new Chess(entry.fen);
    // Make the player's move to show the resulting position
    displayGameRef.current.move(entry.san);
    setDisplayFen(displayGameRef.current.fen());

    // Show best move arrow from the position before the move
    if (entry.bestMove) {
      const from = entry.bestMove.slice(0, 2);
      const to = entry.bestMove.slice(2, 4);
      setArrows([[from, to, 'rgb(0, 180, 0)']]);
    } else {
      setArrows([]);
    }
  }, [analysis]);

  const handleKeyDown = useCallback((e) => {
    if (!analysis) return;
    if (e.key === 'ArrowLeft') {
      navigateToMove(Math.max(0, currentIndex - 1));
    } else if (e.key === 'ArrowRight') {
      navigateToMove(Math.min(analysis.length - 1, currentIndex + 1));
    }
  }, [analysis, currentIndex, navigateToMove]);

  // PGN input screen
  if (!analysis && !isAnalyzing) {
    return (
      <div className="max-w-lg w-full">
        <h2 className="text-xl font-bold mb-4">Game Review</h2>
        <p className="text-gray-400 text-sm mb-4">
          Paste a PGN to analyze. The engine will evaluate every move and highlight blunders.
        </p>
        <textarea
          value={pgnInput}
          onChange={(e) => setPgnInput(e.target.value)}
          placeholder="Paste PGN here...&#10;&#10;1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5..."
          className="w-full h-48 bg-gray-800 border border-gray-700 rounded p-3 text-sm font-mono text-gray-300 resize-none focus:outline-none focus:border-blue-500"
        />
        {error && (
          <p className="text-red-400 text-sm mt-2">{error}</p>
        )}
        <button
          onClick={() => analyzeGame(pgnInput)}
          disabled={!pgnInput.trim()}
          className="mt-3 w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 rounded font-medium transition-colors"
        >
          Analyze Game
        </button>
      </div>
    );
  }

  // Analyzing screen
  if (isAnalyzing) {
    return (
      <div className="max-w-lg w-full text-center">
        <h2 className="text-xl font-bold mb-4">Analyzing Game...</h2>
        <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-gray-400 text-sm mb-4">{progress}% complete</p>
        <button
          onClick={handleCancel}
          className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Review screen
  const currentEntry = analysis[currentIndex];
  const evalToShow = currentEntry?.evalBefore ?? 0;

  return (
    <div className="flex flex-col items-center gap-4" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Navigation hint */}
      <p className="text-xs text-gray-500">Use arrow keys to navigate moves</p>

      <div className="flex gap-4">
        <EvalBar evaluation={evalToShow} playerColor="white" />

        <Board
          fen={displayFen}
          onMove={() => {}}
          arrows={arrows}
          playerColor="white"
          disabled={true}
        />

        <div className="flex flex-col gap-3 w-72">
          <ReviewPanel
            analysis={analysis}
            currentIndex={currentIndex}
            onNavigate={navigateToMove}
            summary={summary}
          />

          <div className="flex gap-2">
            <button
              onClick={() => navigateToMove(Math.max(0, currentIndex - 1))}
              disabled={currentIndex <= 0}
              className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-medium transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => navigateToMove(Math.min(analysis.length - 1, currentIndex + 1))}
              disabled={currentIndex >= analysis.length - 1}
              className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-medium transition-colors"
            >
              Next
            </button>
          </div>

          <button
            onClick={() => {
              setAnalysis(null);
              setSummary(null);
              setProgress(0);
              setCurrentIndex(0);
              setArrows([]);
              setError(null);
            }}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
          >
            Analyze Another Game
          </button>
        </div>
      </div>
    </div>
  );
}
