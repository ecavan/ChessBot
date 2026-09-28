// Opening names by position, from lichess-org/chess-openings (CC0): position (FEN without the
// move counters) → [eco, name]. Used to name openings and to mark book moves in game review.
//   node scripts/build-openings.mjs <dir with a.tsv … e.tsv>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chess.js';
const dir = process.argv[2];
const out = {};
for (const f of 'abcde') {
  const rows = readFileSync(`${dir}/${f}.tsv`, 'utf8').trim().split('\n').slice(1);
  for (const r of rows) {
    const [eco, name, pgn] = r.split('\t');
    const g = new Chess();
    const sans = pgn.replace(/\d+\.\s*/g, '').trim().split(/\s+/);
    try { for (const s of sans) g.move(s); } catch { continue; }
    const key = g.fen().split(' ').slice(0, 4).join(' ');
    if (!out[key] || name.length < out[key][1].length) out[key] = [eco, name];
  }
}
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/openings.json', JSON.stringify(out));
console.log('positions', Object.keys(out).length);
