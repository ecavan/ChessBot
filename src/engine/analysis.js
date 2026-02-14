const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };

function isSacrifice(moveInfo) {
  const { piece, captured, to, color, gameAfter, from, gameBefore } = moveInfo;
  const movingValue = PIECE_VALUES[piece] || 0;
  const capturedValue = captured ? (PIECE_VALUES[captured] || 0) : 0;
  const opponentColor = color === 'w' ? 'b' : 'w';

  // Check if the piece is attacked on its destination square
  let isHanging;
  try {
    isHanging = gameAfter.isAttacked(to, opponentColor);
  } catch {
    return false;
  }
  if (!isHanging) return false;

  // Require a full piece sacrifice (net material >= 3, not just an exchange)
  const netSacrifice = movingValue - capturedValue;
  if (netSacrifice < 3) return false;

  // If the piece was already en prise before the move, moving it isn't a sacrifice
  if (gameBefore && from) {
    try {
      if (gameBefore.isAttacked(from, opponentColor)) {
        return false;
      }
    } catch {
      // If check fails, allow it
    }
  }

  return true;
}

export function classifyMove(evalBefore, evalAfter, isWhite, moveInfo) {
  // evalBefore: from the moving player's perspective
  // evalAfter: from the OPPONENT's perspective
  // loss = evalBefore + evalAfter (positive = player lost ground)
  const loss = evalBefore + evalAfter;

  // --- Positive classifications (best to good) ---

  // Brilliant: sacrifice + must be the best move or very close to it
  if (moveInfo && isSacrifice(moveInfo)) {
    const isBestOrNearBest = (moveInfo.playerUci && moveInfo.bestUci &&
      moveInfo.playerUci === moveInfo.bestUci) || loss <= 0.1;
    if (isBestOrNearBest && loss <= 0.15) {
      return { type: 'brilliant', symbol: '!!', color: '#26c6da', label: 'Brilliant' };
    }
  }

  // Great: significantly improved position beyond engine expectation
  if (loss <= -0.3) {
    return { type: 'great', symbol: '!', color: '#5dadec', label: 'Great' };
  }

  // Best: played the engine's top move — always classify as best regardless of
  // eval change, since eval noise from search depth shouldn't penalize the player
  if (moveInfo?.playerUci && moveInfo?.bestUci &&
      moveInfo.playerUci === moveInfo.bestUci) {
    return { type: 'best', symbol: '', color: '#96bc4b', label: 'Best' };
  }

  // Good: close to best
  if (loss <= 0.15) {
    return { type: 'good', symbol: '', color: '#96bc4b', label: 'Good' };
  }

  // Okay: acceptable
  if (loss <= 0.5) {
    return { type: 'okay', symbol: '', color: '#8b8b8b', label: 'Okay' };
  }

  // --- Negative classifications (worst to least bad) ---

  // Blunder: catastrophic
  if (loss >= 2.0) {
    return { type: 'blunder', symbol: '??', color: '#e74c3c', label: 'Blunder' };
  }

  // Miss: had a winning position but let it slip
  if (evalBefore >= 1.5 && loss >= 0.5) {
    return { type: 'miss', symbol: '?', color: '#e67e22', label: 'Miss' };
  }

  // Mistake: significant error
  if (loss >= 1.0) {
    return { type: 'mistake', symbol: '?', color: '#e67e22', label: 'Mistake' };
  }

  // Inaccuracy: small error
  return { type: 'inaccuracy', symbol: '?!', color: '#f7c631', label: 'Inaccuracy' };
}

export function explainMove(classification, bestMoveSan) {
  switch (classification.type) {
    case 'brilliant':
      return 'Brilliant sacrifice!';
    case 'great':
      return 'Great move!';
    case 'best':
      return 'Best move — top engine choice.';
    case 'good':
      return 'Good move.';
    case 'okay':
      return 'Okay move — slightly imprecise.';
    case 'book':
      return 'Book move — known theory.';
    case 'miss':
      return `Missed opportunity! ${bestMoveSan} was winning.`;
    case 'blunder':
      return `Blunder! ${bestMoveSan} was much stronger.`;
    case 'mistake':
      return `Mistake. Consider ${bestMoveSan} instead.`;
    case 'inaccuracy':
      return `Inaccuracy. ${bestMoveSan} was more precise.`;
    default:
      return '';
  }
}
