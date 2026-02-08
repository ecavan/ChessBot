export default function HintPanel({ hintLevel, hintData, onRequestHint, disabled }) {
  return (
    <div className="bg-gray-800 rounded p-3">
      <button
        onClick={onRequestHint}
        disabled={disabled || hintLevel >= 3}
        className="w-full px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 rounded transition-colors mb-2"
      >
        {hintLevel === 0 ? 'Hint (H)' : hintLevel >= 3 ? 'Best Move Shown' : `More Hints (${hintLevel}/3)`}
      </button>
      {hintData && (
        <p className="text-sm text-yellow-300">{hintData.text}</p>
      )}
      {!hintData && hintLevel === 0 && (
        <p className="text-xs text-gray-500">Press H or click for progressive hints</p>
      )}
    </div>
  );
}
