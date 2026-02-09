const QUALITY_WEIGHTS = {
  brilliant: 100,
  best: 100,
  great: 95,
  good: 80,
  okay: 55,
  book: 90,
  inaccuracy: 25,
  miss: 15,
  mistake: 10,
  blunder: 0,
};

/**
 * Estimate approximate ELO from game analysis data.
 * Blends an exponential ACPL formula with a classification quality score.
 *
 * @param {number} acpl - Average centipawn loss
 * @param {Object} classifications - { brilliant, best, great, good, okay, book, inaccuracy, miss, mistake, blunder }
 * @param {number} totalMoves - Number of player moves analyzed
 * @returns {{ elo: number, accuracy: number, acpl: number }}
 */
export function estimateElo(acpl, classifications, totalMoves) {
  // Method 1: Exponential ACPL → ELO (community formula)
  // Reference: ACPL 6 ≈ 2900, ACPL 20 ≈ 2550, ACPL 50 ≈ 1900, ACPL 100 ≈ 1140
  const acplElo = 3100 * Math.exp(-0.01 * acpl);

  // Method 2: Classification quality score → ELO
  let weightedSum = 0;
  let moveCount = 0;
  for (const [type, count] of Object.entries(classifications)) {
    if (count > 0 && QUALITY_WEIGHTS[type] !== undefined) {
      weightedSum += QUALITY_WEIGHTS[type] * count;
      moveCount += count;
    }
  }
  const qualityScore = moveCount > 0 ? weightedSum / moveCount : 50;
  // Map quality 30→200, quality 100→3000
  const classElo = Math.max(200, Math.min(3200, (qualityScore - 30) * 40));

  // Blend (ACPL is more granular, classification captures severity)
  const blended = 0.55 * acplElo + 0.45 * classElo;
  const elo = Math.round(Math.max(200, Math.min(3200, blended)));

  // Accuracy: 0-100 score based on quality
  const accuracy = Math.round(Math.max(0, Math.min(100, qualityScore)));

  return { elo, accuracy, acpl: Math.round(acpl) };
}

/**
 * Compute average centipawn loss from moves with evalBefore/evalAfter.
 * evalBefore is from the player's perspective, evalAfter from the opponent's.
 * loss = evalBefore + evalAfter (positive = player lost ground).
 *
 * @param {Array<{ evalBefore: number, evalAfter: number }>} moves
 * @returns {number} ACPL in centipawns
 */
export function computeACPL(moves) {
  if (moves.length === 0) return 0;
  let total = 0;
  for (const m of moves) {
    const loss = (m.evalBefore + m.evalAfter) * 100; // pawns → centipawns
    total += Math.max(0, loss); // only count losses, not gains
  }
  return total / moves.length;
}
