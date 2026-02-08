import { useState, useRef, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board';
import MoveList from '../components/MoveList';
import { OPENINGS } from '../data/openings';

function moveToUci(move) {
  return move.from + move.to + (move.promotion || '');
}

export default function OpeningSandbox({ engine }) {
  const [selectedOpening, setSelectedOpening] = useState(null);
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState([]);
  const [moveHistory, setMoveHistory] = useState('');
  const [moveIndex, setMoveIndex] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [isOpeningPhase, setIsOpeningPhase] = useState(true);
  const [arrows, setArrows] = useState([]);
  const [squareStyles, setSquareStyles] = useState({});
  const [isThinking, setIsThinking] = useState(false);

  const opening = selectedOpening ? OPENINGS[selectedOpening] : null;
  const playerIsWhite = opening?.color === 'white';

  const makeBookMove = useCallback((uciMove) => {
    const game = gameRef.current;
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

    try {
      const move = game.move({ from, to, promotion });
      if (move) {
        setHistory((prev) => [...prev, { san: move.san, classification: null }]);
        setFen(game.fen());
        return move;
      }
    } catch {
      // Invalid move
    }
    return null;
  }, []);

  const makeEngineFreeMove = useCallback(async () => {
    setIsThinking(true);
    await new Promise((r) => setTimeout(r, 400));
    const result = await engine.getBestMove(gameRef.current.fen(), 12);
    if (result?.move) {
      const from = result.move.slice(0, 2);
      const to = result.move.slice(2, 4);
      const promotion = result.move.length > 4 ? result.move[4] : undefined;
      try {
        const move = gameRef.current.move({ from, to, promotion });
        if (move) {
          setHistory((prev) => [...prev, { san: move.san, classification: null }]);
          setFen(gameRef.current.fen());
        }
      } catch {
        // Invalid
      }
    }
    setIsThinking(false);
  }, [engine]);

  // Auto-play engine's opening moves when it's the engine's turn
  useEffect(() => {
    if (!opening || !isOpeningPhase) return;

    const game = gameRef.current;
    const isEngineTurn = (playerIsWhite && game.turn() === 'b') ||
                         (!playerIsWhite && game.turn() === 'w');

    if (isEngineTurn && moveIndex < opening.moves.length) {
      const timer = setTimeout(() => {
        const engineMoveUci = opening.moves[moveIndex];
        const move = makeBookMove(engineMoveUci);
        if (move) {
          setMoveHistory((prev) => (prev ? prev + ' ' : '') + engineMoveUci);
          setMoveIndex((prev) => prev + 1);
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    // Opening phase complete - transition to free play
    if (moveIndex >= opening.moves.length && isEngineTurn) {
      setIsOpeningPhase(false);
      setFeedback({ type: 'complete', text: 'Opening complete! Now playing freely against the engine.' });
      makeEngineFreeMove();
    }
  }, [opening, moveIndex, fen, isOpeningPhase, playerIsWhite, makeBookMove, makeEngineFreeMove]);

  const handleMove = useCallback((move) => {
    if (!opening) return;

    const uci = moveToUci(move);

    if (isOpeningPhase && moveIndex < opening.moves.length) {
      const expectedMove = opening.moves[moveIndex];
      const currentHistory = moveHistory ? moveHistory + ' ' + uci : uci;

      if (uci === expectedMove) {
        // Correct book move
        setSquareStyles({
          [move.from]: { backgroundColor: 'rgba(0, 200, 0, 0.4)' },
          [move.to]: { backgroundColor: 'rgba(0, 200, 0, 0.4)' },
        });
        setArrows([]);
        setFeedback({ type: 'book', text: 'Book move! Well played.' });
        setMoveHistory(currentHistory);
        setMoveIndex((prev) => prev + 1);
        setHistory((prev) => [...prev, { san: move.san, classification: { type: 'great', symbol: '!', color: '#2ecc71' } }]);
        setFen(gameRef.current.fen());
      } else {
        // Deviation from book
        const deviationKey = currentHistory;
        const deviation = opening.deviations[deviationKey];

        // Undo the move
        gameRef.current.undo();
        setFen(gameRef.current.fen());

        const expectedFrom = expectedMove.slice(0, 2);
        const expectedTo = expectedMove.slice(2, 4);

        setSquareStyles({
          [move.to]: { backgroundColor: 'rgba(255, 200, 0, 0.4)' },
        });
        setArrows([[expectedFrom, expectedTo, 'rgb(0, 180, 0)']]);

        if (deviation) {
          setFeedback({ type: 'deviation', text: deviation.explanation });
        } else {
          // Try to get the SAN of the book move
          try {
            const tempGame = new Chess(gameRef.current.fen());
            const bookMove = tempGame.move({ from: expectedFrom, to: expectedTo });
            setFeedback({
              type: 'deviation',
              text: `Not the mainline. The book move is ${bookMove?.san || expectedMove}.`,
            });
          } catch {
            setFeedback({
              type: 'deviation',
              text: `Not the mainline. The book move is ${expectedMove}.`,
            });
          }
        }
      }
    } else {
      // Free play phase
      setHistory((prev) => [...prev, { san: move.san, classification: null }]);
      setFen(gameRef.current.fen());
      setFeedback(null);
      setArrows([]);
      setSquareStyles({});

      if (!gameRef.current.isGameOver()) {
        makeEngineFreeMove();
      }
    }
  }, [opening, isOpeningPhase, moveIndex, moveHistory, makeEngineFreeMove]);

  const handleReset = useCallback(() => {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setHistory([]);
    setMoveHistory('');
    setMoveIndex(0);
    setFeedback(null);
    setIsOpeningPhase(true);
    setArrows([]);
    setSquareStyles({});
    setIsThinking(false);
    engine.newGame();
  }, [engine]);

  // Opening selection screen
  if (!selectedOpening) {
    return (
      <div className="max-w-lg">
        <h2 className="text-xl font-bold mb-4">Opening Repertoire</h2>
        <p className="text-gray-400 text-sm mb-6">
          Select an opening to drill. Play the mainline moves and the engine will guide you.
        </p>
        <div className="space-y-3">
          {Object.entries(OPENINGS).map(([key, op]) => (
            <button
              key={key}
              onClick={() => { setSelectedOpening(key); handleReset(); }}
              className="w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{op.name}</span>
                <span className="text-sm text-gray-400 px-2 py-0.5 bg-gray-700 rounded">
                  {op.color}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {op.moves.length} mainline moves
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const boardColor = playerIsWhite ? 'white' : 'black';
  const isPlayerTurn = (playerIsWhite && gameRef.current.turn() === 'w') ||
                       (!playerIsWhite && gameRef.current.turn() === 'b');

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => { setSelectedOpening(null); handleReset(); }}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
        >
          Back
        </button>
        <h2 className="text-lg font-bold">{opening.name}</h2>
        {!isOpeningPhase && (
          <span className="text-xs bg-green-700 text-green-200 px-2 py-0.5 rounded">Free Play</span>
        )}
      </div>

      <div className="flex gap-4">
        {/* Board */}
        <Board
          game={gameRef.current}
          onMove={handleMove}
          arrows={arrows}
          squareStyles={squareStyles}
          playerColor={boardColor}
          disabled={!isPlayerTurn || isThinking}
          boardWidth={480}
        />

        {/* Side panel */}
        <div className="flex flex-col gap-3 w-72">
          {/* Feedback */}
          {feedback && (
            <div
              className={`rounded p-3 text-sm ${
                feedback.type === 'book'
                  ? 'bg-green-900/50 border border-green-700 text-green-300'
                  : feedback.type === 'deviation'
                    ? 'bg-yellow-900/50 border border-yellow-700 text-yellow-300'
                    : 'bg-blue-900/50 border border-blue-700 text-blue-300'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Move list */}
          <MoveList history={history} currentMoveIndex={history.length - 1} />

          {/* Principles */}
          {isOpeningPhase && (
            <div className="bg-gray-800 rounded p-3">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Key Principles</h3>
              <ul className="text-xs text-gray-400 space-y-1">
                {opening.principles.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-blue-400 shrink-0">-</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-medium transition-colors"
            >
              Restart
            </button>
          </div>

          {/* Progress */}
          {isOpeningPhase && (
            <div className="bg-gray-800 rounded p-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span>
                <span>{moveIndex}/{opening.moves.length} moves</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(moveIndex / opening.moves.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
