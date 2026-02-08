import { useEffect, useRef } from 'react';

export default function ReviewPanel({ analysis, currentIndex, onNavigate, summary }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current && currentIndex >= 0) {
      const el = listRef.current.children[Math.floor(currentIndex / 2)];
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [currentIndex]);

  if (!analysis) return null;

  // Group into move pairs
  const rows = [];
  for (let i = 0; i < analysis.length; i += 2) {
    rows.push({
      number: Math.floor(i / 2) + 1,
      white: analysis[i] || null,
      black: analysis[i + 1] || null,
      whiteIndex: i,
      blackIndex: i + 1,
    });
  }

  return (
    <div className="bg-gray-800 rounded p-3">
      {summary && (
        <div className="flex gap-4 mb-3 pb-2 border-b border-gray-700 text-sm">
          <span className="text-red-400">{summary.blunders} blunders</span>
          <span className="text-orange-400">{summary.mistakes} mistakes</span>
          <span className="text-yellow-400">{summary.inaccuracies} inaccuracies</span>
        </div>
      )}

      <div ref={listRef} className="overflow-y-auto font-mono text-sm" style={{ maxHeight: 300 }}>
        {rows.map((row) => (
          <div key={row.number} className="flex gap-1 py-0.5">
            <span className="text-gray-500 w-8 text-right shrink-0">{row.number}.</span>
            {row.white && (
              <button
                onClick={() => onNavigate(row.whiteIndex)}
                className={`px-1 rounded hover:bg-gray-600 transition-colors ${
                  currentIndex === row.whiteIndex ? 'bg-gray-600' : ''
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
                onClick={() => onNavigate(row.blackIndex)}
                className={`px-1 rounded hover:bg-gray-600 transition-colors ${
                  currentIndex === row.blackIndex ? 'bg-gray-600' : ''
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

      {/* Explanation for selected move */}
      {analysis[currentIndex] && analysis[currentIndex].explanation && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <p className="text-sm" style={{ color: analysis[currentIndex].classification?.color }}>
            {analysis[currentIndex].explanation}
          </p>
        </div>
      )}
    </div>
  );
}
