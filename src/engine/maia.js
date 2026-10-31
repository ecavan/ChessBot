/**
 * Maia in the browser: the human-move model (McIlroy-Young et al., 2020), a Leela-style network
 * trained to predict what a player of a given rating plays, not what wins. Pure JS inference of
 * the lc0 "SE" network with a convolutional policy head and a WDL value head, from weights exported
 * by tools/maia/maia_ref.py (16-bit linear per layer, lc0's own encoding).
 *
 *   const m = await loadMaia(1500);           // public/maia/maia-1500.{json,bin}
 *   const { moves, wdl } = m.predict(game);   // game: a chess.js instance with its move history
 *   // moves: [{ uci, san, p }] sorted by probability; wdl: [win, draw, loss] for the side to move
 *
 * Input: lc0 INPUT_CLASSICAL_112_PLANE — 8 positions of history (the current one first), each 12
 * piece planes from the mover's view (the board is flipped when Black is to move) plus a
 * repetition plane; then castling (ours O-O-O, O-O, theirs O-O-O, O-O), "we are black", the
 * fifty-move counter, a zero plane, a ones plane. Positions before the start of a game are zero
 * planes; a position given without history repeats itself, as lc0 does.
 * Output: the policy head gives one logit per lc0 move (1858, from the mover's view); the legal
 * moves are softmaxed among themselves.
 */
import { Chess } from 'chess.js';
import POLICY_MAP from './maia/policyMap.json' with { type: 'json' };
import MOVE_STRS from './maia/moves.json' with { type: 'json' };

const MOVE_IDX = new Map(MOVE_STRS.map((m, i) => [m, i]));
export const MAIA_LEVELS = [1100, 1300, 1500, 1700, 1900];

// ------------------------------------------------------------------ weights

async function fetchModel(rating, base) {
  const [meta, bin] = await Promise.all([
    fetch(`${base}/maia-${rating}.json`).then(r => { if (!r.ok) throw new Error(`maia-${rating}.json: ${r.status}`); return r.json(); }),
    fetch(`${base}/maia-${rating}.bin`).then(r => { if (!r.ok) throw new Error(`maia-${rating}.bin: ${r.status}`); return r.arrayBuffer(); }),
  ]);
  return decode(meta, bin);
}

/** Decode the 16-bit layers to Float32Arrays keyed by name. */
export function decode(meta, bin) {
  const u16 = new Uint16Array(bin);
  const layers = {};
  for (const l of meta.layers) {
    const n = l.shape.reduce((a, b) => a * b, 1);
    const out = new Float32Array(n);
    const lo = l.min, scale = (l.max - l.min) / 65535;
    for (let i = 0; i < n; i++) out[i] = lo + u16[l.offset + i] * scale;
    layers[l.name] = { w: out, shape: l.shape };
  }
  return { filters: meta.filters, blocks: meta.blocks, layers };
}

// ------------------------------------------------------------------ layers

/** 3x3 (or 1x1) convolution over an 8x8 board, NCHW, with bias. x: [cin*64], w: [cout][cin][k][k]. */
function conv(x, cin, cout, w, b, k, out) {
  out ??= new Float32Array(cout * 64);
  if (k === 1) {
    for (let o = 0; o < cout; o++) {
      const bo = b[o], base = o * 64;
      for (let s = 0; s < 64; s++) out[base + s] = bo;
      for (let c = 0; c < cin; c++) {
        const wv = w[o * cin + c];
        if (wv === 0) continue;
        const xb = c * 64;
        for (let s = 0; s < 64; s++) out[base + s] += wv * x[xb + s];
      }
    }
    return out;
  }
  // padded copy of the input: 10x10 per channel, so no edge tests in the inner loop
  const xp = padded(x, cin);
  for (let o = 0; o < cout; o++) {
    const base = o * 64, bo = b[o];
    for (let s = 0; s < 64; s++) out[base + s] = bo;
    for (let c = 0; c < cin; c++) {
      const wb = (o * cin + c) * 9, pb = c * 100;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          const wv = w[wb + dy * 3 + dx];
          if (wv === 0) continue;
          for (let r = 0; r < 8; r++) {
            const ob = base + r * 8, ib = pb + (r + dy) * 10 + dx;
            for (let f = 0; f < 8; f++) out[ob + f] += wv * xp[ib + f];
          }
        }
      }
    }
  }
  return out;
}

let padBuf = null;
function padded(x, cin) {
  if (!padBuf || padBuf.length < cin * 100) padBuf = new Float32Array(cin * 100);
  const xp = padBuf;
  for (let c = 0; c < cin; c++) {
    const pb = c * 100, xb = c * 64;
    for (let i = 0; i < 10; i++) { xp[pb + i] = 0; xp[pb + 90 + i] = 0; }
    for (let r = 0; r < 8; r++) {
      const row = pb + (r + 1) * 10;
      xp[row] = 0; xp[row + 9] = 0;
      for (let f = 0; f < 8; f++) xp[row + 1 + f] = x[xb + r * 8 + f];
    }
  }
  return xp;
}

const relu = (a) => { for (let i = 0; i < a.length; i++) if (a[i] < 0) a[i] = 0; return a; };

/** Fully connected: y[o] = b[o] + Σ w[o][i] x[i]. */
function fc(x, w, b, nOut) {
  const nIn = x.length, y = new Float32Array(nOut);
  for (let o = 0; o < nOut; o++) {
    let acc = b[o];
    const wb = o * nIn;
    for (let i = 0; i < nIn; i++) acc += w[wb + i] * x[i];
    y[o] = acc;
  }
  return y;
}

/** One forward pass. planes: Float32Array(112*64). Returns { logits: Float32Array(1858), wdl: [w,d,l] }. */
export function forward(model, planes) {
  const C = model.filters, L = model.layers;
  let x = relu(conv(planes, 112, C, L['input.w'].w, L['input.b'].w, 3));
  for (let i = 0; i < model.blocks; i++) {
    const h1 = relu(conv(x, C, C, L[`b${i}.c1.w`].w, L[`b${i}.c1.b`].w, 3));
    const h = conv(h1, C, C, L[`b${i}.c2.w`].w, L[`b${i}.c2.b`].w, 3);
    // squeeze-excitation: global average, two small FCs, sigmoid scale + bias, add the skip
    const pool = new Float32Array(C);
    for (let c = 0; c < C; c++) { let s = 0; for (let q = 0; q < 64; q++) s += h[c * 64 + q]; pool[c] = s / 64; }
    const seN = L[`b${i}.se.b1`].w.length;
    const f = relu(fc(pool, L[`b${i}.se.w1`].w, L[`b${i}.se.b1`].w, seN));
    const s = fc(f, L[`b${i}.se.w2`].w, L[`b${i}.se.b2`].w, 2 * C);
    for (let c = 0; c < C; c++) {
      const g = 1 / (1 + Math.exp(-s[c])), beta = s[C + c], hb = c * 64;
      for (let q = 0; q < 64; q++) { const v = g * h[hb + q] + beta + x[hb + q]; h[hb + q] = v > 0 ? v : 0; }
    }
    x = h;
  }
  // policy: conv, conv to 80 planes, map to the 1858 moves
  const p1 = relu(conv(x, C, C, L['policy1.w'].w, L['policy1.b'].w, 3));
  const pOut = L['policy.b'].w.length;
  const p = conv(p1, C, pOut, L['policy.w'].w, L['policy.b'].w, 3);
  const logits = new Float32Array(1858).fill(-1e9);
  for (let i = 0; i < POLICY_MAP.length; i++) { const j = POLICY_MAP[i]; if (j >= 0) logits[j] = p[i]; }
  // value: 1x1 conv, two FCs, softmax over win/draw/loss
  const vC = L['value.b'].w.length;
  const v0 = relu(conv(x, C, vC, L['value.w'].w, L['value.b'].w, 1));
  const v1 = relu(fc(v0, L['ip1_val.w'].w, L['ip1_val.b'].w, L['ip1_val.b'].w.length));
  const v2 = fc(v1, L['ip2_val.w'].w, L['ip2_val.b'].w, 3);
  const mx = Math.max(v2[0], v2[1], v2[2]);
  const e = [Math.exp(v2[0] - mx), Math.exp(v2[1] - mx), Math.exp(v2[2] - mx)];
  const z = e[0] + e[1] + e[2];
  return { logits, wdl: [e[0] / z, e[1] / z, e[2] / z] };
}

// ------------------------------------------------------------------ encoder

const PIECE = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };
const sqIdx = (name) => (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97); // a1 = 0, h8 = 63
const flipIdx = (i) => (7 - (i >> 3)) * 8 + (i & 7);
const posKey = (fen) => fen.split(' ').slice(0, 4).join(' ');
const START_KEY = posKey(new Chess().fen());

/** The 13 planes of one position from `us`'s view, written at `planes[off...]`. */
function boardPlanes(planes, off, fen, us) {
  const board = fen.split(' ')[0];
  let rank = 7, file = 0;
  for (const ch of board) {
    if (ch === '/') { rank--; file = 0; continue; }
    if (ch >= '1' && ch <= '8') { file += ch.charCodeAt(0) - 48; continue; }
    const white = ch === ch.toUpperCase();
    const type = PIECE[ch.toLowerCase()];
    let i = rank * 8 + file;
    if (us === 'b') i = flipIdx(i);
    const own = (white ? 'w' : 'b') === us;
    planes[off + ((own ? 0 : 6) + type) * 64 + i] = 1;
    file++;
  }
}

/**
 * lc0's 112 input planes for the position at the end of `fens` (the game's positions in order,
 * the first being the start). Float32Array(112*64), plane-major, square a1 first.
 */
export function encode(fens) {
  const planes = new Float32Array(112 * 64);
  const cur = fens[fens.length - 1];
  const us = cur.split(' ')[1];
  const fromStart = posKey(fens[0]) === START_KEY;
  for (let i = 0; i < 8; i++) {
    const k = fens.length - 1 - i;
    let fen;
    if (k >= 0) fen = fens[k];
    else if (fromStart) break; // before the game started: zeros
    else fen = fens[0]; // a position given without history: lc0 repeats it
    boardPlanes(planes, i * 13 * 64, fen, us);
    // repetitions of this position earlier in the game
    if (k > 0) {
      const key = posKey(fen);
      let reps = 0;
      for (let j = k - 1; j >= 0; j--) if (posKey(fens[j]) === key) reps++;
      if (reps >= 1) planes.fill(1, (i * 13 + 12) * 64, (i * 13 + 13) * 64);
    }
  }
  const castle = cur.split(' ')[2] || '-';
  const them = us === 'w' ? 'b' : 'w';
  const has = (side, kingside) => castle.includes(side === 'w' ? (kingside ? 'K' : 'Q') : (kingside ? 'k' : 'q'));
  if (has(us, false)) planes.fill(1, 104 * 64, 105 * 64);
  if (has(us, true)) planes.fill(1, 105 * 64, 106 * 64);
  if (has(them, false)) planes.fill(1, 106 * 64, 107 * 64);
  if (has(them, true)) planes.fill(1, 107 * 64, 108 * 64);
  if (us === 'b') planes.fill(1, 108 * 64, 109 * 64);
  planes.fill(Number(cur.split(' ')[4]) || 0, 109 * 64, 110 * 64);
  planes.fill(1, 111 * 64, 112 * 64);
  return planes;
}

/** lc0's policy index of a uci move for the side `us` (the board is flipped for Black). */
export function moveIndex(uci, us) {
  let from = uci.slice(0, 2), to = uci.slice(2, 4);
  if (us === 'b') {
    from = from[0] + (9 - Number(from[1]));
    to = to[0] + (9 - Number(to[1]));
  }
  const promo = uci[4] && uci[4] !== 'n' ? uci[4] : ''; // a knight promotion is the plain move
  return MOVE_IDX.get(from + to + promo);
}

/** The positions of a game given as uci moves from `startFen` (the standard start when null). */
export function fensFromUci(startFen, ucis) {
  const g = new Chess(startFen || undefined);
  const fens = [g.fen()];
  for (const u of ucis) { try { g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; } fens.push(g.fen()); }
  return fens;
}

/** The positions of a chess.js game, start first, as FENs. */
export function fensOf(game) {
  const hist = game.history({ verbose: true });
  const g = new Chess(hist.length ? hist[0].before : game.fen());
  const fens = [g.fen()];
  for (const m of hist) { g.move(m.san); fens.push(g.fen()); }
  return fens;
}

// ------------------------------------------------------------------ model object

export class Maia {
  constructor(rating, model) { this.rating = rating; this.model = model; }
  /** Probability of every legal move, from a chess.js game (its history is the model's context). */
  predict(game) {
    const fens = fensOf(game);
    return this.predictFens(fens, game);
  }
  predictFens(fens, game = new Chess(fens[fens.length - 1])) {
    const us = fens[fens.length - 1].split(' ')[1];
    const { logits, wdl } = forward(this.model, encode(fens));
    const legal = game.moves({ verbose: true });
    const z = legal.map(m => logits[moveIndex(m.from + m.to + (m.promotion || ''), us)] ?? -1e9);
    const mx = Math.max(...z);
    const e = z.map(v => Math.exp(v - mx));
    const sum = e.reduce((a, b) => a + b, 0);
    const moves = legal.map((m, i) => ({ uci: m.from + m.to + (m.promotion || ''), san: m.san, p: e[i] / sum })).sort((a, b) => b.p - a.p);
    return { moves, wdl };
  }
  /** Sample a move the way a player of this rating would: by the policy, optionally sharpened (temperature < 1). */
  sample(game, rand = Math.random, temperature = 1) {
    return this.pick(this.predict(game).moves, rand, temperature);
  }
  sampleFens(fens, game, rand = Math.random, temperature = 1) {
    return this.pick(this.predictFens(fens, game).moves, rand, temperature);
  }
  pick(moves, rand = Math.random, temperature = 1) {
    if (!moves.length) return null;
    const ws = moves.map(m => Math.pow(m.p, 1 / temperature));
    const tot = ws.reduce((a, b) => a + b, 0);
    let r = rand() * tot;
    for (let i = 0; i < moves.length; i++) { r -= ws[i]; if (r <= 0) return moves[i]; }
    return moves[0];
  }
}

const cache = new Map();
/** Load (once) the Maia net for a rating level; base is where the weight files are served from. */
export async function loadMaia(rating = 1500, base = '/maia') {
  if (!MAIA_LEVELS.includes(rating)) rating = MAIA_LEVELS.reduce((a, b) => (Math.abs(b - rating) < Math.abs(a - rating) ? b : a));
  if (!cache.has(rating)) cache.set(rating, fetchModel(rating, base).then(m => new Maia(rating, m)).catch(e => { cache.delete(rating); throw e; }));
  return cache.get(rating);
}
