import { Chessboard } from 'react-chessboard';

const BOARD_SIZE = 360;
const SQUARE_SIZE = BOARD_SIZE / 8;

function squareToCoords(square, orientation) {
  const file = square.charCodeAt(0) - 97; // a=0, b=1, ..., h=7
  const rank = parseInt(square[1]) - 1;    // 1=0, 2=1, ..., 8=7

  if (orientation === 'white') {
    return {
      x: file * SQUARE_SIZE + SQUARE_SIZE / 2,
      y: (7 - rank) * SQUARE_SIZE + SQUARE_SIZE / 2,
    };
  }
  return {
    x: (7 - file) * SQUARE_SIZE + SQUARE_SIZE / 2,
    y: rank * SQUARE_SIZE + SQUARE_SIZE / 2,
  };
}

function ArrowOverlay({ arrows, orientation }) {
  if (!arrows || arrows.length === 0) return null;

  return (
    <svg
      width={BOARD_SIZE}
      height={BOARD_SIZE}
      viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <defs>
        {arrows.map((arrow, i) => {
          const color = Array.isArray(arrow) ? (arrow[2] || 'rgb(0, 128, 0)') : (arrow.color || 'rgb(0, 128, 0)');
          return (
            <marker
              key={`head-${i}`}
              id={`arrowhead-${i}`}
              markerWidth="4"
              markerHeight="4"
              refX="2.5"
              refY="2"
              orient="auto"
            >
              <polygon points="0 0, 4 2, 0 4" fill={color} />
            </marker>
          );
        })}
      </defs>
      {arrows.map((arrow, i) => {
        const from = Array.isArray(arrow) ? arrow[0] : arrow.startSquare;
        const to = Array.isArray(arrow) ? arrow[1] : arrow.endSquare;
        const color = Array.isArray(arrow) ? (arrow[2] || 'rgb(0, 128, 0)') : (arrow.color || 'rgb(0, 128, 0)');

        if (!from || !to || from.length !== 2 || to.length !== 2) return null;

        const start = squareToCoords(from, orientation);
        const end = squareToCoords(to, orientation);

        // Shorten the line slightly so arrowhead doesn't overshoot
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const shortenBy = 6;
        const endX = end.x - (dx / len) * shortenBy;
        const endY = end.y - (dy / len) * shortenBy;

        return (
          <line
            key={`${from}-${to}-${i}`}
            x1={start.x}
            y1={start.y}
            x2={endX}
            y2={endY}
            stroke={color}
            strokeWidth={SQUARE_SIZE * 0.22}
            strokeLinecap="round"
            opacity={0.7}
            markerEnd={`url(#arrowhead-${i})`}
          />
        );
      })}
    </svg>
  );
}

export default function Board({
  fen,
  onMove,
  arrows = [],
  squareStyles = {},
  playerColor = 'white',
  disabled = false,
  onSquareClick,
}) {
  return (
    <div style={{ width: BOARD_SIZE, height: BOARD_SIZE, position: 'relative' }}>
      <Chessboard
        options={{
          id: 'trainer-board',
          position: fen,
          boardOrientation: playerColor,
          arrows: [],
          squareStyles: squareStyles,
          allowDrawingArrows: false,
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
          onSquareClick: ({ square }) => {
            if (onSquareClick) onSquareClick(square);
          },
        }}
      />
      <ArrowOverlay arrows={arrows} orientation={playerColor} />
    </div>
  );
}
