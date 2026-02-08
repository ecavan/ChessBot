import { Chess } from 'chess.js';

export function getThreats(game) {
  try {
    const fen = game.fen();
    const parts = fen.split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    const flipped = new Chess(parts.join(' '));

    const threats = [];
    for (const move of flipped.moves({ verbose: true })) {
      if (move.captured) {
        threats.push([move.from, move.to, 'rgba(255, 0, 0, 0.6)']);
      }
    }
    return threats;
  } catch {
    return [];
  }
}

export function getPlayerThreats(game) {
  try {
    const threats = [];
    for (const move of game.moves({ verbose: true })) {
      if (move.captured) {
        threats.push([move.from, move.to, 'rgba(255, 165, 0, 0.6)']);
      }
    }
    return threats;
  } catch {
    return [];
  }
}
