import { useState, useRef, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board';
import EvalBar from '../components/EvalBar';
import MoveList from '../components/MoveList';
import { classifyMove } from '../engine/analysis';
import { playMoveSound } from '../utils/sounds';
import { estimateElo, computeACPL } from '../utils/elo';
import { getEloDisplay } from '../utils/eloDisplay';
import { OPENINGS } from '../data/openings';

const WATCH_DEPTH = 16;
const openingKeys = Object.keys(OPENINGS);

// Pick a random opening and return its book moves
function pickRandomOpening() {
  const key = openingKeys[Math.floor(Math.random() * openingKeys.length)];
  return { name: OPENINGS[key].name, moves: OPENINGS[key].moves };
}

export default function WatchMode({ engine }) {
  const {
    evaluation: engineEval,
    analyze: engineAnalyze,
    getBestMove: engineGetBestMove,
    setSkillLevel: engineSetSkillLevel,
    setMultiPV: engineSetMultiPV,
    newGame: engineNewGame,
  } = engine;

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isThinking, setIsThinking] = useState(false);
  const [gameOver, setGameOver] = useState(null);
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(2000);
  const [openingName, setOpeningName] = useState('');
  const isThinkingRef = useRef(false);
  const evalBeforeRef = useRef(null);
  const autoPlayRef = useRef(false);
  autoPlayRef.current = autoPlay;
  const bookMovesRef = useRef([]);
  const bookIndexRef = useRef(0);

  // Configure engine at max strength, MultiPV=1, pick initial opening
  useEffect(() => {
    engineSetSkillLevel(20);
    engineSetMultiPV(1);
    const opening = pickRandomOpening();
    bookMovesRef.current = opening.moves;
    bookIndexRef.current = 0;
    setOpeningName(opening.name);
    engineAnalyze(gameRef.current.fen(), WATCH_DEPTH);
  }, [engineSetSkillLevel, engineSetMultiPV, engineAnalyze]);

  // Store eval for classification
  useEffect(() => {
    if (engineEval !== null) {
      evalBeforeRef.current = engineEval;
    }
  }, [engineEval]);

  const makeNextMove = useCallback(async () => {
    if (isThinkingRef.current || gameRef.current.isGameOver()) return;
    isThinkingRef.current = true;
    setIsThinking(true);

    const game = gameRef.current;
    const evalBefore = evalBeforeRef.current;
    const fenBefore = game.fen();

    try {
      // Play book moves during the opening phase
      let uciMove;
      if (bookIndexRef.current < bookMovesRef.current.length) {
        uciMove = bookMovesRef.current[bookIndexRef.current];
        bookIndexRef.current++;
      } else {
        const result = await engineGetBestMove(game.fen(), WATCH_DEPTH);
        if (!result || !result.move || result.move === '(none)') {
          isThinkingRef.current = false;
          setIsThinking(false);
          return;
        }
        uciMove = result.move;
      }

      const from = uciMove.slice(0, 2);
      const to = uciMove.slice(2, 4);
      const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

      const move = game.move({ from, to, promotion });
      if (move) {
        playMoveSound(game, move);

        // Classify the move if we have eval data
        let classification = null;
        if (evalBefore !== null) {
          const classResult = await engineGetBestMove(game.fen(), WATCH_DEPTH);
          if (classResult) {
            const evalAfter = classResult.eval ?? 0;
            const isWhite = move.color === 'w';
            classification = classifyMove(evalBefore, evalAfter, isWhite, {
              piece: move.piece,
              captured: move.captured,
              to: move.to,
              from: move.from,
              color: move.color,
              gameAfter: game,
              gameBefore: new Chess(fenBefore),
              playerUci: uciMove,
              bestUci: uciMove,
            });
            evalBeforeRef.current = evalAfter;
          }
        }

        setHistory((prev) => [...prev, {
          san: move.san,
          fen: game.fen(),
          classification,
          evalBefore,
          evalAfter: evalBeforeRef.current,
        }]);
        setCurrentMoveIndex((prev) => prev + 1);
        setFen(game.fen());

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
          setAutoPlay(false);
        } else {
          engineAnalyze(game.fen(), WATCH_DEPTH);
        }
      }
    } catch {
      // Engine error
    }

    isThinkingRef.current = false;
    setIsThinking(false);
  }, [engineGetBestMove, engineAnalyze]);

  // Auto-play interval
  useEffect(() => {
    if (!autoPlay || gameOver) return;
    const interval = setInterval(() => {
      if (autoPlayRef.current && !isThinkingRef.current) {
        makeNextMove();
      }
    }, autoPlaySpeed);
    return () => clearInterval(interval);
  }, [autoPlay, autoPlaySpeed, gameOver, makeNextMove]);

  const handleNewGame = useCallback(() => {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setHistory([]);
    setCurrentMoveIndex(-1);
    setGameOver(null);
    setIsThinking(false);
    isThinkingRef.current = false;
    evalBeforeRef.current = null;
    setAutoPlay(false);

    const opening = pickRandomOpening();
    bookMovesRef.current = opening.moves;
    bookIndexRef.current = 0;
    setOpeningName(opening.name);

    engineNewGame();
    engineSetSkillLevel(20);
    engineSetMultiPV(1);

    setTimeout(() => {
      engineAnalyze(gameRef.current.fen(), WATCH_DEPTH);
    }, 100);
  }, [engineNewGame, engineSetSkillLevel, engineSetMultiPV, engineAnalyze]);

  const handleFlipBoard = useCallback(() => {
    setBoardOrientation((prev) => prev === 'white' ? 'black' : 'white');
  }, []);

  // Compute game summary at game over
  const summary = gameOver ? (() => {
    const computeSide = (isWhiteSide) => {
      const sideMoves = history.filter((_, i) => isWhiteSide ? i % 2 === 0 : i % 2 === 1);
      const classified = sideMoves.filter((m) => m.classification);
      const withEval = classified.filter((m) => m.evalBefore != null && m.evalAfter != null);
      const acpl = computeACPL(withEval);
      const cls = {};
      for (const m of classified) {
        const t = m.classification.type;
        cls[t] = (cls[t] || 0) + 1;
      }
      return estimateElo(acpl, cls, classified.length);
    };
    return {
      whiteElo: computeSide(true),
      blackElo: computeSide(false),
    };
  })() : null;

  const SPEEDS = [
    { label: '1s', value: 1000 },
    { label: '2s', value: 2000 },
    { label: '3s', value: 3000 },
    { label: '5s', value: 5000 },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm text-gray-400 text-center">
        {gameOver ? (
          <span className="text-yellow-300 font-bold">{gameOver}</span>
        ) : isThinking ? (
          <span>Engine is thinking...</span>
        ) : (
          <span>Stockfish vs Stockfish — Max Strength</span>
        )}
        {openingName && !gameOver && (
          <div className="text-xs text-blue-400 mt-0.5">Opening: {openingName}</div>
        )}
      </div>

      <div className="flex gap-4 items-start">
        <EvalBar evaluation={engineEval} playerColor={boardOrientation} />

        <Board
          fen={fen}
          onMove={() => false}
          playerColor={boardOrientation}
          disabled={true}
        />

        <div className="flex flex-col gap-3 w-60">
          <MoveList
            history={history}
            currentMoveIndex={currentMoveIndex}
          />

          {/* Controls */}
          <div className="bg-gray-800 rounded p-3 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={makeNextMove}
                disabled={isThinking || !!gameOver}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 rounded text-sm font-medium transition-colors"
              >
                Next Move
              </button>
              <button
                onClick={handleNewGame}
                className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-medium transition-colors"
              >
                New
              </button>
              <button
                onClick={handleFlipBoard}
                className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium transition-colors"
              >
                Flip
              </button>
            </div>

            {/* Auto-play toggle + speed */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Auto-play</span>
              <button
                onClick={() => setAutoPlay((prev) => !prev)}
                disabled={!!gameOver}
                className={`w-10 h-5 rounded-full transition-colors ${
                  autoPlay ? 'bg-blue-600' : 'bg-gray-600'
                } ${gameOver ? 'opacity-50' : ''}`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${
                    autoPlay ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {autoPlay && (
              <div className="flex gap-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setAutoPlaySpeed(s.value)}
                    className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                      autoPlaySpeed === s.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Game over summary with ELO for both sides */}
      {gameOver && summary && (() => {
        const wStyle = getEloDisplay(summary.whiteElo.elo);
        const bStyle = getEloDisplay(summary.blackElo.elo);
        return (
          <div className="bg-gray-800 rounded-lg p-5 max-w-md text-center">
            <h3 className="text-lg font-bold mb-3">{gameOver}</h3>
            <div className="flex justify-between mb-4">
              <div className="text-center flex-1">
                <div className="text-3xl font-black" style={{ color: wStyle.color }}>
                  {summary.whiteElo.elo}
                </div>
                <div className="text-xs font-medium" style={{ color: wStyle.color }}>
                  {wStyle.label}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  White · {summary.whiteElo.accuracy}% · ACPL {summary.whiteElo.acpl}
                </div>
              </div>
              <div className="text-xs text-gray-600 self-center px-3">vs</div>
              <div className="text-center flex-1">
                <div className="text-3xl font-black" style={{ color: bStyle.color }}>
                  {summary.blackElo.elo}
                </div>
                <div className="text-xs font-medium" style={{ color: bStyle.color }}>
                  {bStyle.label}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Black · {summary.blackElo.accuracy}% · ACPL {summary.blackElo.acpl}
                </div>
              </div>
            </div>
            <button
              onClick={handleNewGame}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-medium transition-colors text-sm"
            >
              New Game
            </button>
          </div>
        );
      })()}
    </div>
  );
}
