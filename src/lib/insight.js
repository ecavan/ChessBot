/**
 * Board insight for the scratch pad and assists: what each piece reaches, which squares each side
 * controls, what is hanging, threats.
 */
import { Chess } from 'chess.js';
import { VALUE } from './chessutil.js';

const FILES = 'abcdefgh';
const sq = (f, r) => FILES[f] + (r + 1);
const fr = (s) => [s.charCodeAt(0) - 97, Number(s[1]) - 1];

/** Parse the placement into { square: {type, color} }. */
export function pieces(fen) {
  const out = {};
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else { out[sq(f, 7 - i)] = { type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? 'w' : 'b' }; f++; }
    }
  });
  return out;
}

/**
 * Squares a piece on `s` attacks (controls), ignoring pins and whose turn it is: the squares it
 * could capture on, including ones held by its own pieces (it defends those).
 */
export function reach(pos, s) {
  const p = pos[s];
  if (!p) return [];
  const [f, r] = fr(s);
  const out = [];
  const on = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
  const ray = (dx, dy) => { let x = f + dx, y = r + dy; while (on(x, y)) { out.push(sq(x, y)); if (pos[sq(x, y)]) break; x += dx; y += dy; } };
  const jump = (dx, dy) => { if (on(f + dx, r + dy)) out.push(sq(f + dx, r + dy)); };
  switch (p.type) {
    case 'p': { const d = p.color === 'w' ? 1 : -1; jump(-1, d); jump(1, d); break; }
    case 'n': [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([a, b]) => jump(a, b)); break;
    case 'b': [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => ray(a, b)); break;
    case 'r': [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => ray(a, b)); break;
    case 'q': [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => ray(a, b)); break;
    case 'k': [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => jump(a, b)); break;
    default:
  }
  return out;
}

/** For every square: who attacks it. { sq: { w: [from...], b: [from...] } } */
export function control(fen) {
  const pos = pieces(fen);
  const out = {};
  for (const [s, p] of Object.entries(pos)) {
    for (const t of reach(pos, s)) {
      out[t] ||= { w: [], b: [] };
      out[t][p.color].push(s);
    }
  }
  return out;
}

/**
 * Pieces in trouble: attacked and undefended, or attacked by something worth less.
 * Returns [{ square, color, type, by: [from] }].
 */
export function hanging(fen) {
  const pos = pieces(fen);
  const ctl = control(fen);
  const out = [];
  for (const [s, p] of Object.entries(pos)) {
    if (p.type === 'k') continue;
    const c = ctl[s];
    if (!c) continue;
    const opp = p.color === 'w' ? 'b' : 'w';
    const att = c[opp], def = c[p.color];
    if (!att.length) continue;
    const cheapest = Math.min(...att.map(a => (pos[a].type === 'k' ? 100 : VALUE[pos[a].type])));
    if (!def.length || cheapest < VALUE[p.type]) out.push({ square: s, ...p, by: att });
  }
  return out;
}

/** Legal destination squares for the piece on `s`, as if it were that piece's side to move. */
export function legalFrom(fen, s) {
  const pos = pieces(fen);
  const p = pos[s];
  if (!p) return [];
  const parts = fen.split(' ');
  if (parts[1] !== p.color) { parts[1] = p.color; parts[3] = '-'; }
  try {
    const g = new Chess(parts.join(' '));
    return g.moves({ square: s, verbose: true }).map(m => m.to);
  } catch {
    return reach(pos, s).filter(t => pos[t]?.color !== p.color);
  }
}

/** Opponent's capture threats against the side to move (arrows). */
export function threatArrows(fen) {
  const turn = fen.split(' ')[1];
  return hanging(fen).filter(h => h.color === turn).flatMap(h => h.by.map(b => ({ from: b, to: h.square, color: 'rgba(244,63,94,.8)' })));
}

/** Can a position be loaded by chess.js (both kings, side not to move not in check…)? */
export function validFen(fen) {
  try {
    new Chess(fen);
    // the side NOT to move must not be in check (otherwise its king could be captured)
    const p = fen.split(' ');
    p[1] = p[1] === 'w' ? 'b' : 'w';
    p[3] = '-';
    return !new Chess(p.join(' ')).inCheck();
  } catch { return false; }
}
