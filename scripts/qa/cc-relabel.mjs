// Re-run the app's move classification on positions saved by cc-compare.mjs (no engine needed),
// so rule changes in src/lib/review.js can be checked against chess.com's labels quickly.
//   node scripts/qa/cc-relabel.mjs ours.json games.json out.json
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { classifyGame, gameAccuracy } from '../../src/lib/review.js';
import { posKey } from '../../src/lib/chessutil.js';

const [oursPath, gamesPath, outPath] = process.argv.slice(2);
const book = JSON.parse(readFileSync(new URL('../../public/data/openings.json', import.meta.url)));
const isBook = (fen) => !!book[posKey(fen)];
const pgn = Object.fromEntries(JSON.parse(readFileSync(gamesPath)).map(g => [g.url, g.pgn]));
const out = [];
for (const d of JSON.parse(readFileSync(oursPath))) {
  const c = new Chess(); c.loadPgn(pgn[d.url]);
  const moves = c.history({ verbose: true });
  const r = new Chess(moves[0].before); const fens = [r.fen()];
  for (const m of moves) { r.move(m.san); fens.push(r.fen()); }
  const positions = d.positions.map((p, i) => ({ fen: fens[i], terminal: p.terminal ?? undefined, lines: p.lines || [] }));
  positions.forEach(p => { if (p.terminal == null) delete p.terminal; });
  const cls = classifyGame(positions, moves, isBook);
  out.push({ url: d.url, cc: d.cc, ours: { white: gameAccuracy(cls, positions, 'w'), black: gameAccuracy(cls, positions, 'b') }, white: d.white, black: d.black, me: d.me, plies: d.plies,
    moves: cls.map((x, i) => ({ san: moves[i].san, cls: x.cls, drop: Math.round(x.drop * 10) / 10, acc: x.acc })) , positions: d.positions });
}
writeFileSync(outPath, JSON.stringify(out));
console.log(out.length, 'games relabelled');
