export default function HintPanel({ hintLevel, hintData, onRequestHint, disabled }) {
  return (
    <div className="bg-gray-800 rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">Hints</span>
        <button
          onClick={onRequestHint}
          disabled={disabled || hintLevel >= 3}
          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 rounded transition-colors"
        >
          {hintLevel === 0 ? 'Hint' : hintLevel >= 3 ? 'Max' : `More (${hintLevel}/3)`}
        </button>
      </div>
      {hintData && (
        <p className="text-sm text-yellow-300">{hintData.text}</p>
      )}
      {!hintData && hintLevel === 0 && (
        <p className="text-xs text-gray-500">Click Hint for guidance</p>
      )}
    </div>
  );
}
