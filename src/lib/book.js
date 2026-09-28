/** Opening names (Lichess chess-openings, CC0): position → [ECO, name]. Loaded once, on demand. */
import { posKey } from './chessutil.js';

let book = null, loading = null;
export function loadBook() {
  if (book) return Promise.resolve(book);
  loading ||= fetch('/data/openings.json').then(r => r.json()).then(j => (book = j)).catch(() => (book = {}));
  return loading;
}
export const bookReady = () => !!book;
export const isBook = (fen) => !!book?.[posKey(fen)];

/** The deepest named opening reached in a list of FENs. */
export function openingOf(fens) {
  if (!book) return null;
  let found = null;
  for (let i = 0; i < Math.min(fens.length, 40); i++) {
    const e = book[posKey(fens[i])];
    if (e) found = { eco: e[0], name: e[1], ply: i };
  }
  return found;
}
