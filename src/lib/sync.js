/**
 * chess.com sync: when the app opens (or comes back to the front, or on the Sync button), fetch the
 * current month's games for the saved username, import the new ones and queue them for review.
 *
 * Nothing runs while the app is closed (an iOS web app can't), so this is "catch up on open":
 * a game you finished on chess.com is in the review queue a couple of seconds after you open the
 * app, and reviewed about a minute later while you do something else here.
 *
 * Each device keeps its own username and sync state; there are no accounts and no server.
 *
 * State (chess.sync.v1): { user, lastEndTime (unix s), etags: { 'YYYY/MM': etag }, lastRun (ms),
 *   lastResult: { added, at, error? } }
 * Settings that drive it live in prefs: chesscom (username), syncClasses (['rapid','blitz']),
 * syncAuto (bool), syncBackfillMonths (1).
 */
import { load, save, KEYS } from './store.js';
import { getPrefs } from './prefs.js';
import { fetchChessComMonth, importChessComGames } from './games.js';
import { enqueue } from './reviewQueue.js';

let state = load(KEYS.sync, { user: '', lastEndTime: 0, etags: {}, lastRun: 0, lastResult: null });
const subs = new Set();
const persist = () => { save(KEYS.sync, state); for (const f of subs) f(); };
export const subscribeSync = (f) => { subs.add(f); return () => subs.delete(f); };
export const syncState = () => state;

let inflight = null;
const DEBOUNCE = 10 * 60 * 1000;

/** Months to look at: the current one, plus earlier ones for a backfill or when the last run was last month. */
function monthsToFetch(now, backfill) {
  const out = [];
  const d = new Date(now);
  let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  const last = new Date(state.lastRun || 0);
  const crossed = !state.lastRun || last.getUTCFullYear() !== y || last.getUTCMonth() + 1 !== m;
  const n = Math.max(1, backfill, crossed ? 2 : 1);
  for (let i = 0; i < n; i++) { out.unshift([y, m]); m--; if (m === 0) { m = 12; y--; } }
  return out;
}

/**
 * Run a sync. opts: { manual } (skip the 10-minute debounce). Resolves { added, skipped, error? }.
 * Serial requests; stops on a rate limit and reports it.
 */
export async function sync({ manual = false, now = Date.now() } = {}) {
  const prefs = getPrefs();
  const user = (prefs.chesscom || '').trim();
  if (!user) return { added: 0, skipped: 0, error: 'no username' };
  if (!manual && !prefs.syncAuto) return { added: 0, skipped: 0, error: 'off' };
  if (inflight) return inflight;
  if (!manual && now - state.lastRun < DEBOUNCE) return { added: 0, skipped: 0 };
  if (user.toLowerCase() !== (state.user || '').toLowerCase()) state = { ...state, user, lastEndTime: 0, etags: {} };
  inflight = (async () => {
    let added = 0, skipped = 0, error = null;
    const newIds = [];
    let newest = state.lastEndTime || 0;
    try {
      for (const [y, m] of monthsToFetch(now, prefs.syncBackfillMonths || 1)) {
        const key = `${y}/${String(m).padStart(2, '0')}`;
        const r = await fetchChessComMonth(user, y, m, state.etags[key] || null);
        if (r.status === 404 || r.notModified) continue;
        const res = importChessComGames(r.games, user, { timeClasses: prefs.syncClasses || ['rapid', 'blitz'], after: state.lastEndTime || 0 });
        added += res.added; skipped += res.skipped;
        newest = Math.max(newest, res.newest || 0);
        newIds.push(...res.games.filter(g => g.you).map(g => g.id));
        if (r.etag) state.etags = { ...state.etags, [key]: r.etag };
      }
    } catch (e) { error = e.message || String(e); }
    // keep only the current and previous month's ETags
    const keep = new Set(monthsToFetch(now, 2).map(([y, m]) => `${y}/${String(m).padStart(2, '0')}`));
    state.etags = Object.fromEntries(Object.entries(state.etags).filter(([k]) => keep.has(k)));
    if (!error) state.lastEndTime = newest;
    state.lastRun = now;
    state.lastResult = { added, skipped, at: now, ...(error ? { error } : {}) };
    persist();
    if (newIds.length) enqueue(newIds, { front: true });
    inflight = null;
    return { added, skipped, ...(error ? { error } : {}) };
  })();
  return inflight;
}

/** Forget the sync position (after a username change, or to refetch): the next sync starts from scratch. */
export function resetSync() { state = { user: '', lastEndTime: 0, etags: {}, lastRun: 0, lastResult: null }; persist(); }

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync().catch(() => {}); });
}
