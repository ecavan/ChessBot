/**
 * The chessboard. Drawn by hand (no board library) so touch works the way it should on an iPad:
 *   - tap a piece to see its moves (dots; rings on captures), tap a dot to move;
 *   - or drag it; dropping it back leaves it selected;
 *   - tap a piece that can't move (the other side's) to peek at where it could go;
 *   - promotion picker on the board, like chess.com;
 *   - pieces glide between squares; arrows, circles, square tints and move badges on top.
 *
 * Modes: normal (legal moves only, from `logicFen`), free (move anything anywhere: the
 * scratch-pad editor) and arrow (drag draws an arrow, tap draws a circle).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { usePrefs } from '../lib/prefs.js';
import { boardOf, piecesOf } from '../lib/themes.js';
import { pieces as parsePieces, legalFrom } from '../lib/insight.js';
import { CLASSES, BADGE } from '../lib/review.js';

const FILES = 'abcdefgh';
const xyOf = (s, flip) => { const f = s.charCodeAt(0) - 97, r = Number(s[1]) - 1; return flip ? [7 - f, r] : [f, 7 - r]; };
const sqAt = (x, y, flip) => (x < 0 || x > 7 || y < 0 || y > 7 ? null : flip ? FILES[7 - x] + (y + 1) : FILES[x] + (8 - y));
const code = (p) => (p.color === 'w' ? 'w' : 'b') + p.type.toUpperCase();

let idSeq = 1;
/** Give each piece a stable id across positions so moves animate. */
function track(prev, placement) {
  const next = [];
  const left = [...prev];
  const todo = [];
  for (const [s, p] of Object.entries(placement)) {
    const c = code(p);
    const k = left.findIndex(q => q.sq === s && q.code === c);
    if (k >= 0) { next.push({ ...left[k] }); left.splice(k, 1); } else todo.push({ sq: s, code: c });
  }
  for (const t of todo) {
    let best = -1, bd = 99;
    const [tx, ty] = xyOf(t.sq, false);
    left.forEach((q, i) => {
      if (q.code !== t.code) return;
      const [qx, qy] = xyOf(q.sq, false);
      const d = Math.abs(qx - tx) + Math.abs(qy - ty);
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) { next.push({ id: left[best].id, sq: t.sq, code: t.code }); left.splice(best, 1); } else next.push({ id: idSeq++, sq: t.sq, code: t.code });
  }
  return next;
}

export default function Board({
  fen, logicFen, orientation = 'white', size = 480,
  movable = 'none', // 'w' | 'b' | 'both' | 'none' — which colours the user may move (on their turn)
  free = false, // editor: any piece anywhere
  tool = null, // 'arrow' → dragging draws arrows
  hideDots = false,
  onMove, onRemove, onArrow, onSelect, onTap,
  lastMove, arrows = [], circles = [], marks = {}, badge = null, reachOf = null, counts = null,
  dim = false,
}) {
  const [prefs] = usePrefs();
  const theme = boardOf(prefs.boardTheme);
  const set = piecesOf(prefs.pieceStyle);
  const flip = orientation === 'black';
  const S = size / 8;
  const lf = logicFen || fen;

  const placement = useMemo(() => parsePieces(fen), [fen]);
  const prevRef = useRef([]);
  const tracked = useMemo(() => { const t = track(prevRef.current, placement); prevRef.current = t; return t; }, [placement]);

  const [sel, setSel] = useState(null);
  const [drag, setDrag] = useState(null); // { from, x, y, moved }
  const [promo, setPromo] = useState(null); // { from, to, color }
  const [draw, setDraw] = useState(null); // arrow being drawn { from, to }
  const [noAnim, setNoAnim] = useState(null);
  const boxRef = useRef(null);
  const downRef = useRef(null);

  // selection resets when the position changes underneath
  useEffect(() => { setSel(null); setPromo(null); }, [lf]);
  useEffect(() => { const t = setTimeout(() => setNoAnim(null), 40); return () => clearTimeout(t); }, [fen]);
  useEffect(() => { onSelect?.(sel); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const game = useMemo(() => { try { return new Chess(lf); } catch { return null; } }, [lf]);
  const turn = lf.split(' ')[1];
  const logicPieces = useMemo(() => (lf === fen ? placement : parsePieces(lf)), [lf, fen, placement]);

  const canMove = (s) => {
    const p = logicPieces[s];
    if (!p) return false;
    if (free) return true;
    if (movable === 'none') return false;
    if (movable !== 'both' && movable !== p.color) return false;
    return p.color === turn;
  };

  const targets = useMemo(() => {
    if (!sel) return { list: [], mine: true };
    if (free) return { list: [], mine: true };
    const p = logicPieces[sel];
    if (!p) return { list: [], mine: true };
    if (canMove(sel) && game) {
      const ms = game.moves({ square: sel, verbose: true });
      return { list: [...new Set(ms.map(m => m.to))], mine: true, moves: ms };
    }
    if (!prefs.peek) return { list: [], mine: false };
    return { list: legalFrom(lf, sel), mine: false };
  }, [sel, lf, free, game, logicPieces, prefs.peek]); // eslint-disable-line react-hooks/exhaustive-deps

  const squareFromEvent = (e) => {
    const r = boxRef.current.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * 8), y = Math.floor(((e.clientY - r.top) / r.height) * 8);
    return sqAt(x, y, flip);
  };

  function tryMove(from, to) {
    if (free) {
      if (from !== to) { onMove?.({ from, to }); setNoAnim(to); }
      setSel(null);
      return true;
    }
    if (!game || !canMove(from)) return false;
    const ms = game.moves({ square: from, verbose: true }).filter(m => m.to === to);
    if (!ms.length) return false;
    if (ms.some(m => m.promotion)) { setPromo({ from, to, color: logicPieces[from].color }); return true; }
    const ok = onMove?.({ from, to });
    setSel(null);
    return ok !== false;
  }

  function onPointerDown(e) {
    if (e.button === 2) return;
    const s = squareFromEvent(e);
    if (!s) return;
    if (promo) { setPromo(null); setSel(null); return; }
    try { boxRef.current.setPointerCapture?.(e.pointerId); } catch { /* synthetic or finished pointer */ }
    const r = boxRef.current.getBoundingClientRect();
    const pt = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (tool === 'arrow') { setDraw({ from: s, to: s }); downRef.current = { s, arrow: true }; return; }
    onTap?.(s);
    if (sel && sel !== s && targets.mine && (free || targets.list.includes(s))) {
      setNoAnim(null);
      tryMove(sel, s);
      downRef.current = null;
      return;
    }
    if (logicPieces[s] || (free && placement[s])) {
      const wasSel = sel === s;
      setSel(s);
      downRef.current = { s, wasSel, x: pt.x, y: pt.y, canDrag: canMove(s) };
    } else {
      setSel(null);
      downRef.current = null;
    }
  }

  function onPointerMove(e) {
    const d = downRef.current;
    if (!d) return;
    if (d.arrow) { const s = squareFromEvent(e); if (s) setDraw(x => (x ? { ...x, to: s } : x)); return; }
    if (!d.canDrag) return;
    const r = boxRef.current.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (!d.dragging && Math.hypot(x - d.x, y - d.y) < 6) return;
    d.dragging = true;
    setDrag({ from: d.s, x, y });
  }

  function onPointerUp(e) {
    const d = downRef.current;
    downRef.current = null;
    if (!d) return;
    if (d.arrow) {
      const s = squareFromEvent(e) || draw?.to;
      if (draw && s) onArrow?.(draw.from, s);
      setDraw(null);
      return;
    }
    const s = squareFromEvent(e);
    setDrag(null);
    if (d.dragging) {
      if (!s) { if (free) { onRemove?.(d.s); setSel(null); } return; }
      if (s !== d.s) { setNoAnim(s); if (!tryMove(d.s, s)) setNoAnim(null); }
      return;
    }
    if (d.wasSel && s === d.s) setSel(null); // tap again to deselect
  }

  const lightSq = (s) => (s.charCodeAt(0) - 97 + Number(s[1])) % 2 === 0;
  const pos = (s) => { const [x, y] = xyOf(s, flip); return [x * S, y * S]; };

  // check
  let checkSq = null;
  if (game && game.inCheck()) {
    for (const [s, p] of Object.entries(logicPieces)) if (p.type === 'k' && p.color === turn) checkSq = s;
  }

  const sqStyles = {};
  const add = (s, bg) => { if (s) (sqStyles[s] ||= []).push(bg); };
  if (lastMove) { add(lastMove.from, theme.hl); add(lastMove.to, theme.hl); }
  if (sel && !tool) add(sel, theme.hl);
  for (const [s, c] of Object.entries(marks)) add(s, c);
  if (reachOf) for (const s of reachOf.squares) add(s, reachOf.color);

  const allSquares = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) allSquares.push(sqAt(x, y, flip));

  const arrowsAll = draw && draw.from !== draw.to ? [...arrows, { from: draw.from, to: draw.to, color: 'rgba(250,176,5,.85)' }] : arrows;

  return (
    <div
      ref={boxRef}
      className="cb"
      data-fen={fen}
      style={{ width: size, height: size, opacity: dim ? 0.55 : 1 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { downRef.current = null; setDrag(null); setDraw(null); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {allSquares.map((s) => {
        const [x, y] = pos(s);
        const light = lightSq(s);
        const overlays = sqStyles[s];
        return (
          <div key={s} className="cb-sq" style={{ left: x, top: y, width: S, height: S, background: light ? theme.light : theme.dark }}>
            {overlays?.map((bg, i) => <div key={i} style={{ position: 'absolute', inset: 0, background: bg }} />)}
            {counts?.[s] && (
              <>
                {counts[s].w > 0 && <span className="cb-count" style={{ left: S * 0.05, bottom: S * 0.05, width: S * 0.26, height: S * 0.26, fontSize: S * 0.17, background: 'rgba(14,165,233,.92)' }}>{counts[s].w}</span>}
                {counts[s].b > 0 && <span className="cb-count" style={{ right: S * 0.05, top: S * 0.05, width: S * 0.26, height: S * 0.26, fontSize: S * 0.17, background: 'rgba(225,29,72,.92)' }}>{counts[s].b}</span>}
              </>
            )}
            {s === checkSq && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(255,0,0,.9) 0%, rgba(231,0,0,.55) 35%, rgba(169,0,0,0) 72%)' }} />}
            {prefs.coords && (flip ? s[1] === '8' : s[1] === '1') && (
              <span className="cb-coord" style={{ right: S * 0.06, bottom: S * 0.05, fontSize: Math.max(9, S * 0.2), color: light ? theme.dark : theme.light }}>{s[0]}</span>
            )}
            {prefs.coords && (flip ? s[0] === 'h' : s[0] === 'a') && (
              <span className="cb-coord" style={{ left: S * 0.06, top: S * 0.05, fontSize: Math.max(9, S * 0.2), color: light ? theme.dark : theme.light }}>{s[1]}</span>
            )}
          </div>
        );
      })}

      {/* move dots */}
      {!hideDots && !tool && targets.list.map((s) => {
        const [x, y] = pos(s);
        const occupied = !!logicPieces[s];
        const col = targets.mine ? 'rgba(20, 30, 20, .28)' : 'rgba(225, 29, 72, .38)';
        return occupied ? (
          <div key={'t' + s} className="cb-ring" style={{ left: x, top: y, width: S, height: S, border: `${S * 0.09}px solid ${col}` }} />
        ) : (
          <div key={'t' + s} className="cb-dot" style={{ left: x + S * 0.34, top: y + S * 0.34, width: S * 0.32, height: S * 0.32, background: col }} />
        );
      })}

      {/* pieces */}
      {tracked.map((p) => {
        const Piece = set[p.code];
        const dragging = drag && drag.from === p.sq;
        let [x, y] = pos(p.sq);
        if (dragging) { x = drag.x - S / 2; y = drag.y - S / 2; }
        const anim = !dragging && noAnim !== p.sq;
        return (
          <div key={p.id} className={`cb-piece ${anim ? 'anim' : ''} ${dragging ? 'drag' : ''}`}
            style={{ width: S, height: S, transform: `translate(${x}px, ${y}px)${dragging ? ' scale(1.12)' : ''}` }}>
            {Piece ? <Piece /> : null}
          </div>
        );
      })}

      <Arrows arrows={arrowsAll} circles={circles} flip={flip} />

      {badge && CLASSES[badge.cls] && (() => {
        const [x, y] = pos(badge.sq);
        const d = Math.max(18, S * 0.4);
        return (
          <div className="cb-badge pop" key={badge.sq + badge.cls} style={{ left: Math.min(size - d - 1, x + S - d * 0.62), top: Math.max(1, y - d * 0.38), width: d, height: d, fontSize: d * 0.5, background: CLASSES[badge.cls].color }}>
            {BADGE[badge.cls]}
          </div>
        );
      })()}

      {promo && (() => {
        const [x] = pos(promo.to);
        const top = (promo.color === 'w') !== flip;
        const kinds = ['q', 'n', 'r', 'b'];
        return (
          <div className="cb-promo" style={{ left: x, top: top ? 0 : undefined, bottom: top ? undefined : 0, width: S }}
            onPointerDown={(e) => e.stopPropagation()}>
            {(top ? kinds : [...kinds].reverse()).map(k => {
              const P = set[(promo.color === 'w' ? 'w' : 'b') + k.toUpperCase()];
              return (
                <button key={k} style={{ width: S, height: S }} onClick={() => { const pr = promo; setPromo(null); setSel(null); onMove?.({ from: pr.from, to: pr.to, promotion: k }); }}>
                  <P />
                </button>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

/** Arrows (knight moves get the L shape) and circles, in board units (one square = 1). */
function Arrows({ arrows, circles, flip }) {
  if (!arrows?.length && !circles?.length) return null;
  const c = (s) => { const [x, y] = xyOf(s, flip); return [x + 0.5, y + 0.5]; };
  return (
    <svg className="cb-arrows" viewBox="0 0 8 8" preserveAspectRatio="none">
      {circles?.map((k, i) => { const [x, y] = c(k.sq); return <circle key={'c' + i} cx={x} cy={y} r={0.44} fill="none" stroke={k.color || 'rgba(250,176,5,.85)'} strokeWidth={0.07} />; })}
      {arrows.map((a, i) => {
        if (!a.from || !a.to || a.from === a.to) return null;
        const [x1, y1] = c(a.from), [x2, y2] = c(a.to);
        const dx = x2 - x1, dy = y2 - y1;
        const knight = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
        const pts = knight ? (Math.abs(dy) > Math.abs(dx) ? [[x1, y1], [x1, y2], [x2, y2]] : [[x1, y1], [x2, y1], [x2, y2]]) : [[x1, y1], [x2, y2]];
        const w = a.width || 0.17;
        const head = 0.42, hw = 0.42;
        // shorten the last leg for the head
        const [px, py] = pts[pts.length - 2];
        const lx = x2 - px, ly = y2 - py, L = Math.hypot(lx, ly);
        const ux = lx / L, uy = ly / L;
        const bx = x2 - ux * head, by = y2 - uy * head;
        const start = pts[0], sx = start[0] + (pts[1][0] - start[0]) / Math.hypot(pts[1][0] - start[0], pts[1][1] - start[1]) * 0.18,
          sy = start[1] + (pts[1][1] - start[1]) / Math.hypot(pts[1][0] - start[0], pts[1][1] - start[1]) * 0.18;
        const line = [[sx, sy], ...pts.slice(1, -1), [bx, by]];
        return (
          <g key={i} opacity={a.opacity ?? 0.9}>
            <polyline points={line.map(p => p.join(',')).join(' ')} fill="none" stroke={a.color || 'rgba(21,128,61,.8)'} strokeWidth={w} strokeLinejoin="round" />
            <polygon points={`${x2},${y2} ${bx - uy * hw / 2 * 1.0},${by + ux * hw / 2} ${bx + uy * hw / 2},${by - ux * hw / 2}`} fill={a.color || 'rgba(21,128,61,.8)'} />
          </g>
        );
      })}
    </svg>
  );
}
