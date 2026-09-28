/**
 * Train: opening courses (chessreps-style, with a coach), middlegame practice from those
 * openings, checkmate patterns, endgame basics and the scratch pad.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../ui/Board.jsx';
import { Stage, useStage, EvalBar, MoveList, Toggle, Seg, Spinner, fmtScore } from '../ui/kit.jsx';
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
import Course from './Course.jsx';
import { loadCourses, loadCourse, courseStats } from '../lib/repertoire.js';
import { planNow, threatNow } from '../lib/coachEngine.js';

export default function Train({ route }) {
  const [, sub, id] = route.parts;
  if (sub === 'scratch') return <ScratchPad key={route.key} initFen={route.query.fen} />;
  if (sub === 'openings' && id) return <Course key={id} id={id} mode={route.query.mode} />;
  if (sub === 'endgames' && ENDGAMES[id]) return <EndgameDrill key={id} id={id} />;
  if (sub === 'notes') return <Notes />;
  return <Hub />;
}

const trainState = () => load(KEYS.train, { openings: {}, endgames: {}, scratch: null });
const saveTrain = (patch) => save(KEYS.train, { ...trainState(), ...patch });

function Hub() {
  const st = trainState();
  const [courses, setCourses] = useState(null);
  const [stats, setStats] = useState({});
  useEffect(() => {
    loadCourses().then(async (ix) => {
      setCourses(ix);
      const out = {};
      for (const c of ix) { try { out[c.id] = courseStats(await loadCourse(c.id)); } catch { /* skip */ } }
      setStats(out);
    }).catch(() => setCourses([]));
  }, []);
  const card = (c) => {
    const s = stats[c.id];
    return (
      <a key={c.id} href={`#/train/openings/${c.id}`} className="card-link !p-4 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-white">{c.name}</span>
          {s?.due ? <span className="tag !text-amber-300">{s.due} due</span> : s?.learned ? <span className="tag !text-emerald-300">{s.learned}/{s.total}</span> : <span className="tag">{s ? `${s.total} lines` : '…'}</span>}
        </div>
        <div className="text-xs text-ink-300 mt-1.5 leading-relaxed flex-1">{c.blurb}</div>
        {s && <div className="bar mt-3"><i style={{ width: `${(s.learned / Math.max(1, s.total)) * 100}%`, background: '#10b981' }} /></div>}
      </a>
    );
  };
  const white = (courses || []).filter(c => c.color === 'w'), black = (courses || []).filter(c => c.color === 'b');
  const MATES = [['mateIn2', 'Mate in 2'], ['mateIn3', 'Mate in 3'], ['backRankMate', 'Back-rank mate'], ['smotheredMate', 'Smothered mate'], ['arabianMate', 'Arabian mate'], ['anastasiaMate', 'Anastasia mate'], ['hookMate', 'Hook mate'], ['doubleBishopMate', 'Two bishops mate']];
  return (
    <div className="page fade-up space-y-7">
      <div>
        <h1 className="h-title">Train</h1>
        <p className="muted mt-1">Learn your openings line by line, including what people really play against you, then play the middlegame out with a coach.</p>
      </div>

      {!courses ? <div className="text-ink-300 flex items-center gap-2"><Spinner /> Loading courses…</div> : (
        <>
          <section>
            <div className="h-sec mb-3">Openings as White</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{white.map(card)}</div>
          </section>
          <section>
            <div className="h-sec mb-3">Openings as Black</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{black.map(card)}</div>
          </section>
        </>
      )}

      <section className="grid md:grid-cols-2 gap-4">
        <a href="#/train/notes" className="card-link">
          <div className="h-sec !text-sky-300">Middlegame</div>
          <div className="text-white text-lg font-semibold mt-1">What to do after the opening</div>
          <div className="text-sm text-ink-300 mt-1">The coach's checklist: safety first, then plans. Short, with examples you can play out.</div>
        </a>
        <a href="#/train/scratch" className="card-link">
          <div className="h-sec !text-sky-300">Scratch pad</div>
          <div className="text-white text-lg font-semibold mt-1">A board to think on</div>
          <div className="text-sm text-ink-300 mt-1">Play lines for both sides, see what pieces hit, ask the coach for threats and a plan.</div>
        </a>
      </section>

      <section>
        <div className="h-sec mb-3">Checkmate patterns</div>
        <div className="flex flex-wrap gap-2">{MATES.map(([t, n]) => <a key={t} className="btn btn-sm" href={href('/puzzles/solve', { mode: 'theme', theme: t })}>{n}</a>)}</div>
      </section>

      <details className="disc">
        <summary>Endgame basics</summary>
        <div className="body">
          <div className="grid sm:grid-cols-2 gap-2">
            {Object.entries(ENDGAMES).map(([k, e]) => {
              const p = st.endgames?.[k];
              return (
                <a key={k} href={`#/train/endgames/${k}`} className="row-link border border-ink-700/60">
                  <span className="flex-1 min-w-0"><span className="block text-sm font-semibold text-white">{e.name}</span><span className="block text-xs text-ink-300 truncate">{e.description}</span></span>
                  {p?.best ? <span className="tag !text-emerald-300">✓ {p.best}</span> : <span className="tag">{e.difficulty}</span>}
                </a>
              );
            })}
          </div>
        </div>
      </details>
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


function ScratchPad({ initFen }) {
  const [prefs] = usePrefs();
  const saved = trainState().scratch;
  const [base, setBase] = useState(() => (initFen && validFen(initFen) ? initFen : saved?.base && validFen(saved.base) ? saved.base : START));
  const [line, setLine] = useState(() => (initFen ? [] : saved?.line || []));
  const [ply, setPly] = useState(() => (initFen ? 0 : saved?.line?.length || 0));
  const [mode, setMode] = useState('play'); // play | free
  const [flip, setFlip] = useState(false);
  const [sel, setSel] = useState(null);
  const [showReach, setShowReach] = useState(true);
  const [showChecks, setShowChecks] = useState(false);
  const [showCaptures, setShowCaptures] = useState(false);
  const [coach, setCoach] = useState(null); // { title, items, arrows, circles } | 'busy'
  const [showHanging, setShowHanging] = useState(false);
  const [showThreats, setShowThreats] = useState(false);
  const [engineOn, setEngineOn] = useState(false);
  const [palette, setPalette] = useState(null); // 'wN' … or 'x' (remove)
  const [fenText, setFenText] = useState('');
  const [err, setErr] = useState(null);
  const [cands, setCands] = useState(() => (initFen ? [] : saved?.cands || []));
  const [checking, setChecking] = useState(false);
  const stage = useStage({ evalBar: engineOn });
  const set = piecesOf(prefs.pieceStyle);
  const aliveRef = useRef(true);
  const fenRef = useRef(null);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; engine.cancel(['cand', 'coach']); }; }, []);

  const { fens, moves } = useMemo(() => {
    const g = new Chess(base);
    const f = [g.fen()], m = [];
    for (const u of line) { try { m.push(g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })); f.push(g.fen()); } catch { break; } }
    return { fens: f, moves: m };
  }, [base, line]);
  const fen = fens[Math.min(ply, fens.length - 1)];
  fenRef.current = fen;
  useEffect(() => { saveTrain({ scratch: { base, line, cands } }); }, [base, line, cands]);
  useEffect(() => { setCoach(null); }, [fen]);
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

  async function askCoach(kind) {
    if (!validFen(fen)) return;
    const g = new Chess(fen);
    if (g.isGameOver()) { setCoach({ title: 'Game over', items: [g.isCheckmate() ? 'Checkmate.' : 'Draw.'], arrows: [], circles: [] }); return; }
    setCoach('busy');
    const at = fen;
    if (kind === 'threat') {
      const t = await threatNow(fen);
      if (at !== fenRef.current || !aliveRef.current) return;
      const who = fen.split(' ')[1] === 'w' ? 'Black' : 'White';
      setCoach(t ? { title: `${who}'s threat`, items: [t.text], arrows: t.arrows, circles: [] } : { title: `${who}'s threat`, items: [g.inCheck() ? 'You are in check: deal with that first.' : `Nothing serious: ${who} has no immediate threat here.`], arrows: [], circles: [] });
    } else {
      const p = await planNow(fen);
      if (at !== fenRef.current || !aliveRef.current) return;
      setCoach({ title: `Plan for ${fen.split(' ')[1] === 'w' ? 'White' : 'Black'}`, items: p.ideas.map(i => `${i.title}: ${i.text}`), arrows: p.arrows, circles: p.circles });
    }
  }

  // overlays
  const marks = {};
  const circles = coach && coach !== 'busy' ? [...coach.circles] : [];
  const arrows = coach && coach !== 'busy' ? [...coach.arrows] : [];
  if ((showChecks || showCaptures) && validFen(fen)) {
    for (const m of new Chess(fen).moves({ verbose: true })) {
      if (showChecks && m.san.includes('+')) arrows.push({ from: m.from, to: m.to, color: 'rgba(250,204,21,.85)', width: 0.12 });
      else if (showCaptures && m.captured) arrows.push({ from: m.from, to: m.to, color: 'rgba(251,146,60,.8)', width: 0.12 });
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
      bottom={<div className="strip text-xs text-ink-300">{mode === 'play' ? 'Tap any piece: dots show its moves, blue squares what it controls.' : palette ? 'Tap a square to place. Tap again to remove.' : 'Drag any piece anywhere; drag it off the board to remove it.'}</div>}
      evalBar={engineOn ? <EvalBar height={stage.size} orientation={flip ? 'black' : 'white'} line={live.lines[0]} /> : null}
      board={
        <Board fen={fen} orientation={flip ? 'black' : 'white'} size={stage.size}
          movable={mode === 'play' ? 'both' : 'none'} free={mode === 'free' && !palette}
          onMove={onMove} onRemove={(s) => { const p = parsePieces(fen); delete p[s]; setBase(placementToFen(p, turn)); setLine([]); setPly(0); }}
          onTap={onTap} onSelect={setSel}
          lastMove={mode === 'play' && ply > 0 ? moves[ply - 1] : null}
          arrows={arrows} circles={circles} marks={marks}
          reachOf={reachSq ? { squares: reachSq, color: 'rgba(56,189,248,.32)' } : null} />
      }
    >
      <div className="panel panel-pad space-y-3">
        <Seg value={mode} onChange={setMode2} options={[['play', 'Play moves'], ['free', 'Move pieces freely']]} className="w-full [&>button]:flex-1" />
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
      </div>

      {mode === 'play' && (
        <div className="panel panel-pad space-y-2">
          <div className="h-sec">Coach</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn" onClick={() => askCoach('threat')} disabled={coach === 'busy'}>What's the threat?</button>
            <button className="btn" onClick={() => askCoach('plan')} disabled={coach === 'busy'}>What's the plan?</button>
          </div>
          {coach === 'busy' && <div className="text-sm text-ink-300 flex items-center gap-2"><Spinner size={14} /> Thinking…</div>}
          {coach && coach !== 'busy' && (
            <div className="verdict v-info fade-up">
              <div className="font-semibold text-white">{coach.title}</div>
              <ul className="mt-1 space-y-1.5">{coach.items.map((t, i) => <li key={i} className="text-sm text-ink-200">{t}</li>)}</ul>
            </div>
          )}
          <p className="text-xs text-ink-400">Checks, captures, threats: before every move, look at all three, for both sides.</p>
        </div>
      )}

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
        <Toggle on={showChecks} onChange={setShowChecks} label="Checks" sub="Yellow arrows: every check the side to move has." />
        <Toggle on={showCaptures} onChange={setShowCaptures} label="Captures" sub="Orange arrows: every capture the side to move has." />
        <Toggle on={showHanging} onChange={setShowHanging} label="Loose pieces" sub="Red rings on pieces that are attacked and not defended well enough." />
        <Toggle on={showThreats} onChange={setShowThreats} label="Your pieces under attack" sub="Red arrows: captures the other side is threatening." />
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


// ------------------------------------------------------------------ middlegame notes

const fenOf = (sans) => { const g = new Chess(); for (const x of sans.split(' ')) g.move(x); return g.fen(); };
const NOTES = [
  { t: 'Checks, captures, threats', b: 'Before every move, list every check, capture and threat, first for your opponent ("what does their last move want?"), then for you. Most games under 1500 are decided by a piece that was simply left hanging or a fork nobody looked for. The scratch pad can draw all checks and captures for you while you practise the habit.' },
  { t: 'Safety first', b: 'Is your king safe? Is every piece defended? Loose pieces drop off: a piece that is attacked and not defended is a gift. Fix safety before starting anything.' },
  { t: 'Improve your worst piece', b: 'When nothing is happening, find your least active piece (a bishop stuck behind its own pawns, a knight on the edge, a rook still in the corner) and give it a better square. Often that is the whole plan.' },
  { t: 'Find a target', b: 'A weak pawn, a weak square next to the king, a piece with no defender. Attack it with more pieces than can defend it. Plans are just targets plus the route there.' },
  { t: 'Pawn breaks open the game', b: 'The pawn move that attacks their pawn chain is how you open lines for your pieces: d4 in the Italian, c5 in the French, …f5 in the King\'s Indian, e4 or c4 against the London. Prepare it, then play it when your pieces are ready.' },
  { t: 'Rooks on open files', b: 'A file with no pawns is a highway into the enemy camp. Put a rook on it, then double the rooks. A half-open file (only their pawn on it) works too: it pressures that pawn.' },
  { t: 'Attack where you are stronger', b: 'Play on the side where you have more space or more pieces, or where their king is. If the kings castled on opposite sides, it is a race: push the pawns in front of their king and don\'t worry about your own pawns.' },
  { t: 'Trade when ahead, not when behind', b: 'Up material? Trade pieces (not pawns); the endgame makes the extra material count. Down material? Keep pieces on and look for activity. Trade your bad pieces for their good ones, never the other way round.' },
  { t: 'Knights love outposts, bishops love diagonals', b: 'A square in their half that no enemy pawn can ever attack, backed by your pawn, is an outpost. A knight there is often worth a rook. Bishops want open diagonals, so don\'t lock them in with your own pawns.' },
  { t: 'Don\'t grab poisoned pawns', b: 'Taking a pawn with your queen while your pieces are undeveloped or your king is in the centre usually costs more than a pawn. Count what it costs in time first.' },
];
const EXAMPLES = [
  { name: 'Italian: slow build-up', color: 'w', sans: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3 h6 Nbd2 Re8', text: 'Classic Giuoco Pianissimo. The plan: Nf1-g3, then the d4 break, or Nh4-f5 against the king.' },
  { name: "Caro-Kann Advance: space", color: 'w', sans: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 O-O Nc6 c3 Qb6', text: 'White has space on the kingside; Black hits d4. Who is attacking what?' },
  { name: "Queen's Gambit Declined: minority attack", color: 'w', sans: 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 O-O Bd3 Nbd7 Nf3 c6 Qc2 Re8 O-O Nf8', text: 'The famous plan: push b4-b5 to create a weak pawn on c6.' },
];

function Notes() {
  return (
    <div className="page fade-up max-w-3xl space-y-5">
      <div>
        <a href="#/train" className="text-sm text-ink-300">← Train</a>
        <h1 className="h-title mt-1">After the opening</h1>
        <p className="muted mt-1">The coach's checklist for the middlegame. When in doubt, ask it in the scratch pad or during a game (What's the threat? What's the plan?).</p>
      </div>
      <ol className="space-y-3">
        {NOTES.map((n, i) => (
          <li key={i} className="panel panel-pad">
            <div className="flex gap-3">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</span>
              <div><div className="font-semibold text-white">{n.t}</div><p className="text-sm text-ink-200 mt-1 leading-relaxed">{n.b}</p></div>
            </div>
          </li>
        ))}
      </ol>
      <section>
        <div className="h-sec mb-2">Practise a plan</div>
        <div className="grid gap-3">
          {EXAMPLES.map(x => {
            const fen = fenOf(x.sans);
            return (
              <div key={x.name} className="panel panel-pad flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0"><div className="font-semibold text-white">{x.name}</div><div className="text-sm text-ink-300">{x.text}</div></div>
                <div className="flex gap-2">
                  <a className="btn btn-sm" href={href('/train/scratch', { fen })}>Study</a>
                  <a className="btn btn-sm btn-primary" href={href('/play', { fen, color: x.color, coach: 1 })}>Play it out</a>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
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
