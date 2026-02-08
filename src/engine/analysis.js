export function classifyMove(evalBefore, evalAfter, isWhite) {
  // evalBefore: from the moving player's perspective (side to move before the move)
  // evalAfter: from the OPPONENT's perspective (side to move after the move)
  // To get loss from the moving player's view:
  //   playerEvalAfter = -evalAfter (negate opponent's perspective)
  //   loss = evalBefore - playerEvalAfter = evalBefore - (-evalAfter) = evalBefore + evalAfter
  const loss = evalBefore + evalAfter;

  if (loss >= 2.0) return { type: 'blunder', symbol: '??', color: '#e74c3c' };
  if (loss >= 1.0) return { type: 'mistake', symbol: '?', color: '#e67e22' };
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
