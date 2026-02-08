import { useState, useRef, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board';
import EvalBar from '../components/EvalBar';
import MoveList from '../components/MoveList';
import HintPanel from '../components/HintPanel';
import { generateHint } from '../engine/hints';
import { ENDGAMES } from '../data/endgames';

const DIFFICULTY_STYLES = {
  beginner: 'bg-green-900 text-green-300',
  intermediate: 'bg-blue-900 text-blue-300',
  advanced: 'bg-orange-900 text-orange-300',
  expert: 'bg-red-900 text-red-300',
};

const DIFFICULTY_ORDER = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };

const sortedEndgames = Object.entries(ENDGAMES).sort(
  (a, b) => DIFFICULTY_ORDER[a[1].difficulty] - DIFFICULTY_ORDER[b[1].difficulty]
);

export default function EndgameTrainer({ engine }) {
  const {
    evaluation: engineEval,
    topLines: engineTopLines,
    getBestMove: engineGetBestMove,
    analyze: engineAnalyze,
    setMultiPV: engineSetMultiPV,
    setSkillLevel: engineSetSkillLevel,
    newGame: engineNewGame,
  } = engine;

  const engineTopLinesRef = useRef(engineTopLines);
  engineTopLinesRef.current = engineTopLines;

  const [selectedEndgame, setSelectedEndgame] = useState(null);
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState([]);
  const [moveCount, setMoveCount] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [arrows, setArrows] = useState([]);
  const [squareStyles, setSquareStyles] = useState({});
  const [hintLevel, setHintLevel] = useState(0);
  const [hintData, setHintData] = useState(null);

  const endgame = selectedEndgame ? ENDGAMES[selectedEndgame] : null;

  // Configure engine when an endgame is selected
  useEffect(() => {
    if (endgame) {
      engineSetSkillLevel(5);
      engineSetMultiPV(3);
    }
  }, [endgame, engineSetSkillLevel, engineSetMultiPV]);

  const initPosition = useCallback((key) => {
    const eg = ENDGAMES[key];
    gameRef.current = new Chess(eg.fen);
    setFen(eg.fen);
    setHistory([]);
    setMoveCount(0);
    setSuccess(false);
    setArrows([]);
    setSquareStyles({});
    setHintLevel(0);
    setHintData(null);
    setIsThinking(false);
    engineNewGame();
    engineSetSkillLevel(5);
    engineSetMultiPV(3);

    setTimeout(() => {
      engineAnalyze(eg.fen, eg.engineDepth);
    }, 100);
  }, [engineNewGame, engineSetSkillLevel, engineSetMultiPV, engineAnalyze]);

  const makeEngineMove = useCallback(async () => {
    setIsThinking(true);
    await new Promise((r) => setTimeout(r, 300));

    const game = gameRef.current;
    if (game.isGameOver()) {
      setIsThinking(false);
      return;
    }

    const depth = endgame?.engineDepth || 6;
    const result = await engineGetBestMove(game.fen(), depth);
    if (result?.move) {
      const from = result.move.slice(0, 2);
      const to = result.move.slice(2, 4);
      const promotion = result.move.length > 4 ? result.move[4] : undefined;

      try {
        const move = game.move({ from, to, promotion });
        if (move) {
          setHistory((prev) => [...prev, { san: move.san, classification: null }]);
          setFen(game.fen());

          if (!game.isGameOver()) {
            engineAnalyze(game.fen(), depth);
          }
        }
      } catch {
        // Invalid engine move
      }
    }
    setIsThinking(false);
  }, [endgame, engineGetBestMove, engineAnalyze]);

  const handleMove = useCallback((from, to) => {
    if (isThinking || success) return false;

    const game = gameRef.current;
    let move;
    try {
      move = game.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    if (!move) return false;

    setHistory((prev) => [...prev, { san: move.san, classification: null }]);
    setMoveCount((prev) => prev + 1);
    setFen(game.fen());
    setHintLevel(0);
    setHintData(null);
    setArrows([]);
    setSquareStyles({});

    // Check success
    if (endgame?.goal === 'checkmate' && game.isCheckmate()) {
      setSuccess(true);
      return true;
    }
    if (endgame?.goal === 'promotion' && move.promotion) {
      setSuccess(true);
      return true;
    }

    // Check for draw/stalemate (player failed)
    if (game.isGameOver()) {
      return true;
    }

    makeEngineMove();
    return true;
  }, [isThinking, success, endgame, makeEngineMove]);

  const handleUndo = useCallback(() => {
    if (isThinking || history.length < 2) return;
    const game = gameRef.current;
    game.undo();
    game.undo();
    setHistory((prev) => prev.slice(0, -2));
    setMoveCount((prev) => Math.max(0, prev - 1));
    setFen(game.fen());
    setSuccess(false);
    setArrows([]);
    setSquareStyles({});
    setHintLevel(0);
    setHintData(null);
    engineAnalyze(game.fen(), endgame?.engineDepth || 6);
  }, [isThinking, history.length, endgame, engineAnalyze]);

  const handleBoardClick = useCallback(() => {
    if (arrows.length > 0 || Object.keys(squareStyles).length > 0) {
      setArrows([]);
      setSquareStyles({});
      setHintLevel(0);
      setHintData(null);
    }
  }, [arrows.length, squareStyles]);

  const handleRequestHint = useCallback(() => {
    if (success) return;
    const newLevel = Math.min(hintLevel + 1, 3);
    setHintLevel(newLevel);
    const hint = generateHint(engineTopLinesRef.current, gameRef.current, newLevel);
    setHintData(hint);
    if (hint) {
      setArrows(hint.arrows || []);
      setSquareStyles(hint.squareStyles || {});
    }
  }, [hintLevel, success]);

  // Keyboard shortcut: H for hints
  useEffect(() => {
    const handler = (e) => {
      if ((e.key === 'h' || e.key === 'H') && !isThinking && !success && hintLevel < 3) {
        handleRequestHint();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isThinking, success, hintLevel, handleRequestHint]);

  // Selection screen
  if (!selectedEndgame) {
    return (
      <div className="max-w-3xl">
        <h2 className="text-xl font-bold mb-2">Endgame Trainer</h2>
        <p className="text-gray-400 text-sm mb-6">
          Master essential endgames. Practice each scenario until you can win consistently.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {sortedEndgames.map(([key, eg]) => (
            <button
              key={key}
              onClick={() => { setSelectedEndgame(key); initPosition(key); }}
              className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-colors"
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-medium">{eg.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded shrink-0 ml-2 ${DIFFICULTY_STYLES[eg.difficulty]}`}>
                  {eg.difficulty}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1">{eg.description}</p>
              <p className="text-xs text-gray-600">
                Goal: {eg.goal === 'checkmate' ? 'Checkmate' : 'Promote pawn'} · {eg.maxMoves} moves
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const isPlayerTurn = gameRef.current.turn() === 'w';
  const gameOverDraw = !success && gameRef.current.isGameOver();

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => { setSelectedEndgame(null); }}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
        >
          Back
        </button>
        <h2 className="text-lg font-bold">{endgame.name}</h2>
        <span className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_STYLES[endgame.difficulty]}`}>
          {endgame.difficulty}
        </span>
        <span className="text-sm text-gray-400">
          Move {moveCount}/{endgame.maxMoves}
        </span>
      </div>

      {/* Status */}
      <div className="text-sm">
        {success ? (
          <span className="text-green-400 font-bold">Checkmate! Well done!</span>
        ) : gameOverDraw ? (
          <span className="text-yellow-300 font-bold">Draw — try again!</span>
        ) : isThinking ? (
          <span className="text-gray-400">Engine thinking...</span>
        ) : (
          <span className="text-gray-300">Your turn — {endgame.goal === 'checkmate' ? 'deliver checkmate' : 'promote your pawn'}</span>
        )}
      </div>

      <div className="flex gap-4 items-start">
        <EvalBar evaluation={engineEval} playerColor="white" />

        <Board
          fen={fen}
          onMove={handleMove}
          arrows={arrows}
          squareStyles={squareStyles}
          playerColor="white"
          disabled={isThinking || success || gameOverDraw}
          onSquareClick={handleBoardClick}
        />

        <div className="flex flex-col gap-3 w-72">
          {/* Success banner */}
          {success && (
            <div className="bg-green-900/50 border border-green-700 rounded p-4 text-center">
              <p className="text-green-300 font-bold text-lg mb-1">
                {endgame.goal === 'promotion' ? 'Pawn Promoted!' : 'Checkmate!'}
              </p>
              <p className="text-sm text-green-400">
                Completed in {moveCount} move{moveCount !== 1 ? 's' : ''}
                {moveCount <= endgame.maxMoves
                  ? ' — within target!'
                  : ` (target: ${endgame.maxMoves})`}
              </p>
            </div>
          )}

          {/* Draw warning */}
          {gameOverDraw && (
            <div className="bg-yellow-900/50 border border-yellow-700 rounded p-3 text-center">
              <p className="text-yellow-300 font-bold">Stalemate!</p>
              <p className="text-xs text-yellow-400 mt-1">Be careful not to stalemate. Try again.</p>
            </div>
          )}

          <MoveList history={history} currentMoveIndex={history.length - 1} />

          {!success && !gameOverDraw && (
            <HintPanel
              hintLevel={hintLevel}
              hintData={hintData}
              onRequestHint={handleRequestHint}
              disabled={isThinking}
            />
          )}

          {/* Principles */}
          <div className="bg-gray-800 rounded p-3">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Principles</h3>
            <ul className="text-xs text-gray-400 space-y-1">
              {endgame.principles.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-blue-400 shrink-0">-</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => initPosition(selectedEndgame)}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-medium transition-colors"
            >
              {success || gameOverDraw ? 'Try Again' : 'Reset'}
            </button>
            {!success && !gameOverDraw && (
              <button
                onClick={handleUndo}
                disabled={isThinking || history.length < 2}
                className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-medium transition-colors"
              >
                Undo
              </button>
            )}
            {history.length > 0 && (
              <button
                onClick={() => navigator.clipboard.writeText(gameRef.current.pgn())}
                className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium transition-colors"
              >
                Copy PGN
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
