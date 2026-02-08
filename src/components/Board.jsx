import { Chessboard } from 'react-chessboard';

export default function Board({
  game,
  onMove,
  arrows = [],
  squareStyles = {},
  playerColor = 'white',
  disabled = false,
  boardWidth = 480,
}) {
  function onDrop(sourceSquare, targetSquare) {
    if (disabled) return false;
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });
      if (move === null) return false;
      onMove(move);
      return true;
    } catch {
      return false;
    }
  }

  function isDraggablePiece({ piece }) {
    if (disabled) return false;
    const color = piece[0];
    const turn = game.turn();
    return (color === 'w' && turn === 'w') || (color === 'b' && turn === 'b');
  }

  return (
    <Chessboard
      id="trainer-board"
      position={game.fen()}
      onPieceDrop={onDrop}
      isDraggablePiece={isDraggablePiece}
      boardOrientation={playerColor}
      customArrows={arrows}
      customSquareStyles={squareStyles}
      boardWidth={boardWidth}
      customBoardStyle={{
        borderRadius: '4px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
      customDarkSquareStyle={{ backgroundColor: '#779952' }}
      customLightSquareStyle={{ backgroundColor: '#edeed1' }}
    />
  );
}
