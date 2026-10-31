/**
 * The main thread's handle on the Maia worker (maiaWorker.js). One worker, one request at a time
 * in order; every call returns a promise. Falls back to running the model on the main thread
 * when workers are unavailable (tests, very old browsers).
 */
import { loadMaia as loadMain, MAIA_LEVELS } from './maia.js';
import { Chess } from 'chess.js';

let worker = null;
let seq = 0;
const pending = new Map();

function get() {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./maiaWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error) p.reject(new Error(error)); else p.resolve(e.data);
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || 'maia worker error'));
      pending.clear();
      worker = null;
    };
  } catch { worker = null; }
  return worker;
}

function call(msg) {
  const w = get();
  if (!w) return null;
  const id = ++seq;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); w.postMessage({ id, ...msg }); });
}

/** Load a level in the background so the first move is quick. */
export function warmMaia(rating = 1500) {
  const p = call({ type: 'warm', rating });
  return p ?? loadMain(rating).then(() => ({}));
}

/** Probability of every legal move at the end of `fens` (the game's positions), and WDL. */
export async function maiaPredict(rating, fens) {
  const p = call({ type: 'predict', rating, fens });
  if (p) return p;
  const m = await loadMain(rating);
  return { ...m.predictFens(fens, new Chess(fens[fens.length - 1])), rating: m.rating };
}

/**
 * Rating from style: the Maia level whose policy gives the moves at `indices` (positions in
 * `fens`, the move played being the one that reaches the next fen) the highest total
 * log-likelihood, with a parabolic interpolation between levels. Returns
 * { est, best, ll: { level: total }, n } or null when there is nothing to rate.
 */
export async function maiaStyle(fens, indices, levels = MAIA_LEVELS) {
  if (!indices.length) return null;
  let res = call({ type: 'style', fens, indices, levels });
  if (!res) {
    // main-thread fallback (no worker): same computation through the model objects
    const { encode, forward, moveIndex } = await import('./maia.js');
    const ll = {};
    for (const lv of levels) {
      const m = await loadMain(lv);
      ll[lv] = indices.map(i => {
        const g = new Chess(fens[i]);
        const { logits } = forward(m.model, encode(fens.slice(0, i + 1)));
        const legal = g.moves({ verbose: true }), us = fens[i].split(' ')[1];
        const z = legal.map(x => logits[moveIndex(x.from + x.to + (x.promotion || ''), us)] ?? -1e9);
        const mx = Math.max(...z), lse = mx + Math.log(z.reduce((a, v) => a + Math.exp(v - mx), 0));
        const key = fens[i + 1].split(' ').slice(0, 4).join(' ');
        const k = legal.findIndex(x => { const h = new Chess(fens[i]); h.move(x.san); return h.fen().split(' ').slice(0, 4).join(' ') === key; });
        return k < 0 ? null : z[k] - lse;
      });
    }
    res = { ll };
  } else res = await res;
  return styleFromLL(res.ll, levels);
}

/** The estimate from per-level log-likelihoods: argmax level, refined by a parabola through its neighbours. */
export function styleFromLL(llByLevel, levels = MAIA_LEVELS) {
  const tot = {};
  let n = 0;
  for (const lv of levels) {
    const arr = llByLevel[lv] || [];
    tot[lv] = arr.reduce((a, v) => a + (v ?? 0), 0);
    n = Math.max(n, arr.filter(v => v != null).length);
  }
  if (!n) return null;
  const ls = [...levels].sort((a, b) => a - b);
  let bi = 0;
  for (let i = 1; i < ls.length; i++) if (tot[ls[i]] > tot[ls[bi]]) bi = i;
  let est = ls[bi];
  if (bi > 0 && bi < ls.length - 1) {
    // parabola through (x-1, y-1), (x, y), (x+1, y+1) in units of one step
    const y0 = tot[ls[bi - 1]], y1 = tot[ls[bi]], y2 = tot[ls[bi + 1]];
    const denom = y0 - 2 * y1 + y2;
    const dx = denom < 0 ? Math.max(-1, Math.min(1, 0.5 * (y0 - y2) / denom)) : 0;
    est = ls[bi] + dx * (ls[bi + 1] - ls[bi]);
  } else if (bi === 0 && ls.length > 1) {
    // below the lowest level: extrapolate by the slope, at most one step down
    const slope = tot[ls[1]] - tot[ls[0]]; // negative here
    est = ls[0] - Math.min(1, Math.max(0, -slope / Math.max(1e-9, Math.abs(tot[ls[1]] - tot[ls[0]]) + Math.abs(tot[ls[2]] - tot[ls[1]]))) ) * (ls[1] - ls[0]);
  } else if (bi === ls.length - 1 && ls.length > 1) {
    const i = ls.length - 1;
    const slope = tot[ls[i]] - tot[ls[i - 1]];
    est = ls[i] + Math.min(1, Math.max(0, slope / Math.max(1e-9, Math.abs(slope) + Math.abs(tot[ls[i - 1]] - tot[ls[i - 2]])))) * (ls[i] - ls[i - 1]);
  }
  return { est: Math.round(est / 10) * 10, best: ls[bi], ll: tot, n };
}
