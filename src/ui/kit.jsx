/** Small shared UI pieces. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePrefs } from '../lib/prefs.js';
import { piecesOf } from '../lib/themes.js';
import { captured, material } from '../lib/chessutil.js';
import { winPct, cpOf, CLASSES, BADGE } from '../lib/review.js';

export function Toggle({ on, onChange, label, sub }) {
  return (
    <button type="button" className="flex items-center justify-between gap-3 w-full text-left py-1.5" onClick={() => onChange(!on)}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink-100">{label}</span>
        {sub && <span className="block text-xs text-ink-300 mt-0.5">{sub}</span>}
      </span>
      <span className={`toggle ${on ? 'on' : ''}`}><i /></span>
    </button>
  );
}

export function Seg({ value, options, onChange, className = '' }) {
  return (
    <div className={`seg ${className}`}>
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

export function Stat({ k, v, s, className = '' }) {
  return <div className={`stat ${className}`}><div className="k">{k}</div><div className="v">{v}</div>{s != null && <div className="s">{s}</div>}</div>;
}

export function Spinner({ size = 16 }) {
  return <span className="spin inline-block rounded-full border-2 border-ink-500 border-t-emerald-400" style={{ width: size, height: size }} />;
}

export function Sheet({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-back fade-up" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`sheet panel panel-pad scroll-y ${wide ? '!max-w-3xl' : ''}`}>
        {title && (
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {onClose && <button className="btn btn-quiet btn-sm" onClick={onClose}>Close</button>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Progress({ value, className = '', color = '#10b981' }) {
  return <div className={`bar ${className}`}><i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div>;
}

/** Board + panel sizing for the current window. */
export function useStage({ evalBar = false, panel = 380 } = {}) {
  const get = () => {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width || window.innerWidth), h = Math.round(vv?.height || window.innerHeight);
    const landscape = w >= 900 && w > h * 1.05;
    const ev = evalBar ? 30 : 0;
    let size;
    if (landscape) {
      const pw = w >= 1100 ? panel : Math.min(panel, 330);
      size = Math.min(h - 56 - 26 - 84, w - pw - ev - 20 - 36);
      return { portrait: false, size: Math.floor(Math.max(240, size) / 8) * 8, panel: pw, w, h };
    }
    const top = w >= 768 ? 56 : 52;
    size = Math.min(w - 28 - ev, (h - top) * (w >= 768 ? 0.6 : 0.62), 820);
    return { portrait: true, size: Math.floor(Math.max(200, size) / 8) * 8, panel: size, w, h };
  };
  const [st, setSt] = useState(get);
  useLayoutEffect(() => {
    const f = () => setSt(get());
    f();
    window.addEventListener('resize', f);
    window.visualViewport?.addEventListener('resize', f);
    window.addEventListener('orientationchange', f);
    return () => { window.removeEventListener('resize', f); window.visualViewport?.removeEventListener('resize', f); window.removeEventListener('orientationchange', f); };
  }, [evalBar, panel]); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}

/** The board screen layout: [eval bar] board (with strips above and below) | panel. */
export function Stage({ stage, top, bottom, evalBar, board, children, panelClass = '' }) {
  return (
    <div className={`stage ${stage.portrait ? 'portrait' : ''}`} style={{ '--bw': `${stage.size + (evalBar ? 30 : 0)}px` }}>
      <div className="stage-board">
        {top && <div style={{ marginLeft: evalBar ? 30 : 0 }}>{top}</div>}
        <div className="flex gap-2 items-stretch">
          {evalBar}
          {board}
        </div>
        {bottom && <div style={{ marginLeft: evalBar ? 30 : 0 }}>{bottom}</div>}
      </div>
      <div className={`stage-panel ${stage.portrait ? '' : 'fill'} ${panelClass}`} style={stage.portrait ? {} : { width: stage.panel, height: stage.size + 80 }}>
        {children}
      </div>
    </div>
  );
}

/** Player strip above/below the board: avatar, name, rating, captured pieces, material edge. */
export function PlayerStrip({ icon = '👤', name, sub, color, fen, right, active }) {
  const [prefs] = usePrefs();
  const set = piecesOf(prefs.pieceStyle);
  const caps = fen ? captured(fen)[color] : [];
  const mat = fen ? material(fen) * (color === 'w' ? 1 : -1) : 0;
  const order = { q: 0, r: 1, b: 2, n: 3, p: 4 };
  const them = color === 'w' ? 'b' : 'w';
  return (
    <div className="strip">
      <div className="who">
        <span className="avatar" style={active ? { borderColor: '#10b981', boxShadow: '0 0 0 2px rgba(16,185,129,.3)' } : undefined}>{icon}</span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-sm font-semibold text-white truncate">{name}</span>
            {sub && <span className="text-xs text-ink-300 whitespace-nowrap">{sub}</span>}
          </div>
          <div className="caps">
            {[...caps].sort((a, b) => order[a] - order[b]).map((t, i) => { const P = set[them + t.toUpperCase()]; return <span key={i} style={{ width: 13, display: 'inline-block' }}>{P ? <P /> : null}</span>; })}
            {mat > 0 && <span className="text-xs text-ink-300 font-semibold ml-2">+{mat}</span>}
          </div>
        </div>
      </div>
      {right}
    </div>
  );
}

/** Vertical eval bar. line = engine line (White POV) or { cp } / { mate }. */
export function EvalBar({ line, height, orientation = 'white', result }) {
  let pctW = 50, text = '0.0', whiteAhead = true;
  if (result) {
    pctW = result === '1-0' ? 100 : result === '0-1' ? 0 : 50;
    text = result === '1/2-1/2' ? '½' : result === '1-0' ? '1-0' : '0-1';
    whiteAhead = result !== '0-1';
  } else if (line && (line.cp != null || line.mate != null)) {
    const cp = cpOf(line);
    pctW = line.mate != null ? (cp > 0 ? 100 : cp < 0 ? 0 : 50) : Math.max(4, Math.min(96, winPct(cp)));
    whiteAhead = cp >= 0;
    text = line.mate != null ? (line.mate === 0 ? '#' : `M${Math.abs(line.mate)}`) : (Math.abs(cp / 100) >= 10 ? Math.round(Math.abs(cp / 100)) : Math.abs(cp / 100).toFixed(1));
  }
  const flip = orientation === 'black';
  const wh = (pctW / 100) * height;
  return (
    <div className="evalbar" style={{ height }} title="Evaluation">
      <div className="w" style={flip ? { top: 0, height: wh } : { bottom: 0, height: wh }} />
      <div className="t" style={{
        ...((whiteAhead !== flip) ? { bottom: 4 } : { top: 4 }),
        color: whiteAhead ? '#1d2531' : '#f2f2f2',
      }}>{text}</div>
    </div>
  );
}

export function ClsDot({ cls, size = 18 }) {
  const c = CLASSES[cls];
  if (!c) return null;
  return <span className="cls-dot" style={{ background: c.color, width: size, height: size, fontSize: size * 0.55 }}>{BADGE[cls]}</span>;
}

/** Move list. sans[i], cls?[i]; ply = number of moves shown (0 = start). */
export function MoveList({ sans, cls, ply, onJump, startFen, className = '', maxHeight }) {
  const box = useRef(null);
  const onRef = useRef(null);
  const blackFirst = startFen && startFen.split(' ')[1] === 'b';
  const n0 = startFen ? Number(startFen.split(' ')[5]) || 1 : 1;
  const rows = [];
  const cells = blackFirst ? [null, ...sans.map((s, i) => i)] : sans.map((s, i) => i);
  for (let k = 0; k < cells.length; k += 2) rows.push([n0 + k / 2, cells[k], cells[k + 1]]);
  useEffect(() => {
    const el = onRef.current, b = box.current;
    if (!el || !b) return;
    const top = el.offsetTop - b.offsetTop;
    if (top < b.scrollTop + 8 || top > b.scrollTop + b.clientHeight - 40) b.scrollTop = top - b.clientHeight / 2;
  }, [ply]);
  const cell = (i) => {
    if (i == null || i === undefined) return <span />;
    const on = ply === i + 1;
    const c = cls?.[i];
    const col = c && ['inaccuracy', 'mistake', 'blunder', 'miss', 'brilliant', 'great'].includes(c) ? CLASSES[c].color : undefined;
    return (
      <button ref={on ? onRef : null} className={on ? 'on' : ''} onClick={() => onJump?.(i + 1)} style={col ? { color: col } : undefined}>
        {c && <ClsDot cls={c} size={16} />}
        <span>{sans[i]}</span>
      </button>
    );
  };
  return (
    <div ref={box} className={`scroll-y ${className}`} style={{ maxHeight }}>
      {!sans.length ? <div className="text-sm text-ink-400 px-2 py-3">No moves yet.</div> : (
        <div className="moves">
          {rows.map(([n, a, b]) => (
            <div key={n} className="contents">
              <span className="n">{n}.</span>
              {cell(a)}
              {cell(b)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Win% graph for a reviewed game. wins[i] = White's win% at position i. */
export function EvalGraph({ wins, marks = [], ply, onJump, height = 84 }) {
  const n = wins.length;
  if (n < 2) return null;
  const W = 600, H = height;
  const x = (i) => (i / (n - 1)) * W;
  const y = (w) => H - (w / 100) * H;
  const pts = wins.map((w, i) => `${x(i)},${y(w)}`).join(' ');
  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    onJump?.(Math.max(0, Math.min(n - 1, i)));
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full rounded-lg cursor-pointer" style={{ height, background: '#2b2b2b', touchAction: 'none' }}
      onPointerDown={pick} onPointerMove={(e) => e.buttons && pick(e)}>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="#e9e9e9" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#888" strokeWidth="1" strokeDasharray="4 4" opacity=".6" />
      {marks.map((m) => (
        <g key={m.ply}>
          <line x1={x(m.ply)} x2={x(m.ply)} y1={y(wins[m.ply]) - 0.5} y2={y(wins[m.ply]) + 0.5} stroke="#111" strokeWidth="11" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <line x1={x(m.ply)} x2={x(m.ply)} y1={y(wins[m.ply]) - 0.5} y2={y(wins[m.ply]) + 0.5} stroke={CLASSES[m.cls]?.color} strokeWidth="8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      {ply != null && <line x1={x(ply)} x2={x(ply)} y1="0" y2={H} stroke="#f59e0b" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/** Format an engine line's score for text: +1.25, −0.40, #3, #−2. */
export function fmtScore(line, pov = 'w') {
  if (!line) return '…';
  const s = pov === 'w' ? 1 : -1;
  if (line.mate != null) return line.mate === 0 ? '#' : `#${line.mate * s > 0 ? '' : '−'}${Math.abs(line.mate)}`;
  const v = (line.cp * s) / 100;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
}
