/**
 * Puzzles: 58k positions from the Lichess puzzle database (CC0), split into 100-point rating
 * bands and loaded one band at a time.
 *
 * A puzzle row is [id, fen, "uci moves", rating, [theme indexes]]. The first move is the
 * opponent's (it's played for you), then you and the opponent alternate; your moves are the
 * even ones after that. Any move that mates is accepted, even if it isn't the listed one.
 *
 * Progress lives in localStorage: a rating per mode (Glicko-lite: K shrinks as you play),
 * the recent history, a spaced-repetition queue of puzzles you missed (1, 3, 7, 21 days), the
 * daily puzzle, and the ids you've already seen so they don't repeat.
 */
import { load, save, KEYS } from './store.js';

let index = null;
const bandCache = new Map();

export async function loadIndex() {
  if (index) return index;
  const r = await fetch('/puzzles/index.json');
  if (!r.ok) throw new Error('Puzzles could not be loaded.');
  index = await r.json();
  return index;
}

async function loadBand(b) {
  if (bandCache.has(b.file)) return bandCache.get(b.file);
  const p = fetch(`/puzzles/${b.file}`).then(r => { if (!r.ok) throw new Error('Puzzle pack failed to load.'); return r.json(); });
  bandCache.set(b.file, p);
  try { return await p; } catch (e) { bandCache.delete(b.file); throw e; }
}

export function toPuzzle(row, idx = index) {
  const [id, fen, moves, rating, th] = row;
  return { id, fen, moves: moves.split(' '), rating, themes: th.map(i => idx?.themes[i]).filter(Boolean) };
}

// ------------------------------------------------------------------ progress

const fresh = () => ({
  ratings: { rated: 1200, visual: 1000 },
  plays: { rated: 0, visual: 0 },
  history: [], // { id, r: puzzle rating, ok, mode, t, after }
  seen: [], // recent ids
  queue: [], // { p: puzzle, box, due }
  daily: {}, // 'YYYY-MM-DD' → { id, ok }
  streak: 0, best: 0,
});

function loadState() {
  const d = fresh();
  const x = load(KEYS.puzzles, null) || {};
  return { ...d, ...x, ratings: { ...d.ratings, ...x.ratings }, plays: { ...d.plays, ...x.plays } };
}
let state = loadState();
const persist = () => save(KEYS.puzzles, state);
export const progress = () => state;
export function resetPuzzles() { state = fresh(); persist(); }

const K = (n) => Math.max(16, 48 - n * 0.8);
const expected = (me, them) => 1 / (1 + 10 ** ((them - me) / 400));

/** Record an attempt. mode: 'rated' | 'visual' | 'theme' | 'daily' | 'review' | 'free'. Returns the rating change. */
export function record(p, ok, mode) {
  let delta = 0;
  const key = mode === 'visual' ? 'visual' : mode === 'rated' || mode === 'theme' ? 'rated' : null;
  if (key) {
    const me = state.ratings[key];
    delta = Math.round(K(state.plays[key]) * ((ok ? 1 : 0) - expected(me, p.rating)));
    state.ratings[key] = Math.max(100, me + delta);
    state.plays[key]++;
  }
  state.history.push({ id: p.id, r: p.rating, ok, mode, t: Date.now(), after: key ? state.ratings[key] : null });
  if (state.history.length > 600) state.history = state.history.slice(-600);
  state.seen.push(p.id);
  if (state.seen.length > 4000) state.seen = state.seen.slice(-4000);
  if (ok) { state.streak++; state.best = Math.max(state.best, state.streak); } else state.streak = 0;
  // spaced repetition
  const DAY = 86400000;
  const inQ = state.queue.find(q => q.p.id === p.id);
  if (!ok) {
    if (inQ) { inQ.box = 0; inQ.due = Date.now() + DAY; }
    else state.queue.push({ p, box: 0, due: Date.now() + DAY });
  } else if (inQ && mode === 'review') {
    const gaps = [1, 3, 7, 21];
    inQ.box++;
    if (inQ.box >= gaps.length) state.queue = state.queue.filter(q => q !== inQ);
    else inQ.due = Date.now() + gaps[inQ.box] * DAY;
  }
  if (mode === 'daily') state.daily[today()] = { id: p.id, ok };
  persist();
  return delta;
}

export const dueReviews = () => state.queue.filter(q => q.due <= Date.now());
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ------------------------------------------------------------------ picking

const seenSet = () => new Set(state.seen.slice(-3000));

/**
 * Pick a puzzle near `target` rating. opts: { theme?: name, minPlies?: n, exclude?: Set }.
 * Looks in the nearest band first and widens until something fits.
 */
export async function pick(target, opts = {}) {
  const idx = await loadIndex();
  const seen = opts.exclude || seenSet();
  const themeI = opts.theme ? idx.themes.indexOf(opts.theme) : -1;
  const bands = [...idx.bands].sort((a, b) => Math.abs(a.min + 50 - target) - Math.abs(b.min + 50 - target));
  for (let w = 0; w < bands.length; w++) {
    const band = bands[w];
    const rows = await loadBand(band);
    const fits = (row) => !seen.has(row[0]) && (themeI < 0 || row[4].includes(themeI)) && (!opts.minPlies || row[2].split(' ').length >= opts.minPlies)
      && (!opts.maxPlies || row[2].split(' ').length <= opts.maxPlies);
    // random probing first (fast), then a scan
    for (let k = 0; k < 60; k++) {
      const row = rows[Math.floor(Math.random() * rows.length)];
      if (fits(row)) return toPuzzle(row, idx);
    }
    const all = rows.filter(fits);
    if (all.length) return toPuzzle(all[Math.floor(Math.random() * all.length)], idx);
    if (w > 6 && themeI < 0) break;
  }
  // everything nearby seen: forget the seen list
  if (!opts._retry) { state.seen = []; persist(); return pick(target, { ...opts, exclude: new Set(), _retry: true }); }
  throw new Error('No puzzle found for that filter.');
}

/** The daily puzzle: the same for everyone on a given date, rating 1500–2100. */
export async function daily() {
  const idx = await loadIndex();
  const d = today();
  let h = 2166136261;
  for (const c of d) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const bands = idx.bands.filter(b => b.min >= 1500 && b.min <= 2100);
  const band = bands[h % bands.length];
  const rows = await loadBand(band);
  // prefer a puzzle with a bit of length
  for (let k = 0; k < rows.length; k++) {
    const row = rows[(h + k * 7919) % rows.length];
    if (row[2].split(' ').length >= 4) return toPuzzle(row, idx);
  }
  return toPuzzle(rows[h % rows.length], idx);
}

/** Look a puzzle up by id (scans the loaded bands, then all). */
export async function byId(id) {
  const idx = await loadIndex();
  for (const b of idx.bands) {
    const rows = await loadBand(b);
    const row = rows.find(r => r[0] === id);
    if (row) return toPuzzle(row, idx);
  }
  return null;
}

// ------------------------------------------------------------------ themes shown in the picker

export const THEME_GROUPS = [
  { name: 'Tactics', themes: ['fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'deflection', 'attraction', 'clearance', 'interference', 'intermezzo', 'xRayAttack', 'capturingDefender', 'trappedPiece', 'hangingPiece', 'sacrifice', 'quietMove', 'defensiveMove', 'zugzwang'] },
  { name: 'Mates', themes: ['mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'backRankMate', 'smotheredMate', 'arabianMate', 'anastasiaMate', 'bodenMate', 'hookMate', 'doubleBishopMate', 'epauletteMate'] },
  { name: 'Phase', themes: ['opening', 'middlegame', 'endgame', 'rookEndgame', 'pawnEndgame', 'knightEndgame', 'bishopEndgame', 'queenEndgame', 'promotion', 'advancedPawn'] },
  { name: 'Attack', themes: ['kingsideAttack', 'queensideAttack', 'exposedKing', 'attackingF2F7'] },
  { name: 'Length', themes: ['oneMove', 'short', 'long', 'veryLong'] },
];

export function themeName(t) {
  const special = { mateIn1: 'Mate in 1', mateIn2: 'Mate in 2', mateIn3: 'Mate in 3', mateIn4: 'Mate in 4', mateIn5: 'Mate in 5', oneMove: 'One move',
    attackingF2F7: 'Attacking f2/f7', xRayAttack: 'X-ray', veryLong: 'Very long', enPassant: 'En passant', superGM: 'Super GM' };
  if (special[t]) return special[t];
  return t.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).replace(/ ([A-Z])/g, (m, c) => ' ' + c.toLowerCase());
}
