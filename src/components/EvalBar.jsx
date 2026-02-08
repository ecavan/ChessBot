export default function EvalBar({ evaluation, playerColor = 'white' }) {
  const clampedEval = Math.max(-10, Math.min(10, evaluation ?? 0));
  // White percentage: eval 0 = 50%, +10 = 100%, -10 = 0%
  const whitePercent = 50 + clampedEval * 5;

  const displayEval = evaluation === null
    ? '...'
    : Math.abs(evaluation) >= 100
      ? (evaluation > 0 ? 'M' : '-M')
      : (evaluation > 0 ? '+' : '') + evaluation.toFixed(1);

  const isFlipped = playerColor === 'black';

  return (
    <div className="flex flex-col items-center mr-2" style={{ height: 480 }}>
      <div
        className="relative w-6 rounded overflow-hidden"
        style={{ height: '100%' }}
      >
        {/* White section */}
        <div
          className="absolute transition-all duration-500 ease-out"
          style={{
            backgroundColor: '#f0f0f0',
            bottom: isFlipped ? undefined : 0,
            top: isFlipped ? 0 : undefined,
            left: 0,
            right: 0,
            height: `${whitePercent}%`,
          }}
        />
        {/* Black section */}
        <div
          className="absolute transition-all duration-500 ease-out"
          style={{
            backgroundColor: '#333',
            top: isFlipped ? undefined : 0,
            bottom: isFlipped ? 0 : undefined,
            left: 0,
            right: 0,
            height: `${100 - whitePercent}%`,
          }}
        />
      </div>
      <span className="text-xs mt-1 font-mono text-gray-300">{displayEval}</span>
    </div>
  );
}
