export default function BlunderAlert({ visible, evalLoss, bestMoveSan, classification, onConfirm, onTakeBack }) {
  if (!visible) return null;

  const title = classification?.type === 'blunder' ? 'Blunder!' : 'Mistake!';
  const bgColor = classification?.type === 'blunder' ? 'border-red-500' : 'border-orange-500';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className={`bg-gray-800 border-2 ${bgColor} rounded-lg p-6 max-w-sm mx-4 shadow-2xl`}>
        <h3 className="text-xl font-bold mb-2" style={{ color: classification?.color }}>
          {title}
        </h3>
        <p className="text-gray-300 mb-1">
          This move loses {evalLoss.toFixed(1)} pawns of evaluation.
        </p>
        {bestMoveSan && (
          <p className="text-gray-400 text-sm mb-4">
            Consider <span className="text-green-400 font-bold">{bestMoveSan}</span> instead.
          </p>
        )}
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
