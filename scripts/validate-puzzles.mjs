// Validates all puzzles: FEN validity, move legality, playerColor matching
import { Chess } from 'chess.js';
import { PUZZLES } from '../src/data/puzzles.js';

let errors = 0;
let warnings = 0;

for (const p of PUZZLES) {
  const prefix = `[${p.id}] "${p.name}"`;

  // 1. Validate FEN
  let game;
  try {
    game = new Chess(p.fen);
  } catch (e) {
    console.error(`${prefix} INVALID FEN: ${p.fen}`);
    errors++;
    continue;
  }

  // 2. playerColor must match side to move for first move
  const turnColor = game.turn() === 'w' ? 'white' : 'black';
  if (turnColor !== p.playerColor) {
    console.error(`${prefix} playerColor=${p.playerColor} but FEN turn=${turnColor}`);
    errors++;
  }

  // 3. Solution must not be empty
  if (!p.solution || p.solution.length === 0) {
    console.error(`${prefix} empty solution`);
    errors++;
    continue;
  }

  // 4. Validate each move in the solution
  let moveOk = true;
  for (let i = 0; i < p.solution.length; i++) {
    const uci = p.solution[i];
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    try {
      const move = game.move({ from, to, promotion });
      if (!move) {
        console.error(`${prefix} move ${i} "${uci}" returned null (illegal)`);
        errors++;
        moveOk = false;
        break;
      }
    } catch (e) {
      console.error(`${prefix} move ${i} "${uci}" threw: ${e.message}`);
      errors++;
      moveOk = false;
      break;
    }
  }

  // 5. Check difficulty vs solution length
  const playerMoves = p.solution.filter((_, i) => i % 2 === 0).length;
  if (p.difficulty === 'beginner' && playerMoves > 1) {
    console.warn(`${prefix} WARNING: beginner puzzle has ${playerMoves} player moves`);
    warnings++;
  }
  if (p.difficulty === 'expert' && playerMoves < 2) {
    console.warn(`${prefix} WARNING: expert puzzle has only ${playerMoves} player move(s)`);
    warnings++;
  }

  if (moveOk) {
    console.log(`${prefix} ✓ (${p.difficulty}, ${playerMoves} player move(s))`);
  }
}

console.log(`\n=== Results: ${PUZZLES.length} puzzles, ${errors} errors, ${warnings} warnings ===`);

// Summary by difficulty
const counts = {};
for (const p of PUZZLES) {
  counts[p.difficulty] = (counts[p.difficulty] || 0) + 1;
}
console.log('Counts:', counts);

if (errors > 0) process.exit(1);
