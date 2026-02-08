import { useState, useRef, useCallback, useEffect } from 'react';
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
  const {
    getBestMove: engineGetBestMove,
    stop: engineStop,
    analyze: engineAnalyze,
    evaluation: engineEval,
    setMultiPV: engineSetMultiPV,
  } = engine;

  const engineEvalRef = useRef(engineEval);
  engineEvalRef.current = engineEval;

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

  // Explore mode state
  const [isExploring, setIsExploring] = useState(false);
  const [exploreMoves, setExploreMoves] = useState([]);
  const exploreGameRef = useRef(new Chess());

  // Enable multi-PV for analysis in explore mode
  useEffect(() => {
    engineSetMultiPV(1);
  }, [engineSetMultiPV]);

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
      const resultBefore = await engineGetBestMove(fenBefore, 12);
      const evalBefore = resultBefore?.eval ?? 0;
      const bestMoveUci = resultBefore?.move ?? '';

      // Make the actual move
      const playedMove = replay.move(moves[i].san);
      const fenAfter = replay.fen();

      // Get engine eval after the move
      const resultAfter = await engineGetBestMove(fenAfter, 12);
      const evalAfter = resultAfter?.eval ?? 0;

      const playerUci = moves[i].from + moves[i].to + (moves[i].promotion || '');
      const classification = classifyMove(evalBefore, evalAfter, isWhite, playedMove ? {
        piece: playedMove.piece,
        captured: playedMove.captured,
        to: playedMove.to,
        color: playedMove.color,
        gameAfter: replay,
        playerUci,
        bestUci: bestMoveUci,
      } : undefined);
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
      const brilliancies = results.filter((r) => r.classification.type === 'brilliant').length;
      const best = results.filter((r) => r.classification.type === 'best').length;
      const great = results.filter((r) => r.classification.type === 'great').length;
      const blunders = results.filter((r) => r.classification.type === 'blunder').length;
      const mistakes = results.filter((r) => r.classification.type === 'mistake').length;
      const misses = results.filter((r) => r.classification.type === 'miss').length;
      const inaccuracies = results.filter((r) => r.classification.type === 'inaccuracy').length;

      setSummary({ brilliancies, best, great, blunders, mistakes, misses, inaccuracies, totalMoves: moves.length });
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
  }, [engineGetBestMove]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    engineStop();
  }, [engineStop]);

  const exitExplore = useCallback(() => {
    setIsExploring(false);
    setExploreMoves([]);
  }, []);

  const navigateToMove = useCallback((index) => {
    if (!analysis || index < 0 || index >= analysis.length) return;

    // Exit explore mode when navigating main line
    if (isExploring) exitExplore();

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
  }, [analysis, isExploring, exitExplore]);

  // Handle moves on the board (explore mode)
  const handleExploreMove = useCallback((from, to) => {
    if (!analysis) return false;

    // If not exploring yet, start from the current analysis position
    let game;
    if (!isExploring) {
      const entry = analysis[currentIndex];
      game = new Chess(entry.fen);
      game.move(entry.san); // replay the actual move first
      exploreGameRef.current = game;
    } else {
      game = exploreGameRef.current;
    }

    let move;
    try {
      move = game.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    if (!move) return false;

    setIsExploring(true);
    setExploreMoves((prev) => [...prev, { san: move.san, fen: game.fen() }]);
    setDisplayFen(game.fen());
    setArrows([]);

    // Run engine analysis on the new position
    engineAnalyze(game.fen(), 14);

    return true;
  }, [analysis, isExploring, currentIndex, engineAnalyze]);

  const handleExploreUndo = useCallback(() => {
    if (!isExploring || exploreMoves.length === 0) return;

    exploreGameRef.current.undo();
    const newMoves = exploreMoves.slice(0, -1);
    setExploreMoves(newMoves);

    if (newMoves.length === 0) {
      // Back to the main line position
      exitExplore();
      const entry = analysis[currentIndex];
      displayGameRef.current = new Chess(entry.fen);
      displayGameRef.current.move(entry.san);
      setDisplayFen(displayGameRef.current.fen());
      if (entry.bestMove) {
        const from = entry.bestMove.slice(0, 2);
        const to = entry.bestMove.slice(2, 4);
        setArrows([[from, to, 'rgb(0, 180, 0)']]);
      }
    } else {
      setDisplayFen(exploreGameRef.current.fen());
      engineAnalyze(exploreGameRef.current.fen(), 14);
    }
  }, [isExploring, exploreMoves, exitExplore, analysis, currentIndex, engineAnalyze]);

  const handleBackToMainLine = useCallback(() => {
    exitExplore();
    const entry = analysis[currentIndex];
    displayGameRef.current = new Chess(entry.fen);
    displayGameRef.current.move(entry.san);
    setDisplayFen(displayGameRef.current.fen());
    if (entry.bestMove) {
      const from = entry.bestMove.slice(0, 2);
      const to = entry.bestMove.slice(2, 4);
      setArrows([[from, to, 'rgb(0, 180, 0)']]);
    } else {
      setArrows([]);
    }
  }, [exitExplore, analysis, currentIndex]);

  const handleKeyDown = useCallback((e) => {
    if (!analysis) return;
    if (isExploring) {
      // In explore mode: left arrow undoes explore move
      if (e.key === 'ArrowLeft') {
        handleExploreUndo();
      } else if (e.key === 'Escape') {
        handleBackToMainLine();
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      navigateToMove(Math.max(0, currentIndex - 1));
    } else if (e.key === 'ArrowRight') {
      navigateToMove(Math.min(analysis.length - 1, currentIndex + 1));
    }
  }, [analysis, currentIndex, isExploring, navigateToMove, handleExploreUndo, handleBackToMainLine]);

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
  const evalToShow = isExploring ? engineEval : (currentEntry?.evalBefore ?? 0);

  return (
    <div className="flex flex-col items-center gap-4" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Navigation hint */}
      <p className="text-xs text-gray-500">
        {isExploring
          ? 'Exploring variation — Esc to return, Left arrow to undo'
          : 'Use arrow keys to navigate · Move a piece to explore alternatives'}
      </p>

      <div className="flex gap-4">
        <EvalBar evaluation={evalToShow} playerColor="white" />

        <Board
          fen={displayFen}
          onMove={handleExploreMove}
          arrows={arrows}
          playerColor="white"
          disabled={false}
        />

        <div className="flex flex-col gap-3 w-72">
          {/* Explore mode banner */}
          {isExploring && (
            <div className="bg-purple-900/50 border border-purple-700 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-300 text-sm font-medium">Exploring Variation</span>
                <button
                  onClick={handleBackToMainLine}
                  className="text-xs px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded transition-colors"
                >
                  Back to Main Line
                </button>
              </div>
              <div className="text-xs text-purple-200 font-mono">
                {exploreMoves.map((m, i) => (
                  <span key={i}>
                    {i % 2 === 0 && <span className="text-purple-400">{Math.floor((currentIndex + i) / 2) + 1}{currentIndex % 2 === 0 ? '.' : '...'} </span>}
                    {m.san}{' '}
                  </span>
                ))}
              </div>
              {engineEval !== null && (
                <p className="text-xs text-purple-300 mt-1">
                  Eval: {engineEval > 0 ? '+' : ''}{engineEval.toFixed(1)}
                </p>
              )}
              <button
                onClick={handleExploreUndo}
                disabled={exploreMoves.length === 0}
                className="mt-2 text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded transition-colors"
              >
                Undo
              </button>
            </div>
          )}

          <ReviewPanel
            analysis={analysis}
            currentIndex={currentIndex}
            onNavigate={navigateToMove}
            summary={summary}
          />

          {!isExploring && (
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
          )}

          <button
            onClick={() => {
              setAnalysis(null);
              setSummary(null);
              setProgress(0);
              setCurrentIndex(0);
              setArrows([]);
              setError(null);
              setIsExploring(false);
              setExploreMoves([]);
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
