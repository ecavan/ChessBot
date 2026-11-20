// How strong does each bot actually play? Self-play games for every bot (the same move rule as
// src/engine/bots.js, on a native Stockfish 17.1 and the JS Maia), reviewed with the app's own
// review code, next to real chess.com games reviewed the same way.
//   SF=/path/stockfish node scripts/qa/bot-arena.mjs out.json [gamesPerBot] [humans.json ...]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { Chess } from 'chess.js';
import { classifyGame, gameAccuracy, counts, cpOf } from '../../src/lib/review.js';
import { posKey } from '../../src/lib/chessutil.js';
import { decode, Maia, fensFromUci } from '../../src/engine/maia.js';
import { BOTS } from '../../src/engine/bots.js';

const [outPath, nArg = '8', ...humanFiles] = process.argv.slice(2);
const N = Number(nArg), SF = process.env.SF || 'stockfish', NODES = Number(process.env.NODES || 150000);
const book = JSON.parse(readFileSync(new URL('../../public/data/openings.json', import.meta.url)));
const isBook = (fen) => !!book[posKey(fen)];
class Engine {
  constructor() { this.p = spawn(SF, [], { stdio: ['pipe', 'pipe', 'inherit'] }); this.buf = ''; this.waiters = [];
    this.p.stdout.on('data', (d) => { this.buf += d; let i; while ((i = this.buf.indexOf('\n')) >= 0) { const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1); for (const w of [...this.waiters]) w(line); } }); }
  send(c) { this.p.stdin.write(c + '\n'); }
  until(pred, onLine) { return new Promise(res => { const f = (l) => { onLine?.(l); if (pred(l)) { this.waiters = this.waiters.filter(x => x !== f); res(l); } }; this.waiters.push(f); }); }
  async init() { this.send('uci'); await this.until(l => l === 'uciok'); this.send('setoption name Threads value 1'); this.send('setoption name Hash value 64'); this.send('isready'); await this.until(l => l === 'readyok'); }
  async search(fen, go, { multipv = 2, elo = null } = {}) {
    const lines = [];
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send(`setoption name UCI_LimitStrength value ${elo ? 'true' : 'false'}`);
    if (elo) this.send(`setoption name UCI_Elo value ${elo}`);
    this.send(`position fen ${fen}`); this.send(`go ${go}`);
    const bm = await this.until(l => l.startsWith('bestmove'), (l) => {
      if (!l.startsWith('info') || !l.includes(' pv ') || / (upperbound|lowerbound)/.test(l)) return;
      const k = Number((l.match(/ multipv (\d+)/) || [0, 1])[1]) - 1;
      const cp = l.match(/ score cp (-?\d+)/), mate = l.match(/ score mate (-?\d+)/);
      lines[k] = { ...(cp ? { cp: Number(cp[1]) } : {}), ...(mate ? { mate: Number(mate[1]) } : {}), pv: l.split(' pv ')[1].split(' ') };
    });
    const white = fen.split(' ')[1] === 'w';
    return { bestmove: bm.split(' ')[1], lines: lines.filter(Boolean).map(x => ({ ...x, ...(x.cp != null ? { cp: white ? x.cp : -x.cp } : {}), ...(x.mate != null ? { mate: white ? x.mate : -x.mate } : {}) })) };
  }
}
const eng = new Engine(); await eng.init();
const maias = {};
const maia = (r) => maias[r] ||= (() => { const meta = JSON.parse(readFileSync(new URL(`../../public/maia/maia-${r}.json`, import.meta.url))); const bin = readFileSync(new URL(`../../public/maia/maia-${r}.bin`, import.meta.url)); return new Maia(r, decode(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength))); })();

async function botMove(bot, fen, ucis) {
  const g = new Chess(fen); const legal = g.moves({ verbose: true }); if (!legal.length) return null;
  if (bot.maia) {
    const fens = fensFromUci(undefined, ucis);
    const moves = maia(bot.maia).predictFens(fens, g).moves;
    const m = maia(bot.maia).pick(moves, Math.random, bot.temp || 1);
    return m.uci;
  }
  if (!bot.weak) return (await eng.search(fen, 'movetime 150', { multipv: 1, elo: Math.max(1320, bot.elo) })).bestmove;
  const { depth, temp, random } = bot.weak;
  if (Math.random() < random) {
    const safe = legal.filter(m => { const h = new Chess(fen); h.move(m); return !h.moves({ verbose: true }).some(x => { const k = new Chess(h.fen()); k.move(x); return k.isCheckmate(); }); });
    const pool = safe.length ? safe : legal; const m = pool[Math.floor(Math.random() * pool.length)]; return m.from + m.to + (m.promotion || '');
  }
  const r = await eng.search(fen, `depth ${depth}`, { multipv: Math.min(5, legal.length) });
  if (!r.lines.length) return r.bestmove;
  const white = fen.split(' ')[1] === 'w';
  const scored = r.lines.filter(l => l.pv?.length).map(l => ({ uci: l.pv[0], cp: (white ? 1 : -1) * cpOf(l) }));
  const top = Math.max(...scored.map(s => s.cp)); const w = scored.map(s => Math.exp((s.cp - top) / temp));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < scored.length; i++) { x -= w[i]; if (x <= 0) return scored[i].uci; }
  return scored[0].uci;
}
const terminalOf = (g) => g.isCheckmate() ? (g.turn() === 'w' ? -10000 : 10000) : (g.isStalemate() || g.isInsufficientMaterial() || g.isThreefoldRepetition()) ? 0 : null;
async function review(sans) {
  const r = new Chess(); const fens = [r.fen()]; const moves = [];
  for (const s of sans) { moves.push(r.move(s)); fens.push(r.fen()); }
  const positions = []; const rp = new Chess();
  for (let i = 0; i < fens.length; i++) { if (i > 0) rp.move(sans[i - 1]); const t = terminalOf(rp); positions.push(t != null ? { fen: fens[i], lines: [], terminal: t } : { fen: fens[i], lines: (await eng.search(fens[i], `nodes ${NODES}`)).lines }); }
  const cls = classifyGame(positions, moves, isBook);
  const acc = { w: gameAccuracy(cls, positions, 'w'), b: gameAccuracy(cls, positions, 'b') };
  const c = { w: counts(cls, 'w', 'w'), b: counts(cls, 'b', 'w') };
  // hung material: moves that lose a piece outright to the reply (drop in win% > 20 = blunder)
  return { plies: sans.length, acc, counts: c };
}
const out = existsSync(outPath) ? JSON.parse(readFileSync(outPath)) : {};
const save = () => writeFileSync(outPath, JSON.stringify(out));
// humans
for (const f of humanFiles) for (const g of JSON.parse(readFileSync(f)).games) {
  if (g.rules !== 'chess' || !g.pgn || g.time_class !== 'blitz') continue;
  out.humans ||= []; if (out.humans.some(h => h.url === g.url)) continue;
  const c = new Chess(); c.loadPgn(g.pgn); const sans = c.history(); if (sans.length < 20) continue;
  const r = await review(sans); const me = g.white.username.toLowerCase() === 'ecavan' ? 'w' : 'b';
  out.humans.push({ url: g.url, me, r: { w: g.white.rating, b: g.black.rating }, cc: g.accuracies || null, ...r }); save();
  console.log('human', out.humans.length, sans.length, r.acc, g.accuracies || '');
}
const VARIANTS = process.env.VARIANTS ? JSON.parse(process.env.VARIANTS) : [...BOTS.filter(b => !b.max && (b.maia || b.elo <= 1600))];
for (const bot of VARIANTS) {
  out[bot.id] ||= [];
  while (out[bot.id].length < N) {
    const g = new Chess(); const ucis = [];
    while (!g.isGameOver() && ucis.length < 160) { const u = await botMove(bot, g.fen(), ucis); if (!u) break; g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); ucis.push(u); }
    const r = await review(g.history());
    out[bot.id].push({ ...r, over: g.isCheckmate() ? 'mate' : g.isGameOver() ? 'draw' : 'cap' }); save();
    console.log(bot.id, out[bot.id].length, r.plies, r.acc, r.est, out[bot.id].at(-1).over);
  }
}
eng.send('quit'); process.exit(0);
