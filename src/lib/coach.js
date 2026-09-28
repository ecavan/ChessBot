/**
 * The coach: explains moves, threats and plans in plain English, from Stockfish's lines plus
 * the rules of thumb every coach teaches (develop, castle, don't weaken your king, don't move
 * a piece twice, take the centre, rooks on open files…).
 *
 * Everything here is deterministic and offline. The engine supplies the facts (what the best
 * move was, what the refutation is); this file finds the *reason*: the piece left hanging,
 * the fork, the pin, the weakened king, the plan.
 */
import { Chess } from 'chess.js';
import { VALUE } from './chessutil.js';
import { pieces as parse, reach, control } from './insight.js';

export const NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const val = (t) => (t === 'k' ? 100 : VALUE[t]);
const other = (c) => (c === 'w' ? 'b' : 'w');
const file = (s) => s.charCodeAt(0) - 97;
const rank = (s) => Number(s[1]) - 1;
const sq = (f, r) => 'abcdefgh'[f] + (r + 1);

function tryMove(fen, uci) {
  const g = new Chess(fen);
  try { return { g, m: g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }) }; } catch { return null; }
}

// ------------------------------------------------------------------ board facts

/** Attackers of `s` by `color` (pseudo-legal: pins ignored, like a human counts them). */
function attackers(fen, s, color) { return control(fen)[s]?.[color] || []; }

/** Is the piece on `s` loose: attacked, and either undefended or attacked by something cheaper? */
export function loose(fen, s) {
  const pos = parse(fen);
  const p = pos[s];
  if (!p || p.type === 'k') return false;
  const att = attackers(fen, s, other(p.color));
  if (!att.length) return false;
  const def = attackers(fen, s, p.color);
  const cheapest = Math.min(...att.map(a => val(pos[a].type)));
  return !def.length || cheapest < val(p.type);
}

/** Pieces the piece on `s` attacks that matter: the king, anything worth more, anything loose. */
function targetsOf(fen, s, pawns = false) {
  const pos = parse(fen);
  const p = pos[s];
  if (!p) return [];
  return reach(pos, s).filter(t => pos[t] && pos[t].color !== p.color).filter(t => {
    const q = pos[t];
    if (q.type === 'k') return true;
    if (val(q.type) > val(p.type)) return true;
    return !attackers(fen, t, q.color).length && (pawns || q.type !== 'p');
  });
}

/** Fork: the piece on `s` hits two or more worthwhile targets (a loose pawn counts as the second). */
export function forkAt(fen, s) {
  const t = targetsOf(fen, s, true);
  const pos = parse(fen);
  if (loose(fen, s)) return null; // the forking piece just gets taken
  return t.length >= 2 && t.some(x => pos[x].type !== 'p') ? t : null;
}

/** Pins and skewers by `color`'s long-range pieces. */
export function lines(fen, color) {
  const pos = parse(fen);
  const out = [];
  const dirs = { b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
  dirs.q = [...dirs.b, ...dirs.r];
  for (const [s, p] of Object.entries(pos)) {
    if (p.color !== color || !dirs[p.type]) continue;
    for (const [dx, dy] of dirs[p.type]) {
      let f = file(s) + dx, r = rank(s) + dy;
      const hit = [];
      while (f >= 0 && f < 8 && r >= 0 && r < 8 && hit.length < 2) {
        const q = pos[sq(f, r)];
        if (q) { if (q.color === color) break; hit.push(sq(f, r)); }
        f += dx; r += dy;
      }
      if (hit.length < 2) continue;
      const [a, b] = hit.map(h => pos[h]);
      const frontHitsPinner = reach(pos, hit[0]).includes(s);
      if (val(b.type) > val(a.type) && val(b.type) >= 5 && !frontHitsPinner) out.push({ kind: 'pin', by: s, front: hit[0], back: hit[1] });
      else if (val(a.type) > val(b.type) && val(a.type) > val(p.type) && (a.type === 'k' || a.type === 'q') && b.type !== 'p' && !frontHitsPinner
        && (!attackers(fen, hit[1], b.color).length || val(b.type) > val(p.type))) out.push({ kind: 'skewer', by: s, front: hit[0], back: hit[1] });
    }
  }
  return out;
}

/** Material (White − Black) in pawns. */
function material(fen) {
  let m = 0;
  for (const p of Object.values(parse(fen))) if (p.type !== 'k') m += p.color === 'w' ? VALUE[p.type] : -VALUE[p.type];
  return m;
}

const pn = (pos, s) => `${NAME[pos[s].type]} on ${s}`;
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** Walk an engine line; material change for `color` after it settles. */
export function lineGain(fen, pv, color, maxPly = 8) {
  const g = new Chess(fen);
  const m0 = material(fen);
  let k = 0;
  const sans = [];
  for (; k < Math.min(pv.length, maxPly); k++) {
    try { const m = g.move({ from: pv[k].slice(0, 2), to: pv[k].slice(2, 4), promotion: pv[k][4] }); sans.push(m.san); } catch { break; }
  }
  // don't stop in the middle of an exchange
  while (k < pv.length && k < maxPly + 3) {
    const h = g.history({ verbose: true });
    if (!h.length || !h.at(-1).captured) break;
    try { const m = g.move({ from: pv[k].slice(0, 2), to: pv[k].slice(2, 4), promotion: pv[k][4] }); sans.push(m.san); k++; } catch { break; }
  }
  const d = material(g.fen()) - m0;
  return { gain: color === 'w' ? d : -d, sans, mate: g.isCheckmate() };
}

function lineText(fen, pv, n = 6) {
  const g = new Chess(fen);
  const out = [];
  let no = Number(fen.split(' ')[5]) || 1, white = fen.split(' ')[1] === 'w';
  for (let i = 0; i < Math.min(n, pv.length); i++) {
    let m;
    try { m = g.move({ from: pv[i].slice(0, 2), to: pv[i].slice(2, 4), promotion: pv[i][4] }); } catch { break; }
    out.push(white ? `${no}.${m.san}` : i === 0 ? `${no}…${m.san}` : m.san);
    if (!white) no++;
    white = !white;
  }
  return out.join(' ');
}

const worth = (g) => (g >= 8 ? 'the queen' : g >= 4.5 ? 'a rook' : g >= 2.5 ? 'a piece' : g >= 1.5 ? 'two pawns' : 'a pawn');

/**
 * Why a single move works (the tactic in it), described from the mover's side.
 * Returns a sentence or null.
 */
export function motifOf(fen, uci, prevUci = null) {
  const r = tryMove(fen, uci);
  if (!r) return null;
  const { g, m } = r;
  const after = g.fen();
  const before = parse(fen);
  const me = m.color;
  if (g.isCheckmate()) return `${m.san} is checkmate.`;
  const recapture = prevUci && prevUci.slice(2, 4) === m.to;
  const fork = forkAt(after, m.to);
  if (fork && (fork.length >= 2)) {
    const pos = parse(after);
    const names = fork.map(t => (pos[t].type === 'k' ? 'king' : pn(pos, t)));
    return `${m.san} forks the ${list(names)}.`;
  }
  if (m.captured && recapture) return `${m.san} takes back the ${NAME[m.captured]}.`;
  if (m.captured) {
    const wasLoose = !attackers(after, m.to, other(me)).length;
    if (wasLoose) return `${m.san} takes a ${NAME[m.captured]} that was left undefended.`;
    if (val(m.captured) > val(m.piece)) return `${m.san} wins material: the ${NAME[m.piece]} is worth less than the ${NAME[m.captured]} it takes.`;
  }
  const pos = parse(after);
  const fresh = lines(after, me).filter(l => !lines(fen, me).some(o => o.front === l.front && o.back === l.back))
    .filter(l => l.by === m.to || (pos[l.back].type === 'k' || pos[l.back].type === 'q') && pos[l.front].type !== 'p');
  const pin = fresh.find(l => l.kind === 'pin');
  if (pin) return `${m.san} pins the ${NAME[pos[pin.front].type]} on ${pin.front} to the ${NAME[pos[pin.back].type]}${pos[pin.back].type === 'k' ? '' : ` on ${pin.back}`}.`;
  const skewer = fresh.find(l => l.kind === 'skewer');
  if (skewer) return `${m.san} skewers the ${NAME[pos[skewer.front].type]}: when it moves, the ${pn(pos, skewer.back)} falls.`;
  // discovered attack: something else of mine now hits a big target
  for (const [s, p] of Object.entries(pos)) {
    if (p.color !== me || s === m.to || !'bqr'.includes(p.type)) continue;
    const now = targetsOf(after, s).filter(t => pos[t].type === 'k' || val(pos[t].type) >= 3);
    const was = before[s] ? targetsOf(fen, s) : [];
    const fr = now.filter(t => !was.includes(t));
    if (fr.length) return `${m.san} uncovers an attack: the ${NAME[p.type]} on ${s} now hits the ${pos[fr[0]].type === 'k' ? 'king' : pn(pos, fr[0])}.`;
  }
  if (m.san.includes('+')) return `${m.san} is a check that gains time.`;
  const had = reach(before, m.from);
  const t = targetsOf(after, m.to).filter(x => !had.includes(x) || m.piece === 'p');
  if (t.length && !loose(after, m.to)) return `${m.san} attacks the ${pn(pos, t[0])}.`;
  return null;
}

// ------------------------------------------------------------------ rules of thumb

const HOME = { w: { b1: 'n', g1: 'n', c1: 'b', f1: 'b' }, b: { b8: 'n', g8: 'n', c8: 'b', f8: 'b' } };
const INIT = {
  w: { b1: 'n', g1: 'n', c1: 'b', f1: 'b', d1: 'q', a1: 'r', h1: 'r', e1: 'k' },
  b: { b8: 'n', g8: 'n', c8: 'b', f8: 'b', d8: 'q', a8: 'r', h8: 'r', e8: 'k' },
};
export function undeveloped(fen, color) {
  const pos = parse(fen);
  return Object.entries(HOME[color]).filter(([s, t]) => pos[s]?.type === t && pos[s].color === color).map(([s]) => s);
}
function kingSq(fen, color) {
  for (const [s, p] of Object.entries(parse(fen))) if (p.type === 'k' && p.color === color) return s;
  return null;
}
export function castled(fen, color) {
  const k = kingSq(fen, color);
  const home = color === 'w' ? '1' : '8';
  return k && k[1] === home && 'gbhc'.includes(k[0]) && k !== (color === 'w' ? 'e1' : 'e8');
}
function canCastle(fen, color) {
  const c = fen.split(' ')[2];
  return color === 'w' ? /[KQ]/.test(c) : /[kq]/.test(c);
}
function shield(fen, color) {
  const k = kingSq(fen, color);
  if (!k) return 0;
  const pos = parse(fen);
  const dir = color === 'w' ? 1 : -1;
  let n = 0;
  for (let df = -1; df <= 1; df++) for (let dr = 1; dr <= 2; dr++) {
    const f = file(k) + df, r = rank(k) + dir * dr;
    if (f < 0 || f > 7 || r < 0 || r > 7) continue;
    const p = pos[sq(f, r)];
    if (p && p.type === 'p' && p.color === color) n++;
  }
  return n;
}
function pawnFiles(fen, color) {
  const f = Array(8).fill(0);
  for (const [s, p] of Object.entries(parse(fen))) if (p.type === 'p' && p.color === color) f[file(s)]++;
  return f;
}
export function pawnWeaknesses(fen, color) {
  const f = pawnFiles(fen, color);
  const doubled = [], isolated = [];
  f.forEach((n, i) => {
    if (n >= 2) doubled.push('abcdefgh'[i]);
    if (n && !(f[i - 1] || 0) && !(f[i + 1] || 0)) isolated.push('abcdefgh'[i]);
  });
  return { doubled, isolated };
}

/** What a move does, concretely: attacks, defends, aims at f7, prepares a break, opens a bishop. */
export function moveIdeas(fen, m, after) {
  const out = [];
  const me = m.color, them = other(me);
  const pos0 = parse(fen), pos1 = parse(after);
  // aims at the f7/f2 weak spot while their king is still near it
  const weak = me === 'w' ? 'f7' : 'f2', theirKing = kingSq(after, them);
  if ('bqn'.includes(m.piece) && pos1[weak]?.color === them && theirKing && ['e8', 'g8', 'e1', 'g1'].includes(theirKing)
    && reach(pos1, m.to).includes(weak) && !reach(pos0, m.from).includes(weak)) {
    const n = attackers(after, weak, me).length, d = attackers(after, weak, them).length;
    if (n >= 2 && n > d) out.push(`Hits ${weak} a second time: it is defended only by ${d === 1 ? 'the king' : `${d} pieces`}, so ${m.piece.toUpperCase()}x${weak} is a real threat.`);
    else out.push(`Aims at ${weak}, the weak point next to the king: at the start only the king defends it.`);
  }
  // new attacks by the moved piece
  const hit = reach(pos1, m.to).filter(t => pos1[t]?.color === them && pos1[t].type !== 'k' && !reach(pos0, m.from).includes(t));
  const worthIt = hit.filter(t => val(pos1[t].type) > val(m.piece) || !attackers(after, t, them).length);
  if (worthIt.length && !m.san.includes('#')) out.push(`Attacks the ${pn(pos1, worthIt[0])}${worthIt.length > 1 ? ` and the ${pn(pos1, worthIt[1])}` : ''}.`);
  // defends something that was attacked
  const defended = reach(pos1, m.to).filter(t => pos1[t]?.color === me && t !== m.to && pos1[t].type !== 'k'
    && attackers(after, t, them).length && !attackers(fen, t, me).includes(m.from));
  if (defended.length) out.push(`Defends the ${pn(pos1, defended[0])}.`);
  if (m.piece === 'p' && !m.captured) {
    // opens a bishop
    const bishops = Object.entries(pos1).filter(([s, p]) => p.type === 'b' && p.color === me && HOME[me][s] === 'b').map(([s]) => s);
    for (const b of bishops) {
      const before = reach(pos0, b).length, now = reach(pos1, b).length;
      if (now > before + 1) { out.push(`Opens the diagonal for the bishop on ${b}.`); break; }
    }
    // prepares a central push
    const dr = me === 'w' ? 1 : -1;
    if (m.to[0] === 'c' || m.to[0] === 'f') {
      const tgt = (m.to[0] === 'c' ? 'd' : 'e') + (me === 'w' ? '4' : '5');
      const pawnBehind = pos1[(m.to[0] === 'c' ? 'd' : 'e') + (me === 'w' ? '2' : '7')] || pos1[(m.to[0] === 'c' ? 'd' : 'e') + (me === 'w' ? '3' : '6')];
      if (!pos1[tgt] && pawnBehind?.type === 'p' && pawnBehind.color === me && reach(pos1, m.to).includes(tgt)) out.push(`Prepares ${tgt}, to build a bigger centre.`);
    }
    // supports a central pawn
    const sup = reach(pos1, m.to).filter(t => pos1[t]?.type === 'p' && pos1[t].color === me && 'de'.includes(t[0]));
    if (sup.length && !out.some(o => o.startsWith('Prepares'))) out.push(`Supports the pawn on ${sup[0]}.`);
    // the little h3/a3 moves: take a square away
    if ('ah'.includes(m.to[0]) && Math.abs(rank(m.to) - rank(m.from)) === 1) {
      const sqs = [sq(file(m.to) === 7 ? 6 : 1, rank(m.to) + dr)];
      const g0 = new Chess(nullFenSafe(fen));
      const could = g0 ? g0.moves({ verbose: true }).filter(x => sqs.includes(x.to) && 'bn'.includes(x.piece)) : [];
      if (could.length) out.push(`Takes ${sqs[0]} away from their ${NAME[could[0].piece]}, so it can't pin or harass your pieces there.`);
    }
  }
  if (m.captured && !out.length) out.push(`Takes the ${NAME[m.captured]}.`);
  return out;
}
function nullFenSafe(fen) {
  const p = fen.split(' ');
  p[1] = p[1] === 'w' ? 'b' : 'w';
  p[3] = '-';
  try { return new Chess(p.join(' ')).fen(); } catch { return fen; }
}

/** Rules-of-thumb notes about the move just played (m, from chess.js), good and bad. */
function principles(fen, m, after, ply) {
  const me = m.color;
  const good = [], bad = [];
  const opening = ply < 24;
  const undevBefore = undeveloped(fen, me);
  const piece = NAME[m.piece];
  if (m.flags.includes('k') || m.flags.includes('q')) good.push('Castles: the king gets safe and a rook comes toward the centre.');
  else if (m.piece === 'k' && canCastle(fen, me) && !canCastle(after, me) && ply < 40) bad.push('Moving the king gives up castling for good; the king will be stuck in the middle.');
  if (HOME[me][m.from] && HOME[me][m.from] === m.piece) {
    const central = 'cdef'.includes(m.to[0]);
    good.push(`Develops the ${piece}${central ? ' toward the centre' : ''}.`);
    if (m.piece === 'n' && 'ah'.includes(m.to[0])) bad.push('A knight on the edge controls half as many squares ("a knight on the rim is dim").');
  }
  if (m.piece === 'p' && opening && ['d4', 'e4', 'd5', 'e5'].includes(m.to) && !m.captured) good.push('Takes a share of the centre.');
  for (const t of moveIdeas(fen, m, after)) good.push(t);
  if (opening && m.piece === 'q' && undevBefore.length >= 3 && !m.captured) bad.push('The queen comes out before the minor pieces; she can be chased around while your opponent develops with tempo.');
  if (opening && !m.captured && m.piece !== 'p' && m.piece !== 'k' && INIT[me][m.from] !== m.piece && undevBefore.length >= 2 && !loose(fen, m.from) && !attackers(fen, m.from, other(me)).length && !m.san.includes('+'))
    bad.push(`Moves the ${piece} a second time while ${undevBefore.length} minor pieces are still at home. Develop a new piece instead.`);
  if (m.piece === 'p' && !m.captured) {
    const k = kingSq(fen, me);
    const nearKing = k && Math.abs(file(k) - file(m.from)) <= 1 && (castled(fen, me) || 'fgh'.includes(m.from[0]) && k[0] >= 'e');
    if (nearKing && 'fgh'.includes(m.from[0]) && shield(after, me) < shield(fen, me)) bad.push('Pushes a pawn in front of your king. Those pawns are its shelter; every push leaves holes the enemy pieces can use.');
    else if (m.from[0] === 'f' && opening && !castled(fen, me) && Math.abs(rank(m.to) - rank(m.from)) === 1) bad.push('The early f-pawn move weakens the diagonal to your king and takes the f3/f6 square from your knight.');
    else if (opening && 'ah'.includes(m.from[0]) && undevBefore.length >= 2) bad.push('Edge-pawn moves don\'t help your development. Bring out a piece instead.');
  }
  // king still in the middle
  if (ply >= 16 && !castled(after, me) && canCastle(after, me) && !m.flags.includes('k') && !m.flags.includes('q')) bad.push('Your king is still in the centre. Castle soon, before the position opens up.');
  // pawn structure damage from the move itself
  const w0 = pawnWeaknesses(fen, me), w1 = pawnWeaknesses(after, me);
  const newIso = w1.isolated.filter(f => !w0.isolated.includes(f));
  if (newIso.length && m.piece === 'p') bad.push(`Leaves an isolated pawn on the ${newIso[0]}-file: no pawn can defend it.`);
  // rook to open file
  if (m.piece === 'r' && !pawnFiles(after, me)[file(m.to)]) good.push(pawnFiles(after, other(me))[file(m.to)] ? 'Puts the rook on a half-open file.' : 'Puts the rook on an open file.');
  return { good, bad };
}

// ------------------------------------------------------------------ explaining a move

/**
 * Explain a played move.
 *   fen: position before the move; uci: the move played;
 *   ctx: { cls, drop (win% lost), bestUci, bestLine (pv from fen), afterLine (pv after the move), ply }
 * Returns { headline, points: [string], arrows: [{from,to,color}] }.
 */
export function explainMove(fen, uci, ctx = {}) {
  const r = tryMove(fen, uci);
  if (!r) return { headline: '', points: [] };
  const { g, m } = r;
  const after = g.fen();
  const me = m.color;
  const ply = ctx.ply ?? ((Number(fen.split(' ')[5]) - 1) * 2 + (me === 'b' ? 1 : 0));
  const bad = ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(ctx.cls);
  const big = ['mistake', 'blunder', 'miss'].includes(ctx.cls);
  const pr = principles(fen, m, after, ply);
  const points = [];
  const arrows = [];
  const bestSan = ctx.bestUci ? (tryMove(fen, ctx.bestUci)?.m.san ?? null) : null;

  if (bad && ctx.afterLine?.length) {
    // what goes wrong: follow the opponent's best reply
    const ref = ctx.afterLine;
    const loss = lineGain(after, ref, me);
    const why = motifOf(after, ref[0]);
    const refSan = tryMove(after, ref[0])?.m.san;
    if (loss.mate || ctx.afterMate) points.push(`${why ? `After this, ${why} ` : ''}It ends in a forced mate: ${lineText(after, ref, 7)}.`);
    else if (loss.gain <= -1) points.push(`After this, ${why || `${refSan} is strong.`} You lose ${worth(-loss.gain)}: ${lineText(after, ref, 6)}.`);
    else if (why) points.push(`After this, ${why} (${lineText(after, ref, 5)})`);
    if (ref[0]) arrows.push({ from: ref[0].slice(0, 2), to: ref[0].slice(2, 4), color: 'rgba(244,63,94,.85)' });
  }
  if (bad && ctx.bestUci && ctx.bestUci !== uci) {
    const bestWhy = motifOf(fen, ctx.bestUci);
    const gain = ctx.bestLine?.length ? lineGain(fen, ctx.bestLine, me) : { gain: 0 };
    if (bestWhy && /checkmate/.test(bestWhy)) points.push(`${ctx.cls === 'miss' ? 'You missed' : 'You had'} ${bestSan}, checkmate!`);
    else if (bestWhy && (gain.gain >= 1 || /forks|pins|skewers|uncovers/.test(bestWhy))) points.push(`${ctx.cls === 'miss' ? 'You missed' : 'Better was'} ${bestSan}: ${bestWhy.replace(/^[^ ]+ /, '')}`);
    else if (big) {
      const bp = tryMove(fen, ctx.bestUci);
      const bpr = bp ? principles(fen, bp.m, bp.g.fen(), ply) : { good: [] };
      points.push(`Better was ${bestSan}${bpr.good[0] ? `: ${bpr.good[0].charAt(0).toLowerCase()}${bpr.good[0].slice(1)}` : '.'}`);
    }
    arrows.push({ from: ctx.bestUci.slice(0, 2), to: ctx.bestUci.slice(2, 4), color: 'rgba(16,185,129,.85)' });
  }
  // rules of thumb: the bad ones matter when the move was worse, the good ones when it was fine
  if (bad) points.push(...pr.bad.slice(0, 2));
  else {
    const t = motifOf(fen, uci, ctx.prevUci);
    if (t && /forks|pins|skewers|uncovers|undefended|wins material|checkmate|takes back/.test(t)) points.push(t);
    points.push(...pr.good.slice(0, 2));
    if (!pr.good.length && pr.bad.length && ctx.cls !== 'best' && ctx.cls !== 'great' && ctx.cls !== 'brilliant') points.push(...pr.bad.slice(0, 1));
  }
  if (bad && !points.length && bestSan) points.push(`${bestSan} was more accurate; the difference is positional and shows a few moves later.`);
  const headline = ctx.cls ? {
    brilliant: 'Brilliant.', great: 'The only good move.', best: 'Best move.', excellent: 'Excellent.', good: 'Good move.', book: 'Book move.',
    inaccuracy: 'Inaccuracy.', mistake: 'Mistake.', miss: 'Missed chance.', blunder: 'Blunder.',
  }[ctx.cls] : '';
  return { headline, points: [...new Set(points)].slice(0, 3), arrows };
}

// ------------------------------------------------------------------ threats

/**
 * What is the opponent threatening? Pass the engine's best move for the opponent if it were
 * their turn (from a search on nullFen(fen)) and its line.
 */
export function nullFen(fen) {
  const p = fen.split(' ');
  p[1] = p[1] === 'w' ? 'b' : 'w';
  p[3] = '-';
  const f = p.join(' ');
  try { const g = new Chess(f); if (new Chess(fen).inCheck()) return null; return g.fen(); } catch { return null; }
}

export function describeThreat(fen, threatPv, gainCp) {
  const nf = nullFen(fen);
  if (!nf || !threatPv?.length) return null;
  const r = tryMove(nf, threatPv[0]);
  if (!r) return null;
  const them = r.m.color;
  const loss = lineGain(nf, threatPv, them);
  const why = motifOf(nf, threatPv[0]);
  let text;
  if (r.g.isCheckmate() || loss.mate) text = `They threaten mate: ${lineText(nf, threatPv, 5)}.`;
  else if (why) text = `Threat: ${why}`;
  else if (loss.gain >= 1) text = `Threat: ${r.m.san}, winning ${worth(loss.gain)}.`;
  else text = `They want to play ${r.m.san}.`;
  if (gainCp != null && gainCp < 80 && !loss.mate) return null;
  return { text, move: threatPv[0], arrows: [{ from: threatPv[0].slice(0, 2), to: threatPv[0].slice(2, 4), color: 'rgba(244,63,94,.85)' }] };
}

// ------------------------------------------------------------------ plans

/**
 * Plan ideas for `color` in the position: a short list of { title, text } plus arrows/circles
 * for the board. enginePv (optional): Stockfish's line from this position.
 */
export function planIdeas(fen, color, enginePv = []) {
  const ideas = [];
  const arrows = [], circles = [];
  const pos = parse(fen);
  const them = other(color);
  const g = new Chess(fen);
  const moveNo = Number(fen.split(' ')[5]) || 1;
  const undev = undeveloped(fen, color);
  const mat = material(fen) * (color === 'w' ? 1 : -1);

  // 1. king safety first
  if (!castled(fen, color) && canCastle(fen, color)) {
    ideas.push({ title: 'Castle', text: `Your king is still in the centre${undev.length ? ` and ${undev.length} minor piece${undev.length > 1 ? 's are' : ' is'} at home` : ''}. Finish developing and castle before starting anything.` });
  } else if (undev.length) {
    ideas.push({ title: 'Finish developing', text: `Still at home: ${undev.map(s => `${NAME[pos[s].type]} on ${s}`).join(', ')}. Every piece should join the game before you attack.` });
  }
  // 2. their king
  const theirK = kingSq(fen, them), myK = kingSq(fen, color);
  const queensOn = Object.values(pos).some(p => p.type === 'q');
  if (theirK && !castled(fen, them) && moveNo >= 8 && queensOn) {
    const centreOpen = [3, 4].some(f => !pawnFiles(fen, 'w')[f] || !pawnFiles(fen, 'b')[f]);
    ideas.push({ title: 'Their king is stuck in the centre', text: centreOpen ? 'Open the centre files (d and e) and bring your rooks there: a king in the middle is the best target there is.' : 'Open the centre with a pawn break so your pieces can reach their king.' });
  } else if (theirK && myK && castled(fen, color) && castled(fen, them) && Math.abs(file(theirK) - file(myK)) >= 4) {
    ideas.push({ title: 'Opposite-side castling: race', text: `Kings on opposite wings means a pawn storm: push the pawns on the ${file(theirK) >= 4 ? 'f, g and h' : 'a, b and c'} files at their king. Speed matters more than material.` });
  } else if (theirK && shield(fen, them) <= 1 && castled(fen, them)) {
    ideas.push({ title: 'Their king has few defenders', text: 'The pawns in front of their king are gone or advanced. Bring your queen and knights toward it and look for checks.' });
  }
  // 3. open files for the rooks
  const mine = pawnFiles(fen, color), theirs = pawnFiles(fen, them);
  const rooks = Object.entries(pos).filter(([, p]) => p.type === 'r' && p.color === color).map(([s]) => s);
  const open = [...Array(8).keys()].filter(f => !mine[f] && !theirs[f]);
  const half = [...Array(8).keys()].filter(f => !mine[f] && theirs[f]);
  if (rooks.length && (open.length || half.length) && !rooks.some(r => !mine[file(r)])) {
    const f = open[0] ?? half[0];
    ideas.push({ title: 'Rooks to the open file', text: `The ${'abcdefgh'[f]}-file is ${open.includes(f) ? 'open' : 'half-open'}. A rook there presses into their position; doubling rooks is even stronger.` });
  }
  // 4. the worst piece
  let worst = null;
  for (const [s, p] of Object.entries(pos)) {
    if (p.color !== color || !'nb'.includes(p.type) || HOME[color][s]) continue;
    const moves = g.turn() === color ? g.moves({ square: s }).length : reach(pos, s).filter(t => !pos[t] || pos[t].color !== color).length;
    if (!worst || moves < worst.n) worst = { s, n: moves, t: p.type };
  }
  if (worst && worst.n <= 2) ideas.push({ title: 'Improve your worst piece', text: `The ${NAME[worst.t]} on ${worst.s} has only ${worst.n} move${worst.n === 1 ? '' : 's'}. Find it a better square: often the whole plan is just that.` });
  // 5. outposts for a knight
  const dir = color === 'w' ? 1 : -1;
  const theirPawns = Object.entries(pos).filter(([, p]) => p.type === 'p' && p.color === them).map(([s]) => s);
  const outposts = [];
  for (let f = 1; f < 7; f++) for (const r of color === 'w' ? [4, 5] : [3, 2]) {
    const s = sq(f, r);
    if (pos[s]) continue;
    const guarded = [-1, 1].some(df => { const q = pos[sq(f + df, r - dir)]; return q && q.type === 'p' && q.color === color; });
    const safe = !theirPawns.some(p => Math.abs(file(p) - f) === 1 && (color === 'w' ? rank(p) > r : rank(p) < r));
    if (guarded && safe) outposts.push(s);
  }
  if (outposts.length) {
    ideas.push({ title: 'An outpost for a knight', text: `${list(outposts.slice(0, 2))} ${outposts.length > 1 ? 'are squares' : 'is a square'} no enemy pawn can ever attack, backed by your pawn. A knight planted there is often worth a rook.` });
    circles.push(...outposts.slice(0, 2).map(s => ({ sq: s, color: 'rgba(16,185,129,.9)' })));
  }
  // 5b. pawn breaks: a pawn push that hits their pawns and opens lines
  {
    const dir1 = color === 'w' ? 1 : -1;
    const pvSans = [];
    if (enginePv.length) {
      const h = new Chess(fen);
      for (const u of enginePv.slice(0, 10)) { try { const m = h.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); if (m.color === color && m.piece === 'p') pvSans.push(m.to); } catch { break; } }
    }
    const breaks = [];
    for (const [s0, p] of Object.entries(pos)) {
      if (p.type !== 'p' || p.color !== color) continue;
      const f = file(s0), r = rank(s0) + dir1;
      if (r < 0 || r > 7) continue;
      const t = sq(f, r);
      if (pos[t]) continue;
      const hits = [-1, 1].map(df => pos[sq(f + df, r + dir1)]).filter((q, i) => q && q.type === 'p' && q.color === them && f + [-1, 1][i] >= 0 && f + [-1, 1][i] < 8);
      if (!hits.length) continue;
      const score = (pvSans.includes(t) ? 10 : 0) + ('cdef'.includes(t[0]) ? 2 : 0);
      breaks.push({ t, score });
    }
    breaks.sort((a, b) => b.score - a.score);
    if (breaks.length && (breaks[0].score >= 2)) {
      const b = breaks[0].t;
      ideas.push({ title: `The ${b} break`, text: `${b} attacks their pawn chain and opens lines for your pieces. Prepare it (enough pieces covering ${b}) so that when pawns are traded, your pieces come alive.` });
      circles.push({ sq: b, color: 'rgba(250,204,21,.9)' });
    }
  }
  // 6. targets
  const w = pawnWeaknesses(fen, them);
  if (w.isolated.length) ideas.push({ title: 'Target the weak pawn', text: `Their ${w.isolated[0]}-pawn is isolated: no pawn can defend it. Attack it with pieces and it may fall.` });
  const hang = Object.entries(pos).filter(([s, p]) => p.color === them && p.type !== 'p' && loose(fen, s)).map(([s]) => s);
  if (hang.length) ideas.push({ title: 'Loose piece', text: `Their ${pn(pos, hang[0])} is not properly defended. Look for a way to attack it twice, or with a check at the same time.` });
  // 7. material
  if (mat >= 2) ideas.push({ title: 'You are ahead', text: 'Trade pieces (not pawns) and head for an endgame; every trade makes your extra material count for more.' });
  else if (mat <= -2) ideas.push({ title: 'You are behind', text: 'Avoid trades, keep pieces on and look for activity against their king. Simple positions favour the side with more.' });
  // 8. what Stockfish would do
  if (enginePv.length) {
    const h = new Chess(fen);
    const mineSans = [];
    for (let i = 0; i < Math.min(enginePv.length, 10); i++) {
      let m;
      try { m = h.move({ from: enginePv[i].slice(0, 2), to: enginePv[i].slice(2, 4), promotion: enginePv[i][4] }); } catch { break; }
      if (m.color === color) { mineSans.push(m.san); if (arrows.length < 3) arrows.push({ from: m.from, to: m.to, color: 'rgba(16,185,129,.8)' }); }
    }
    if (mineSans.length) ideas.push({ title: "Stockfish's plan", text: `${mineSans.slice(0, 4).join(', then ')}.` });
  }
  return { ideas: ideas.slice(0, 5), arrows, circles };
}
