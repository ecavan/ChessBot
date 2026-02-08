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
import { getThreats, getPlayerThreats } from '../utils/arrows';
import { OPENINGS } from '../data/openings';

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

function pvToSan(uciMoves, fen, maxMoves = 5) {
  try {
    const game = new Chess(fen);
    const sans = [];
    for (let i = 0; i < Math.min(uciMoves.length, maxMoves); i++) {
      const from = uciMoves[i].slice(0, 2);
      const to = uciMoves[i].slice(2, 4);
      const promotion = uciMoves[i].length > 4 ? uciMoves[i][4] : undefined;
      const move = game.move({ from, to, promotion });
      if (move) {
        const num = Math.ceil((i + 1) / 2);
        if (i % 2 === 0 && game.turn() === 'b') {
          sans.push(`${num}. ${move.san}`);
        } else if (i % 2 === 0) {
          sans.push(`${num}... ${move.san}`);
        } else {
          sans.push(move.san);
        }
      } else break;
    }
    return sans.join(' ');
  } catch {
    return '';
  }
}

// Check if the full UCI sequence matches any known opening prefix
const openingValues = Object.values(OPENINGS);
function isBookMove(uciHistory) {
  return openingValues.some((opening) => {
    if (uciHistory.length > opening.moves.length) return false;
    return uciHistory.every((m, i) => m === opening.moves[i]);
  });
}

const DIFFICULTIES = [
  { label: 'Beginner', skill: 0, depth: 5 },
  { label: 'Easy', skill: 3, depth: 8 },
  { label: 'Medium', skill: 6, depth: 10 },
  { label: 'Hard', skill: 12, depth: 12 },
  { label: 'Expert', skill: 18, depth: 14 },
  { label: 'Max', skill: 20, depth: 16 },
];

export default function PlayMode({ engine, onGameEnd, onReviewGame }) {
  // Destructure engine: functions are stable (useCallback with []), values change
  const {
    isReady: engineReady,
    evaluation: engineEval,
    topLines: engineTopLines,
    analyze: engineAnalyze,
    getBestMove: engineGetBestMove,
    setSkillLevel: engineSetSkillLevel,
    setMultiPV: engineSetMultiPV,
    newGame: engineNewGame,
  } = engine;

  // Refs for reactive values used inside callbacks (avoids stale closures)
  const engineTopLinesRef = useRef(engineTopLines);
  engineTopLinesRef.current = engineTopLines;
  const engineEvalRef = useRef(engineEval);
  engineEvalRef.current = engineEval;

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({
    skillLevel: 5,
    blunderWarnings: true,
    showThreats: true,
    showPlayerThreats: false,
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
  const [brilliantFlash, setBrilliantFlash] = useState(false);
  const [moveIndicator, setMoveIndicator] = useState(null);
  const [indicatorKey, setIndicatorKey] = useState(0);
  const evalBeforeRef = useRef(null);
  const isThinkingRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const uciHistoryRef = useRef([]);

  const actualColor = settings.playerColor === 'random'
    ? (Math.random() < 0.5 ? 'white' : 'black')
    : settings.playerColor;
  const [boardOrientation, setBoardOrientation] = useState(actualColor);

  // Set engine skill level when settings change
  useEffect(() => {
    engineSetSkillLevel(settings.skillLevel);
  }, [engineSetSkillLevel, settings.skillLevel]);

  // Enable MultiPV for hints
  useEffect(() => {
    engineSetMultiPV(3);
  }, [engineSetMultiPV]);

  // Run initial analysis for the starting position
  useEffect(() => {
    if (engineReady) {
      engineAnalyze(gameRef.current.fen(), settings.engineDepth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady, engineAnalyze]);

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

  const showIndicator = useCallback((classification) => {
    setMoveIndicator(classification);
    setIndicatorKey((k) => k + 1);
  }, []);

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
      const depth = settingsRef.current.engineDepth;
      const result = await engineGetBestMove(game.fen(), depth);
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
        // Track engine UCI move for book detection
        uciHistoryRef.current = [...uciHistoryRef.current, result.move];

        setHistory((prev) => [...prev, {
          san: move.san,
          fen: game.fen(),
          classification: null,
        }]);
        setCurrentMoveIndex((prev) => prev + 1);
        setFen(game.fen());

        if (!checkGameOver()) {
          engineAnalyze(game.fen(), settingsRef.current.engineDepth);
        }
      }
    } catch {
      // Engine returned invalid move
    }

    isThinkingRef.current = false;
    setIsThinking(false);
  }, [engineGetBestMove, engineAnalyze, checkGameOver]);

  // If the engine should move first (player is black), trigger it
  useEffect(() => {
    if (engineReady && boardOrientation === 'black' && gameRef.current.turn() === 'w' && history.length === 0) {
      makeEngineMove();
    }
  }, [engineReady, boardOrientation, history.length, makeEngineMove]);

  const handleMove = useCallback((from, to) => {
    if (isThinkingRef.current || blunderAlert) return false;

    const game = gameRef.current;
    const fenBeforeMove = game.fen();
    const evalBefore = evalBeforeRef.current;
    const preMoveBestUci = engineTopLinesRef.current[0]?.moves[0] || '';
    const preMovePV = engineTopLinesRef.current[0]?.moves?.slice(0, 5) || [];
    const preMovePVEval = engineTopLinesRef.current[0]?.eval;

    let move;
    try {
      move = game.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    if (!move) return false;

    const isWhite = move.color === 'w';
    const uci = from + to + (move.promotion || '');

    // Track UCI for book detection
    uciHistoryRef.current = [...uciHistoryRef.current, uci];

    // Commit the move to state immediately
    setHistory((prev) => [...prev, { san: move.san, fen: game.fen(), classification: null }]);
    setCurrentMoveIndex((prev) => prev + 1);
    setFen(game.fen());
    setHintLevel(0);
    setHintData(null);
    setArrows([]);
    setSquareStyles({});

    if (checkGameOver()) return true;

    // Check if this is a book move (matches known opening theory)
    if (isBookMove(uciHistoryRef.current)) {
      const classification = { type: 'book', symbol: '', color: '#a88865', label: 'Book' };
      setHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], classification };
        return updated;
      });
      showIndicator(classification);
      makeEngineMove();
      return true;
    }

    // Always classify moves using engine eval
    if (evalBefore !== null) {
      isThinkingRef.current = true;
      setIsThinking(true);

      engineGetBestMove(game.fen(), 10).then((result) => {
        if (!result) {
          isThinkingRef.current = false;
          setIsThinking(false);
          makeEngineMove();
          return;
        }

        const evalAfter = result.eval ?? 0;
        const classification = classifyMove(evalBefore, evalAfter, isWhite, {
          piece: move.piece,
          captured: move.captured,
          to: move.to,
          color: move.color,
          gameAfter: gameRef.current,
          playerUci: uci,
          bestUci: preMoveBestUci,
        });
        evalBeforeRef.current = evalAfter;

        // Update this move's classification in history
        setHistory((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].classification === null) {
              updated[i] = { ...updated[i], classification };
              break;
            }
          }
          return updated;
        });

        // Show per-move indicator
        showIndicator(classification);

        // Brilliant flash
        if (classification.type === 'brilliant') {
          setBrilliantFlash(true);
        }

        // Blunder/mistake alert (only if warnings enabled)
        if (settingsRef.current.blunderWarnings &&
            (classification.type === 'blunder' || classification.type === 'mistake' || classification.type === 'miss')) {
          const bestSan = preMoveBestUci
            ? uciToSan(preMoveBestUci, fenBeforeMove)
            : '';
          const bestLine = pvToSan(preMovePV, fenBeforeMove, 5);

          isThinkingRef.current = false;
          setIsThinking(false);
          setBlunderAlert({
            evalLoss: evalBefore + evalAfter,
            bestMoveSan: bestSan,
            bestLine,
            bestLineEval: preMovePVEval,
            playerMoveSan: move.san,
            classification,
          });
        } else {
          isThinkingRef.current = false;
          setIsThinking(false);
          makeEngineMove();
        }
      });
    } else {
      // No eval yet (first move) — just make engine move
      makeEngineMove();
    }

    return true;
  }, [engineGetBestMove, blunderAlert, checkGameOver, makeEngineMove, showIndicator]);

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
    uciHistoryRef.current = uciHistoryRef.current.slice(0, -1);
    setHistory((prev) => prev.slice(0, -1));
    setCurrentMoveIndex((prev) => prev - 1);
    setFen(game.fen());
    engineAnalyze(game.fen(), settingsRef.current.engineDepth);
  }, [engineAnalyze]);

  const handleUndo = useCallback(() => {
    const game = gameRef.current;
    if (history.length < 2 || isThinking) return;

    game.undo();
    game.undo();
    uciHistoryRef.current = uciHistoryRef.current.slice(0, -2);
    setHistory((prev) => prev.slice(0, -2));
    setCurrentMoveIndex((prev) => Math.max(-1, prev - 2));
    setFen(game.fen());
    setGameOver(null);
    setMoveIndicator(null);
    engineAnalyze(game.fen(), settingsRef.current.engineDepth);
  }, [history.length, isThinking, engineAnalyze]);

  const handleNewGame = useCallback(() => {
    const s = settingsRef.current;
    const newColor = s.playerColor === 'random'
      ? (Math.random() < 0.5 ? 'white' : 'black')
      : s.playerColor;

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
    uciHistoryRef.current = [];
    setMoveIndicator(null);
    setBrilliantFlash(false);

    engineNewGame();
    engineSetSkillLevel(s.skillLevel);
    engineSetMultiPV(3);

    setTimeout(() => {
      engineAnalyze(gameRef.current.fen(), s.engineDepth);
    }, 100);
  }, [engineNewGame, engineSetSkillLevel, engineSetMultiPV, engineAnalyze]);

  const handleFlipBoard = useCallback(() => {
    setBoardOrientation((prev) => prev === 'white' ? 'black' : 'white');
  }, []);

  const handleBoardClick = useCallback(() => {
    if (arrows.length > 0 || Object.keys(squareStyles).length > 0) {
      setArrows([]);
      setSquareStyles({});
      setHintLevel(0);
      setHintData(null);
    }
  }, [arrows.length, squareStyles]);

  const handleRequestHint = useCallback(() => {
    const newLevel = Math.min(hintLevel + 1, 3);
    setHintLevel(newLevel);
    const hint = generateHint(engineTopLinesRef.current, gameRef.current, newLevel);
    setHintData(hint);
    if (hint) {
      setArrows(hint.arrows || []);
      setSquareStyles(hint.squareStyles || {});
    }
  }, [hintLevel]);

  const handleSettingsChange = useCallback((newSettings) => {
    setSettings(newSettings);
    if (newSettings.skillLevel !== settingsRef.current.skillLevel) {
      engineSetSkillLevel(newSettings.skillLevel);
    }
  }, [engineSetSkillLevel]);

  const handleDifficultyChange = useCallback((diff) => {
    setSettings((prev) => ({ ...prev, skillLevel: diff.skill, engineDepth: diff.depth }));
    engineSetSkillLevel(diff.skill);
  }, [engineSetSkillLevel]);

  // Auto-dismiss brilliant flash
  useEffect(() => {
    if (brilliantFlash) {
      const timer = setTimeout(() => setBrilliantFlash(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [brilliantFlash]);

  // Auto-dismiss move indicator
  useEffect(() => {
    if (moveIndicator) {
      const timer = setTimeout(() => setMoveIndicator(null), 2200);
      return () => clearTimeout(timer);
    }
  }, [moveIndicator, indicatorKey]);

  // Keyboard shortcut: H for hints
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'h' || e.key === 'H') {
        if (!isThinking && !gameOver && hintLevel < 3 && settings.hintsAvailable) {
          handleRequestHint();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isThinking, gameOver, hintLevel, settings.hintsAvailable, handleRequestHint]);

  // Store current eval for classification
  useEffect(() => {
    if (engineEval !== null) {
      evalBeforeRef.current = engineEval;
    }
  }, [engineEval]);

  const isPlayerTurn = (gameRef.current.turn() === 'w' && boardOrientation === 'white') ||
                       (gameRef.current.turn() === 'b' && boardOrientation === 'black');

  // Compute threat arrows (deduplicate by from+to, prefer player threats over opponent threats)
  const threatArrows = settings.showThreats ? getThreats(gameRef.current) : [];
  const playerThreatArrows = settings.showPlayerThreats && isPlayerTurn
    ? getPlayerThreats(gameRef.current) : [];
  const arrowMap = new Map();
  for (const a of threatArrows) arrowMap.set(a[0] + a[1], a);
  for (const a of playerThreatArrows) arrowMap.set(a[0] + a[1], a); // overwrites red with orange
  const allArrows = [...arrows, ...arrowMap.values()];

  const currentDifficulty = DIFFICULTIES.find(
    (d) => d.skill === settings.skillLevel && d.depth === settings.engineDepth
  );

  // Compute game summary counts
  const summaryCounts = gameOver ? {
    brilliant: history.filter((m) => m.classification?.type === 'brilliant').length,
    great: history.filter((m) => m.classification?.type === 'great').length,
    best: history.filter((m) => m.classification?.type === 'best').length,
    blunders: history.filter((m) => m.classification?.type === 'blunder').length,
    mistakes: history.filter((m) => m.classification?.type === 'mistake').length,
    misses: history.filter((m) => m.classification?.type === 'miss').length,
    inaccuracies: history.filter((m) => m.classification?.type === 'inaccuracy').length,
  } : null;

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

      {/* Status + move indicator */}
      <div className="flex items-center gap-3">
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

        {moveIndicator && (
          <div
            key={indicatorKey}
            className="move-indicator px-3 py-0.5 rounded-full text-xs font-bold"
            style={{
              backgroundColor: moveIndicator.color + '20',
              color: moveIndicator.color,
              border: `1px solid ${moveIndicator.color}30`,
            }}
          >
            {moveIndicator.symbol ? `${moveIndicator.symbol} ` : ''}{moveIndicator.label}
          </div>
        )}
      </div>

      {/* Brilliant move notification */}
      {brilliantFlash && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="px-6 py-3 rounded-lg shadow-lg border border-cyan-400/50"
            style={{
              background: 'linear-gradient(135deg, rgba(38,198,218,0.2) 0%, rgba(0,150,136,0.2) 100%)',
              boxShadow: '0 0 30px rgba(38,198,218,0.4), 0 0 60px rgba(38,198,218,0.2)',
            }}
          >
            <span className="text-2xl font-black tracking-wide" style={{ color: '#26c6da' }}>
              !! Brilliant
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-4 items-start">
        {settings.showEval && (
          <EvalBar evaluation={engineEval} playerColor={boardOrientation} />
        )}

        <Board
          fen={fen}
          onMove={handleMove}
          arrows={allArrows}
          squareStyles={squareStyles}
          playerColor={boardOrientation}
          disabled={isThinking || !!gameOver || !!blunderAlert}
          onSquareClick={handleBoardClick}
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

      {gameOver && summaryCounts && (
        <div className="bg-gray-800 rounded-lg p-4 max-w-md text-center">
          <h3 className="text-lg font-bold mb-2">{gameOver}</h3>
          <div className="flex gap-3 justify-center text-sm mb-3 flex-wrap">
            {summaryCounts.brilliant > 0 && (
              <span style={{ color: '#26c6da' }}>{summaryCounts.brilliant} brilliant</span>
            )}
            {summaryCounts.best > 0 && (
              <span style={{ color: '#96bc4b' }}>{summaryCounts.best} best</span>
            )}
            {summaryCounts.great > 0 && (
              <span style={{ color: '#5dadec' }}>{summaryCounts.great} great</span>
            )}
          </div>
          <div className="flex gap-3 justify-center text-sm mb-3 flex-wrap">
            <span className="text-red-400">{summaryCounts.blunders} blunders</span>
            <span className="text-orange-400">{summaryCounts.mistakes} mistakes</span>
            {summaryCounts.misses > 0 && (
              <span className="text-orange-400">{summaryCounts.misses} misses</span>
            )}
            <span style={{ color: '#f7c631' }}>{summaryCounts.inaccuracies} inaccuracies</span>
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleNewGame}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-medium transition-colors text-sm"
            >
              Play Again
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(gameRef.current.pgn())}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded font-medium transition-colors text-sm"
            >
              Copy PGN
            </button>
            {onReviewGame && (
              <button
                onClick={() => onReviewGame(gameRef.current.pgn())}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium transition-colors text-sm"
              >
                Review Game
              </button>
            )}
          </div>
        </div>
      )}

      <BlunderAlert
        visible={!!blunderAlert}
        evalLoss={blunderAlert?.evalLoss || 0}
        bestMoveSan={blunderAlert?.bestMoveSan || ''}
        bestLine={blunderAlert?.bestLine || ''}
        bestLineEval={blunderAlert?.bestLineEval}
        playerMoveSan={blunderAlert?.playerMoveSan || ''}
        classification={blunderAlert?.classification}
        onConfirm={handleBlunderConfirm}
        onTakeBack={handleBlunderTakeBack}
      />
    </div>
  );
}
