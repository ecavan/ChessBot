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

export function getProtectionArrows(game) {
  try {
    const playerColor = game.turn();
    const oppColor = playerColor === 'w' ? 'b' : 'w';
    const board = game.board();
    const arrows = [];

    for (const row of board) {
      for (const cell of row) {
        if (!cell || cell.color !== playerColor || cell.type === 'k') continue;

        const sq = cell.square;
        const testGame = new Chess(game.fen());
        testGame.remove(sq);
        testGame.put({ type: cell.type, color: oppColor }, sq);

        // Ensure it's the player's turn so we find player's captures
        const testParts = testGame.fen().split(' ');
        testParts[1] = playerColor;
        let flipped;
        try { flipped = new Chess(testParts.join(' ')); } catch { continue; }

        for (const move of flipped.moves({ verbose: true })) {
          if (move.to === sq && move.captured) {
            arrows.push([move.from, sq, 'rgba(0, 180, 0, 0.5)']);
          }
        }
      }
    }
    return arrows;
  } catch {
    return [];
  }
}

export function getForkArrows(game) {
  try {
    const bySource = {};
    for (const move of game.moves({ verbose: true })) {
      if (move.captured) {
        if (!bySource[move.from]) bySource[move.from] = [];
        bySource[move.from].push(move.to);
      }
    }

    const arrows = [];
    for (const [from, targets] of Object.entries(bySource)) {
      if (targets.length >= 2) {
        for (const to of targets) {
          arrows.push([from, to, 'rgba(160, 32, 240, 0.6)']);
        }
      }
    }
    return arrows;
  } catch {
    return [];
  }
}
