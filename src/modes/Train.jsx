/**
 * Train: the scratch pad (a board to think on), opening lines and endgame technique.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../ui/Board.jsx';
import { Stage, useStage, EvalBar, MoveList, Toggle, Seg, Spinner, fmtScore } from '../ui/kit.jsx';
import { OPENINGS } from '../data/openings.js';
import { ENDGAMES } from '../data/endgames.js';
import { START, playUci, uciOf, lineSan, uciToSan } from '../lib/chessutil.js';
import { pieces as parsePieces, control, hanging, threatArrows, reach, validFen } from '../lib/insight.js';
import { load, save, KEYS } from '../lib/store.js';
import { usePrefs } from '../lib/prefs.js';
import { piecesOf } from '../lib/themes.js';
import { moveSound, sfx } from '../lib/sound.js';
import { engine } from '../engine/engine.js';
import { useLiveEval } from '../engine/useEngine.js';
import { href, go } from '../lib/router.js';
import { openingOf, loadBook } from '../lib/book.js';
import { NavButtons } from './Play.jsx';

export default function Train({ route }) {
  const [, sub, id] = route.parts;
  if (sub === 'scratch') return <ScratchPad key={route.key} initFen={route.query.fen} />;
  if (sub === 'openings' && OPENINGS[id]) return <OpeningDrill key={id} id={id} />;
  if (sub === 'endgames' && ENDGAMES[id]) return <EndgameDrill key={id} id={id} />;
  return <Hub />;
}

const trainState = () => load(KEYS.train, { openings: {}, endgames: {}, scratch: null });
const saveTrain = (patch) => save(KEYS.train, { ...trainState(), ...patch });

function Hub() {
  const st = trainState();
  return (
    <div className="page fade-up space-y-6">
      <div>
        <h1 className="h-title">Train</h1>
        <p className="muted mt-1">Think on a board, drill opening lines, and learn to convert endgames.</p>
      </div>
      <a href="#/train/scratch" className="card-link flex items-center justify-between gap-4 !border-sky-700/50">
        <div>
          <div className="h-sec !text-sky-300">Scratch pad</div>
          <div className="text-white text-lg font-semibold mt-1">A board to calculate on</div>
          <div className="text-sm text-ink-300 mt-1 max-w-xl">Move both sides through a line, drop a knight anywhere and see what it hits, show every square each side controls and every loose piece. Save candidate lines, then let the engine grade them.</div>
        </div>
        <span className="btn btn-primary">Open</span>
      </a>

      <section>
        <div className="h-sec mb-3">Openings</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(OPENINGS).map(([k, o]) => {
            const p = st.openings[k];
            return (
              <a key={k} href={`#/train/openings/${k}`} className="card-link !p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white">{o.name}</span>
                  <span className="tag">{o.color === 'white' ? 'White' : 'Black'}</span>
                </div>
                <div className="text-xs text-ink-300 mt-1">{Math.ceil(o.moves.length / 2)} moves{p ? ` · ${p.clean}/${p.runs} clean runs` : ''}</div>
              </a>
            );
          })}
        </div>
      </section>

      <section>
        <div className="h-sec mb-3">Endgames</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(ENDGAMES).map(([k, e]) => {
            const p = st.endgames[k];
            return (
              <a key={k} href={`#/train/endgames/${k}`} className="card-link !p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white">{e.name}</span>
                  {p?.best ? <span className="tag !text-emerald-300">✓ {p.best} moves</span> : <span className="tag">{e.difficulty}</span>}
                </div>
                <div className="text-xs text-ink-300 mt-1">{e.description}</div>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ scratch pad

function placementToFen(pos, turn = 'w') {
  const rows = [];
  for (let r = 8; r >= 1; r--) {
    let row = '', empty = 0;
    for (const f of 'abcdefgh') {
      const p = pos[f + r];
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p.color === 'w' ? p.type.toUpperCase() : p.type;
    }
    if (empty) row += empty;
    rows.push(row);
  }
  let castle = '';
  const is = (s, c, t) => pos[s]?.color === c && pos[s]?.type === t;
  if (is('e1', 'w', 'k')) { if (is('h1', 'w', 'r')) castle += 'K'; if (is('a1', 'w', 'r')) castle += 'Q'; }
  if (is('e8', 'b', 'k')) { if (is('h8', 'b', 'r')) castle += 'k'; if (is('a8', 'b', 'r')) castle += 'q'; }
  return `${rows.join('/')} ${turn} ${castle || '-'} - 0 1`;
}

const TINT = { w: 'rgba(56,189,248,', b: 'rgba(244,63,94,' };

function ScratchPad({ initFen }) {
  const [prefs] = usePrefs();
  const saved = trainState().scratch;
  const [base, setBase] = useState(() => (initFen && validFen(initFen) ? initFen : saved?.base && validFen(saved.base) ? saved.base : START));
  const [line, setLine] = useState(() => (initFen ? [] : saved?.line || []));
  const [ply, setPly] = useState(() => (initFen ? 0 : saved?.line?.length || 0));
  const [mode, setMode] = useState('play'); // play | free | draw
  const [flip, setFlip] = useState(false);
  const [sel, setSel] = useState(null);
  const [showReach, setShowReach] = useState(true);
  const [showControl, setShowControl] = useState(false);
  const [showHanging, setShowHanging] = useState(false);
  const [showThreats, setShowThreats] = useState(false);
  const [engineOn, setEngineOn] = useState(false);
  const [drawn, setDrawn] = useState({ arrows: [], circles: [] });
  const [palette, setPalette] = useState(null); // 'wN' … or 'x' (remove)
  const [fenText, setFenText] = useState('');
  const [err, setErr] = useState(null);
  const [cands, setCands] = useState(() => (initFen ? [] : saved?.cands || []));
  const [checking, setChecking] = useState(false);
  const stage = useStage({ evalBar: engineOn });
  const set = piecesOf(prefs.pieceStyle);
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; engine.cancel(['cand']); }, []);

  const { fens, moves } = useMemo(() => {
    const g = new Chess(base);
    const f = [g.fen()], m = [];
    for (const u of line) { try { m.push(g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })); f.push(g.fen()); } catch { break; } }
    return { fens: f, moves: m };
  }, [base, line]);
  const fen = fens[Math.min(ply, fens.length - 1)];
  useEffect(() => { saveTrain({ scratch: { base, line, cands } }); }, [base, line, cands]);
  useEffect(() => { setDrawn({ arrows: [], circles: [] }); }, [fen]);
  const live = useLiveEval(fen, { on: engineOn && mode !== 'free', multipv: 3, movetime: 8000 });
  useEffect(() => { loadBook(); }, []);

  function onMove({ from, to, promotion }) {
    if (mode === 'free') {
      const pos = parsePieces(fen);
      pos[to] = pos[from]; delete pos[from];
      setBase(placementToFen(pos, fen.split(' ')[1])); setLine([]); setPly(0);
      sfx.move();
      return true;
    }
    const g = new Chess(fen);
    let m;
    try { m = g.move({ from, to, promotion }); } catch { return false; }
    moveSound(m, g.inCheck());
    const u = uciOf(m);
    // following the existing line keeps it; otherwise the line branches here
    if (line[ply] === u) setPly(ply + 1);
    else { setLine([...line.slice(0, ply), u]); setPly(ply + 1); }
    return true;
  }

  function onTap(sq) {
    if (mode !== 'free' || !palette) return;
    const pos = parsePieces(fen);
    if (palette === 'x') delete pos[sq];
    else pos[sq] = { color: palette[0], type: palette[1].toLowerCase() };
    setBase(placementToFen(pos, fen.split(' ')[1])); setLine([]); setPly(0);
  }

  function setMode2(m) {
    if (m !== 'free' && !validFen(fen)) { setErr('This position is not legal (each side needs one king, and the side not to move can\'t be in check). Fix it in Move freely.'); return; }
    setErr(null);
    if (m === 'free') { setBase(fen); setLine([]); setPly(0); }
    setPalette(null);
    setMode(m);
  }

  function loadFen(t) {
    const f = t.trim();
    if (!validFen(f)) { setErr('That FEN is not a legal position.'); return; }
    setErr(null); setBase(f); setLine([]); setPly(0); setFenText('');
  }

  const onArrow = (from, to) => setDrawn(d => {
    if (from === to) {
      const has = d.circles.some(c => c.sq === from);
      return { ...d, circles: has ? d.circles.filter(c => c.sq !== from) : [...d.circles, { sq: from }] };
    }
    const has = d.arrows.some(a => a.from === from && a.to === to);
    return { ...d, arrows: has ? d.arrows.filter(a => !(a.from === from && a.to === to)) : [...d.arrows, { from, to, color: 'rgba(250,176,5,.85)' }] };
  });

  // overlays
  const marks = {};
  const circles = [...drawn.circles];
  const arrows = [...drawn.arrows];
  let counts = null;
  if (showControl) {
    const ctl = control(fen);
    counts = Object.fromEntries(Object.entries(ctl).map(([sq, v]) => [sq, { w: v.w.length, b: v.b.length }]));
    for (const [sq, v] of Object.entries(ctl)) {
      const d = v.w.length - v.b.length;
      if (d > 0) marks[sq] = TINT.w + '0.16)';
      else if (d < 0) marks[sq] = TINT.b + '0.16)';
    }
  }
  if (showHanging) for (const h of hanging(fen)) circles.push({ sq: h.square, color: 'rgba(244,63,94,.95)' });
  if (showThreats && validFen(fen)) arrows.push(...threatArrows(fen));
  if (engineOn && live.lines[0]?.pv?.[0] && mode !== 'free') { const u = live.lines[0].pv[0]; arrows.push({ from: u.slice(0, 2), to: u.slice(2, 4), color: 'rgba(56,189,248,.8)' }); }
  const pos = parsePieces(fen);
  const reachSq = showReach && sel && pos[sel] ? reach(pos, sel) : null;
  const opening = mode !== 'free' ? openingOf(fens.slice(0, ply + 1)) : null;
  const turn = fen.split(' ')[1];

  function saveCandidate() {
    if (!line.length || ply === 0) return;
    const u = line.slice(0, ply);
    setCands(c => [...c.filter(x => x.uci.join() !== u.join()), { base, uci: u, text: lineSan(base, u, 40), fen, score: null }].slice(-12));
  }
  async function checkCands() {
    setChecking(true);
    const alive = aliveRef;
    const out = [...cands];
    for (let i = 0; i < out.length; i++) {
      if (out[i].score) continue;
      const g = new Chess(out[i].fen);
      let score;
      if (g.isCheckmate()) score = { mate: 0, text: 'Checkmate' };
      else if (g.isDraw()) score = { cp: 0, text: 'Draw' };
      else {
        const r = await engine.search({ fen: out[i].fen, movetime: 1200, tag: 'cand' });
        if (!alive.current) return;
        score = r?.lines?.[0] ? { ...r.lines[0], text: fmtScore(r.lines[0]) } : null;
      }
      out[i] = { ...out[i], score };
      setCands([...out]);
    }
    setChecking(false);
  }

  return (
    <Stage stage={stage}
      top={<div className="strip"><span className="text-sm font-semibold text-ink-200">Scratch pad{opening ? <span className="text-ink-400 font-normal"> · {opening.name}</span> : ''}</span>
        <span className="text-xs text-ink-300">{turn === 'w' ? 'White' : 'Black'} to move</span></div>}
      bottom={<div className="strip text-xs text-ink-300">{mode === 'play' ? 'Tap any piece: dots show its moves, blue squares what it controls.' : mode === 'free' ? (palette ? 'Tap a square to place. Tap again to remove.' : 'Drag any piece anywhere; drag it off the board to remove it.') : 'Drag to draw an arrow, tap a square to circle it.'}</div>}
      evalBar={engineOn ? <EvalBar height={stage.size} orientation={flip ? 'black' : 'white'} line={live.lines[0]} /> : null}
      board={
        <Board fen={fen} orientation={flip ? 'black' : 'white'} size={stage.size}
          movable={mode === 'play' ? 'both' : 'none'} free={mode === 'free' && !palette} tool={mode === 'draw' ? 'arrow' : null}
          onMove={onMove} onRemove={(s) => { const p = parsePieces(fen); delete p[s]; setBase(placementToFen(p, turn)); setLine([]); setPly(0); }}
          onArrow={onArrow} onTap={onTap} onSelect={setSel}
          lastMove={mode === 'play' && ply > 0 ? moves[ply - 1] : null}
          arrows={arrows} circles={circles} marks={marks} counts={counts}
          reachOf={reachSq ? { squares: reachSq, color: 'rgba(56,189,248,.32)' } : null} />
      }
    >
      <div className="panel panel-pad space-y-3">
        <Seg value={mode} onChange={setMode2} options={[['play', 'Play moves'], ['free', 'Move freely'], ['draw', 'Draw']]} className="w-full [&>button]:flex-1" />
        {err && <div className="text-sm text-rose-300">{err}</div>}
        {mode === 'free' && (
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-1">
              {['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'x', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'].map(k => {
                const P = set[k];
                return (
                  <button key={k} onClick={() => setPalette(p => (p === k ? null : k))}
                    className={`aspect-square rounded-lg border ${palette === k ? 'border-emerald-400 bg-emerald-950/60' : 'border-ink-700 bg-ink-850'} flex items-center justify-center text-rose-300 font-bold ${k === 'x' ? 'row-span-2' : ''}`}>
                    {k === 'x' ? '✕' : <span className="w-[80%] h-[80%]"><P /></span>}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Seg value={turn} onChange={(t) => { const p = fen.split(' '); p[1] = t; setBase(p.join(' ')); }} options={[['w', 'White to move'], ['b', 'Black to move']]} />
              <button className="btn btn-sm" onClick={() => { setBase(START); setLine([]); setPly(0); }}>Start position</button>
              <button className="btn btn-sm" onClick={() => { setBase('4k3/8/8/8/8/8/8/4K3 w - - 0 1'); setLine([]); setPly(0); }}>Kings only</button>
            </div>
          </div>
        )}
        {mode === 'draw' && <button className="btn btn-sm" onClick={() => setDrawn({ arrows: [], circles: [] })} disabled={!drawn.arrows.length && !drawn.circles.length}>Clear drawings</button>}
      </div>

      {mode === 'play' && (
        <div className="panel p-2 flex flex-col min-h-[120px] flex-1">
          <MoveList sans={moves.map(m => m.san)} ply={ply} onJump={setPly} startFen={base} className="flex-1" maxHeight={stage.portrait ? 180 : undefined} />
        </div>
      )}
      {mode === 'play' && <NavButtons ply={ply} len={moves.length} jump={(p) => setPly(Math.max(0, Math.min(moves.length, p)))}
        extra={<button className="ibtn" onClick={() => setFlip(f => !f)} aria-label="Flip">⇅</button>} />}

      <div className="panel panel-pad">
        <div className="h-sec mb-1">See</div>
        <Toggle on={showReach} onChange={setShowReach} label="What a piece controls" sub="Tap a piece: blue squares are everything it attacks or defends." />
        <Toggle on={showControl} onChange={setShowControl} label="Control map" sub="How many white (blue) and black (red) pieces hit each square." />
        <Toggle on={showHanging} onChange={setShowHanging} label="Loose pieces" sub="Red rings on pieces that are attacked and not defended well enough." />
        <Toggle on={showThreats} onChange={setShowThreats} label="Threats" sub="Captures the other side is threatening." />
        <Toggle on={engineOn} onChange={setEngineOn} label="Engine" sub="Off by default, so you do the thinking." />
        {engineOn && live.lines.length > 0 && (
          <div className="mt-2 space-y-1">
            {live.lines.map((l, i) => <div key={i} className="text-xs text-ink-200 flex gap-2"><b className="num text-white w-12 shrink-0">{fmtScore(l)}</b><span className="truncate">{lineSan(fen, l.pv, 8)}</span></div>)}
            <div className="text-[10px] text-ink-400">depth {live.lines[0].depth}</div>
          </div>
        )}
      </div>

      {mode === 'play' && (
        <div className="panel panel-pad space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-sec">Candidate lines</div>
            <button className="btn btn-sm" onClick={saveCandidate} disabled={ply === 0}>Save this line</button>
          </div>
          {!cands.length ? <p className="text-xs text-ink-400">Play a line you're considering and save it. Save a few, decide which you'd pick, then let Stockfish grade where each one ends up.</p> : (
            <>
              {cands.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <button className="flex-1 text-left text-ink-100 hover:text-white truncate" onClick={() => { setBase(c.base); setLine(c.uci); setPly(c.uci.length); }}>{c.text}</button>
                  <span className="num font-semibold w-16 text-right">{c.score ? <span className={c.score.cp > 50 || c.score.mate > 0 ? 'text-emerald-300' : c.score.cp < -50 || c.score.mate < 0 ? 'text-rose-300' : 'text-ink-100'}>{c.score.text}</span> : <span className="text-ink-500">?</span>}</span>
                  <button className="text-ink-400 hover:text-rose-300 px-1" onClick={() => setCands(cs => cs.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button className="btn btn-sm btn-primary" onClick={checkCands} disabled={checking || cands.every(c => c.score)}>{checking ? <Spinner size={12} /> : null}Grade my lines</button>
                <button className="btn btn-sm" onClick={() => setCands([])}>Clear</button>
              </div>
            </>
          )}
        </div>
      )}

      <details className="disc">
        <summary>Position</summary>
        <div className="body">
          <div className="flex gap-2">
            <input type="text" className="flex-1 font-mono !text-xs" placeholder="Paste a FEN" value={fenText} onChange={(e) => setFenText(e.target.value)} autoCapitalize="none" autoCorrect="off" />
            <button className="btn btn-sm" onClick={() => loadFen(fenText)} disabled={!fenText.trim()}>Load</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(fen)}>Copy FEN</button>
            <button className="btn btn-sm" onClick={() => { setBase(START); setLine([]); setPly(0); }}>Reset to start</button>
            <a className="btn btn-sm" href={href('/play', { fen })} onClick={(e) => { if (!validFen(fen)) { e.preventDefault(); setErr('Not a legal position to play from.'); } }}>Play this vs a bot</a>
          </div>
        </div>
      </details>
    </Stage>
  );
}

// ------------------------------------------------------------------ openings

function OpeningDrill({ id }) {
  const o = OPENINGS[id];
  const stage = useStage();
  const you = o?.color === 'black' ? 'b' : 'w';
  const [line, setLine] = useState([]); // uci played
  const [expect, setExpect] = useState(null); // the move you were supposed to play after a slip
  const [msg, setMsg] = useState(null);
  const [slips, setSlips] = useState(0);
  const [surprise, setSurprise] = useState(false);
  const [target, setTarget] = useState(o?.moves || []); // the line being followed (can switch to a deviation)
  const [done, setDone] = useState(false);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { loadBook(); }, []);

  const { game, moves } = useMemo(() => playUci(START, line), [line]);
  const fen = game.fen();
  const turn = game.turn();

  function reset() { timers.current.forEach(clearTimeout); setLine([]); setExpect(null); setMsg(null); setSlips(0); setTarget(o.moves); setDone(false); }

  // opponent replies
  useEffect(() => {
    if (!o || done || turn === you) return;
    const t = setTimeout(() => {
      const key = line.join(' ');
      let reply = target[line.length];
      let explanation = null;
      if (surprise && Math.random() < 0.45) {
        const devs = Object.entries(o.deviations || {}).filter(([k, d]) => { const ks = k.split(' '); return ks.length === line.length + 1 && ks.slice(0, -1).join(' ') === key && d.bookResponse; });
        if (devs.length) {
          const [k, d] = devs[Math.floor(Math.random() * devs.length)];
          reply = k.split(' ').at(-1);
          explanation = d;
        }
      }
      if (!reply) { finish(); return; }
      const g = new Chess(fen);
      try { const m = g.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] }); moveSound(m, g.inCheck()); } catch { finish(); return; }
      let tgt = target;
      if (explanation) {
        tgt = [...line, reply, explanation.bookResponse];
        setTarget(tgt);
        setMsg({ kind: 'info', text: `Your opponent leaves the book: ${explanation.explanation}` });
      }
      setLine(l => [...l, reply]);
      if (line.length + 1 >= tgt.length) finish();
    }, 450);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [line, turn, done]); // eslint-disable-line react-hooks/exhaustive-deps

  function finish() {
    setDone(true);
    const st = trainState();
    const p = st.openings[id] || { runs: 0, clean: 0 };
    saveTrain({ openings: { ...st.openings, [id]: { runs: p.runs + 1, clean: p.clean + (slips === 0 ? 1 : 0) } } });
    sfx.end();
  }

  function onMove({ from, to, promotion }) {
    if (turn !== you || done) return false;
    const g = new Chess(fen);
    let m;
    try { m = g.move({ from, to, promotion }); } catch { return false; }
    const u = uciOf(m);
    const want = target[line.length];
    if (!want) { finish(); return false; }
    if (u === want) {
      moveSound(m, g.inCheck());
      setExpect(null);
      setMsg(msg?.kind === 'info' ? msg : { kind: 'good', text: `${m.san} ✓` });
      const next = [...line, u];
      setLine(next);
      if (next.length >= target.length) setTimeout(finish, 300);
      return true;
    }
    sfx.bad();
    setSlips(s => s + 1);
    const dev = o.deviations?.[[...line, u].join(' ')];
    setExpect(want);
    setMsg({ kind: 'bad', text: dev ? dev.explanation : `${m.san} isn't the line. The move here is ${uciToSan(fen, want)}.` });
    return false;
  }

  const op = openingOf([START, ...moves.map((m) => m.after)]);
  const arrows = expect ? [{ from: expect.slice(0, 2), to: expect.slice(2, 4), color: 'rgba(16,185,129,.85)' }] : [];
  return (
    <Stage stage={stage}
      top={<div className="strip"><span className="text-sm font-semibold text-ink-200">{o.name}</span><span className="text-xs text-ink-300">{op?.name || ''}</span></div>}
      bottom={<div className="strip text-xs text-ink-300">You play {you === 'w' ? 'White' : 'Black'} · move {Math.min(line.length, target.length)}/{target.length}</div>}
      board={<Board fen={fen} orientation={you === 'w' ? 'white' : 'black'} size={stage.size} movable={turn === you && !done ? you : 'none'} onMove={onMove}
        lastMove={moves.at(-1)} arrows={arrows} />}
    >
      <div className="panel panel-pad space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-white">{o.name}</h1>
          <a href="#/train" className="btn btn-quiet btn-sm">All drills</a>
        </div>
        {done ? (
          <div className={`verdict ${slips ? 'v-info' : 'v-good'} pop`}>
            <div className="font-semibold text-white">{slips ? `Line complete, ${slips} slip${slips > 1 ? 's' : ''}` : 'Clean run!'}</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button className="btn btn-primary" onClick={reset}>Again</button>
              <a className="btn" href={href('/play', { fen })}>Play on vs a bot</a>
              <a className="btn col-span-2" href={href('/train/scratch', { fen })}>Explore in the scratch pad</a>
            </div>
          </div>
        ) : msg ? (
          <div className={`verdict ${msg.kind === 'good' ? 'v-good' : msg.kind === 'bad' ? 'v-bad' : 'v-info'} ${msg.kind === 'bad' ? 'shake' : 'fade-up'}`}>
            <div className="text-sm text-white">{msg.text}</div>
          </div>
        ) : <p className="text-sm text-ink-300">Play the main line. The opponent answers with book moves.</p>}
        <Toggle on={surprise} onChange={setSurprise} label="Surprise me" sub="The opponent sometimes plays a common sideline, and you have to find the answer." />
        <button className="btn btn-sm" onClick={reset}>Restart</button>
      </div>
      <div className="panel panel-pad">
        <div className="h-sec mb-2">Ideas</div>
        <ul className="text-sm text-ink-200 space-y-1.5 list-disc pl-5">{o.principles.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </div>
      <div className="panel p-2"><MoveList sans={moves.map(m => m.san)} ply={moves.length} maxHeight={180} /></div>
    </Stage>
  );
}

// ------------------------------------------------------------------ endgames

function EndgameDrill({ id }) {
  const e = ENDGAMES[id];
  const stage = useStage();
  const you = e?.playerColor === 'black' ? 'b' : 'w';
  const [line, setLine] = useState([]);
  const [over, setOver] = useState(null); // { ok, text }
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState(null);
  const token = useRef(0);
  const { game, moves } = useMemo(() => playUci(e.fen, line), [line, e.fen]);
  const fen = game.fen();
  const turn = game.turn();
  const yourMoves = Math.ceil(line.length / 2);

  useEffect(() => {
    if (over) return;
    const promoted = moves.some(m => m.color === you && m.promotion);
    if (game.isCheckmate()) end(game.turn() !== you, game.turn() !== you ? `Checkmate in ${yourMoves} moves.` : 'You got mated.');
    else if (game.isDraw()) end(false, game.isStalemate() ? 'Stalemate! The king had no moves. Leave it a square.' : 'Draw.');
    else if (e.goal === 'promotion' && promoted) end(true, `Promoted in ${yourMoves} moves.`);
    else if (yourMoves > (e.maxMoves || 50) && turn === you) end(false, `Out of moves (limit ${e.maxMoves}).`);
  }, [fen]); // eslint-disable-line react-hooks/exhaustive-deps

  function end(ok, text) {
    setOver({ ok, text });
    if (ok) {
      const st = trainState();
      const p = st.endgames[id] || {};
      saveTrain({ endgames: { ...st.endgames, [id]: { best: Math.min(p.best || 999, yourMoves) } } });
      sfx.end();
    } else sfx.bad();
  }

  useEffect(() => {
    if (over || turn === you) return undefined;
    const my = ++token.current;
    setThinking(true);
    engine.search({ fen, movetime: 700, tag: 'bot', stops: ['hint'] }).then(r => {
      if (my !== token.current) return;
      setThinking(false);
      const u = r?.bestmove;
      if (!u) return;
      const g = new Chess(fen);
      try { const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); moveSound(m, g.inCheck()); } catch { return; }
      setLine(l => [...l, u]);
    });
    return () => { token.current++; engine.cancel(['bot']); };
  }, [fen, over]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setHint(null), [fen]);

  function onMove({ from, to, promotion }) {
    if (turn !== you || over) return false;
    const g = new Chess(fen);
    let m;
    try { m = g.move({ from, to, promotion }); } catch { return false; }
    moveSound(m, g.inCheck());
    setLine(l => [...l, uciOf(m)]);
    return true;
  }
  const fenRef = useRef(fen);
  fenRef.current = fen;
  async function getHint() {
    setHint('…');
    const asked = fen;
    const r = await engine.search({ fen, movetime: 1500, tag: 'hint', preempt: true });
    if (fenRef.current !== asked) return;
    setHint(r?.bestmove || null);
  }
  const reset = () => { token.current++; engine.cancel(['bot']); setLine([]); setOver(null); setThinking(false); };
  const arrows = hint && hint !== '…' ? [{ from: hint.slice(0, 2), to: hint.slice(2, 4), color: 'rgba(16,185,129,.85)' }] : [];
  return (
    <Stage stage={stage}
      top={<div className="strip"><span className="text-sm font-semibold text-ink-200">Stockfish (full strength)</span>{thinking && <span className="text-xs text-ink-300 flex items-center gap-2"><Spinner size={12} />thinking</span>}</div>}
      bottom={<div className="strip text-xs text-ink-300">Goal: {e.goal === 'promotion' ? 'promote a pawn' : 'checkmate'} · move {yourMoves}{e.maxMoves ? ` of ${e.maxMoves}` : ''}</div>}
      board={<Board fen={fen} orientation={you === 'w' ? 'white' : 'black'} size={stage.size} movable={!over && turn === you ? you : 'none'} onMove={onMove} lastMove={moves.at(-1)} arrows={arrows} />}
    >
      <div className="panel panel-pad space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-white">{e.name}</h1>
          <a href="#/train" className="btn btn-quiet btn-sm">All drills</a>
        </div>
        <p className="text-sm text-ink-300">{e.description}</p>
        {over && <div className={`verdict ${over.ok ? 'v-good' : 'v-bad'} pop`}><div className="font-semibold text-white">{over.ok ? 'Done!' : 'Not this time'}</div><div className="text-sm text-ink-200">{over.text}</div></div>}
        <div className="grid grid-cols-3 gap-2">
          <button className="btn" onClick={getHint} disabled={!!over || turn !== you || hint === '…'}>{hint === '…' ? <Spinner size={12} /> : 'Hint'}</button>
          <button className="btn" onClick={() => { token.current++; engine.cancel(['bot']); setThinking(false); setOver(null); setLine(l => l.slice(0, Math.max(0, l.length - (turn === you ? 2 : 1)))); }} disabled={!line.length}>Takeback</button>
          <button className={`btn ${over ? 'btn-primary' : ''}`} onClick={reset}>Restart</button>
        </div>
      </div>
      <div className="panel panel-pad">
        <div className="h-sec mb-2">Technique</div>
        <ul className="text-sm text-ink-200 space-y-1.5 list-disc pl-5">{e.principles.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </div>
    </Stage>
  );
}
