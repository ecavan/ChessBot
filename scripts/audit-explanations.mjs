// Offline explanation audit: analyse exported games (JSON from localStorage chess.games.v2: id, you, startFen, uci…) with Stockfish (node), classify,
//   node scripts/audit-explanations.mjs [movetime ms] [games.json]  → out/audit/moments.json (every explained mistake)
// and print the coach's explanation for each of the user's inaccuracies/mistakes/blunders/misses.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { classifyGame } from '../src/lib/review.js';
import { explainMove } from '../src/lib/coach.js';

const MS = Number(process.argv[2] || 120);
const games = JSON.parse(readFileSync('process.argv[3] || 'out/audit/games.json'', 'utf8'));
const sf = spawn('node', ['node_modules/stockfish/src/stockfish-17.1-lite-51f59da.js']);
let buf = '';
const waiters = [];
sf.stdout.on('data', (d) => { buf += d.toString(); let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); for (const w of waiters) w(line); } });
const send = (s) => sf.stdin.write(s + '\n');
const until = (pred) => new Promise((res) => { const w = (line) => { if (pred(line)) { waiters.splice(waiters.indexOf(w), 1); res(line); } }; waiters.push(w); });
send('uci'); await until(l => l === 'uciok');
send('setoption name MultiPV value 2'); send('setoption name Threads value 2'); send('setoption name Hash value 64');
send('isready'); await until(l => l === 'readyok');

function parseInfo(line) {
  const num = (k) => { const m = line.match(new RegExp(` ${k} (-?\\d+)`)); return m ? Number(m[1]) : undefined; };
  const pv = (line.match(/ pv (.*)$/) || [])[1]?.split(' ') || [];
  return { multipv: num('multipv') || 1, depth: num('depth'), cp: num('cp'), mate: num('mate'), pv };
}
async function search(fen) {
  const white = fen.split(' ')[1] === 'w';
  const sign = white ? 1 : -1;
  const lines = {};
  const w = (line) => { if (line.startsWith('info') && / pv /.test(line) && / depth /.test(line)) { const i = parseInfo(line); lines[i.multipv] = i; } };
  waiters.push(w);
  send(`position fen ${fen}`); send(`go movetime ${MS}`);
  await until(l => l.startsWith('bestmove'));
  waiters.splice(waiters.indexOf(w), 1);
  return [1, 2].filter(k => lines[k]).map(k => ({ ...(lines[k].cp != null ? { cp: sign * lines[k].cp } : {}), ...(lines[k].mate != null ? { mate: sign * lines[k].mate } : {}), depth: lines[k].depth, pv: lines[k].pv.slice(0, 12) }));
}
const terminalOf = (g) => (g.isCheckmate() ? (g.turn() === 'w' ? -10000 : 10000) : (g.isStalemate() || g.isInsufficientMaterial()) ? 0 : null);

const out = [];
let n = 0;
for (const game of games) {
  const g = new Chess(game.startFen || undefined);
  const fens = [g.fen()], moves = [];
  for (const u of game.uci) { const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); moves.push(m); fens.push(g.fen()); }
  const positions = [];
  for (const fen of fens) { const t = terminalOf(new Chess(fen)); positions.push(t != null ? { lines: [], terminal: t } : { lines: await search(fen) }); }
  const cls = classifyGame(positions, moves);
  const opp = game.you === 'w' ? game.black : game.white;
  for (let i = 0; i < moves.length; i++) {
    if (moves[i].color !== game.you) continue;
    const c = cls[i];
    if (!['inaccuracy', 'mistake', 'blunder', 'miss'].includes(c.cls)) continue;
    const uci = moves[i].from + moves[i].to + (moves[i].promotion || '');
    const ex = explainMove(fens[i], uci, { cls: c.cls, drop: c.drop, bestUci: c.bestUci, bestLine: c.bestLine, afterLine: c.afterLine, ply: i, prevUci: i ? moves[i - 1].from + moves[i - 1].to + (moves[i - 1].promotion || '') : null, prevCaptured: i ? !!moves[i - 1].captured : null, mateIn: c.mateIn, wAfter: c.wAfter });
    out.push({ game: `${game.date} vs ${opp}`, ply: i, san: `${Math.floor(i / 2) + 1}${moves[i].color === 'w' ? '.' : '…'}${moves[i].san}`, cls: c.cls, drop: Math.round(c.drop), fen: fens[i], best: c.bestUci, points: ex.points });
  }
  n++;
  if (n % 10 === 0) { console.error(`${n}/${games.length} games, ${out.length} moments`); writeFileSync('out/audit/moments.json', JSON.stringify(out, null, 1)); }
}
writeFileSync('out/audit/moments.json', JSON.stringify(out, null, 1));
console.error('done', out.length);
sf.kill();
