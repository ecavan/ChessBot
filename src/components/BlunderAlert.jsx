export default function BlunderAlert({
  visible, evalLoss, bestMoveSan, bestLine, bestLineEval,
  playerMoveSan, classification, onConfirm, onTakeBack,
}) {
  if (!visible) return null;

  const titles = { blunder: 'Blunder!', mistake: 'Mistake!', miss: 'Missed Opportunity!' };
  const borders = { blunder: 'border-red-500', mistake: 'border-orange-500', miss: 'border-orange-500' };
  const title = titles[classification?.type] || 'Mistake!';
  const bgColor = borders[classification?.type] || 'border-orange-500';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className={`bg-gray-800 border-2 ${bgColor} rounded-lg p-6 max-w-sm mx-4 shadow-2xl`}>
        <h3 className="text-xl font-bold mb-2" style={{ color: classification?.color }}>
          {classification?.symbol} {title}
        </h3>

        {playerMoveSan && (
          <p className="text-gray-300 mb-1">
            You played <span className="font-bold" style={{ color: classification?.color }}>{playerMoveSan}</span>
            {evalLoss > 0 && <span className="text-gray-400"> ({evalLoss >= 2 ? 'loses' : 'costs'} ~{evalLoss.toFixed(1)} pawns)</span>}
          </p>
        )}

        {bestLine ? (
          <div className="bg-gray-900 rounded p-3 my-3">
            <p className="text-xs text-gray-500 mb-1">Better continuation:</p>
            <p className="text-green-400 font-mono text-sm font-medium">{bestLine}</p>
            {bestLineEval != null && (
              <p className="text-xs text-gray-500 mt-1">
                Eval: {bestLineEval > 0 ? '+' : ''}{bestLineEval.toFixed(1)}
              </p>
            )}
          </div>
        ) : bestMoveSan ? (
          <p className="text-gray-400 text-sm mb-4">
            Consider <span className="text-green-400 font-bold">{bestMoveSan}</span> instead.
          </p>
        ) : null}

        <div className="flex gap-3">
          <button
            onClick={onTakeBack}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-medium transition-colors"
          >
            Take back
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded font-medium transition-colors"
          >
            Play anyway
          </button>
        </div>
      </div>
    </div>
  );
}
