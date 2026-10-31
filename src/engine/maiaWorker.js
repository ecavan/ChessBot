/**
 * Maia in a Web Worker: the inference (~0.2 s a position) runs off the main thread, so a Maia bot's
 * move never stalls the board and a whole game can be tagged in the background.
 * Messages in:  { id, type: 'predict', rating, fens }  → { id, moves, wdl, rating }
 *               { id, type: 'style', fens, indices, levels } → { id, ll: { level: [logp per index] } }
 *               { id, type: 'warm', rating }           → { id }
 * Errors come back as { id, error }.
 */
import { Chess } from 'chess.js';
import { decode, Maia, encode, forward, moveIndex, MAIA_LEVELS } from './maia.js';

const models = new Map();
const base = self.location.origin + (import.meta.env?.BASE_URL || '/').replace(/\/$/, '') + '/maia';

async function model(rating) {
  if (!MAIA_LEVELS.includes(rating)) rating = MAIA_LEVELS.reduce((a, b) => (Math.abs(b - rating) < Math.abs(a - rating) ? b : a));
  if (!models.has(rating)) {
    models.set(rating, (async () => {
      const [meta, bin] = await Promise.all([
        fetch(`${base}/maia-${rating}.json`).then(r => { if (!r.ok) throw new Error(`maia-${rating}.json: ${r.status}`); return r.json(); }),
        fetch(`${base}/maia-${rating}.bin`).then(r => { if (!r.ok) throw new Error(`maia-${rating}.bin: ${r.status}`); return r.arrayBuffer(); }),
      ]);
      return new Maia(rating, decode(meta, bin));
    })().catch(e => { models.delete(rating); throw e; }));
  }
  return models.get(rating);
}

self.onmessage = async (e) => {
  const { id, type } = e.data;
  try {
    if (type === 'warm') { await model(e.data.rating); self.postMessage({ id }); return; }
    if (type === 'predict') {
      const m = await model(e.data.rating);
      const { moves, wdl } = m.predictFens(e.data.fens, new Chess(e.data.fens[e.data.fens.length - 1]));
      self.postMessage({ id, moves, wdl, rating: m.rating });
      return;
    }
    if (type === 'style') {
      // log-probability of the move actually played at each index, under each level
      const { fens, indices, levels } = e.data;
      const ll = {};
      for (const lv of levels) {
        const m = await model(lv);
        ll[lv] = [];
        for (const i of indices) {
          const hist = fens.slice(0, i + 1);
          const g = new Chess(fens[i]);
          const { logits } = forward(m.model, encode(hist));
          // the played move is the one that leads to fens[i+1]
          const legal = g.moves({ verbose: true });
          const us = fens[i].split(' ')[1];
          const z = legal.map(x => logits[moveIndex(x.from + x.to + (x.promotion || ''), us)] ?? -1e9);
          const mx = Math.max(...z);
          const lse = mx + Math.log(z.reduce((a, v) => a + Math.exp(v - mx), 0));
          const key = fens[i + 1].split(' ').slice(0, 4).join(' ');
          let played = -1;
          for (let k = 0; k < legal.length; k++) { const h = new Chess(fens[i]); h.move(legal[k].san); if (h.fen().split(' ').slice(0, 4).join(' ') === key) { played = k; break; } }
          ll[lv].push(played < 0 ? null : z[played] - lse);
        }
      }
      self.postMessage({ id, ll });
      return;
    }
    throw new Error(`unknown message ${type}`);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
