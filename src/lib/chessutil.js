/** Small helpers around chess.js: UCI ↔ SAN, lines, PGN, material. */
import { Chess } from 'chess.js';

export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const posKey = (fen) => fen.split(' ').slice(0, 4).join(' ');
export const uciOf = (m) => m.from + m.to + (m.promotion || '');
export const sideToMove = (fen) => fen.split(' ')[1];

/** Play UCI moves from a FEN; returns the chess.js moves (verbose) actually made. */
export function playUci(fen, ucis) {
  const g = new Chess(fen);
  const out = [];
  for (const u of ucis) {
    try {
      const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      if (!m) break;
      out.push(m);
    } catch { break; }
  }
  return { game: g, moves: out };
}

/** "1. e4 e5 2. Nf3" style text for a UCI line from `fen`, up to `max` plies. */
export function lineSan(fen, ucis, max = 8) {
  const { moves } = playUci(fen, ucis.slice(0, max));
  const [, turn, , , , full] = fen.split(' ');
  let n = Number(full) || 1;
  let white = turn === 'w';
  const parts = [];
  moves.forEach((m, i) => {
    if (white) parts.push(`${n}. ${m.san}`);
    else parts.push(i === 0 ? `${n}… ${m.san}` : m.san);
    if (!white) n++;
    white = !white;
  });
  return parts.join(' ');
}

export function uciToSan(fen, uci) {
  const { moves } = playUci(fen, [uci]);
  return moves[0]?.san ?? uci;
}

export const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Material balance (White − Black) in pawns. */
export function material(fen) {
  let s = 0;
  for (const ch of fen.split(' ')[0]) {
    const v = VALUE[ch.toLowerCase()];
    if (v == null) continue;
    s += ch === ch.toUpperCase() ? v : -v;
  }
  return s;
}

/** Captured pieces for display: { w: ['p','n'], b: [...] } = pieces each side has taken. */
export function captured(fen) {
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const have = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const ch of fen.split(' ')[0]) {
    const t = ch.toLowerCase();
    if (!(t in start)) continue;
    have[ch === ch.toUpperCase() ? 'w' : 'b'][t]++;
  }
  const took = (by, of) => Object.entries(start).flatMap(([t, n]) => Array(Math.max(0, n - have[of][t])).fill(t));
  return { w: took('w', 'b'), b: took('b', 'w') };
}

/** Build PGN text from headers and SAN moves. */
export function toPgn(headers, sans, startFen = null) {
  const h = { Event: 'Chess Trainer', Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'), ...headers };
  if (startFen && startFen !== START) { h.SetUp = '1'; h.FEN = startFen; }
  const head = Object.entries(h).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n');
  const g = new Chess(startFen || START);
  let n = Number((startFen || START).split(' ')[5]) || 1;
  let white = g.turn() === 'w';
  const parts = [];
  sans.forEach((s, i) => {
    if (white) parts.push(`${n}.`);
    else if (i === 0) parts.push(`${n}...`);
    parts.push(s);
    if (!white) n++;
    white = !white;
  });
  return `${head}\n\n${parts.join(' ')} ${h.Result || '*'}`;
}

/**
 * Parse one PGN (chess.com / lichess exports work). Returns { headers, startFen, moves: [verbose] }
 * or throws with a readable message.
 */
export function parsePgn(text) {
  const g = new Chess();
  try {
    g.loadPgn(text.trim(), { strict: false });
  } catch (e) {
    throw new Error('That PGN could not be read. Paste the whole game, headers and moves.');
  }
  const headers = g.getHeaders ? g.getHeaders() : g.header();
  const moves = g.history({ verbose: true });
  if (!moves.length) throw new Error('No moves found in that PGN.');
  const startFen = headers.FEN || START;
  return { headers, startFen, moves };
}

/** Split a paste with several games into single PGNs. */
export function splitPgns(text) {
  const parts = text.replace(/\r/g, '').split(/\n(?=\[Event )/).map(s => s.trim()).filter(Boolean);
  return parts.length ? parts : [text];
}
