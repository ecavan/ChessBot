import { useState, useRef, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board';
import { PUZZLES, DIFFICULTY_ORDER } from '../data/puzzles';
import { getThreats, getPlayerThreats, getProtectionArrows, getForkArrows } from '../utils/arrows';
import { playMoveSound, sounds } from '../utils/sounds';
import { useBoardSize } from '../hooks/useBoardSize';

const DIFFICULTY_STYLES = {
  beginner: 'bg-green-900 text-green-300',
  medium: 'bg-blue-900 text-blue-300',
  hard: 'bg-orange-900 text-orange-300',
  expert: 'bg-red-900 text-red-300',
};

const THEME_STYLES = {
  'Back Rank': 'text-red-300',
  Fork: 'text-yellow-300',
  Pin: 'text-blue-300',
  Skewer: 'text-purple-300',
  'Discovered Attack': 'text-orange-300',
  Sacrifice: 'text-cyan-300',
  Checkmate: 'text-red-300',
  Deflection: 'text-pink-300',
  Combination: 'text-emerald-300',
  'Trapped Piece': 'text-amber-300',
  'Hanging Piece': 'text-lime-300',
};

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

function getRandomPuzzle(difficulty) {
  const pool = difficulty === 'all'
    ? PUZZLES
    : PUZZLES.filter((p) => p.difficulty === difficulty);
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function PuzzlesTrainer({ preferences = {} }) {
  const boardSize = useBoardSize();
  const [difficulty, setDifficulty] = useState('all');
  const [activePuzzle, setActivePuzzle] = useState(null);
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [success, setSuccess] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [arrows, setArrows] = useState([]);
  const [squareStyles, setSquareStyles] = useState({});
  const [lastMove, setLastMove] = useState(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [showThreats, setShowThreats] = useState(false);
  const [showPlayerThreats, setShowPlayerThreats] = useState(false);
  const [showProtection, setShowProtection] = useState(false);
  const [showForks, setShowForks] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const loadPuzzle = useCallback((puzzle) => {
    gameRef.current = new Chess(puzzle.fen);
    setFen(puzzle.fen);
    setActivePuzzle(puzzle);
    setSolutionIndex(0);
    setHistory([]);
    setSuccess(false);
    setFeedback(null);
    setArrows([]);
    setSquareStyles({});
    setLastMove(null);
    setHintLevel(0);
    setIsAnimating(false);
  }, []);

  const handleSelectDifficulty = useCallback((diff) => {
    setDifficulty(diff);
    const puzzle = getRandomPuzzle(diff);
    if (puzzle) loadPuzzle(puzzle);
  }, [loadPuzzle]);

  const handleNextPuzzle = useCallback(() => {
    const puzzle = getRandomPuzzle(difficulty);
    if (puzzle) loadPuzzle(puzzle);
  }, [difficulty, loadPuzzle]);

  const autoPlayOpponentMove = useCallback((puzzle, index) => {
    if (index >= puzzle.solution.length) return;

    setIsAnimating(true);
    setTimeout(() => {
      const uci = puzzle.solution[index];
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;

      try {
        const move = gameRef.current.move({ from, to, promotion });
        if (move) {
          setLastMove({ from, to });
          setHistory((prev) => [...prev, { san: move.san, isPlayer: false }]);
          setFen(gameRef.current.fen());
          playMoveSound(gameRef.current, move);
          const nextIdx = index + 1;
          setSolutionIndex(nextIdx);

          // If this was the last move in the solution, puzzle is solved
          if (nextIdx >= puzzle.solution.length) {
            setSuccess(true);
            sounds.success();
            setFeedback({ type: 'success', text: 'Correct! Puzzle solved.' });
            setIsAnimating(false);
            return;
          }
        }
      } catch {
        // Invalid opponent move in solution data
      }
      setIsAnimating(false);
    }, 400);
  }, []);

  const handleMove = useCallback((from, to) => {
    if (success || isAnimating || !activePuzzle) return false;

    // Only accept moves on the player's turn
    const currentTurn = gameRef.current.turn() === 'w' ? 'white' : 'black';
    if (currentTurn !== activePuzzle.playerColor) return false;

    const puzzle = activePuzzle;
    const expectedUci = puzzle.solution[solutionIndex];
    if (!expectedUci) return false;

    const playerUci = from + to;
    // Check if move matches (with or without promotion)
    const expectedBase = expectedUci.slice(0, 4);
    const expectedPromo = expectedUci.length > 4 ? expectedUci[4] : undefined;

    if (playerUci !== expectedBase) {
      // Wrong move — show feedback, don't apply
      setFeedback({ type: 'wrong', text: 'Not quite — try again.' });
      sounds.error();
      setSquareStyles({
        [to]: { backgroundColor: 'rgba(255, 80, 80, 0.4)' },
      });
      setTimeout(() => setSquareStyles({}), 800);
      return false;
    }

    // Correct move — apply it
    try {
      const move = gameRef.current.move({ from, to, promotion: expectedPromo || 'q' });
      if (!move) return false;

      setLastMove({ from, to });
      setHistory((prev) => [...prev, { san: move.san, isPlayer: true }]);
      setFen(gameRef.current.fen());
      playMoveSound(gameRef.current, move);
      setSquareStyles({
        [from]: { backgroundColor: 'rgba(0, 200, 0, 0.4)' },
        [to]: { backgroundColor: 'rgba(0, 200, 0, 0.4)' },
      });
      setFeedback(null);
      setArrows([]);
      setHintLevel(0);

      const nextIndex = solutionIndex + 1;
      setSolutionIndex(nextIndex);

      // Check if puzzle is complete
      if (nextIndex >= puzzle.solution.length) {
        setSuccess(true);
        sounds.success();
        setFeedback({ type: 'success', text: 'Correct! Puzzle solved.' });
        return true;
      }

      // Auto-play opponent response
      autoPlayOpponentMove(puzzle, nextIndex);
      return true;
    } catch {
      return false;
    }
  }, [success, isAnimating, activePuzzle, solutionIndex, autoPlayOpponentMove]);

  const handleRequestHint = useCallback(() => {
    if (success || !activePuzzle) return;

    const newLevel = Math.min(hintLevel + 1, 3);
    setHintLevel(newLevel);

    const expectedUci = activePuzzle.solution[solutionIndex];
    if (!expectedUci) return;

    const from = expectedUci.slice(0, 2);
    const to = expectedUci.slice(2, 4);

    if (newLevel === 1) {
      // Highlight target square
      setSquareStyles({ [to]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' } });
      setArrows([]);
      setFeedback({ type: 'hint', text: activePuzzle.hint || 'Pay attention to the highlighted square.' });
    } else if (newLevel === 2) {
      // Show arrow
      setArrows([[from, to, 'rgb(0, 180, 0)']]);
      setSquareStyles({});
      setFeedback({ type: 'hint', text: 'This is the key move.' });
    } else {
      // Show the move in SAN
      const san = uciToSan(expectedUci, gameRef.current.fen());
      setArrows([[from, to, 'rgb(0, 200, 0)']]);
      setSquareStyles({});
      setFeedback({ type: 'hint', text: `Best move: ${san}` });
    }
  }, [success, activePuzzle, hintLevel, solutionIndex]);

  const handleBoardClick = useCallback(() => {
    if (arrows.length > 0 || Object.keys(squareStyles).length > 0) {
      setArrows([]);
      setSquareStyles({});
    }
  }, [arrows.length, squareStyles]);

  // Keyboard shortcut: H for hints
  useEffect(() => {
    const handler = (e) => {
      if ((e.key === 'h' || e.key === 'H') && activePuzzle && !success && hintLevel < 3) {
        handleRequestHint();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activePuzzle, success, hintLevel, handleRequestHint]);

  // Selection screen
  if (!activePuzzle) {
    const difficulties = ['all', 'beginner', 'medium', 'hard', 'expert'];
    const puzzleCounts = {};
    for (const d of difficulties) {
      puzzleCounts[d] = d === 'all' ? PUZZLES.length : PUZZLES.filter((p) => p.difficulty === d).length;
    }

    return (
      <div className="max-w-lg">
        <h2 className="text-xl font-bold mb-2">Puzzles</h2>
        <p className="text-gray-400 text-sm mb-6">
          Sharpen your tactics. Choose a difficulty and solve random puzzles.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {difficulties.map((diff) => (
            <button
              key={diff}
              onClick={() => handleSelectDifficulty(diff)}
              className={`p-4 rounded-lg text-left transition-colors ${
                diff === 'all'
                  ? 'bg-gray-700 hover:bg-gray-600 col-span-2'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium capitalize">{diff === 'all' ? 'Random (Any Difficulty)' : diff}</span>
                {diff !== 'all' && (
                  <span className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_STYLES[diff]}`}>
                    {puzzleCounts[diff]} puzzles
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {diff === 'all' && `${puzzleCounts.all} puzzles across all difficulties`}
                {diff === 'beginner' && 'Simple one-move tactics'}
                {diff === 'medium' && '1-2 move combinations'}
                {diff === 'hard' && '2-3 move deep tactics'}
                {diff === 'expert' && '3+ move combinations'}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Compute threat arrows (deduplicate by from+to, higher priority overwrites lower)
  const boardColor = activePuzzle.playerColor;
  const isPlayerTurn = (boardColor === 'white' && gameRef.current.turn() === 'w') ||
                       (boardColor === 'black' && gameRef.current.turn() === 'b');
  const threatArrows = showThreats ? getThreats(gameRef.current) : [];
  const playerThreatArrows = showPlayerThreats && isPlayerTurn
    ? getPlayerThreats(gameRef.current) : [];
  const forkArrows = showForks && isPlayerTurn
    ? getForkArrows(gameRef.current) : [];
  const protectionArrows = showProtection && isPlayerTurn
    ? getProtectionArrows(gameRef.current) : [];
  const arrowMap = new Map();
  for (const a of threatArrows) arrowMap.set(a[0] + a[1], a);
  for (const a of playerThreatArrows) arrowMap.set(a[0] + a[1], a);
  for (const a of forkArrows) arrowMap.set(a[0] + a[1], a);
  for (const a of protectionArrows) arrowMap.set(a[0] + a[1], a);
  const allArrows = [...arrows, ...arrowMap.values()];

  const totalPlayerMoves = activePuzzle.solution.filter((_, i) => i % 2 === 0).length;
  const completedPlayerMoves = Math.floor(solutionIndex / 2) + (solutionIndex % 2 === 0 ? 0 : 1);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setActivePuzzle(null)}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
        >
          Back
        </button>
        <h2 className="text-lg font-bold">{activePuzzle.name}</h2>
        <span className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_STYLES[activePuzzle.difficulty]}`}>
          {activePuzzle.difficulty}
        </span>
        <span className={`text-xs ${THEME_STYLES[activePuzzle.theme] || 'text-gray-300'}`}>
          {activePuzzle.theme}
        </span>
      </div>

      {/* Status */}
      <div className="text-sm">
        {success ? (
          <span className="text-green-400 font-bold">Solved!</span>
        ) : isAnimating ? (
          <span className="text-gray-400">Opponent responding...</span>
        ) : (
          <span className="text-gray-300">
            Find the best move ({completedPlayerMoves}/{totalPlayerMoves})
          </span>
        )}
      </div>

      <div className="flex gap-4 items-start">
        <Board
          fen={fen}
          onMove={handleMove}
          arrows={allArrows}
          squareStyles={squareStyles}
          playerColor={boardColor}
          disabled={success || isAnimating}
          onSquareClick={handleBoardClick}
          theme={preferences.boardTheme}
          pieceStyle={preferences.pieceStyle}
          lastMove={lastMove}
          boardSize={boardSize}
        />

        <div className="flex flex-col gap-3 w-72">
          {/* Success banner */}
          {success && (
            <div className="bg-green-900/50 border border-green-700 rounded p-4 text-center">
              <p className="text-green-300 font-bold text-lg mb-1">Puzzle Solved!</p>
              <p className="text-sm text-green-400">
                {hintLevel === 0 ? 'No hints used!' : `Used ${hintLevel} hint${hintLevel > 1 ? 's' : ''}`}
              </p>
            </div>
          )}

          {/* Feedback */}
          {feedback && !success && (
            <div
              className={`rounded p-3 text-sm ${
                feedback.type === 'wrong'
                  ? 'bg-red-900/50 border border-red-700 text-red-300'
                  : feedback.type === 'hint'
                    ? 'bg-yellow-900/50 border border-yellow-700 text-yellow-300'
                    : 'bg-blue-900/50 border border-blue-700 text-blue-300'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Move history */}
          {history.length > 0 && (
            <div className="bg-gray-800 rounded p-3">
              <h3 className="text-xs text-gray-400 mb-1">Moves</h3>
              <div className="font-mono text-sm text-gray-300">
                {history.map((m, i) => (
                  <span key={i} className={m.isPlayer ? 'text-green-300' : 'text-gray-400'}>
                    {m.san}{' '}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hints */}
          {!success && (
            <button
              onClick={handleRequestHint}
              disabled={hintLevel >= 3 || isAnimating}
              className="px-3 py-2 bg-yellow-700 hover:bg-yellow-600 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-medium transition-colors"
            >
              {hintLevel === 0 ? 'Hint (H)' : `More Hint (${hintLevel}/3)`}
            </button>
          )}

          {/* Arrow toggles */}
          <div className="space-y-1.5">
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setShowThreats(!showThreats)}
                className={`flex-1 px-2 py-1.5 rounded transition-colors ${
                  showThreats ? 'bg-red-900 text-red-300' : 'bg-gray-700 text-gray-400'
                }`}
              >
                Threats
              </button>
              <button
                onClick={() => setShowPlayerThreats(!showPlayerThreats)}
                className={`flex-1 px-2 py-1.5 rounded transition-colors ${
                  showPlayerThreats ? 'bg-orange-900 text-orange-300' : 'bg-gray-700 text-gray-400'
                }`}
              >
                Attacks
              </button>
            </div>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setShowProtection(!showProtection)}
                className={`flex-1 px-2 py-1.5 rounded transition-colors ${
                  showProtection ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
                }`}
              >
                Defenders
              </button>
              <button
                onClick={() => setShowForks(!showForks)}
                className={`flex-1 px-2 py-1.5 rounded transition-colors ${
                  showForks ? 'bg-purple-900 text-purple-300' : 'bg-gray-700 text-gray-400'
                }`}
              >
                Forks
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {success ? (
              <button
                onClick={handleNextPuzzle}
                className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-medium transition-colors"
              >
                Next Puzzle
              </button>
            ) : (
              <>
                <button
                  onClick={() => loadPuzzle(activePuzzle)}
                  className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={handleNextPuzzle}
                  className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium transition-colors"
                >
                  Skip
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
