// Per-move rows from a cc-compare result (re-classified with the current src/lib/review.js, no engine):
//   node scripts/qa/cc-export.mjs games.json out.json rows.json
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { classifyGame, gameAccuracy, gameRating, counts, cpOf } from '../../src/lib/review.js';
import { posKey } from '../../src/lib/chessutil.js';
const [gamesPath, outPath, rowsPath] = process.argv.slice(2);
const book = JSON.parse(readFileSync(new URL('../../public/data/openings.json', import.meta.url)));
const isBook = (fen) => !!book[posKey(fen)];
const games = Object.fromEntries(JSON.parse(readFileSync(gamesPath)).map(g => [g.url, g]));
const out = [];
for (const r of JSON.parse(readFileSync(outPath))) {
  const g = games[r.url]; const c = new Chess(); c.loadPgn(g.pgn); const moves = c.history({ verbose: true });
  const rp = new Chess(moves[0].before); const fens = [rp.fen()]; for (const m of moves) { rp.move(m.san); fens.push(rp.fen()); }
  const positions = r.positions.map((p, i) => ({ fen: fens[i], lines: p.lines || [], ...(p.terminal != null ? { terminal: p.terminal } : {}) }));
  const cls = classifyGame(positions, moves, isBook);
  const acc = { w: gameAccuracy(cls, positions, 'w'), b: gameAccuracy(cls, positions, 'b') };
  out.push({ id: r.url.split('/').pop(), cc: r.cc, white: r.white, black: r.black, acc, est: { w: gameRating(acc.w, { rating: g.white.rating, timeClass: g.time_class }), b: gameRating(acc.b, { rating: g.black.rating, timeClass: g.time_class }) },
    counts: { w: counts(cls, 'w', 'w'), b: counts(cls, 'b', 'w') },
    moves: cls.map((x, i) => { const l = positions[i].lines; const sg = moves[i].color === 'w' ? 1 : -1;
      return { san: moves[i].san, cls: x.cls, drop: +x.drop.toFixed(2), acc: +x.acc.toFixed(1), cpBest: x.cpBest, cpAfter: x.cpAfter, source: x.source, cp2: l[1] ? sg * cpOf(l[1]) : null, legal: new Chess(fens[i]).moves().length }; }) });
}
writeFileSync(rowsPath, JSON.stringify(out)); console.log(out.length, 'games');
