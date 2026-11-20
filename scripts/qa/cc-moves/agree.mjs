// How often the app's label for a move is chess.com's.  node scripts/qa/cc-moves/agree.mjs rows.json [more-rows.json ...]
import { readFileSync } from 'node:fs';
const here = new URL('.', import.meta.url);
const cc = Object.fromEntries(readFileSync(new URL('labels.txt', here), 'utf8').trim().split('\n@@\n').map(b => { const [id, , mv] = b.split('\n'); return [id.trim(), mv.split(';').map(x => x.split('|'))]; }));
const rows = Object.fromEntries(process.argv.slice(2).flatMap(f => JSON.parse(readFileSync(f))).map(g => [g.id, g]));
const band = (c) => (['mistake', 'miss', 'blunder'].includes(c) ? 'bad' : c === 'inaccuracy' ? 'inaccuracy' : 'fine');
const cols = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
const conf = {}; let n = 0, same = 0, sameBand = 0, games = 0;
for (const [id, mv] of Object.entries(cc)) {
  const g = rows[id]; if (!g) continue; games++;
  mv.forEach((m, i) => {
    let a = m[2].toLowerCase(); const b = g.moves[i]?.cls;
    if (!b || a === 'skill') return;
    if (a === 'forced') a = 'best'; // the only legal move: the app calls it Best
    n++; if (a === b) same++; if (band(a) === band(b)) sameBand++;
    conf[a] ||= {}; conf[a][b] = (conf[a][b] || 0) + 1;
  });
}
console.log(`${games} games, ${n} moves: same label ${(100 * same / n).toFixed(1)}%, same band ${(100 * sameBand / n).toFixed(1)}%`);
console.log('chess.com \\ app'.padEnd(15) + cols.map(c => c.slice(0, 5).padStart(6)).join(''));
for (const a of cols) console.log(a.padEnd(15) + cols.map(b => String(conf[a]?.[b] || 0).padStart(6)).join(''));
