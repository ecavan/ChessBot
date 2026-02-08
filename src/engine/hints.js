import { Chess } from 'chess.js';

function uciToSan(uci, game) {
  try {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const tempGame = new Chess(game.fen());
    const move = tempGame.move({ from, to, promotion });
    return move ? move.san : uci;
  } catch {
    return uci;
  }
}

export function generateHint(topLines, game, level) {
  if (!topLines || topLines.length === 0) return null;

  if (level === 1) {
    const squareStyles = {};
    topLines.slice(0, 3).forEach((line) => {
      if (line && line.moves && line.moves[0]) {
        const dest = line.moves[0].slice(2, 4);
        squareStyles[dest] = { backgroundColor: 'rgba(255, 255, 0, 0.4)' };
      }
    });
    return { type: 'squares', squareStyles, arrows: [], text: 'Pay attention to these squares.' };
  }

  if (level === 2) {
    const arrows = topLines.slice(0, 3).map((line, i) => {
      if (!line || !line.moves || !line.moves[0]) return null;
      const from = line.moves[0].slice(0, 2);
      const to = line.moves[0].slice(2, 4);
      const color = i === 0 ? 'rgb(0, 180, 0)' : 'rgb(0, 100, 200)';
      return [from, to, color];
    }).filter(Boolean);
    return { type: 'arrows', squareStyles: {}, arrows, text: 'These are the candidate moves.' };
  }

  // Level 3: reveal best move
  const best = topLines[0];
  if (!best || !best.moves || !best.moves[0]) return null;
  const from = best.moves[0].slice(0, 2);
  const to = best.moves[0].slice(2, 4);
  const san = uciToSan(best.moves[0], game);
  return {
    type: 'bestMove',
    squareStyles: {},
    arrows: [[from, to, 'rgb(0, 200, 0)']],
    text: `Best move: ${san} (eval: ${best.eval > 0 ? '+' : ''}${best.eval.toFixed(1)})`,
  };
}
