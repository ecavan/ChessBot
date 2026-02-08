import { useState, useRef, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board';
import EvalBar from '../components/EvalBar';
import MoveList from '../components/MoveList';
import HintPanel from '../components/HintPanel';
import BlunderAlert from '../components/BlunderAlert';
import GameControls from '../components/GameControls';
import { classifyMove } from '../engine/analysis';
import { generateHint } from '../engine/hints';
import { getThreats } from '../utils/arrows';

function uciToSan(uci, fen) {
  try {
    const tempGame = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = tempGame.move({ from, to, promotion });
    return move ? move.san : uci;
  } catch {
    return uci;
  }
}

const DIFFICULTIES = [
  { label: 'Beginner', skill: 0, depth: 5 },
  { label: 'Easy', skill: 3, depth: 8 },
  { label: 'Medium', skill: 6, depth: 10 },
  { label: 'Hard', skill: 12, depth: 12 },
  { label: 'Expert', skill: 18, depth: 14 },
  { label: 'Max', skill: 20, depth: 16 },
];

export default function PlayMode({ engine, onGameEnd }) {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({
    skillLevel: 5,
    blunderWarnings: true,
    showThreats: false,
    showEval: true,
    hintsAvailable: true,
    playerColor: 'white',
    engineDepth: 10,
  });
  const [arrows, setArrows] = useState([]);
  const [squareStyles, setSquareStyles] = useState({});
  const [isThinking, setIsThinking] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintData, setHintData] = useState(null);
  const [blunderAlert, setBlunderAlert] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const evalBeforeRef = useRef(null);
  const isThinkingRef = useRef(false);

  const actualColor = settings.playerColor === 'random'
    ? (Math.random() < 0.5 ? 'white' : 'black')
    : settings.playerColor;
  const [boardOrientation, setBoardOrientation] = useState(actualColor);

  // Set engine skill level when settings change
  useEffect(() => {
    engine.setSkillLevel(settings.skillLevel);
  }, [engine, settings.skillLevel]);

  // Enable MultiPV for hints
  useEffect(() => {
    engine.setMultiPV(3);
  }, [engine]);

  // Run initial analysis for the starting position
  useEffect(() => {
    if (engine.isReady) {
      engine.analyze(gameRef.current.fen(), settings.engineDepth);
    }
  }, [engine, engine.isReady, settings.engineDepth]);

  const checkGameOver = useCallback(() => {
    const game = gameRef.current;
    if (game.isGameOver()) {
      let result;
      if (game.isCheckmate()) {
        result = game.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
      } else if (game.isDraw()) {
        result = 'Draw';
      } else if (game.isStalemate()) {
        result = 'Draw by stalemate';
      } else {
        result = 'Game over';
      }
      setGameOver(result);
      if (onGameEnd) {
        onGameEnd(game.pgn());
      }
      return true;
    }
    return false;
  }, [onGameEnd]);

  const makeEngineMove = useCallback(async () => {
    if (isThinkingRef.current) return;
    isThinkingRef.current = true;
    setIsThinking(true);
    setArrows([]);
    setSquareStyles({});

    await new Promise((r) => setTimeout(r, 200));

    const game = gameRef.current;
    if (game.isGameOver()) {
      isThinkingRef.current = false;
      setIsThinking(false);
      return;
    }

    try {
      const result = await engine.getBestMove(game.fen(), settings.engineDepth);
      if (!result || !result.move || result.move === '(none)') {
        isThinkingRef.current = false;
        setIsThinking(false);
        return;
      }

      const from = result.move.slice(0, 2);
      const to = result.move.slice(2, 4);
      const promotion = result.move.length > 4 ? result.move[4] : undefined;

      const move = game.move({ from, to, promotion });
      if (move) {
        setHistory((prev) => [...prev, {
          san: move.san,
          fen: game.fen(),
          classification: null,
        }]);
        setCurrentMoveIndex((prev) => prev + 1);
        setFen(game.fen());

        if (!checkGameOver()) {
          engine.analyze(game.fen(), settings.engineDepth);
        }
      }
    } catch {
      // Engine returned invalid move
    }

    isThinkingRef.current = false;
    setIsThinking(false);
  }, [engine, settings.engineDepth, checkGameOver]);

  // If the engine should move first (player is black), trigger it
  useEffect(() => {
    if (engine.isReady && boardOrientation === 'black' && gameRef.current.turn() === 'w' && history.length === 0) {
      makeEngineMove();
    }
  }, [engine.isReady, boardOrientation, history.length, makeEngineMove]);

  // Always commit the player's move immediately (return true so the piece stays).
  // Then optionally run the blunder check. If it's a blunder, show the alert.
  // The engine only moves after the blunder check clears.
  const handleMove = useCallback((from, to) => {
    if (isThinkingRef.current || blunderAlert) return false;

    const game = gameRef.current;
    const fenBeforeMove = game.fen();
    const evalBefore = evalBeforeRef.current;
    const preMoveBestUci = engine.topLines[0]?.moves[0] || '';

    let move;
    try {
      move = game.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    if (!move) return false;

    const isWhite = move.color === 'w';

    // Commit the move to state immediately
    setHistory((prev) => [...prev, { san: move.san, fen: game.fen(), classification: null }]);
    setCurrentMoveIndex((prev) => prev + 1);
    setFen(game.fen());
    setHintLevel(0);
    setHintData(null);
    setArrows([]);
    setSquareStyles({});

    if (checkGameOver()) return true;

    if (settings.blunderWarnings && evalBefore !== null) {
      // Run blunder check before making the engine move
      isThinkingRef.current = true;
      setIsThinking(true);

      engine.getBestMove(game.fen(), 10).then((result) => {
        if (!result) {
          // Search was cancelled — just make engine move
          isThinkingRef.current = false;
          setIsThinking(false);
          makeEngineMove();
          return;
        }

        const evalAfter = result.eval ?? 0;
        const classification = classifyMove(evalBefore, evalAfter, isWhite);
        evalBeforeRef.current = evalAfter;

        // Update this move's classification in history
        setHistory((prev) => {
          const updated = [...prev];
          // Find the last player move (should be the one we just added)
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].classification === null) {
              updated[i] = { ...updated[i], classification };
              break;
            }
          }
          return updated;
        });

        if (classification.type === 'blunder' || classification.type === 'mistake') {
          const bestSan = preMoveBestUci
            ? uciToSan(preMoveBestUci, fenBeforeMove)
            : '';

          isThinkingRef.current = false;
          setIsThinking(false);
          setBlunderAlert({
            evalLoss: Math.abs(evalBefore - evalAfter),
            bestMoveSan: bestSan,
            classification,
          });
        } else {
          // Not a blunder — make engine move
          isThinkingRef.current = false;
          setIsThinking(false);
          makeEngineMove();
        }
      });
    } else {
      // No blunder check — make engine move right away
      evalBeforeRef.current = engine.evaluation;
      makeEngineMove();
    }

    return true;
  }, [engine, settings.blunderWarnings, blunderAlert, checkGameOver, makeEngineMove]);

  // User saw the blunder alert and chose to continue
  const handleBlunderConfirm = useCallback(() => {
    setBlunderAlert(null);
    makeEngineMove();
  }, [makeEngineMove]);

  // User saw the blunder alert and chose to take back
  const handleBlunderTakeBack = useCallback(() => {
    setBlunderAlert(null);
    const game = gameRef.current;
    game.undo();
    setHistory((prev) => prev.slice(0, -1));
    setCurrentMoveIndex((prev) => prev - 1);
    setFen(game.fen());
    engine.analyze(game.fen(), settings.engineDepth);
  }, [engine, settings.engineDepth]);

  const handleUndo = useCallback(() => {
    const game = gameRef.current;
    if (history.length < 2 || isThinking) return;

    game.undo();
    game.undo();
    setHistory((prev) => prev.slice(0, -2));
    setCurrentMoveIndex((prev) => Math.max(-1, prev - 2));
    setFen(game.fen());
    setGameOver(null);
    engine.analyze(game.fen(), settings.engineDepth);
  }, [history.length, isThinking, engine, settings.engineDepth]);

  const handleNewGame = useCallback(() => {
    const newColor = settings.playerColor === 'random'
      ? (Math.random() < 0.5 ? 'white' : 'black')
      : settings.playerColor;

    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setHistory([]);
    setCurrentMoveIndex(-1);
    setArrows([]);
    setSquareStyles({});
    setHintLevel(0);
    setHintData(null);
    setBlunderAlert(null);
    setGameOver(null);
    setIsThinking(false);
    isThinkingRef.current = false;
    setBoardOrientation(newColor);
    evalBeforeRef.current = null;

    engine.newGame();
    engine.setSkillLevel(settings.skillLevel);
    engine.setMultiPV(3);

    setTimeout(() => {
      engine.analyze(gameRef.current.fen(), settings.engineDepth);
    }, 100);
  }, [engine, settings]);

  const handleFlipBoard = useCallback(() => {
    setBoardOrientation((prev) => prev === 'white' ? 'black' : 'white');
  }, []);

  const handleRequestHint = useCallback(() => {
    const newLevel = Math.min(hintLevel + 1, 3);
    setHintLevel(newLevel);
    const hint = generateHint(engine.topLines, gameRef.current, newLevel);
    setHintData(hint);
    if (hint) {
      setArrows(hint.arrows || []);
      setSquareStyles(hint.squareStyles || {});
    }
  }, [hintLevel, engine.topLines]);

  const handleSettingsChange = useCallback((newSettings) => {
    setSettings(newSettings);
    if (newSettings.skillLevel !== settings.skillLevel) {
      engine.setSkillLevel(newSettings.skillLevel);
    }
  }, [engine, settings.skillLevel]);

  const handleDifficultyChange = useCallback((diff) => {
    const newSettings = { ...settings, skillLevel: diff.skill, engineDepth: diff.depth };
    setSettings(newSettings);
    engine.setSkillLevel(diff.skill);
  }, [settings, engine]);

  // Compute threat arrows
  const threatArrows = settings.showThreats ? getThreats(gameRef.current) : [];
  const allArrows = [...arrows, ...threatArrows];

  // Store current eval for blunder detection
  useEffect(() => {
    if (engine.evaluation !== null) {
      evalBeforeRef.current = engine.evaluation;
    }
  }, [engine.evaluation]);

  const isPlayerTurn = (gameRef.current.turn() === 'w' && boardOrientation === 'white') ||
                       (gameRef.current.turn() === 'b' && boardOrientation === 'black');

  const currentDifficulty = DIFFICULTIES.find(
    (d) => d.skill === settings.skillLevel && d.depth === settings.engineDepth
  );

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Difficulty selector */}
      <div className="flex gap-1.5">
        {DIFFICULTIES.map((diff) => (
          <button
            key={diff.label}
            onClick={() => handleDifficultyChange(diff)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              currentDifficulty?.label === diff.label
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {diff.label}
          </button>
        ))}
      </div>

      <div className="text-sm text-gray-400">
        {gameOver ? (
          <span className="text-yellow-300 font-bold">{gameOver}</span>
        ) : isThinking ? (
          <span>Engine is thinking...</span>
        ) : isPlayerTurn ? (
          <span>Your turn</span>
        ) : (
          <span>Waiting...</span>
        )}
      </div>

      <div className="flex gap-4 items-start">
        {settings.showEval && (
          <EvalBar evaluation={engine.evaluation} playerColor={boardOrientation} />
        )}

        <Board
          fen={fen}
          onMove={handleMove}
          arrows={allArrows}
          squareStyles={squareStyles}
          playerColor={boardOrientation}
          disabled={isThinking || !!gameOver || !!blunderAlert}
        />

        <div className="flex flex-col gap-3 w-60">
          <MoveList
            history={history}
            currentMoveIndex={currentMoveIndex}
          />

          {settings.hintsAvailable && (
            <HintPanel
              hintLevel={hintLevel}
              hintData={hintData}
              onRequestHint={handleRequestHint}
              disabled={isThinking || !!gameOver}
            />
          )}

          <GameControls
            onNewGame={handleNewGame}
            onUndo={handleUndo}
            onFlipBoard={handleFlipBoard}
            settings={settings}
            onSettingsChange={handleSettingsChange}
          />
        </div>
      </div>

      {gameOver && (
        <div className="bg-gray-800 rounded-lg p-4 max-w-md text-center">
          <h3 className="text-lg font-bold mb-2">{gameOver}</h3>
          <div className="flex gap-4 justify-center text-sm mb-3">
            <span className="text-red-400">
              {history.filter((m) => m.classification?.type === 'blunder').length} blunders
            </span>
            <span className="text-orange-400">
              {history.filter((m) => m.classification?.type === 'mistake').length} mistakes
            </span>
            <span className="text-yellow-400">
              {history.filter((m) => m.classification?.type === 'inaccuracy').length} inaccuracies
            </span>
          </div>
          <button
            onClick={handleNewGame}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded font-medium transition-colors"
          >
            Play Again
          </button>
        </div>
      )}

      <BlunderAlert
        visible={!!blunderAlert}
        evalLoss={blunderAlert?.evalLoss || 0}
        bestMoveSan={blunderAlert?.bestMoveSan || ''}
        classification={blunderAlert?.classification}
        onConfirm={handleBlunderConfirm}
        onTakeBack={handleBlunderTakeBack}
      />
    </div>
  );
}
