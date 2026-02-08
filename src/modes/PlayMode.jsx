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

export default function PlayMode({ engine, onGameEnd }) {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({
    skillLevel: 10,
    blunderWarnings: true,
    showThreats: false,
    showEval: true,
    hintsAvailable: true,
    playerColor: 'white',
    engineDepth: 15,
  });
  const [arrows, setArrows] = useState([]);
  const [squareStyles, setSquareStyles] = useState({});
  const [isThinking, setIsThinking] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintData, setHintData] = useState(null);
  const [blunderAlert, setBlunderAlert] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const pendingMoveRef = useRef(null);
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

    await new Promise((r) => setTimeout(r, 400));

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

  // handleMove is called synchronously from Board's onPieceDrop
  // It must return a boolean: true = accept move, false = reject
  const handleMove = useCallback((from, to) => {
    if (isThinkingRef.current) return false;

    const game = gameRef.current;
    let move;
    try {
      move = game.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    if (!move) return false;

    // Move is legal — check for blunder warning
    if (settings.blunderWarnings && evalBeforeRef.current !== null) {
      const evalBefore = evalBeforeRef.current;
      const isWhite = game.turn() === 'b'; // move was already applied, so turn flipped
      const fenAfterMove = game.fen();

      // Undo to keep game in pre-move state until we confirm
      game.undo();
      setFen(game.fen());

      // Start async blunder check
      pendingMoveRef.current = { from, to, move, evalBefore, isWhite };
      engine.getBestMove(fenAfterMove, 12).then((result) => {
        const pending = pendingMoveRef.current;
        if (!pending || pending.from !== from || pending.to !== to) return;

        const evalAfter = result?.eval ?? 0;
        const classification = classifyMove(evalBefore, evalAfter, isWhite);

        if (classification.type === 'blunder' || classification.type === 'mistake') {
          const bestSan = engine.topLines[0]?.moves[0]
            ? uciToSan(engine.topLines[0].moves[0], game.fen())
            : '';

          pendingMoveRef.current = { ...pending, classification };
          setBlunderAlert({
            evalLoss: Math.abs(evalBefore - evalAfter),
            bestMoveSan: bestSan,
            classification,
          });
        } else {
          // Move is fine — commit it
          pendingMoveRef.current = null;
          try {
            const committedMove = game.move({ from, to, promotion: 'q' });
            if (committedMove) {
              evalBeforeRef.current = evalAfter;
              setHistory((prev) => [...prev, { san: committedMove.san, fen: game.fen(), classification }]);
              setCurrentMoveIndex((prev) => prev + 1);
              setFen(game.fen());
              setHintLevel(0);
              setHintData(null);
              setArrows([]);
              setSquareStyles({});

              if (!checkGameOver()) {
                makeEngineMove();
              }
            }
          } catch {
            // Move became invalid
          }
        }
      });

      return false; // Piece snaps back while we check
    }

    // No blunder warnings — commit immediately
    evalBeforeRef.current = engine.evaluation;
    setHistory((prev) => [...prev, { san: move.san, fen: game.fen(), classification: null }]);
    setCurrentMoveIndex((prev) => prev + 1);
    setFen(game.fen());
    setHintLevel(0);
    setHintData(null);
    setArrows([]);
    setSquareStyles({});

    if (!checkGameOver()) {
      makeEngineMove();
    }

    return true;
  }, [engine, settings.blunderWarnings, checkGameOver, makeEngineMove]);

  const handleBlunderConfirm = useCallback(() => {
    const pending = pendingMoveRef.current;
    if (!pending) return;

    const game = gameRef.current;
    try {
      const move = game.move({ from: pending.from, to: pending.to, promotion: 'q' });
      if (move) {
        setBlunderAlert(null);
        setHistory((prev) => [...prev, { san: move.san, fen: game.fen(), classification: pending.classification }]);
        setCurrentMoveIndex((prev) => prev + 1);
        setFen(game.fen());
        setHintLevel(0);
        setHintData(null);
        setArrows([]);
        setSquareStyles({});
        pendingMoveRef.current = null;

        if (!checkGameOver()) {
          makeEngineMove();
        }
      }
    } catch {
      setBlunderAlert(null);
      pendingMoveRef.current = null;
    }
  }, [checkGameOver, makeEngineMove]);

  const handleBlunderTakeBack = useCallback(() => {
    setBlunderAlert(null);
    pendingMoveRef.current = null;
  }, []);

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
    pendingMoveRef.current = null;

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

  return (
    <div className="flex flex-col items-center gap-4">
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
