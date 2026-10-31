// Run: node test/maia.test.mjs — the JS Maia port against the numpy reference (tools/maia/maia_ref.py
// --tests), on the start position, openings, a FEN without history and positions from real games:
// the same legal-move logits (to 1e-2: the shipped weights are re-quantised to 16 bits after folding batch norm), the same WDL, the same ranking.
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { decode, Maia, encode, moveIndex } from '../src/engine/maia.js';

const meta = JSON.parse(readFileSync('public/maia/maia-1500.json', 'utf8'));
const bin = readFileSync('public/maia/maia-1500.bin');
const model = decode(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const maia = new Maia(1500, model);
const cases = JSON.parse(readFileSync('test/maia-1500.json', 'utf8'));

let fails = 0;
const check = (name, cond, got) => { if (!cond) { fails++; console.log('FAIL', name, '\n   ', got); } else console.log('ok  ', name, '|', typeof got === 'string' ? got : JSON.stringify(got)); };

const t0 = performance.now();
let n = 0;
for (const c of cases) {
  const g = new Chess();
  if (c.uci.length) for (const u of c.uci) g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  else g.load(c.fen);
  const { moves, wdl } = maia.predict(g);
  n++;
  const label = Array.isArray(c.moves) ? (c.moves.join(' ') || 'start') : c.moves === null ? 'fen only' : `game ply ${c.uci.length}`;
  // logits for the legal moves, from the raw forward pass, against the reference
  const fens = c.uci.length ? (() => { const h = new Chess(); const out = [h.fen()]; for (const u of c.uci) { h.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); out.push(h.fen()); } return out; })() : [c.fen];
  const us = c.fen.split(' ')[1];
  const { logits } = (await import('../src/engine/maia.js')).forward(model, encode(fens));
  let maxErr = 0;
  for (const [uci, ref] of Object.entries(c.legal)) maxErr = Math.max(maxErr, Math.abs(logits[moveIndex(uci, us)] - ref));
  check(`${label}: logits match (max err ${maxErr.toExponential(1)})`, maxErr < 1e-2, `${moves.slice(0, 3).map(m => `${m.san} ${m.p.toFixed(2)}`).join(', ')} | ref ${c.top.slice(0, 3).map(([s, p]) => `${s} ${p.toFixed(2)}`).join(', ')}`);
  const wErr = Math.max(...wdl.map((v, i) => Math.abs(v - c.wdl[i])));
  check(`${label}: WDL match`, wErr < 5e-3, wdl.map(v => v.toFixed(3)).join('/'));
  check(`${label}: top move agrees`, moves[0].san === c.top[0][0], moves[0].san);
}
const ms = (performance.now() - t0) / n;
check(`inference time per position ${ms.toFixed(0)} ms (< 400)`, ms < 400, ms.toFixed(0));

// sampling is a distribution over legal moves
{
  const g = new Chess();
  const seen = new Map();
  let seed = 7;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 200; i++) { const m = maia.sample(g, rand); seen.set(m.san, (seen.get(m.san) || 0) + 1); }
  check('samples e4 most, d4 second, others sometimes', seen.get('e4') > seen.get('d4') && seen.get('d4') > 10 && seen.size >= 3, Object.fromEntries(seen));
}
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
