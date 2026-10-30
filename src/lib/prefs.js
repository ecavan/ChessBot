/** App preferences: a tiny global store with a React hook. */
import { useSyncExternalStore } from 'react';
import { load, save, KEYS } from './store.js';

export const DEFAULT_PREFS = {
  theme: 'system', // 'system' | 'dark' | 'light'
  boardTheme: 'green',
  pieceStyle: 'classic',
  coords: true,
  sound: true,
  peek: true, // tapping a piece that can't move shows where it could go
  engine: 'full', // 'full' | 'lite'
  analysisTime: 800, // ms per position in game review
  playEval: false,
  playThreats: false,
  playGuard: true, // the blunder check: the one assist that trains the habit, so on by default
  playHints: true,
  playCoach: true,
  chesscom: '',
  lichess: '',
  puzzleDifficulty: 0, // −300 easier … +300 harder
  syncAuto: true, // fetch new chess.com games when the app opens
  syncClasses: ['rapid', 'blitz'], // which time classes to pull in
  syncBackfillMonths: 1,
  wakeLock: false, // keep the screen on while the review queue works
};

let prefs = load(KEYS.prefs, DEFAULT_PREFS);
const subs = new Set();

export const getPrefs = () => prefs;
export function setPrefs(patch) {
  prefs = { ...prefs, ...(typeof patch === 'function' ? patch(prefs) : patch) };
  save(KEYS.prefs, prefs);
  for (const f of subs) f();
}
export function usePrefs() {
  const p = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => prefs);
  return [p, setPrefs];
}
