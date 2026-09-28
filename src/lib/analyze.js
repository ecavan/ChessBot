/**
 * Full-game analysis for Review: every position searched with two lines (the second tells us
 * whether a move was the only good one), newest positions first so the hash carries knowledge
 * backwards. Results are stored with the game, so a review opens instantly the second time,
 * and an interrupted analysis picks up where it stopped.
 */
import { Chess } from 'chess.js';
import { engine } from '../engine/engine.js';
import { replay, saveGame, getGame } from './games.js';
import { classifyGame, gameAccuracy, ratingFromAccuracy, counts } from './review.js';
import { loadBook, isBook, openingOf } from './book.js';

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
export async function analyzeGame(gameId, { ms = 800, onProgress, isCancelled = () => false } = {}) {
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
  for (let i = fens.length - 1; i >= 0; i--) {
    if (positions[i]) continue;
    if (isCancelled()) return null;
    const term = terminalOf(fens[i]);
    if (term != null) positions[i] = { lines: [], terminal: term };
    else {
      const r = await engine.search({ fen: fens[i], movetime: ms, multipv: 2, tag: 'review' });
      if (!r || isCancelled()) return null;
      positions[i] = { lines: r.lines.slice(0, 2).map(slim) };
    }
    done++;
    onProgress?.(done, total);
    if (!getGame(gameId)) return null; // deleted meanwhile
    if (Date.now() - lastSave > 4000) {
      game = { ...getGame(gameId), review: { ms, positions, partial: true } };
      saveGame(game);
      lastSave = Date.now();
    }
  }
  if (!getGame(gameId)) return null;
  const review = { ms, positions, flavor: engine.status.flavor, at: Date.now() };
  review.summary = summarize(getGame(gameId), review);
  game = { ...getGame(gameId), review };
  saveGame(game);
  return game;
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
    est: { w: movesBy(cls, first, 'w') >= 12 ? ratingFromAccuracy(acc.w) : null, b: movesBy(cls, first, 'b') >= 12 ? ratingFromAccuracy(acc.b) : null },
    counts: { w: counts(cls, 'w', first), b: counts(cls, 'b', first) },
    opening: openingOf(fens),
  };
}
