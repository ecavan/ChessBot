/**
 * Play: you vs a bot from the ladder (or full Stockfish), with optional assists; Watch: bot vs bot.
 * The game in progress survives a reload. Finished games are saved for Review.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../ui/Board.jsx';
import { Stage, useStage, PlayerStrip, EvalBar, MoveList, Toggle, Seg, Sheet, Spinner, fmtScore } from '../ui/kit.jsx';
import { BOTS, botById, botMove } from '../engine/bots.js';
import { engine } from '../engine/engine.js';
import { useLiveEval } from '../engine/useEngine.js';
import { usePrefs } from '../lib/prefs.js';
import { load, save } from '../lib/store.js';
import { START, uciOf } from '../lib/chessutil.js';
import { replay, recordPlayed } from '../lib/games.js';
import { openingOf, loadBook } from '../lib/book.js';
import { threatArrows, validFen } from '../lib/insight.js';
import { moveSound, sfx } from '../lib/sound.js';
import { winPct, cpOf, CLASSES } from '../lib/review.js';
import { judgeMove, threatNow, planNow } from '../lib/coachEngine.js';
import { WalkPanel, walkBoard, makeWalk } from '../ui/LineWalk.jsx';
import { uciToSan as sanOf } from '../lib/chessutil.js';
import { ClsDot } from '../ui/kit.jsx';
import { go, href } from '../lib/router.js';

const CUR = 'chess.current.v2';
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export default function Play({ route }) {
  const sub = route.parts[1];
  if (sub === 'game') return <PlayGame />;
  if (sub === 'watch') return <Watch />;
  return <PlaySetup query={route.query} />;
}

// ------------------------------------------------------------------ setup

function PlaySetup({ query }) {
  const [prefs, setPrefs] = usePrefs();
  const [botId, setBotId] = useState(prefs.lastBot || 'b1400');
  const [color, setColor] = useState(['w', 'b'].includes(query.color) ? query.color : prefs.lastColor || 'w');
  useEffect(() => { if (query.coach) setPrefs({ playCoach: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = load(CUR, null);
  const fromFen = query.fen && validFen(query.fen) ? query.fen : null;
  const start = () => {
    const you = color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
    setPrefs(fromFen ? { lastBot: botId } : { lastBot: botId, lastColor: color });
    save(CUR, { id: newId(), botId, you, startFen: fromFen || START, uci: [], hints: 0, takebacks: 0, over: null });
    go('/play/game');
  };
  const inProgress = cur && !cur.over && cur.uci.length > 0;
  return (
    <div className="page fade-up">
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="h-title">Play</h1>
          <p className="muted mt-1">{fromFen ? 'Play this position out against a bot.' : 'Pick an opponent. Every game is saved for review.'}</p>
        </div>
        <a href={href('/play/watch')} className="btn">Watch bots play</a>
      </div>

      {inProgress && !fromFen && (
        <a href="#/play/game" className="card-link mb-5 flex items-center justify-between gap-4 !border-emerald-700/60">
          <div>
            <div className="h-sec !text-emerald-300">Game in progress</div>
            <div className="text-white font-semibold mt-1">vs {botById(cur.botId).name} ({botById(cur.botId).max ? 'max' : botById(cur.botId).elo}) · move {Math.ceil(cur.uci.length / 2)}</div>
          </div>
          <span className="btn btn-primary">Continue</span>
        </a>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
        <section className="panel panel-pad">
          <div className="h-sec mb-3">Opponent</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {BOTS.map(b => (
              <button key={b.id} onClick={() => setBotId(b.id)}
                className={`text-left rounded-2xl border px-3.5 py-3 transition ${botId === b.id ? 'border-emerald-500 bg-emerald-950/40 shadow-[0_0_0_3px_rgba(16,185,129,.18)]' : 'border-ink-700 bg-ink-850 hover:border-ink-500'}`}>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{b.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{b.name}</div>
                    <div className="text-xs font-bold num" style={{ color: b.max ? '#34d399' : '#fcd34d' }}>{b.max ? 'Max strength' : b.elo}</div>
                  </div>
                </div>
                <div className="text-xs text-ink-300 mt-2 leading-snug">{b.blurb}</div>
              </button>
            ))}
          </div>
        </section>

        <aside className="panel panel-pad space-y-4 lg:sticky lg:top-20">
          <div>
            <div className="h-sec mb-2">You play</div>
            <Seg value={color} onChange={setColor} options={[['w', 'White'], ['r', 'Random'], ['b', 'Black']]} className="w-full [&>button]:flex-1" />
          </div>
          <div>
            <div className="h-sec mb-1">Assists</div>
            <Toggle on={prefs.playCoach} onChange={(v) => setPrefs({ playCoach: v })} label="Coach" sub="Explains each of your moves, warns you about threats, and suggests plans." />
            <Toggle on={prefs.playHints} onChange={(v) => setPrefs({ playHints: v })} label="Hints" sub="A hint button: the piece first, then the move." />
            <Toggle on={prefs.playThreats} onChange={(v) => setPrefs({ playThreats: v })} label="Threat arrows" sub="Red arrows at your pieces that are hanging." />
            <Toggle on={prefs.playGuard} onChange={(v) => setPrefs({ playGuard: v })} label="Blunder check" sub="Asks before you play a move that throws the game away." />
            <Toggle on={prefs.playEval} onChange={(v) => setPrefs({ playEval: v })} label="Eval bar" sub="Stockfish's evaluation while you play." />
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={start}>
            {inProgress && !fromFen ? 'New game' : 'Start game'}
          </button>
          <p className="text-xs text-ink-400 leading-relaxed">
            Ratings 1400+ use Stockfish's own strength limit (calibrated at rapid). Lower bots search shallow and pick
            among a few moves, so they miss tactics like real beginners.
          </p>
        </aside>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the game

function gameOverOf(c) {
  if (c.isCheckmate()) return { result: c.turn() === 'w' ? '0-1' : '1-0', how: 'Checkmate' };
  if (c.isStalemate()) return { result: '1/2-1/2', how: 'Stalemate' };
  if (c.isInsufficientMaterial()) return { result: '1/2-1/2', how: 'Insufficient material' };
  if (c.isThreefoldRepetition()) return { result: '1/2-1/2', how: 'Threefold repetition' };
  if (c.isDrawByFiftyMoves()) return { result: '1/2-1/2', how: '50-move rule' };
  return null;
}

function useNav(len) {
  const [view, setView] = useState(null); // null = live (latest)
  const ply = view == null ? len : Math.min(view, len);
  useEffect(() => {
    const k = (e) => {
      if (e.target.closest?.('input,textarea')) return;
      if (e.key === 'ArrowLeft') setView(v => Math.max(0, (v ?? len) - 1));
      if (e.key === 'ArrowRight') setView(v => { const n = (v ?? len) + 1; return n >= len ? null : n; });
      if (e.key === 'ArrowUp') setView(0);
      if (e.key === 'ArrowDown') setView(null);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [len]);
  const jump = (p) => setView(p >= len ? null : Math.max(0, p));
  return { ply, live: view == null || view >= len, jump, setView };
}

export function NavButtons({ ply, len, jump, extra }) {
  return (
    <div className="flex items-center gap-2">
      <button className="ibtn" onClick={() => jump(0)} disabled={ply === 0} aria-label="First move">⏮</button>
      <button className="ibtn flex-1 !w-auto" onClick={() => jump(ply - 1)} disabled={ply === 0} aria-label="Previous move">◀</button>
      <button className="ibtn flex-1 !w-auto" onClick={() => jump(ply + 1)} disabled={ply >= len} aria-label="Next move">▶</button>
      <button className="ibtn" onClick={() => jump(len)} disabled={ply >= len} aria-label="Last move">⏭</button>
      {extra}
    </div>
  );
}

function PlayGame() {
  const [prefs, setPrefs] = usePrefs();
  const [cur, setCur] = useState(() => load(CUR, null));
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState(null); // { level, uci }
  const [pending, setPending] = useState(null); // blunder check: { uci, before, after }
  const [flip, setFlip] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [coachCard, setCoachCard] = useState(null);
  const [threat, setThreat] = useState(null);
  const [plan, setPlan] = useState(null);
  const [coachArrows, setCoachArrows] = useState(true);
  const [walk, setWalk] = useState(null);
  const [walkI, setWalkI] = useState(0);
  const token = useRef(0);
  const guardEval = useRef({});
  const stage = useStage({ evalBar: prefs.playEval });

  useEffect(() => { loadBook(); }, []);
  const update = useCallback((patch) => setCur(c => { const n = { ...c, ...patch }; save(CUR, n); return n; }), []);

  const bot = cur ? botById(cur.botId) : null;
  const { fens, moves, game } = useMemo(() => replay({ startFen: cur?.startFen || START, uci: cur ? (pending ? [...cur.uci, pending.uci] : cur.uci) : [] }), [cur, pending]);
  const nav = useNav(moves.length);
  const fen = fens[fens.length - 1];
  const fenRef = useRef(fen);
  fenRef.current = fen;
  const over = cur?.over;
  const turn = game.turn();
  const yourTurn = cur && !over && !pending && turn === cur.you;

  // save a finished game once
  const curRef = useRef(cur);
  curRef.current = cur;
  const epoch = useRef(0); // bumps on takeback / resign / rematch: pending async work is dropped
  const finished = useRef(null);
  const finish = useCallback((result, how) => {
    const c = curRef.current;
    if (!c || c.over || finished.current === c.id) return;
    finished.current = c.id;
    const { moves: mv } = replay({ startFen: c.startFen, uci: c.uci });
    const b = botById(c.botId);
    recordPlayed({ id: c.id, source: 'bot', you: c.you, white: c.you === 'w' ? 'You' : b.name, black: c.you === 'b' ? 'You' : b.name,
      whiteElo: c.you === 'b' && !b.max ? b.elo : undefined, blackElo: c.you === 'w' && !b.max ? b.elo : undefined,
      startFen: c.startFen, moves: mv, result, how });
    const n = { ...c, over: { result, how } };
    save(CUR, n);
    setCur(n);
    sfx.end();
  }, []);

  // detect the end
  useEffect(() => {
    if (!cur || cur.over || pending) return;
    const o = gameOverOf(game);
    if (o) finish(o.result, o.how);
  }, [game, cur, pending, finish]);

  // the bot moves
  useEffect(() => {
    if (!cur || over || pending || turn === cur.you) return undefined;
    const my = ++token.current;
    setThinking(true);
    botMove(bot, fen).then((uci) => {
      if (my !== token.current) return;
      setThinking(false);
      if (!uci) return;
      const c = new Chess(fen);
      let m;
      try { m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch { return; }
      moveSound(m, c.inCheck());
      update({ uci: [...cur.uci, uci] });
      nav.setView(null);
    });
    return () => { if (my === token.current) { token.current++; setThinking(false); engine.cancel(['bot']); } };
  }, [fen, over, pending]); // eslint-disable-line react-hooks/exhaustive-deps

  // blunder check: evaluate your position in the background while you think
  useEffect(() => {
    if (!(prefs.playGuard || prefs.playCoach) || !yourTurn) return;
    const f = fen;
    engine.search({ fen: f, movetime: 1200, multipv: 2, tag: 'guard', preempt: true, stops: ['eval'] }).then(r => { if (r?.lines?.length >= 2 && !r.stopped) guardEval.current = { fen: f, res: r }; });
  }, [fen, yourTurn, prefs.playGuard, prefs.playCoach]);

  // coach: after the bot moves, is there a threat?
  useEffect(() => {
    if (!prefs.playCoach || !yourTurn || !nav.live || moves.length === 0) return undefined;
    let alive = true;
    const f = fen;
    threatNow(f).then(t => { if (alive && fenRef.current === f) setThreat(t); });
    return () => { alive = false; };
  }, [fen, yourTurn, prefs.playCoach]); // eslint-disable-line react-hooks/exhaustive-deps

  async function askPlan() {
    const f = fen;
    setPlan('busy');
    const p = await planNow(f, cur.you);
    if (fenRef.current === f) setPlan(p);
  }

  useEffect(() => { setHint(null); }, [fen]);

  const live = useLiveEval(fens[nav.ply], { on: prefs.playEval && !thinking, movetime: 2000 });

  async function onMove({ from, to, promotion }) {
    if (!yourTurn || !nav.live) return false;
    const c = new Chess(fen);
    let m;
    try { m = c.move({ from, to, promotion }); } catch { return false; }
    const uci = uciOf(m);
    moveSound(m, c.inCheck());
    const ep = epoch.current, baseLen = cur.uci.length;
    const commit = () => setCur(x => {
      if (!x || x.over || epoch.current !== ep || x.uci.length !== baseLen) return x;
      const n = { ...x, uci: [...x.uci, uci] };
      save(CUR, n);
      return n;
    });
    const moveNo = `${fen.split(' ')[5]}${cur.you === 'w' ? '.' : '…'} ${m.san}`;
    setThreat(null); setPlan(null);
    if ((prefs.playGuard || prefs.playCoach) && !c.isGameOver()) {
      setPending({ uci, checking: true });
      const before = guardEval.current.fen === fen ? guardEval.current.res : null;
      const j = await judgeMove(fen, uci, before, 600);
      if (epoch.current !== ep) return true;
      if (prefs.playCoach && j) { setCoachCard({ ...j, moveNo, fen }); setWalk(null); }
      if (prefs.playGuard && j && j.wBefore - j.wAfter >= 18 && j.wAfter < 60) { setPending({ uci, checking: false, wb: j.wBefore, wa: j.wAfter }); return true; }
      setPending(null);
    } else setCoachCard(null);
    commit();
    return true;
  }

  function takeback() {
    if (pending) { epoch.current++; setPending(null); setCoachCard(null); return; } // just drop the move being checked
    if (!cur || cur.uci.length === 0) return;
    epoch.current++;
    token.current++;
    engine.cancel(['bot']);
    setThinking(false);
    setPending(null);
    let u = [...cur.uci];
    // back to your turn: undo the bot's reply and your move
    const startTurn = cur.startFen.split(' ')[1];
    const turnAfter = (n) => ((n % 2 === 0) === (startTurn === 'w') ? 'w' : 'b');
    u.pop();
    while (u.length && turnAfter(u.length) !== cur.you) u.pop();
    update({ uci: u, takebacks: (cur.takebacks || 0) + 1, over: null });
    setCoachCard(null); setThreat(null); setPlan(null);
    nav.setView(null);
  }

  async function getHint() {
    if (!yourTurn) return;
    if (hint?.uci) { setHint(h => ({ ...h, level: 2 })); return; }
    setHint({ level: 0 });
    const asked = fen;
    const r = await engine.search({ fen, movetime: 1500, tag: 'hint', preempt: true });
    if (fenRef.current !== asked) return;
    if (r?.bestmove) { setHint({ level: 1, uci: r.bestmove }); update({ hints: (curRef.current.hints || 0) + 1 }); } else setHint(null);
  }

  if (!cur) {
    return (
      <div className="page"><div className="panel panel-pad text-center">
        <p className="muted mb-3">No game in progress.</p><a className="btn btn-primary" href="#/play">Start a game</a>
      </div></div>
    );
  }

  const orientation = (cur.you === 'w') !== flip ? 'white' : 'black';
  const topColor = orientation === 'white' ? 'b' : 'w';
  const shownFen = fens[nav.ply];
  const shownFenIs = (f) => shownFen === f;
  const lm = nav.ply > 0 ? moves[nav.ply - 1] : null;
  const opening = openingOf(fens.slice(0, nav.ply + 1));
  const arrows = [];
  if (nav.live && yourTurn && prefs.playThreats) arrows.push(...threatArrows(fen));
  if (hint?.level === 2 && nav.live) arrows.push({ from: hint.uci.slice(0, 2), to: hint.uci.slice(2, 4), color: 'rgba(16,185,129,.85)' });
  const marks = hint?.level >= 1 && nav.live ? { [hint.uci.slice(0, 2)]: 'rgba(16,185,129,.5)' } : {};
  const circles = [];
  if (prefs.playCoach && coachArrows) {
    if (nav.live && threat) arrows.push(...threat.arrows);
    else if (nav.live && plan && plan !== 'busy') { arrows.push(...plan.arrows); circles.push(...plan.circles); }
    if (coachCard && shownFenIs(coachCard.fen) && coachCard.bestUci && !['best', 'great', 'excellent', 'brilliant'].includes(coachCard.cls)) arrows.push({ from: coachCard.bestUci.slice(0, 2), to: coachCard.bestUci.slice(2, 4), color: 'rgba(16,185,129,.85)' });
  }
  const botLabel = bot.max ? 'Max' : String(bot.elo);
  const strip = (color) => color === cur.you
    ? <PlayerStrip icon="🙂" name="You" color={color} fen={shownFen} active={yourTurn && nav.live} />
    : <PlayerStrip icon={bot.icon} name={bot.name} sub={botLabel} color={color} fen={shownFen} active={thinking}
      right={thinking ? <span className="text-xs text-ink-300 flex items-center gap-2"><Spinner size={12} /> thinking</span> : null} />;
  const youWon = over && ((over.result === '1-0' && cur.you === 'w') || (over.result === '0-1' && cur.you === 'b'));

  return (
    <Stage
      stage={stage}
      top={strip(topColor)}
      bottom={strip(topColor === 'w' ? 'b' : 'w')}
      evalBar={prefs.playEval ? <EvalBar height={stage.size} orientation={orientation} line={live.lines[0]} result={nav.live && over ? over.result : null} /> : null}
      board={
        walk ? <Board fen={walkBoard(walk, walkI).fen} orientation={orientation} size={stage.size} lastMove={walkBoard(walk, walkI).lastMove} arrows={walkBoard(walk, walkI).arrows} dim={false} /> : (
        <Board fen={shownFen} orientation={orientation} size={stage.size}
          movable={nav.live && yourTurn ? cur.you : 'none'} onMove={onMove}
          lastMove={lm} arrows={arrows} marks={marks} circles={circles} />)
      }
    >
      <div className="panel p-3.5 flex items-center gap-3" style={stage.portrait ? { order: 10 } : undefined}>
        <span className="avatar !w-11 !h-11 !text-2xl">{bot.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white truncate">{bot.name} <span className="text-amber-300 num">{botLabel}</span></div>
          <div className="text-xs text-ink-300 truncate">{opening ? `${opening.eco} · ${opening.name}` : bot.blurb}</div>
        </div>
      </div>

      {over && (
        <div className={`verdict ${youWon ? 'v-good' : over.result === '1/2-1/2' ? 'v-info' : 'v-bad'} fade-up`}>
          <div className="text-lg font-semibold text-white">{youWon ? 'You won' : over.result === '1/2-1/2' ? 'Draw' : 'You lost'}</div>
          <div className="text-sm text-ink-200">{over.how}{cur.hints ? ` · ${cur.hints} hint${cur.hints > 1 ? 's' : ''}` : ''}{cur.takebacks ? ` · ${cur.takebacks} takeback${cur.takebacks > 1 ? 's' : ''}` : ''}</div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <a className="btn btn-primary col-span-3" href={href(`/review/game/${cur.id}`, { analyze: 1 })}>Review this game</a>
            <button className="btn" onClick={() => { epoch.current++; save(CUR, { id: newId(), botId: cur.botId, you: cur.you === 'w' ? 'b' : 'w', startFen: cur.startFen, uci: [], hints: 0, takebacks: 0, over: null }); setCur(load(CUR, null)); nav.setView(null); }}>Rematch</button>
            <button className="btn col-span-2" onClick={() => go('/play')}>New opponent</button>
          </div>
        </div>
      )}

      {pending && !pending.checking && (
        <div className="verdict v-warn fade-up">
          <div className="font-semibold text-white">Are you sure?</div>
          <div className="text-sm text-ink-200 mt-0.5">That move drops your winning chances from {Math.round(pending.wb)}% to {Math.round(pending.wa)}%.</div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button className="btn btn-primary" onClick={() => { epoch.current++; setPending(null); setCoachCard(null); setWalk(null); }}>Take it back</button>
            <button className="btn" onClick={() => { const u = pending.uci; setPending(null); if (cur.uci.length === moves.length - 1) update({ uci: [...cur.uci, u] }); }}>Play it</button>
          </div>
        </div>
      )}

      {prefs.playCoach && !over && (
        <div className="panel panel-pad space-y-2" style={stage.portrait ? { order: 4 } : undefined}>
          <div className="flex items-center justify-between gap-2">
            <span className="h-sec">Coach</span>
            <button className="btn btn-sm" onClick={askPlan} disabled={!yourTurn || plan === 'busy'}>{plan === 'busy' ? <Spinner size={12} /> : null}What's the plan?</button>
          </div>
          {pending?.checking && <div className="text-sm text-ink-300 flex items-center gap-2"><Spinner size={12} /> Looking at your move…</div>}
          {threat && (
            <div className="verdict v-warn !py-2.5 fade-up">
              <div className="text-sm font-semibold text-white">Watch out</div>
              <p className="text-sm text-ink-200">{threat.text}</p>
            </div>
          )}
          {walk && <WalkPanel walk={walk} i={walkI} setI={setWalkI} onClose={() => setWalk(null)} />}
          {coachCard && !pending?.checking && !walk && (
            <div className="fade-up" key={coachCard.moveNo}>
              <div className="flex items-center gap-2">
                <ClsDot cls={coachCard.cls} size={18} />
                <span className="text-sm font-semibold text-white">{coachCard.moveNo}</span>
                <span className="text-sm font-semibold" style={{ color: CLASSES[coachCard.cls]?.color }}>{CLASSES[coachCard.cls]?.label}</span>
              </div>
              {coachCard.explanation.points.map((t, i) => <p key={i} className="text-sm text-ink-200 mt-1">{t}</p>)}
              {!['best', 'great', 'excellent', 'brilliant', 'good'].includes(coachCard.cls) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {coachCard.bestLine?.length > 0 && <button className="btn btn-sm btn-primary" onClick={() => { setWalk(makeWalk({ title: `Better was ${coachCard.explanation.points.length ? '' : ''}${sanOf(coachCard.fen, coachCard.bestUci)}`, fen: coachCard.fen, pv: coachCard.bestLine, you: cur.you, score: coachCard.bestScore })); setWalkI(0); }}>Step through the better move</button>}
                  {coachCard.afterLine?.length > 0 && <button className="btn btn-sm" onClick={() => { const g = new Chess(coachCard.fen); g.move({ from: coachCard.uci.slice(0, 2), to: coachCard.uci.slice(2, 4), promotion: coachCard.uci[4] }); setWalk(makeWalk({ title: `Why ${coachCard.san} goes wrong`, fen: g.fen(), pv: coachCard.afterLine, you: cur.you, score: coachCard.afterScore, prevUci: coachCard.uci })); setWalkI(0); }}>Why it goes wrong</button>}
                </div>
              )}
            </div>
          )}
          {plan && plan !== 'busy' && (
            <div className="verdict v-info !py-2.5 fade-up">
              <div className="text-sm font-semibold text-white">Plan ideas</div>
              <ul className="mt-1 space-y-1">{plan.ideas.map((i, k) => <li key={k} className="text-sm text-ink-200"><b className="text-white">{i.title}.</b> {i.text}</li>)}</ul>
            </div>
          )}
          {!coachCard && !threat && !plan && !pending?.checking && <p className="text-sm text-ink-300">Play a move and I'll say what I think of it. I'll also warn you about threats.</p>}
          {(threat || (plan && plan !== 'busy')) && <Toggle on={coachArrows} onChange={setCoachArrows} label="Draw it on the board" />}
        </div>
      )}

      <div className="panel p-2 flex-1 min-h-[140px] flex flex-col" style={stage.portrait ? { order: 5 } : undefined}>
        <MoveList sans={moves.map(m => m.san)} ply={nav.ply} onJump={nav.jump} startFen={cur.startFen} className="flex-1" maxHeight={stage.portrait ? 220 : undefined} />
      </div>

      {prefs.playEval && live.lines[0] && (
        <div className="text-xs text-ink-300 px-1 -mt-1">Eval <b className="text-white num">{fmtScore(live.lines[0])}</b> · depth {live.lines[0].depth}</div>
      )}

      <NavButtons ply={nav.ply} len={moves.length} jump={nav.jump}
        extra={<button className="ibtn" onClick={() => setFlip(f => !f)} aria-label="Flip board">⇅</button>} />

      {!over && (
        <div className="grid grid-cols-3 gap-2">
          {prefs.playHints ? (
            <button className="btn" onClick={getHint} disabled={!yourTurn || hint?.level === 2 || hint?.level === 0}>
              {hint?.level === 0 ? <Spinner size={14} /> : null}{hint?.level >= 1 ? 'Show move' : 'Hint'}
            </button>
          ) : <span />}
          <button className="btn" onClick={takeback} disabled={cur.uci.length === 0 && !pending}>Takeback</button>
          <button className="btn btn-danger" onClick={() => setConfirm('resign')} disabled={cur.uci.length < 1}>Resign</button>
        </div>
      )}

      <details className="disc" style={stage.portrait ? { order: 11 } : undefined}>
        <summary>Assists</summary>
        <div className="body">
          <Toggle on={prefs.playCoach} onChange={(v) => setPrefs({ playCoach: v })} label="Coach" />
          <Toggle on={prefs.playEval} onChange={(v) => setPrefs({ playEval: v })} label="Eval bar" />
          <Toggle on={prefs.playThreats} onChange={(v) => setPrefs({ playThreats: v })} label="Threat arrows" />
          <Toggle on={prefs.playGuard} onChange={(v) => setPrefs({ playGuard: v })} label="Blunder check" />
          <Toggle on={prefs.playHints} onChange={(v) => setPrefs({ playHints: v })} label="Hints" />
        </div>
      </details>

      <Sheet open={confirm === 'resign'} onClose={() => setConfirm(null)} title="Resign this game?">
        <p className="muted text-sm mb-4">It will be saved as a loss, and you can review it.</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => setConfirm(null)}>Keep playing</button>
          <button className="btn btn-danger" onClick={() => { setConfirm(null); epoch.current++; setPending(null); token.current++; engine.cancel(['bot']); finish(cur.you === 'w' ? '0-1' : '1-0', 'Resigned'); }}>Resign</button>
        </div>
      </Sheet>
    </Stage>
  );
}

// ------------------------------------------------------------------ watch

function Watch() {
  const [white, setWhite] = useState('b1800');
  const [black, setBlack] = useState('b2200');
  const [speed, setSpeed] = useState(700);
  const [uci, setUci] = useState([]);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const token = useRef(0);
  const stage = useStage({ evalBar: true });
  const { fens, moves, game } = useMemo(() => replay({ startFen: START, uci }), [uci]);
  const nav = useNav(moves.length);
  const fen = fens[fens.length - 1];
  const live = useLiveEval(fens[nav.ply], { movetime: 1500 });

  useEffect(() => {
    if (!running || over) return undefined;
    const c = game;
    const o = gameOverOf(c) || (moves.length >= 300 ? { result: '1/2-1/2', how: 'Move limit' } : null);
    if (o) {
      setOver(o);
      setRunning(false);
      const wb = botById(white), bb = botById(black);
      const g = recordPlayed({ source: 'watch', you: null, white: wb.name, black: bb.name, whiteElo: wb.max ? undefined : wb.elo, blackElo: bb.max ? undefined : bb.elo, moves, result: o.result, how: o.how });
      setSavedId(g.id);
      sfx.end();
      return undefined;
    }
    const my = ++token.current;
    const bot = botById(c.turn() === 'w' ? white : black);
    const t0 = Date.now();
    botMove(bot, fen, { tag: 'bot', stops: ['eval'] }).then(async (u) => {
      const wait = Math.max(0, speed - (Date.now() - t0));
      await new Promise(r => setTimeout(r, wait));
      if (my !== token.current || !u) return;
      const g = new Chess(fen);
      try { const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); moveSound(m, g.inCheck()); } catch { return; }
      setUci(x => [...x, u]);
    });
    return () => { token.current++; engine.cancel(['bot']); };
  }, [running, fen, over]); // eslint-disable-line react-hooks/exhaustive-deps

  const wb = botById(white), bb = botById(black);
  const reset = () => { token.current++; engine.cancel(['bot']); setRunning(false); setUci([]); setOver(null); setSavedId(null); nav.setView(null); };
  const shown = fens[nav.ply];
  return (
    <Stage stage={stage}
      top={<PlayerStrip icon={bb.icon} name={bb.name} sub={bb.max ? 'Max' : bb.elo} color="b" fen={shown} active={running && new Chess(fen).turn() === 'b'} />}
      bottom={<PlayerStrip icon={wb.icon} name={wb.name} sub={wb.max ? 'Max' : wb.elo} color="w" fen={shown} active={running && new Chess(fen).turn() === 'w'} />}
      evalBar={<EvalBar height={stage.size} line={live.lines[0]} result={over && nav.live ? over.result : null} />}
      board={<Board fen={shown} size={stage.size} lastMove={nav.ply ? moves[nav.ply - 1] : null} />}
    >
      <div className="panel panel-pad space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">Watch</h1>
          <a href="#/play" className="btn btn-quiet btn-sm">Back to Play</a>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-ink-300">White
            <select className="w-full mt-1" value={white} disabled={running} onChange={(e) => { reset(); setWhite(e.target.value); }}>
              {BOTS.map(b => <option key={b.id} value={b.id}>{b.name} {b.max ? '(max)' : `(${b.elo})`}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-300">Black
            <select className="w-full mt-1" value={black} disabled={running} onChange={(e) => { reset(); setBlack(e.target.value); }}>
              {BOTS.map(b => <option key={b.id} value={b.id}>{b.name} {b.max ? '(max)' : `(${b.elo})`}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-300">Pace</span>
          <Seg value={speed} onChange={setSpeed} options={[[200, 'Fast'], [700, 'Normal'], [1800, 'Slow']]} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {over ? <button className="btn btn-primary" onClick={reset}>New match</button> : (
            <button className="btn btn-primary" onClick={() => { setRunning(r => !r); nav.setView(null); }}>{running ? 'Pause' : uci.length ? 'Resume' : 'Start'}</button>
          )}
          <button className="btn" onClick={reset} disabled={!uci.length}>Reset</button>
        </div>
        {over && (
          <div className="verdict v-info">
            <div className="font-semibold text-white">{over.result === '1-0' ? `${wb.name} wins` : over.result === '0-1' ? `${bb.name} wins` : 'Draw'}</div>
            <div className="text-sm text-ink-200">{over.how}</div>
            {savedId && <a className="btn btn-sm mt-2" href={href(`/review/game/${savedId}`, { analyze: 1 })}>Review it</a>}
          </div>
        )}
      </div>
      <div className="panel p-2 flex-1 min-h-[140px] flex flex-col">
        <MoveList sans={moves.map(m => m.san)} ply={nav.ply} onJump={nav.jump} className="flex-1" maxHeight={stage.portrait ? 220 : undefined} />
      </div>
      <NavButtons ply={nav.ply} len={moves.length} jump={nav.jump} />
    </Stage>
  );
}
