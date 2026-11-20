/**
 * Full-game analysis for Review: every position searched with two lines (the second tells us
 * whether a move was the only good one), newest positions first so the hash carries knowledge
 * backwards. Results are stored with the game, so a review opens instantly the second time,
 * and an interrupted analysis picks up where it stopped.
 */
import { Chess } from 'chess.js';
import { engine } from '../engine/engine.js';
import { replay, saveGame, getGame, timeClassOf } from './games.js';
import { classifyGame, gameAccuracy, gameRating, counts } from './review.js';
import { kindsOf } from './plan.js';
import { allGames } from './games.js';
import { loadBook, isBook, openingOf } from './book.js';
import { addMistakePuzzles } from './puzzles.js';
import { ccLevel } from './sync.js';
import { ladder } from './ladder.js';
import { maiaStyle } from '../engine/maiaClient.js';

function terminalOf(fen) {
  const g = new Chess(fen);
  if (g.isCheckmate()) return g.turn() === 'w' ? -10000 : 10000;
  if (g.isStalemate() || g.isInsufficientMaterial() || g.isThreefoldRepetition?.()) return 0;
  return null;
}

const slim = (l) => ({ ...(l.cp != null ? { cp: l.cp } : {}), ...(l.mate != null ? { mate: l.mate } : {}), depth: l.depth, pv: (l.pv || []).slice(0, 12) });

/** The longest one position may take when a review searches to a depth (ms). */
export const DEPTH_CAP_MS = 20000;

/**
 * Analyze a stored game. opts: { ms, onProgress(done, total), isCancelled() }.
 * Resolves the updated game (with .review) or null if cancelled.
 *
 * With `depth`, every position is searched to that depth (at most DEPTH_CAP_MS each) instead of
 * for `ms`, and the game's existing review stays in place until the deeper one is complete:
 * progress is kept beside it (review.deep) so it resumes, positions the existing review already
 * has at that depth are kept, and it stops rather than replace a full-network review with a
 * lite one.
 */
export async function analyzeGame(gameId, { ms = 800, depth = 0, onProgress, isCancelled = () => false, priority, tag = 'review' } = {}) {
  await loadBook();
  let game = getGame(gameId);
  if (!game) return null;
  const { fens } = replay(game);
  const deepen = depth > 0 && !!game.review?.summary;
  const prev = deepen ? (game.review.deep?.depth === depth ? game.review.deep.positions : null)
    : game.review?.partial && game.review.ms === ms && !depth ? game.review.positions : null;
  const positions = prev && prev.length === fens.length ? [...prev] : Array(fens.length).fill(null);
  // what the existing review already has at this depth (or ended by mate) need not be searched again
  if (deepen) game.review.positions.forEach((p, i) => { if (!positions[i] && p && (p.terminal != null || (p.lines?.[0]?.depth ?? 0) >= depth || p.lines?.[0]?.mate != null)) positions[i] = p; });
  const total = fens.length;
  let done = positions.filter(Boolean).length;
  onProgress?.(done, total);
  let lastSave = Date.now();
  const flavors = new Set(game.review?.partial ? game.review.flavors || [] : []);
  const persistPartial = () => {
    const cur = getGame(gameId);
    if (!cur) return;
    game = deepen ? { ...cur, review: { ...cur.review, deep: { depth, positions } } }
      : { ...cur, review: { ms, positions, partial: true, flavors: [...flavors] } };
    saveGame(game);
    lastSave = Date.now();
  };
  for (let i = fens.length - 1; i >= 0; i--) {
    if (positions[i]) continue;
    if (isCancelled()) { persistPartial(); return null; }
    const term = terminalOf(fens[i]);
    if (term != null) positions[i] = { lines: [], terminal: term };
    else {
      let r;
      for (;;) {
        r = await engine.search({ fen: fens[i], ...(depth ? { depth, movetime: DEPTH_CAP_MS } : { movetime: ms }), multipv: 2, tag, priority });
        if (!r || isCancelled()) { persistPartial(); return null; }
        if (!r.yielded) break;
        // a background review stepped aside for a live search: let that finish, then search again
        await engine.whenIdle();
        if (isCancelled()) { persistPartial(); return null; }
      }
      if (deepen && r.flavor?.startsWith('lite')) { persistPartial(); return null; } // never swap a full review for a lite one
      positions[i] = { lines: r.lines.slice(0, 2).map(slim) };
      if (r.flavor) flavors.add(r.flavor);
    }
    done++;
    onProgress?.(done, total);
    if (!getGame(gameId)) return null; // deleted meanwhile
    if (Date.now() - lastSave > 4000) persistPartial();
  }
  if (!getGame(gameId)) return null;
  const fl = [...flavors];
  // the weakest network that took part is what the review is worth
  const flavor = fl.some(f => f.startsWith('lite')) ? fl.find(f => f.startsWith('lite')) : fl[0] || engine.status.flavor;
  const review = { ms: depth ? game.review?.ms ?? ms : ms, ...(depth ? { depth } : {}), positions, flavor: deepen ? game.review.flavor : flavor, at: Date.now() };
  review.summary = summarize(getGame(gameId), review);
  game = { ...getGame(gameId), review };
  saveGame(game);
  // your mistakes become puzzles for the "Your mistakes" queue (full-network reviews only: lite ones are rough)
  if (game.you && flavor?.startsWith('full')) { try { addMistakePuzzles(game, classified(game)); } catch { /* not vital */ } }
  return game;
}

/**
 * Rating from style (Maia): which rating level's players make the moves each side made, from the
 * move after the book. Runs in the Maia worker after a review and is saved as review.style =
 * { w: { est, best, n }, b: { … } }; a game with under eight non-book moves a side gets nothing.
 */
export async function styleRating(gameId) {
  const game = getGame(gameId);
  if (!game?.review?.positions) return null;
  const { fens, moves } = replay(game);
  const first = fens[0].split(' ')[1];
  await loadBook();
  const style = {};
  for (const color of ['w', 'b']) {
    const idx = [];
    for (let i = 0; i < moves.length; i++) {
      if (moves[i].color !== color) continue;
      if (isBook(fens[i + 1])) continue; // book moves say nothing about the player
      if (new Chess(fens[i]).moves().length < 2) continue; // only move
      idx.push(i);
    }
    if (idx.length < 8) continue;
    const r = await maiaStyle(fens, idx);
    if (r) style[color] = { est: r.est, best: r.best, n: r.n };
  }
  const g = getGame(gameId);
  if (!g?.review) return null;
  const updated = { ...g, review: { ...g.review, style } };
  saveGame(updated);
  return style;
}

/**
 * Both sides' game ratings for a reviewed game: { w, b } (null for a side with under 12 moves).
 * Worked out when shown, from the stored accuracies, so a change to the fit reaches old reviews.
 * Each side is anchored on its own rating in that game; your side of a bot game on your rating
 * against the bots (failing that, your chess.com rating).
 */
export function gameRatings(game) {
  const s = game?.review?.summary;
  if (!s?.acc) return { w: null, b: null };
  const num = (x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : null);
  const elo = { w: num(game.whiteElo), b: num(game.blackElo) };
  if (game.you && elo[game.you] == null) elo[game.you] = ladder()?.rating ?? ccLevel()?.rating ?? null;
  const timeClass = timeClassOf(game);
  const skip = (c) => (s.rated ? s.rated[c] === false : s.est?.[c] === null);
  const one = (c) => (skip(c) ? null : gameRating(s.acc[c], { rating: elo[c], timeClass }));
  return { w: one('w'), b: one('b') };
}

/** The depth a review reached: the median over its positions (each stores the depth of its first line). */
export function reviewDepth(game) {
  const ds = (game?.review?.positions || []).map(p => p?.lines?.[0]?.depth).filter(d => d > 0).sort((a, b) => a - b);
  return ds.length ? ds[ds.length >> 1] : null;
}
/** Is this reviewed game still short of `depth`? (A review searched to a depth records it.) */
export const needsDeepening = (game, depth) => depth > 0 && !!game?.review?.summary && !game.review.partial && game.review.flavor?.startsWith('full') && (game.review.depth ?? 0) < depth && (reviewDepth(game) ?? 0) < depth;

/** The time-per-position steps of a review, in ms (Settings shows them by name). */
export const REVIEW_STEPS = [400, 800, 1600, 3000, 8000];

/** Which engine a review was made with: { flavor, full: bool, ms } (full = the complete network). */
export function reviewEngine(game) {
  const r = game?.review;
  if (!r?.summary) return null;
  const flavor = r.summary.engine?.flavor || r.flavor || null;
  return { flavor, full: !!flavor?.startsWith('full'), ms: r.summary.engine?.ms ?? r.ms, threads: r.summary.engine?.threads, depth: reviewDepth(game) };
}

/** Classify moves of an analyzed game. */
export function classified(game) {
  const { fens, moves } = replay(game);
  const pos = game.review.positions.map((p, i) => ({ ...p, fen: fens[i] }));
  return { fens, moves, positions: pos, cls: classifyGame(pos, moves, isBook) };
}

const movesBy = (cls, first, color) => cls.filter((_, i) => ((i % 2 === 0) === (first === 'w')) === (color === 'w')).length;

export function summarize(game, review) {
  const { fens, moves } = replay(game);
  const pos = review.positions.map((p, i) => ({ ...p, fen: fens[i] }));
  const cls = classifyGame(pos, moves, isBook);
  const first = fens[0].split(' ')[1];
  const acc = { w: gameAccuracy(cls, pos, 'w'), b: gameAccuracy(cls, pos, 'b') };
  return {
    acc,
    // a rating guess needs enough moves to mean anything
    // (the game rating itself is worked out when shown, from the accuracies: see gameRatings)
    rated: { w: movesBy(cls, first, 'w') >= 12, b: movesBy(cls, first, 'b') >= 12 },
    plies: moves.length,
    counts: { w: counts(cls, 'w', first), b: counts(cls, 'b', first) },
    opening: openingOf(fens),
    // your mistakes by kind (lesson id), for the weekly plan
    kinds: game.you ? kindsOf({ fens, moves, positions: pos, cls }, game.you) : null,
    // what produced the numbers: a lite-network review is a rough one
    engine: { flavor: review.flavor || null, ms: review.ms, threads: review.threads },
    v: SUMMARY_V,
  };
}

/** Bumped when the classification, accuracy or game rating changes: older summaries are redone. */
export const SUMMARY_V = 5;

/** Redo the summaries of reviewed games from an older version (cheap: no engine needed). */
export async function refreshSummaries() {
  await loadBook();
  for (const g of allGames()) {
    if (!g.review?.summary || g.review.summary.v === SUMMARY_V || g.review.partial) continue;
    try { saveGame({ ...g, review: { ...g.review, summary: summarize(g, g.review) } }); } catch { /* leave it */ }
  }
  // the mistake-puzzle queue catches up on games reviewed before it existed (recent ones; ids dedupe)
  for (const g of allGames().filter(x => x.you && x.review?.summary && x.review.flavor?.startsWith('full')).slice(0, 60)) {
    try { addMistakePuzzles(g, classified(g)); } catch { /* skip */ }
  }
}
