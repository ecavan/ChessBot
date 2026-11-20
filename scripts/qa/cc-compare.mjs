// Review chess.com games with the app's own review code (src/lib/review.js) and a native
// Stockfish 17.1, so the results can be compared with chess.com's accuracies.
//   node scripts/qa/cc-compare.mjs games.json out.json [nodes] [maxGames]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { Chess } from 'chess.js';
import { classifyGame, gameAccuracy, gameRating, counts } from '../../src/lib/review.js';
import { posKey } from '../../src/lib/chessutil.js';

const [gamesPath, outPath, nodesArg = '1000000', maxArg = '30'] = process.argv.slice(2);
const SF = process.env.SF || 'stockfish'; // a native Stockfish binary
const NODES = Number(nodesArg);
const book = JSON.parse(readFileSync(new URL('../../public/data/openings.json', import.meta.url)));
const isBook = (fen) => !!book[posKey(fen)];

class Engine {
  constructor() {
    this.p = spawn(SF, [], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.buf = ''; this.waiters = [];
    this.p.stdout.on('data', (d) => { this.buf += d; let i; while ((i = this.buf.indexOf('\n')) >= 0) { const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1); for (const w of [...this.waiters]) w(line); } });
  }
  send(c) { this.p.stdin.write(c + '\n'); }
  until(pred, onLine) { return new Promise(res => { const f = (l) => { onLine?.(l); if (pred(l)) { this.waiters = this.waiters.filter(x => x !== f); res(l); } }; this.waiters.push(f); }); }
  async init() { this.send('uci'); await this.until(l => l === 'uciok'); this.send('setoption name Threads value 1'); this.send('setoption name Hash value 64'); this.send('setoption name MultiPV value 2'); this.send('isready'); await this.until(l => l === 'readyok'); }
  async search(fen) {
    const lines = [];
    this.send(`position fen ${fen}`);
    this.send(`go nodes ${NODES}`);
    await this.until(l => l.startsWith('bestmove'), (l) => {
      if (!l.startsWith('info') || !l.includes(' pv ') || / (upperbound|lowerbound)/.test(l)) return;
      const k = Number((l.match(/ multipv (\d+)/) || [0, 1])[1]) - 1;
      const cp = l.match(/ score cp (-?\d+)/), mate = l.match(/ score mate (-?\d+)/);
      const depth = Number(l.match(/ depth (\d+)/)[1]);
      const pv = l.split(' pv ')[1].split(' ');
      lines[k] = { ...(cp ? { cp: Number(cp[1]) } : {}), ...(mate ? { mate: Number(mate[1]) } : {}), depth, pv };
    });
    // the app stores lines from White's side
    const white = fen.split(' ')[1] === 'w';
    return lines.filter(Boolean).map(x => ({ ...x, ...(x.cp != null ? { cp: white ? x.cp : -x.cp } : {}), ...(x.mate != null ? { mate: white ? x.mate : -x.mate } : {}) }));
  }
}

function terminalOf(g) {
  if (g.isCheckmate()) return g.turn() === 'w' ? -10000 : 10000;
  if (g.isStalemate() || g.isInsufficientMaterial() || g.isThreefoldRepetition()) return 0;
  return null;
}

const games = JSON.parse(readFileSync(gamesPath)).filter(g => g.accuracies && g.rules === 'chess' && g.pgn).reverse().slice(0, Number(maxArg));
const done = existsSync(outPath) ? JSON.parse(readFileSync(outPath)) : [];
const have = new Set(done.map(d => d.url));
const eng = new Engine();
await eng.init();
for (const g of games) {
  if (have.has(g.url)) continue;
  const c = new Chess();
  c.loadPgn(g.pgn);
  const moves = c.history({ verbose: true });
  if (moves.length < 20) continue;
  const r = new Chess(moves[0].before);
  const fens = [r.fen()];
  for (const m of moves) { r.move(m.san); fens.push(r.fen()); }
  const positions = [];
  const t0 = Date.now();
  const replay = new Chess(fens[0]);
  for (let i = 0; i < fens.length; i++) {
    if (i > 0) replay.move(moves[i - 1].san);
    const term = terminalOf(replay);
    positions.push(term != null ? { fen: fens[i], lines: [], terminal: term } : { fen: fens[i], lines: await eng.search(fens[i]) });
  }
  const cls = classifyGame(positions, moves, isBook);
  const acc = { w: gameAccuracy(cls, positions, 'w'), b: gameAccuracy(cls, positions, 'b') };
  const me = g.white.username.toLowerCase() === 'ecavan' ? 'w' : 'b';
  const row = {
    url: g.url, time_class: g.time_class, me, white: g.white.rating, black: g.black.rating, result: me === 'w' ? g.white.result : g.black.result,
    cc: g.accuracies, ours: { white: acc.w, black: acc.b }, est: { white: gameRating(acc.w, acc.b, moves.length), black: gameRating(acc.b, acc.w, moves.length) },
    counts: { w: counts(cls, 'w', 'w'), b: counts(cls, 'b', 'w') },
    moves: cls.map((x, i) => ({ san: moves[i].san, cls: x.cls, drop: Math.round(x.drop * 10) / 10, best: x.bestUci })),
    plies: moves.length, secs: Math.round((Date.now() - t0) / 1000),
    positions: positions.map(p => ({ terminal: p.terminal, lines: p.lines?.map(l => ({ cp: l.cp, mate: l.mate, pv: (l.pv || []).slice(0, 8) })) })),
  };
  done.push(row);
  writeFileSync(outPath, JSON.stringify(done));
  console.log(`${done.length} ${g.time_class} cc ${g.accuracies.white}/${g.accuracies.black} ours ${acc.w}/${acc.b} (${row.secs}s)`);
}
eng.send('quit');
process.exit(0);
