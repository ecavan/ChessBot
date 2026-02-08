import { useEffect, useRef } from 'react';

export default function MoveList({ history, currentMoveIndex, onMoveClick }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [history.length]);

  // Group moves into pairs (white, black)
  const rows = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({
      number: Math.floor(i / 2) + 1,
      white: history[i] || null,
      black: history[i + 1] || null,
      whiteIndex: i,
      blackIndex: i + 1,
    });
  }

  return (
    <div
      ref={listRef}
      className="bg-gray-800 rounded p-2 overflow-y-auto text-sm font-mono"
      style={{ maxHeight: 240, minHeight: 120 }}
    >
      {rows.length === 0 && (
        <p className="text-gray-500 text-center py-4">No moves yet</p>
      )}
      {rows.map((row) => (
        <div key={row.number} className="flex gap-1 py-0.5">
          <span className="text-gray-500 w-8 text-right shrink-0">{row.number}.</span>
          {row.white && (
            <button
              onClick={() => onMoveClick?.(row.whiteIndex)}
              className={`px-1 rounded hover:bg-gray-600 transition-colors ${
                currentMoveIndex === row.whiteIndex ? 'bg-gray-600' : ''
              }`}
              style={{ color: row.white.classification?.color || '#fff' }}
            >
              {row.white.san}
              {row.white.classification?.symbol && (
                <span className="ml-0.5">{row.white.classification.symbol}</span>
              )}
            </button>
          )}
          {row.black && (
            <button
              onClick={() => onMoveClick?.(row.blackIndex)}
              className={`px-1 rounded hover:bg-gray-600 transition-colors ${
                currentMoveIndex === row.blackIndex ? 'bg-gray-600' : ''
              }`}
              style={{ color: row.black.classification?.color || '#fff' }}
            >
              {row.black.san}
              {row.black.classification?.symbol && (
                <span className="ml-0.5">{row.black.classification.symbol}</span>
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
