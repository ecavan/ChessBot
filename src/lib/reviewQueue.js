/**
 * The review queue: games waiting for a Stockfish review, worked through in the background
 * whenever the app is open and the engine has nothing more urgent to do (a live game, a puzzle
 * check, the eval bar). A browser can't review while the app is closed, so the queue simply
 * resumes where it stopped the next time the app is in front.
 *
 * State (chess.reviewQueue.v1): { items: [{ id, state: 'queued'|'running'|'failed'|'lite', at }] }
 *   queued   waiting
 *   running  being reviewed now (set back to queued on resume)
 *   lite     reviewed with the lite network because the full one wasn't available; re-review later
 *   failed   the game couldn't be reviewed (deleted, broken)
 * Finished games leave the queue; `lite` ones stay until re-reviewed or the user clears them.
 */
import { useSyncExternalStore } from 'react';
import { load, save, KEYS } from './store.js';
import { getGame, allGames, subscribeGames } from './games.js';
import { getPrefs } from './prefs.js';
import { engine } from '../engine/engine.js';
import { analyzeGame } from './analyze.js';

let state = load(KEYS.reviewQueue, { items: [] });
if (!Array.isArray(state.items)) state = { items: [] };
const subs = new Set();
let progress = null; // { id, done, total }
let running = false;
let stopFlag = false;
let waiting = null; // a promise to wake the loop
let wake = () => {};

const persist = () => { save(KEYS.reviewQueue, state); emit(); };
let snap = null;
function emit() { snap = null; for (const f of subs) f(); }
export const subscribeQueue = (f) => { subs.add(f); return () => subs.delete(f); };
const snapshot = () => (snap ||= { items: state.items, progress, pending: pendingIds(), lite: liteIds() });
/** React: the queue as it stands ({ items, progress, pending: [ids], lite: [ids] }). */
export const useQueue = () => useSyncExternalStore(subscribeQueue, snapshot);
export const queueState = () => state;
export const queueProgress = () => progress;

/** Games waiting (queued or running), in order. */
export const pendingIds = () => state.items.filter(x => x.state === 'queued' || x.state === 'running').map(x => x.id);
export const pendingCount = () => pendingIds().length;
export const liteIds = () => state.items.filter(x => x.state === 'lite').map(x => x.id);

/** Add games to the queue (ids of games with a side marked as yours). opts.front puts them first. */
export function enqueue(ids, { front = false } = {}) {
  const have = new Set(state.items.map(x => x.id));
  const fresh = ids.filter(id => !have.has(id) && getGame(id) && !getGame(id).review?.summary).map(id => ({ id, state: 'queued', at: Date.now() }));
  if (!fresh.length) return 0;
  state.items = front ? [...fresh, ...state.items] : [...state.items, ...fresh];
  persist();
  wake();
  return fresh.length;
}

/** Move a game to the front (the user opened it). */
export function promote(id) {
  const i = state.items.findIndex(x => x.id === id);
  if (i < 0) return;
  const [it] = state.items.splice(i, 1);
  state.items.unshift({ ...it, state: it.state === 'lite' ? 'queued' : it.state });
  persist();
}

export function remove(id) { state.items = state.items.filter(x => x.id !== id); persist(); }
export function clearQueue() { state.items = []; persist(); }

/** Put every reviewed-with-lite game back in the queue (when the full network is available). */
export function requeueLite() {
  state.items = state.items.map(x => (x.state === 'lite' ? { ...x, state: 'queued' } : x));
  persist();
  wake();
}

/** Any of your games with no review yet that aren't queued: add them (used by "Review all"). */
export function enqueueUnreviewed({ front = false, limit = 200 } = {}) {
  const ids = allGames().filter(g => g.you && !g.review?.summary).slice(0, limit).map(g => g.id);
  return enqueue(ids, { front });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

// keep the screen on while reviewing, if the user asked for it (Settings)
let lock = null;
async function holdScreen(on) {
  try {
    if (on && !lock && getPrefs().wakeLock && navigator.wakeLock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener?.('release', () => { lock = null; }); }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
}

/**
 * The worker loop. Call once at startup; it runs forever, sleeping when the queue is empty or the
 * app is hidden. Reviews use the engine at low priority, so anything the user does comes first.
 */
export async function run() {
  if (running) return;
  running = true;
  // drop items for games that have gone, and reset ones left "running" by a closed tab
  state.items = state.items.filter(x => getGame(x.id)).map(x => (x.state === 'running' ? { ...x, state: 'queued' } : x));
  persist();
  for (;;) {
    const next = state.items.find(x => x.state === 'queued');
    if (!next || !visible()) { holdScreen(false); await new Promise((r) => { wake = r; waiting = setTimeout(r, 30000); }); clearTimeout(waiting); continue; }
    const game = getGame(next.id);
    if (!game) { remove(next.id); continue; }
    if (game.review?.summary && game.review.flavor?.startsWith('full')) { remove(next.id); continue; }
    // a review the user started by hand (Review page, Insights) has the engine: let it finish
    if (engine.busyWith('review')) { await sleep(2000); continue; }
    const prefs = getPrefs();
    // wait for the full network when the user wants it (give it four minutes, then make do)
    const full = prefs.engine === 'full' ? await engine.whenFull() : false;
    if (!visible()) continue;
    next.state = 'running'; persist();
    holdScreen(true);
    stopFlag = false;
    progress = { id: next.id, done: 0, total: game.uci.length + 1 }; emit();
    let res = null;
    try {
      res = await analyzeGame(next.id, {
        ms: prefs.analysisTime, priority: 'low', tag: 'review-queue',
        onProgress: (done, total) => { progress = { id: next.id, done, total }; emit(); },
        isCancelled: () => stopFlag || !visible(),
      });
    } catch { res = null; }
    progress = null;
    const it = state.items.find(x => x.id === next.id);
    if (!it) continue; // removed meanwhile
    if (res?.review?.summary) {
      const usedLite = !res.review.flavor?.startsWith('full');
      if (usedLite && prefs.engine === 'full' && !full) { it.state = 'lite'; it.at = Date.now(); } else state.items = state.items.filter(x => x !== it);
      persist();
    } else if (!getGame(next.id)) { remove(next.id); }
    else { it.state = 'queued'; persist(); await sleep(1500); } // cancelled (hidden) or interrupted: try again later
  }
}

/** Stop the current review (it resumes from where it got to). */
export function pause() { stopFlag = true; engine.cancel(['review-queue']); }

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (visible()) wake(); else pause(); });
}
// games deleted elsewhere drop out of the queue
subscribeGames(() => { const before = state.items.length; state.items = state.items.filter(x => getGame(x.id)); if (state.items.length !== before) persist(); });
