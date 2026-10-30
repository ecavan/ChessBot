/**
 * Full-game analysis for Review: every position searched with two lines (the second tells us
 * whether a move was the only good one), newest positions first so the hash carries knowledge
 * backwards. Results are stored with the game, so a review opens instantly the second time,
 * and an interrupted analysis picks up where it stopped.
 */
import { Chess } from 'chess.js';
import { engine } from '../engine/engine.js';
import { replay, saveGame, getGame } from './games.js';
import { classifyGame, gameAccuracy, gameRating, counts } from './review.js';
import { kindsOf } from './plan.js';
import { allGames } from './games.js';
import { loadBook, isBook, openingOf } from './book.js';
import { addMistakePuzzles } from './puzzles.js';

function terminalOf(fen) {
  const g = new Chess(fen);
  if (g.isCheckmate()) return g.turn() === 'w' ? -10000 : 10000;
  if (g.isStalemate() || g.isInsufficientMaterial() || g.isThreefoldRepetition?.()) return 0;
  return null;
}

const slim = (l) => ({ ...(l.cp != null ? { cp: l.cp } : {}), ...(l.mate != null ? { mate: l.mate } : {}), depth: l.depth, pv: (l.pv || []).slice(0, 12) });

/**
 * Analyze a stored game. opts: { ms, onProgress(done, total), isCancelled() }.
 * Resolves the updated game (with .review) or null if cancelled.
 */
export async function analyzeGame(gameId, { ms = 800, onProgress, isCancelled = () => false, priority, tag = 'review' } = {}) {
  await loadBook();
  let game = getGame(gameId);
  if (!game) return null;
  const { fens } = replay(game);
  const prev = game.review?.partial && game.review.ms === ms ? game.review.positions : null;
  const positions = prev && prev.length === fens.length ? [...prev] : Array(fens.length).fill(null);
  const total = fens.length;
  let done = positions.filter(Boolean).length;
  onProgress?.(done, total);
  let lastSave = Date.now();
  const flavors = new Set(game.review?.partial ? game.review.flavors || [] : []);
  const persistPartial = () => {
    if (!getGame(gameId)) return;
    game = { ...getGame(gameId), review: { ms, positions, partial: true, flavors: [...flavors] } };
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
        r = await engine.search({ fen: fens[i], movetime: ms, multipv: 2, tag, priority });
        if (!r || isCancelled()) { persistPartial(); return null; }
        if (!r.yielded) break;
        // a background review stepped aside for a live search: let that finish, then search again
        await engine.whenIdle();
        if (isCancelled()) { persistPartial(); return null; }
      }
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
  const review = { ms, positions, flavor, at: Date.now() };
  review.summary = summarize(getGame(gameId), review);
  game = { ...getGame(gameId), review };
  saveGame(game);
  // your mistakes become puzzles for the "Your mistakes" queue (full-network reviews only: lite ones are rough)
  if (game.you && flavor?.startsWith('full')) { try { addMistakePuzzles(game, classified(game)); } catch { /* not vital */ } }
  return game;
}

/** Which engine a review was made with: { flavor, full: bool, ms } (full = the complete network). */
export function reviewEngine(game) {
  const r = game?.review;
  if (!r?.summary) return null;
  const flavor = r.summary.engine?.flavor || r.flavor || null;
  return { flavor, full: !!flavor?.startsWith('full'), ms: r.summary.engine?.ms ?? r.ms, threads: r.summary.engine?.threads };
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
    est: { w: movesBy(cls, first, 'w') >= 12 ? gameRating(acc.w, acc.b, moves.length) : null, b: movesBy(cls, first, 'b') >= 12 ? gameRating(acc.b, acc.w, moves.length) : null },
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
export const SUMMARY_V = 4;

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
