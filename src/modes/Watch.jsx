/**
 * Watch: two bots play, and the coach commentates.
 *
 * Every position is searched once (two lines, so "the only good move" can be spotted) before the
 * next move is played, so the commentary keeps up with the game:
 *   - each move gets a class (best, inaccuracy, blunder…) and the coach's reason, in plain English;
 *   - how much it moved the mover's winning chances (Lichess's win% curve, as in Review);
 *   - a win-chance graph with the big swings marked, and a list of the key moments;
 *   - pause any time and ask "what's the threat?" or "what's the plan?" for the side to move,
 *     or step through the better move / why a move goes wrong.
 * Finished matches are saved with their analysis, so Review opens them instantly.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../ui/Board.jsx';
import { Stage, useStage, PlayerStrip, EvalBar, MoveList, Seg, Toggle, Spinner, ClsDot, EvalGraph, fmtScore } from '../ui/kit.jsx';
import { WalkPanel, walkBoard, makeWalk } from '../ui/LineWalk.jsx';
import { BOTS, botById, botMove } from '../engine/bots.js';
import { engine } from '../engine/engine.js';
import { replay, recordPlayed, saveGame, getGame } from '../lib/games.js';
import { START, uciOf, uciToSan } from '../lib/chessutil.js';
import { winPct, cpOf, CLASSES, classifyGame, gameAccuracy } from '../lib/review.js';
import { explainMove } from '../lib/coach.js';
import { threatNow, planNow } from '../lib/coachEngine.js';
import { summarize } from '../lib/analyze.js';
import { loadBook, isBook, bookReady, openingOf } from '../lib/book.js';
import { moveSound, sfx } from '../lib/sound.js';
import { load, save } from '../lib/store.js';
import { href } from '../lib/router.js';
import { gameOverOf, useNav, NavButtons } from './Play.jsx';

const KEY = 'chess.watch.v1';
// delay: the least time a move takes on screen; ms: how long each position is analysed
const PACES = { fast: { delay: 150, ms: 300 }, normal: { delay: 700, ms: 650 }, slow: { delay: 1700, ms: 1000 } };
const BAD = ['inaccuracy', 'mistake', 'blunder', 'miss'];
const BIG = ['mistake', 'blunder', 'miss'];
const SIDE = { w: 'White', b: 'Black' };
const other = (c) => (c === 'w' ? 'b' : 'w');

/** The coach talks to "you"; here it talks about a side. */
export function voice(text, me) {
  if (!text) return text;
  const M = SIDE[me], O = SIDE[other(me)];
  const t = text
    .replace(/^Your move: (.)/, (_, c) => c.toUpperCase())
    .replace(/\bYou missed\b/g, `${M} missed`)
    .replace(/\bYou had\b/g, `${M} had`)
    .replace(/\bYou lose\b/g, `${M} loses`)
    .replace(/\byou are (up|down)\b/gi, `${M} is $1`)
    .replace(/\bYou are (ahead|behind)\b/g, `${M} is $1`)
    .replace(/\bbefore you attack\b/g, `before ${M} attacks`)
    .replace(/\bThey threaten\b/g, `${O} threatens`)
    .replace(/\bThey want\b/g, `${O} wants`)
    .replace(/\byour opponent\b/g, O)
    .replace(/\b[Yy]our\b/g, `${M}'s`)
    .replace(/\b[Tt]heir\b/g, `${O}'s`)
    .replace(/\bYou\b/g, M)
    .replace(/\byou\b/g, M);
  return t;
}

function terminalOf(fen) {
  const g = new Chess(fen);
  if (g.isCheckmate()) return g.turn() === 'w' ? -10000 : 10000;
  if (g.isStalemate() || g.isInsufficientMaterial()) return 0;
  return null;
}

const slim = (l) => ({ ...(l.cp != null ? { cp: l.cp } : {}), ...(l.mate != null ? { mate: l.mate } : {}), depth: l.depth, pv: (l.pv || []).slice(0, 12) });
const whiteWin = (p) => (p ? winPct(p.terminal != null ? p.terminal : cpOf(p.lines[0])) : null);
const moveLabel = (fen, san) => { const [, t, , , , n] = fen.split(' '); return `${n}${t === 'w' ? '.' : '…'} ${san}`; };

export default function Watch() {
  const saved = useMemo(() => load(KEY, null), []);
  const [white, setWhite] = useState(saved?.white || 'b1400');
  const [black, setBlack] = useState(saved?.black || 'b1800');
  const [pace, setPace] = useState(saved?.pace && PACES[saved.pace] ? saved.pace : 'normal');
  const [pauseOnBad, setPauseOnBad] = useState(saved?.pauseOnBad ?? false);
  const [uci, setUci] = useState(saved?.uci || []);
  const [over, setOver] = useState(saved?.over || null);
  const [savedId, setSavedId] = useState(saved?.savedId || null);
  const [running, setRunning] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [evals, setEvals] = useState([]); // evals[i]: engine view of position i ({ lines } or { lines: [], terminal })
  const [tick, setTick] = useState(0);
  const [book, setBook] = useState(bookReady());
  const [flip, setFlip] = useState(false);
  const [ask, setAsk] = useState(null); // { kind: 'threat'|'plan', fen, busy, res }
  const [walk, setWalk] = useState(null);
  const [walkI, setWalkI] = useState(0);
  const token = useRef(0);
  const epoch = useRef(0);
  const busy = useRef(false);
  const pausedFor = useRef(-1);
  const explained = useRef(new Map());
  const stage = useStage({ evalBar: true });

  useEffect(() => { loadBook().then(() => setBook(true)); }, []);
  useEffect(() => { save(KEY, { white, black, pace, pauseOnBad, uci, over, savedId }); }, [white, black, pace, pauseOnBad, uci, over, savedId]);
  useEffect(() => () => { token.current++; epoch.current++; engine.cancel(['bot', 'watch', 'coach']); }, []);

  const { fens, moves, game } = useMemo(() => replay({ startFen: START, uci }), [uci]);
  const nav = useNav(moves.length);
  const fen = fens[fens.length - 1];
  const wb = botById(white), bb = botById(black);
  const botOf = (c) => (c === 'w' ? wb : bb);

  // ---------------------------------------------------------------- analysis: one position at a time, in order
  let done = 0;
  while (done < fens.length && evals[done]) done++;
  useEffect(() => {
    if (busy.current || done >= fens.length) return;
    const i = done, f = fens[i], ep = epoch.current;
    const t = terminalOf(f);
    if (t != null) { setEvals(e => { const n = [...e]; n[i] = { lines: [], terminal: t }; return n; }); return; }
    busy.current = true;
    engine.search({ fen: f, movetime: PACES[pace].ms, multipv: 2, tag: 'watch' }).then((r) => {
      busy.current = false;
      if (ep !== epoch.current) { setTick(x => x + 1); return; }
      if (!r?.lines?.length) { setTimeout(() => setTick(x => x + 1), 300); return; } // pre-empted: try again
      setEvals(e => { const n = [...e]; n[i] = { lines: r.lines.slice(0, 2).map(slim) }; return n; });
    });
  }, [done, fens, tick, pace]); // eslint-disable-line react-hooks/exhaustive-deps

  const positions = useMemo(() => fens.slice(0, done).map((f, i) => ({ ...evals[i], fen: f })), [fens, evals, done]);
  const cls = useMemo(() => (done >= 2 ? classifyGame(positions, moves.slice(0, done - 1), book ? isBook : () => false) : []), [positions, moves, done, book]);
  const wins = useMemo(() => { let last = 50; return fens.map((_, i) => { const w = i < done ? whiteWin(evals[i]) : null; if (w != null) last = w; return last; }); }, [fens, evals, done]);

  // ---------------------------------------------------------------- the game
  useEffect(() => {
    if (!running || over) return undefined;
    const o = gameOverOf(game) || (moves.length >= 300 ? { result: '1/2-1/2', how: 'Move limit' } : null);
    if (o) {
      setOver(o);
      setRunning(false);
      const g = recordPlayed({ source: 'watch', you: null, white: wb.name, black: bb.name, whiteElo: wb.max ? undefined : wb.elo, blackElo: bb.max ? undefined : bb.elo, moves, result: o.result, how: o.how });
      setSavedId(g.id);
      sfx.end();
      return undefined;
    }
    if (done < fens.length || walk) return undefined; // the commentary catches up first
    const last = cls.length - 1;
    if (pauseOnBad && last >= 0 && BIG.includes(cls[last].cls) && pausedFor.current !== last) {
      pausedFor.current = last;
      setRunning(false);
      nav.setView(null);
      return undefined;
    }
    const my = ++token.current;
    const bot = botOf(game.turn());
    const t0 = Date.now();
    setThinking(true);
    botMove(bot, fen, { tag: 'bot', stops: ['eval'] }).then(async (u) => {
      const wait = Math.max(0, PACES[pace].delay - (Date.now() - t0));
      await new Promise(r => setTimeout(r, wait));
      if (my !== token.current) return;
      setThinking(false);
      if (!u) return;
      const g = new Chess(fen);
      try { const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); moveSound(m, g.inCheck()); } catch { return; }
      setUci(x => [...x, u]);
    });
    return () => { if (my === token.current) { token.current++; setThinking(false); engine.cancel(['bot']); } };
  }, [running, fen, over, done, !!walk]); // eslint-disable-line react-hooks/exhaustive-deps

  // a finished match keeps its analysis, so Review opens it straight away
  useEffect(() => {
    if (!over || !savedId || done < fens.length) return;
    const g = getGame(savedId);
    if (!g || (g.review && !g.review.partial)) return;
    const review = { ms: PACES[pace].ms, positions: evals.slice(0, fens.length).map(p => (p.terminal != null ? { lines: [], terminal: p.terminal } : { lines: p.lines })), flavor: engine.status.flavor, at: Date.now() };
    try { review.summary = summarize(g, review); saveGame({ ...g, review }); } catch { /* the plain game is saved either way */ }
  }, [over, savedId, done]); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    token.current++; epoch.current++; busy.current = false;
    engine.cancel(['bot', 'watch', 'coach']);
    setRunning(false); setThinking(false); setUci([]); setOver(null); setSavedId(null); setEvals([]);
    setAsk(null); setWalk(null); pausedFor.current = -1; explained.current.clear();
    nav.setView(null);
  }
  const toggleRun = () => { setAsk(null); setWalk(null); nav.setView(null); setRunning(r => !r); };

  // ---------------------------------------------------------------- what's shown
  const shown = fens[nav.ply];
  const shownTurn = shown.split(' ')[1];
  const i = nav.ply - 1; // the move that led here
  const note = i >= 0 && cls[i] ? cls[i] : null;
  const mover = i >= 0 ? moves[i].color : null;
  let explanation = null;
  if (note) {
    const k = `${i}:${note.cls}:${note.bestUci}`;
    if (!explained.current.has(k)) {
      const after = evals[i + 1];
      const sgn = mover === 'w' ? 1 : -1;
      const ex = explainMove(fens[i], uciOf(moves[i]), { cls: note.cls, drop: note.drop, bestUci: note.bestUci, bestLine: note.bestLine, afterLine: note.afterLine,
        afterMate: after?.lines?.[0]?.mate != null && after.lines[0].mate * sgn < 0 });
      explained.current.set(k, { ...ex, points: ex.points.map(p => voice(p, mover)) });
    }
    explanation = explained.current.get(k);
  }
  const keyMoments = cls.map((c, k) => ({ ...c, k })).filter(c => BIG.includes(c.cls) || c.cls === 'brilliant' || (c.cls === 'great' && c.wBest < 90));
  const marks = keyMoments.map(c => ({ ply: c.k + 1, cls: c.cls }));
  const opening = openingOf(fens.slice(0, nav.ply + 1));
  const complete = over && done >= fens.length;
  const acc = complete && cls.length ? { w: gameAccuracy(cls, positions, 'w'), b: gameAccuracy(cls, positions, 'b') } : null;
  const orientation = flip ? 'black' : 'white';
  // the eval bar shows the newest analysed position up to the one on the board
  const evAt = done ? evals[Math.min(nav.ply, done - 1)] : null;
  const barLine = evAt ? (evAt.terminal != null ? { cp: evAt.terminal } : evAt.lines[0]) : null;
  const topColor = flip ? 'w' : 'b';

  async function doAsk(kind) {
    const f = shown;
    setWalk(null);
    setAsk({ kind, fen: f, busy: true });
    const res = kind === 'threat' ? await threatNow(f) : await planNow(f);
    setAsk(a => (a && a.fen === f && a.kind === kind ? { kind, fen: f, busy: false, res } : a));
  }
  const openWalk = (w) => { setRunning(false); setAsk(null); setWalk(w); setWalkI(0); };

  const arrows = [], circles = [];
  if (!walk && ask && !ask.busy && ask.res && ask.fen === shown) { arrows.push(...(ask.res.arrows || [])); circles.push(...(ask.res.circles || [])); }
  else if (!walk && note && BAD.includes(note.cls) && note.bestUci && nav.ply === i + 1) arrows.push({ from: note.bestUci.slice(0, 2), to: note.bestUci.slice(2, 4), color: 'rgba(16,185,129,.85)' });

  const strip = (c) => {
    const b = botOf(c);
    const turnNow = running && game.turn() === c && !over;
    return <PlayerStrip icon={b.icon} name={b.name} sub={b.max ? 'Max' : b.elo} color={c} fen={shown} active={turnNow}
      right={turnNow && thinking ? <span className="text-xs text-ink-300 flex items-center gap-2"><Spinner size={12} /> thinking</span>
        : <span className="text-xs text-ink-300" title="Chance of winning">win <b className="num text-ink-100">{Math.round(c === 'w' ? wins[nav.ply] : 100 - wins[nav.ply])}%</b></span>} />;
  };
  const wb2 = walk ? walkBoard(walk, walkI) : null;
  const order = (n) => (stage.portrait ? { order: n } : undefined);
  const started = uci.length > 0;

  return (
    <Stage stage={stage}
      top={strip(topColor)}
      bottom={strip(other(topColor))}
      evalBar={<EvalBar height={stage.size} orientation={orientation} line={barLine} result={over && nav.live ? over.result : null} />}
      board={wb2 ? <Board fen={wb2.fen} orientation={orientation} size={stage.size} lastMove={wb2.lastMove} arrows={wb2.arrows} />
        : <Board fen={shown} orientation={orientation} size={stage.size} lastMove={nav.ply ? moves[nav.ply - 1] : null} arrows={arrows} circles={circles} />}
    >
      {/* the match */}
      <div className="panel panel-pad space-y-3" style={order(1)}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-white leading-tight">Watch</h1>
            <div className="text-xs text-ink-300 truncate">{opening ? `${opening.eco} · ${opening.name}` : 'Two bots play; the coach explains every move.'}</div>
          </div>
          {started && <button className="btn btn-quiet btn-sm shrink-0" onClick={reset}>New match</button>}
        </div>
        {!started ? (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <label className="text-xs text-ink-300">White
                <select className="w-full mt-1" value={white} onChange={(e) => setWhite(e.target.value)}>
                  {BOTS.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name} {b.max ? '(max)' : `(${b.elo})`}</option>)}
                </select>
              </label>
              <button className="ibtn mb-0.5" aria-label="Swap colours" onClick={() => { setWhite(black); setBlack(white); }}>⇄</button>
              <label className="text-xs text-ink-300">Black
                <select className="w-full mt-1" value={black} onChange={(e) => setBlack(e.target.value)}>
                  {BOTS.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name} {b.max ? '(max)' : `(${b.elo})`}</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs text-ink-400">Tip: a gap of 400+ points makes for instructive mistakes; two strong bots make for a clean game.</p>
          </>
        ) : (
          <div className="text-sm text-ink-200">{wb.icon} <b className="text-white">{wb.name}</b> <span className="text-ink-400">({wb.max ? 'max' : wb.elo})</span> vs {bb.icon} <b className="text-white">{bb.name}</b> <span className="text-ink-400">({bb.max ? 'max' : bb.elo})</span></div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-300">Pace</span>
          <Seg value={pace} onChange={setPace} options={[['fast', 'Fast'], ['normal', 'Normal'], ['slow', 'Slow']]} />
        </div>
        <Toggle on={pauseOnBad} onChange={setPauseOnBad} label="Pause on mistakes" sub={started ? undefined : 'Stops after a mistake or blunder so you can see what went wrong.'} />
        {!over && (
          <button className="btn btn-primary btn-block" onClick={toggleRun}>
            {running ? 'Pause' : started ? 'Resume' : 'Start'}
          </button>
        )}
        {over && (
          <div className="verdict v-info">
            <div className="font-semibold text-white">{over.result === '1-0' ? `${wb.name} wins` : over.result === '0-1' ? `${bb.name} wins` : 'Draw'} <span className="text-ink-300 font-normal">· {over.how}</span></div>
            {acc && <div className="text-sm text-ink-200 mt-1">Accuracy: {wb.name} <b className="text-white num">{acc.w ?? '–'}</b> · {bb.name} <b className="text-white num">{acc.b ?? '–'}</b></div>}
            {!complete && <div className="text-xs text-ink-300 mt-1 flex items-center gap-2"><Spinner size={10} /> finishing the analysis…</div>}
            <div className="grid grid-cols-2 gap-2 mt-2">
              {savedId && <a className="btn btn-sm" href={href(`/review/game/${savedId}`)}>Full review</a>}
              <button className="btn btn-sm btn-primary" onClick={reset}>New match</button>
            </div>
          </div>
        )}
      </div>

      {/* the commentary */}
      {walk ? <div style={order(2)}><WalkPanel walk={walk} i={walkI} setI={setWalkI} onClose={() => setWalk(null)} /></div> : (
        <div className="panel panel-pad space-y-2" style={order(2)}>
          <div className="flex items-center justify-between gap-2">
            <span className="h-sec">Coach</span>
            <div className="flex gap-1.5">
              <button className="btn btn-sm" onClick={() => doAsk('threat')} disabled={running || !!over && nav.live || ask?.busy}>Threat?</button>
              <button className="btn btn-sm" onClick={() => doAsk('plan')} disabled={running || !!over && nav.live || ask?.busy}>Plan?</button>
            </div>
          </div>
          {ask && ask.fen === shown && (
            <div className={`verdict ${ask.kind === 'threat' ? 'v-warn' : 'v-info'} !py-2.5 fade-up`}>
              {ask.busy ? <div className="text-sm text-ink-300 flex items-center gap-2"><Spinner size={12} /> Thinking about {SIDE[shownTurn]}'s position…</div>
                : ask.kind === 'threat' ? (
                  <><div className="text-sm font-semibold text-white">What {SIDE[other(shownTurn)]} threatens</div>
                    <p className="text-sm text-ink-200">{ask.res ? voice(ask.res.text, shownTurn) : `Nothing serious: ${SIDE[shownTurn]} is free to carry on with a plan.`}</p></>
                ) : (
                  <><div className="text-sm font-semibold text-white">{SIDE[shownTurn]}'s plan</div>
                    <ul className="mt-1 space-y-1">{(ask.res?.ideas || []).map((x, k) => <li key={k} className="text-sm text-ink-200"><b className="text-white">{voice(x.title, shownTurn)}.</b> {voice(x.text, shownTurn)}</li>)}</ul></>
                )}
            </div>
          )}
          {nav.ply === 0 ? (
            <p className="text-sm text-ink-300">{started ? 'The starting position.' : 'Pick two bots and press Start. After every move the coach says what it thinks and how much the move changed the winning chances. Pause any time to ask about threats and plans.'}</p>
          ) : !note ? (
            <p className="text-sm text-ink-300 flex items-center gap-2"><Spinner size={12} /> Looking at {moves[i].san}…</p>
          ) : (
            <div className="fade-up" key={i}>
              <div className="flex items-center gap-2 flex-wrap">
                <ClsDot cls={note.cls} size={18} />
                <span className="text-sm font-semibold text-white">{moveLabel(fens[i], moves[i].san)}</span>
                <span className="text-sm font-semibold" style={{ color: CLASSES[note.cls]?.color }}>{CLASSES[note.cls]?.label}</span>
                <span className="text-xs text-ink-400 truncate">{botOf(mover).name}</span>
              </div>
              <Swing side={mover} before={note.wBest} after={note.wAfter} />
              {explanation?.points.map((t, k) => <p key={k} className="text-sm text-ink-200 mt-1">{t}</p>)}
              {BAD.includes(note.cls) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {note.bestLine?.length > 0 && <button className="btn btn-sm btn-primary" onClick={() => openWalk(makeWalk({ title: `Better was ${uciToSan(fens[i], note.bestUci)}`, fen: fens[i], pv: note.bestLine, score: evals[i]?.lines?.[0] }))}>Step through the better move</button>}
                  {note.afterLine?.length > 0 && <button className="btn btn-sm" onClick={() => openWalk(makeWalk({ title: `Why ${moves[i].san} goes wrong`, fen: fens[i + 1], pv: note.afterLine, score: evals[i + 1]?.lines?.[0], prevUci: uciOf(moves[i]) }))}>Why it goes wrong</button>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* the game at a glance */}
      {started && (
        <div className="panel panel-pad space-y-2" style={order(3)}>
          <div className="flex items-center justify-between">
            <span className="h-sec">White's winning chances</span>
            {nav.ply < done && <span className="text-xs text-ink-300 num">{fmtScore(evals[nav.ply].terminal != null ? { cp: evals[nav.ply].terminal } : evals[nav.ply].lines[0])}</span>}
          </div>
          <EvalGraph wins={wins} marks={marks} ply={nav.ply} onJump={(p) => { setRunning(false); nav.jump(p); }} height={72} />
          {keyMoments.length > 0 && (
            <div>
              <div className="text-xs text-ink-400 mb-1">Key moments</div>
              <div className="flex flex-wrap gap-1.5">
                {keyMoments.map(c => (
                  <button key={c.k} className={`pill !py-1 ${nav.ply === c.k + 1 ? '!border-amber-400' : ''}`} onClick={() => { setRunning(false); nav.jump(c.k + 1); }}>
                    <ClsDot cls={c.cls} size={14} /> <span>{moveLabel(fens[c.k], moves[c.k].san)}</span>
                    <span className="text-ink-400 num">{c.cls === 'brilliant' || c.cls === 'great' ? '' : `−${Math.round(c.drop)}%`}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="panel p-2 flex-1 min-h-[120px] flex flex-col" style={order(4)}>
        <MoveList sans={moves.map(m => m.san)} cls={cls.map(c => c.cls)} ply={nav.ply} onJump={(p) => { setRunning(false); nav.jump(p); }} className="flex-1" maxHeight={stage.portrait ? 220 : undefined} />
      </div>
      <div style={order(5)}>
        <NavButtons ply={nav.ply} len={moves.length} jump={(p) => { setRunning(false); nav.jump(p); }}
          extra={<button className="ibtn" onClick={() => setFlip(f => !f)} aria-label="Flip board">⇅</button>} />
      </div>
    </Stage>
  );
}

/** "White's winning chances 55% → 41% (−14)" with a small bar. */
function Swing({ side, before, after }) {
  const d = after - before;
  const col = d <= -10 ? '#f43f5e' : d <= -3 ? '#facc15' : '#34d399';
  return (
    <div className="mt-1.5">
      <div className="text-xs text-ink-300">
        {SIDE[side]}'s winning chances <b className="text-white num">{Math.round(before)}%</b> → <b className="text-white num">{Math.round(after)}%</b>
        {Math.abs(d) >= 0.5 && <span className="num font-semibold ml-1.5" style={{ color: col }}>({d > 0 ? '+' : '−'}{Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0)})</span>}
      </div>
      <div className="relative h-1.5 rounded-full bg-ink-700 mt-1 overflow-hidden">
        <i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(0, Math.min(100, after))}%`, background: col }} />
        <i className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: `calc(${Math.max(0, Math.min(100, before))}% - 1px)` }} />
      </div>
    </div>
  );
}
