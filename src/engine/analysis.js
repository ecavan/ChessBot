export function classifyMove(evalBefore, evalAfter, isWhite) {
  const before = isWhite ? evalBefore : -evalBefore;
  const after = isWhite ? evalAfter : -evalAfter;
  const loss = before - after;

  if (loss >= 3.0) return { type: 'blunder', symbol: '??', color: '#e74c3c' };
  if (loss >= 1.5) return { type: 'mistake', symbol: '?', color: '#e67e22' };
  if (loss >= 0.5) return { type: 'inaccuracy', symbol: '?!', color: '#f1c40f' };
  if (loss <= -0.5) return { type: 'great', symbol: '!', color: '#2ecc71' };
  return { type: 'good', symbol: '', color: '#95a5a6' };
}

export function explainMove(classification, bestMoveSan) {
  switch (classification.type) {
    case 'blunder':
      return `Blunder! ${bestMoveSan} was much stronger.`;
    case 'mistake':
      return `Mistake. Consider ${bestMoveSan} instead.`;
    case 'inaccuracy':
      return `Inaccuracy. ${bestMoveSan} was more precise.`;
    case 'great':
      return 'Excellent move!';
    default:
      return '';
  }
}
