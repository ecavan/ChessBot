// Head-to-head matches between bot settings, for the ladder's spacing (Elo differences).
//   SF=/path/stockfish node scripts/qa/bot-match.mjs out.json gamesPerPair '<players json>' [reach]
// players: [{ id, maia, temp } | { id, elo }] in rough strength order; each plays the next `reach` (default 2).
// A game capped at 150 plies is adjudicated by Stockfish (±3 pawns wins, else a draw).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { Chess } from 'chess.js';
import { decode, Maia, fensFromUci } from '../../src/engine/maia.js';

const [outPath, nArg = '20', playersJson, reachArg = '2'] = process.argv.slice(2);
const N = Number(nArg), REACH = Number(reachArg), SF = process.env.SF || 'stockfish';
const players = JSON.parse(playersJson);
class Engine {
  constructor() { this.p = spawn(SF, [], { stdio: ['pipe', 'pipe', 'inherit'] }); this.buf = ''; this.waiters = [];
    this.p.stdout.on('data', (d) => { this.buf += d; let i; while ((i = this.buf.indexOf('\n')) >= 0) { const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1); for (const w of [...this.waiters]) w(line); } }); }
  send(c) { this.p.stdin.write(c + '\n'); }
  until(pred, onLine) { return new Promise(res => { const f = (l) => { onLine?.(l); if (pred(l)) { this.waiters = this.waiters.filter(x => x !== f); res(l); } }; this.waiters.push(f); }); }
  async init() { this.send('uci'); await this.until(l => l === 'uciok'); this.send('setoption name Threads value 1'); this.send('setoption name Hash value 32'); this.send('isready'); await this.until(l => l === 'readyok'); }
  async go(fen, cmd, elo) {
    this.send(`setoption name UCI_LimitStrength value ${elo ? 'true' : 'false'}`); if (elo) this.send(`setoption name UCI_Elo value ${elo}`);
    this.send(`position fen ${fen}`); this.send(`go ${cmd}`);
    let cp = 0; const bm = await this.until(l => l.startsWith('bestmove'), (l) => { const m = l.match(/ score cp (-?\d+)/), mt = l.match(/ score mate (-?\d+)/); if (m) cp = Number(m[1]); if (mt) cp = Number(mt[1]) > 0 ? 10000 : -10000; });
    return { best: bm.split(' ')[1], cp };
  }
}
const eng = new Engine(); await eng.init();
const maias = {};
const maia = (r) => maias[r] ||= (() => { const meta = JSON.parse(readFileSync(new URL(`../../public/maia/maia-${r}.json`, import.meta.url))); const bin = readFileSync(new URL(`../../public/maia/maia-${r}.bin`, import.meta.url)); return new Maia(r, decode(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength))); })();
async function move(p, g, ucis) {
  if (p.maia) { const lv = Array.isArray(p.maia) ? p.maia[Math.random() < (p.mix ?? 0.5) ? 1 : 0] : p.maia; const mm = maia(lv); return mm.pick(mm.predictFens(fensFromUci(undefined, ucis), g).moves, Math.random, p.temp || 1).uci; }
  return (await eng.go(g.fen(), 'movetime 60', p.elo)).best;
}
async function play(w, b) {
  const g = new Chess(); const ucis = [];
  while (!g.isGameOver() && ucis.length < 150) { const u = await move(g.turn() === 'w' ? w : b, g, ucis); g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); ucis.push(u); }
  if (g.isCheckmate()) return g.turn() === 'w' ? 0 : 1;
  if (g.isGameOver()) return 0.5;
  const { cp } = await eng.go(g.fen(), 'nodes 200000'); const wcp = g.turn() === 'w' ? cp : -cp;
  return wcp > 300 ? 1 : wcp < -300 ? 0 : 0.5;
}
const out = existsSync(outPath) ? JSON.parse(readFileSync(outPath)) : {};
for (let i = 0; i < players.length; i++) for (let j = i + 1; j <= Math.min(players.length - 1, i + REACH); j++) {
  const a = players[i], b = players[j], key = `${a.id}|${b.id}`;
  out[key] ||= { n: 0, a: 0 };
  while (out[key].n < N) {
    const aWhite = out[key].n % 2 === 0; const r = await play(aWhite ? a : b, aWhite ? b : a);
    out[key].n++; out[key].a += aWhite ? r : 1 - r; writeFileSync(outPath, JSON.stringify(out));
  }
  console.log(key, out[key].n, 'score of first', out[key].a);
}
eng.send('quit'); process.exit(0);
