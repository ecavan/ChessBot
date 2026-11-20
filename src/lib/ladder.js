/**
 * Your rating against the bots: an Elo that moves with every finished bot game.
 *
 * It starts at the rating of the first bot you play. After each rated game:
 *   expected = 1 / (1 + 10^((bot − you) / 400))        your expected score against that bot
 *   you     += K × (score − expected)                   score: 1 win, ½ draw, 0 loss
 * so beating a stronger bot is worth more than beating a weaker one, and losing to a weaker bot
 * costs more. K is 40 for your first 10 games (it finds your level fast), then 24, then 16 after 30.
 * A game where you took a hint, a takeback or the blunder check's warning is not rated.
 *
 * Stored: { rating, n, peak, games: [{ id, at, bot, botElo, score, before, after }] } (last 200).
 */
import { load, save } from './store.js';

const KEY = 'chess.ladder.v1';
const subs = new Set();
export const subscribeLadder = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const ladder = () => load(KEY, null);

export const expectedScore = (you, bot) => 1 / (1 + 10 ** ((bot - you) / 400));
export const kFactor = (n) => (n < 10 ? 40 : n < 30 ? 24 : 16);

/** What a result would do, without saving: { before, after, delta, expected }. */
export function preview(state, botElo, score) {
  const before = state?.rating ?? botElo;
  const n = state?.n ?? 0;
  const expected = expectedScore(before, botElo);
  const after = Math.max(100, Math.round(before + kFactor(n) * (score - expected)));
  return { before: Math.round(before), after, delta: after - Math.round(before), expected };
}

/** Rate a finished game (once per game id). Returns { before, after, delta } or null if already rated. */
export function rateGame({ id, bot, botElo, score, at = Date.now() }) {
  const st = load(KEY, null) || { rating: null, n: 0, peak: null, games: [] };
  if (st.games.some(g => g.id === id)) return null;
  const r = preview(st.rating == null ? null : st, botElo, score);
  const next = {
    rating: r.after, n: st.n + 1, peak: Math.max(st.peak ?? r.after, r.after),
    games: [...st.games, { id, at, bot, botElo, score, before: r.before, after: r.after }].slice(-200),
  };
  save(KEY, next);
  subs.forEach(fn => fn());
  return { before: r.before, after: r.after, delta: r.delta };
}
