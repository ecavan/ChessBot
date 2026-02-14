import { Chessboard } from 'react-chessboard';
import { BOARD_THEMES } from '../data/boardThemes';

function isLightSquare(sq) {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1]) - 1;
  return (file + rank) % 2 !== 0;
}

function squareToCoords(square, orientation, boardSize) {
  const squareSize = boardSize / 8;
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;

  if (orientation === 'white') {
    return {
      x: file * squareSize + squareSize / 2,
      y: (7 - rank) * squareSize + squareSize / 2,
    };
  }
  return {
    x: (7 - file) * squareSize + squareSize / 2,
    y: rank * squareSize + squareSize / 2,
  };
}

function ArrowOverlay({ arrows, orientation, boardSize }) {
  if (!arrows || arrows.length === 0) return null;
  const squareSize = boardSize / 8;

  return (
    <svg
      width={boardSize}
      height={boardSize}
      viewBox={`0 0 ${boardSize} ${boardSize}`}
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

        const start = squareToCoords(from, orientation, boardSize);
        const end = squareToCoords(to, orientation, boardSize);

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
            strokeWidth={squareSize * 0.22}
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
  theme = 'classic',
  lastMove = null,
  boardSize = 360,
}) {
  const themeObj = BOARD_THEMES[theme] || BOARD_THEMES.classic;

  // Compute last-move highlight styles
  let lastMoveHighlights = {};
  if (lastMove) {
    lastMoveHighlights = {
      [lastMove.from]: {
        backgroundColor: isLightSquare(lastMove.from) ? themeObj.hlLight : themeObj.hlDark,
      },
      [lastMove.to]: {
        backgroundColor: isLightSquare(lastMove.to) ? themeObj.hlLight : themeObj.hlDark,
      },
    };
  }

  // Last-move highlights as base, squareStyles (hints/selections) override
  const mergedStyles = { ...lastMoveHighlights, ...squareStyles };

  return (
    <div style={{ width: boardSize, height: boardSize, position: 'relative' }}>
      <div style={{ filter: themeObj.filter !== 'none' ? themeObj.filter : undefined }}>
        <Chessboard
          options={{
            id: 'trainer-board',
            position: fen,
            boardOrientation: playerColor,
            arrows: [],
            squareStyles: mergedStyles,
            allowDrawingArrows: false,
            boardStyle: {
              borderRadius: '4px',
              boxShadow: themeObj.shadow,
            },
            darkSquareStyle: { backgroundColor: themeObj.dark },
            lightSquareStyle: { backgroundColor: themeObj.light },
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
      </div>
      <ArrowOverlay arrows={arrows} orientation={playerColor} boardSize={boardSize} />
    </div>
  );
}
