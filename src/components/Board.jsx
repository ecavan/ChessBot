import { Chessboard } from 'react-chessboard';

// Convert our [from, to, color] arrow format to v5 { startSquare, endSquare, color } format
function convertArrows(arrows) {
  if (!arrows || arrows.length === 0) return [];
  return arrows.map((a) => {
    if (Array.isArray(a)) {
      return { startSquare: a[0], endSquare: a[1], color: a[2] || 'rgb(0, 128, 0)' };
    }
    return a;
  }).filter(Boolean);
}

export default function Board({
  fen,
  onMove,
  arrows = [],
  squareStyles = {},
  playerColor = 'white',
  disabled = false,
}) {
  return (
    <div style={{ width: 360, height: 360 }}>
      <Chessboard
        options={{
          id: 'trainer-board',
          position: fen,
          boardOrientation: playerColor,
          arrows: convertArrows(arrows),
          squareStyles: squareStyles,
          clearArrowsOnPositionChange: false,
          clearArrowsOnClick: false,
          boardStyle: {
            borderRadius: '4px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          },
          darkSquareStyle: { backgroundColor: '#779952' },
          lightSquareStyle: { backgroundColor: '#edeed1' },
          allowDragging: !disabled,
          animationDurationInMs: 150,
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (disabled || !targetSquare) return false;
            return onMove(sourceSquare, targetSquare);
          },
        }}
      />
    </div>
  );
}
