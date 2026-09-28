/**
 * Review: your saved games (played here or imported), a chess.com-style game review for each
 * (accuracy, estimated rating, move classes, eval graph, key moments, retry your mistakes), and
 * insights across every reviewed game.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Chess } from 'chess.js';
import Board from '../ui/Board.jsx';
import { Stage, useStage, EvalBar, MoveList, EvalGraph, ClsDot, Progress, Spinner, Seg, Sheet, Stat, fmtScore } from '../ui/kit.jsx';
import { allGames, subscribeGames, getGame, deleteGame, importPgnText, fetchChessCom, fetchLichess, gamePgn, replay, resultFor } from '../lib/games.js';
import { analyzeGame, classified } from '../lib/analyze.js';
import { CLASSES, CLASS_ORDER, winPct, cpOf, phaseOf } from '../lib/review.js';
import { loadBook, openingOf, bookReady } from '../lib/book.js';
import { lineSan, uciOf, uciToSan } from '../lib/chessutil.js';
import { explainMove } from '../lib/coach.js';
import { WalkPanel, walkBoard, makeWalk } from '../ui/LineWalk.jsx';
import { engine } from '../engine/engine.js';
import { useLiveEval } from '../engine/useEngine.js';
import { usePrefs } from '../lib/prefs.js';
import { href, go } from '../lib/router.js';
import { moveSound } from '../lib/sound.js';
import { NavButtons } from './Play.jsx';
import Insights from './Insights.jsx';

const useGames = () => useSyncExternalStore(subscribeGames, allGames);

export default function Review({ route }) {
  const sub = route.parts[1];
  if (sub === 'game' && route.parts[2]) return <GameReview key={route.parts[2]} id={decodeURIComponent(route.parts[2])} auto={!!route.query.analyze} />;
  if (sub === 'import') return <Import />;
  if (sub === 'insights') return <Insights />;
  return <GameList />;
}

// ------------------------------------------------------------------ list

const SRC = { bot: 'vs bot', watch: 'bots', import: 'PGN', chesscom: 'chess.com', lichess: 'Lichess' };

function GameList() {
  const games = useGames();
  const [filter, setFilter] = useState('all');
  const list = games.filter(g => filter === 'all' || (filter === 'here' ? g.source === 'bot' : filter === 'imported' ? ['import', 'chesscom', 'lichess'].includes(g.source) : g.source === 'watch'));
  const pending = games.filter(g => g.you && !g.review?.summary).length;
  return (
    <div className="page fade-up space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-title">Review</h1>
          <p className="muted mt-1">Every game you play here, plus the ones you import. Stockfish reviews each move.</p>
        </div>
        <div className="flex gap-2">
          <a className="btn" href="#/review/insights">Insights</a>
          <a className="btn btn-primary" href="#/review/import">Import games</a>
        </div>
      </div>
      <Seg value={filter} onChange={setFilter} options={[['all', 'All'], ['here', 'Played here'], ['imported', 'Imported'], ['watch', 'Bot games']]} />
      {!list.length ? (
        <div className="panel panel-pad text-center">
          <p className="muted">No games yet.</p>
          <div className="flex gap-2 justify-center mt-3"><a className="btn btn-primary" href="#/play">Play a game</a><a className="btn" href="#/review/import">Import from chess.com</a></div>
        </div>
      ) : (
        <div className="panel p-2 divide-y divide-ink-800">
          {list.slice(0, 200).map(g => <GameRow key={g.id} g={g} />)}
        </div>
      )}
      {pending > 0 && <p className="text-xs text-ink-400">{pending} of your games haven't been reviewed yet. Open one, or analyze them all from Insights.</p>}
    </div>
  );
}

export function GameRow({ g }) {
  const res = g.you ? resultFor(g, g.you) : null;
  const acc = g.review?.summary?.acc;
  const yourAcc = g.you && acc ? acc[g.you] : null;
  const opp = g.you === 'w' ? `${g.black}${g.blackElo ? ` (${g.blackElo})` : ''}` : g.you === 'b' ? `${g.white}${g.whiteElo ? ` (${g.whiteElo})` : ''}` : `${g.white} – ${g.black}`;
  const op = g.review?.summary?.opening?.name;
  return (
    <a href={href(`/review/game/${encodeURIComponent(g.id)}`)} className="row-link">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${res === 'win' ? 'bg-emerald-500/20 text-emerald-300' : res === 'loss' ? 'bg-rose-500/20 text-rose-300' : 'bg-ink-700 text-ink-200'}`}>
        {res === 'win' ? 'W' : res === 'loss' ? 'L' : res === 'draw' ? '½' : g.result === '*' ? '·' : g.result.replace('1/2-1/2', '½')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white truncate">{g.you ? `vs ${opp}` : opp}</span>
        <span className="block text-xs text-ink-300 truncate">{g.date?.replace(/\./g, '-')} · {SRC[g.source] || g.source} · {Math.ceil(g.uci.length / 2)} moves{op ? ` · ${op}` : ''}</span>
      </span>
      {yourAcc != null ? <span className="text-right shrink-0"><span className="block text-base font-semibold text-white num">{yourAcc.toFixed(1)}</span><span className="block text-[10px] uppercase tracking-wider text-ink-400">accuracy</span></span>
        : g.review && !g.review.summary ? <span className="tag">partly</span> : <span className="tag">new</span>}
    </a>
  );
}

// ------------------------------------------------------------------ import

function Import() {
  const [prefs, setPrefs] = usePrefs();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [added, setAdded] = useState([]);
  const [months, setMonths] = useState(1);
  const done = (r, where) => {
    setMsg({ ok: true, text: `${r.added} game${r.added === 1 ? '' : 's'} added${r.skipped ? `, ${r.skipped} already here` : ''}${where ? ` from ${where}` : ''}.${r.errors?.length ? ` ${r.errors.length} couldn't be read.` : ''}` });
    setAdded(r.games || []);
  };
  async function run(kind) {
    setBusy(kind); setMsg(null);
    try {
      if (kind === 'chesscom') done(await fetchChessCom(prefs.chesscom, months), 'chess.com');
      else if (kind === 'lichess') done(await fetchLichess(prefs.lichess), 'Lichess');
      else { done(importPgnText(text, 'import', [prefs.chesscom, prefs.lichess])); setText(''); }
    } catch (e) { setMsg({ ok: false, text: e.message || String(e) }); }
    setBusy(null);
  }
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setText(await f.text());
  };
  return (
    <div className="page fade-up space-y-5 max-w-3xl">
      <div>
        <a href="#/review" className="text-sm text-ink-300">← Review</a>
        <h1 className="h-title mt-1">Import games</h1>
      </div>
      <section className="panel panel-pad space-y-3">
        <div className="h-sec">chess.com</div>
        <p className="text-sm text-ink-300">Your recent games straight from chess.com's public archive. No login, nothing is sent anywhere else.</p>
        <div className="flex gap-2 flex-wrap">
          <input type="text" className="flex-1 min-w-[180px]" placeholder="chess.com username" value={prefs.chesscom} autoCapitalize="none" autoCorrect="off"
            onChange={(e) => setPrefs({ chesscom: e.target.value.trim() })} />
          <Seg value={months} onChange={setMonths} options={[[1, 'This month'], [3, '3 months']]} />
          <button className="btn btn-primary" disabled={!prefs.chesscom || busy} onClick={() => run('chesscom')}>{busy === 'chesscom' ? <Spinner /> : null}Fetch</button>
        </div>
      </section>
      <section className="panel panel-pad space-y-3">
        <div className="h-sec">Lichess</div>
        <div className="flex gap-2">
          <input type="text" className="flex-1" placeholder="Lichess username" value={prefs.lichess} autoCapitalize="none" autoCorrect="off"
            onChange={(e) => setPrefs({ lichess: e.target.value.trim() })} />
          <button className="btn" disabled={!prefs.lichess || busy} onClick={() => run('lichess')}>{busy === 'lichess' ? <Spinner /> : null}Fetch last 40</button>
        </div>
      </section>
      <section className="panel panel-pad space-y-3">
        <div className="h-sec">Paste PGN</div>
        <p className="text-sm text-ink-300">On chess.com: open a game → Share → PGN → copy. Several games at once are fine.</p>
        <textarea rows={8} className="w-full font-mono text-sm" placeholder={'[Event "Live Chess"]\n...\n1. e4 e5 2. Nf3 ...'} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex gap-2 items-center">
          <button className="btn btn-primary" disabled={!text.trim() || busy} onClick={() => run('pgn')}>Import</button>
          <label className="btn cursor-pointer">Open a .pgn file<input type="file" accept=".pgn,text/plain,application/x-chess-pgn" className="hidden" onChange={onFile} /></label>
        </div>
      </section>
      {msg && <div className={`verdict ${msg.ok ? 'v-good' : 'v-bad'}`}><div className="text-sm text-white">{msg.text}</div></div>}
      {added.length > 0 && (
        <div className="panel p-2 divide-y divide-ink-800">
          {added.slice(0, 30).map(g => <GameRow key={g.id} g={g} />)}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ one game

function explain(c, move, fenBefore, bestSan, mover) {
  const who = mover === 'w' ? 'White' : 'Black';
  const pct = (x) => `${Math.round(x)}%`;
  switch (c.cls) {
    case 'brilliant': return `A brilliant sacrifice: ${move.san} gives up material for a winning attack.`;
    case 'great': return `The only good move. Everything else was clearly worse.`;
    case 'best': return `The engine's top choice.`;
    case 'excellent': return `Nearly as good as the best move (${bestSan}).`;
    case 'good': return `A decent move; ${bestSan} was a bit stronger.`;
    case 'book': return `A known opening move.`;
    case 'inaccuracy': return `${bestSan} was better. ${who}'s winning chances slip from ${pct(c.wBest)} to ${pct(c.wAfter)}.`;
    case 'mistake': return `${bestSan} was much better. ${who}'s winning chances drop from ${pct(c.wBest)} to ${pct(c.wAfter)}.`;
    case 'miss': return `The opponent had just erred, and ${bestSan} would have punished it. Chances: ${pct(c.wBest)} → ${pct(c.wAfter)}.`;
    case 'blunder': return `A blunder. ${bestSan} kept ${pct(c.wBest)} winning chances; after ${move.san} it's ${pct(c.wAfter)}.`;
    default: return '';
  }
}

function GameReview({ id, auto }) {
  const [prefs] = usePrefs();
  const games = useGames();
  const game = games.find(g => g.id === id);
  const stage = useStage({ evalBar: true });
  const [ply, setPly] = useState(null);
  const [flip, setFlip] = useState(false);
  const [prog, setProg] = useState(null); // { done, total }
  const [engineOn, setEngineOn] = useState(false);
  const [retry, setRetry] = useState(null); // { list: [moveIdx], i, status, tried }
  const [walk, setWalk] = useState(null);
  const [walkI, setWalkI] = useState(0);
  const startWalk = (w) => { setWalk(makeWalk(w)); setWalkI(0); };
  const [confirmDel, setConfirmDel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bookOk, setBookOk] = useState(bookReady());
  const cancelled = useRef(false);
  useEffect(() => { loadBook().then(() => setBookOk(true)); }, []);

  const rep = useMemo(() => (game ? replay(game) : null), [game]);
  const full = !!game?.review?.summary;
  const cls = useMemo(() => (full && bookOk ? classified(game) : full ? classified(game) : null), [game, full, bookOk]);

  async function analyze() {
    cancelled.current = false;
    setProg({ done: 0, total: rep.fens.length });
    await analyzeGame(id, { ms: prefs.analysisTime, onProgress: (done, total) => setProg({ done, total }), isCancelled: () => cancelled.current });
    setProg(null);
  }
  useEffect(() => {
    if (game && !full && (auto || game.review?.partial)) analyze();
    return () => { cancelled.current = true; engine.cancel(['review']); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const len = rep?.moves.length || 0;
  const cur = ply == null ? 0 : Math.min(ply, len);
  const jump = (p) => setPly(Math.max(0, Math.min(len, p)));
  useEffect(() => {
    const k = (e) => {
      if (e.target.closest?.('input,textarea') || retry || walk) return;
      if (e.key === 'ArrowLeft') setPly(p => Math.max(0, (p ?? 0) - 1));
      if (e.key === 'ArrowRight') setPly(p => Math.min(len, (p ?? 0) + 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [len, retry, walk]);
  useEffect(() => { setWalk(null); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

  const retryFen = retry ? rep.fens[retry.list[retry.i]] : null;
  const live = useLiveEval(retry ? retryFen : rep?.fens[cur], { on: engineOn && !prog, multipv: 3, movetime: 6000, tag: 'eval' });

  if (!game) return <div className="page"><div className="panel panel-pad text-center"><p className="muted mb-3">Game not found.</p><a href="#/review" className="btn">Back</a></div></div>;

  const { fens, moves } = rep;
  const first = fens[0].split(' ')[1];
  const moverOf = (i) => ((i % 2 === 0) === (first === 'w') ? 'w' : 'b');
  const you = game.you || 'w';
  const orientation = (you === 'w') !== flip ? 'white' : 'black';
  const sum = game.review?.summary;
  const posLine = (i) => {
    const p = game.review?.positions?.[i];
    if (!p) return null;
    if (p.terminal != null) return p.terminal === 0 ? { cp: 0 } : { mate: 0, cp: p.terminal };
    return p.lines[0];
  };
  const moveNo = (i) => `${fens[i].split(' ')[5]}${fens[i].split(' ')[1] === 'w' ? '.' : '…'}`;
  const wins = full ? fens.map((_, i) => winPct(cpOf(posLine(i)))) : [];
  const marks = cls ? cls.cls.map((c, i) => ({ ply: i + 1, cls: c.cls })).filter(m => ['blunder', 'mistake', 'miss', 'brilliant', 'great'].includes(m.cls)) : [];
  const c = cur > 0 && cls ? cls.cls[cur - 1] : null;
  const mv = cur > 0 ? moves[cur - 1] : null;
  const bestSan = c && c.bestUci ? uciToSan(fens[cur - 1], c.bestUci) : null;
  const bad = c && ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(c.cls);
  const arrows = [];
  if (!retry && bad && c.bestUci) arrows.push({ from: c.bestUci.slice(0, 2), to: c.bestUci.slice(2, 4), color: 'rgba(16,185,129,.8)' });
  if (!retry && bad && c.afterLine?.[0]) arrows.push({ from: c.afterLine[0].slice(0, 2), to: c.afterLine[0].slice(2, 4), color: 'rgba(244,63,94,.75)' });
  if (engineOn && live.lines[0]?.pv?.[0] && !retry) { const u = live.lines[0].pv[0]; arrows.push({ from: u.slice(0, 2), to: u.slice(2, 4), color: 'rgba(56,189,248,.8)' }); }
  const keyMoments = cls ? cls.cls.map((x, i) => ({ ...x, i })).filter(x => (!game.you || moverOf(x.i) === game.you) && ['blunder', 'mistake', 'miss', 'brilliant', 'great'].includes(x.cls)) : [];
  const retryable = cls ? cls.cls.map((x, i) => ({ ...x, i })).filter(x => (!game.you || moverOf(x.i) === game.you) && ['blunder', 'mistake', 'miss'].includes(x.cls)).map(x => x.i) : [];

  // ---- retry
  async function onRetryMove({ from, to, promotion }) {
    if (!retry || retry.status !== 'play') return false;
    const idx = retry.list[retry.i];
    const g = new Chess(fens[idx]);
    let m;
    try { m = g.move({ from, to, promotion }); } catch { return false; }
    moveSound(m, g.inCheck());
    const u = uciOf(m);
    const ref = cls.cls[idx];
    const played = uciOf(moves[idx]);
    if (u === ref.bestUci) { setRetry(r => ({ ...r, status: 'right', tried: { uci: u, san: m.san, fen: g.fen() } })); return true; }
    if (u === played) { setRetry(r => ({ ...r, status: 'wrong', tried: { uci: u, san: m.san, fen: g.fen(), same: true } })); return true; }
    setRetry(r => ({ ...r, status: 'checking', tried: { uci: u, san: m.san, fen: g.fen() } }));
    let wAfter;
    if (g.isCheckmate()) wAfter = 100;
    else {
      const r = await engine.search({ fen: g.fen(), movetime: 700, tag: 'retry', preempt: true });
      const sgn = moverOf(idx) === 'w' ? 1 : -1;
      wAfter = winPct(sgn * cpOf(r?.lines?.[0]));
    }
    const ok = ref.wBest - wAfter <= 4;
    setRetry(rr => (rr && rr.status === 'checking' ? { ...rr, status: ok ? 'right' : 'wrong', tried: { ...rr.tried, wAfter } } : rr));
    return true;
  }
  const retryIdx = retry ? retry.list[retry.i] : null;

  const boardFen = retry ? (retry.tried?.fen ? retry.tried.fen : fens[retryIdx]) : fens[cur];
  const boardLast = retry ? (retry.tried ? { from: retry.tried.uci.slice(0, 2), to: retry.tried.uci.slice(2, 4) } : retryIdx > 0 ? moves[retryIdx - 1] : null) : mv;
  const wb = walk ? walkBoard(walk, walkI) : null;
  const retryArrows = retry?.showBest ? [{ from: cls.cls[retryIdx].bestUci.slice(0, 2), to: cls.cls[retryIdx].bestUci.slice(2, 4), color: 'rgba(16,185,129,.85)' }] : [];

  return (
    <Stage stage={stage}
      top={<Strip game={game} color={orientation === 'white' ? 'b' : 'w'} sum={sum} />}
      bottom={<Strip game={game} color={orientation === 'white' ? 'w' : 'b'} sum={sum} />}
      evalBar={<EvalBar height={stage.size} orientation={orientation} line={engineOn && live.lines[0] ? live.lines[0] : posLine(retry ? retryIdx : cur)} />}
      board={
        wb ? <Board fen={wb.fen} orientation={orientation} size={stage.size} lastMove={wb.lastMove} arrows={wb.arrows} /> : (
        <Board fen={boardFen} orientation={orientation} size={stage.size}
          movable={retry && retry.status === 'play' ? moverOf(retryIdx) : 'none'} onMove={onRetryMove}
          lastMove={boardLast} arrows={retry ? retryArrows : arrows}
          badge={!retry && c && mv ? { sq: mv.to, cls: c.cls } : null} />)
      }
    >
      {walk ? <WalkPanel walk={walk} i={walkI} setI={setWalkI} onClose={() => setWalk(null)} /> : prog ? (
        <div className="panel panel-pad space-y-2">
          <div className="flex items-center justify-between text-sm"><span className="font-semibold text-white flex items-center gap-2"><Spinner size={14} /> Stockfish is reviewing the game</span><span className="num text-ink-300">{prog.done}/{prog.total}</span></div>
          <Progress value={(prog.done / prog.total) * 100} />
          <div className="text-xs text-ink-400">{(prefs.analysisTime / 1000).toFixed(1)} s per position, two lines each. You can leave; it continues where it stopped.</div>
        </div>
      ) : !full ? (
        <div className="panel panel-pad space-y-3">
          <div className="text-white font-semibold">{game.white} vs {game.black}</div>
          <p className="text-sm text-ink-300">Not reviewed yet. Stockfish looks at every position (about {Math.round((fens.length * prefs.analysisTime) / 1000)} s).</p>
          <button className="btn btn-primary btn-block" onClick={analyze}>Review this game</button>
        </div>
      ) : retry ? (
        <RetryPanel retry={retry} setRetry={setRetry} cls={cls} moves={moves} fens={fens} moverOf={moverOf} setPly={setPly} />
      ) : (
        <>
          <Summary game={game} sum={sum} />
          <div className="panel p-2"><EvalGraph wins={wins} marks={marks} ply={cur} onJump={jump} /></div>
          {c && mv && (
            <div className="panel panel-pad fade-up" key={cur}>
              <div className="flex items-center gap-2">
                <ClsDot cls={c.cls} size={22} />
                <span className="font-semibold text-white">{moveNo(cur - 1)} {mv.san}</span>
                <span className="text-sm font-semibold" style={{ color: CLASSES[c.cls].color }}>{CLASSES[c.cls].label}</span>
                <span className="ml-auto text-sm num text-ink-200">{fmtScore(posLine(cur))}</span>
              </div>
              {(() => {
                const ex = explainMove(fens[cur - 1], uciOf(mv), { cls: c.cls, drop: c.drop, bestUci: c.bestUci, bestLine: c.bestLine, afterLine: c.afterLine, ply: cur - 1 });
                const pts = ex.points.length ? ex.points : [explain(c, mv, fens[cur - 1], bestSan, moverOf(cur - 1))];
                return pts.map((t, i) => <p key={i} className="text-sm text-ink-200 mt-1.5">{t}</p>);
              })()}
              {bad && c.bestLine?.length > 0 && <p className="text-xs text-ink-300 mt-1.5"><span className="text-emerald-300 font-semibold">Best line</span> {lineSan(fens[cur - 1], c.bestLine, 8)}</p>}
              {bad && c.afterLine?.length > 0 && <p className="text-xs text-ink-300 mt-1"><span className="text-rose-300 font-semibold">After {mv.san}</span> {lineSan(fens[cur], c.afterLine, 6)}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {bad && c.bestLine?.length > 0 && <button className="btn btn-sm btn-primary" onClick={() => startWalk({ title: `The better move: ${bestSan}`, fen: fens[cur - 1], pv: c.bestLine, you: moverOf(cur - 1), score: game.review.positions[cur - 1]?.lines?.[0], prevUci: cur > 1 ? uciOf(moves[cur - 2]) : null })}>Show best line, step by step</button>}
                {bad && c.afterLine?.length > 0 && <button className="btn btn-sm" onClick={() => startWalk({ title: `Why ${mv.san} goes wrong`, fen: fens[cur], pv: c.afterLine, you: moverOf(cur - 1), score: game.review.positions[cur]?.lines?.[0], prevUci: uciOf(mv) })}>Why {mv.san} goes wrong</button>}
                {!bad && c.afterLine?.length > 0 && <button className="btn btn-sm" onClick={() => startWalk({ title: 'How the game should continue', fen: fens[cur], pv: c.afterLine, you: game.you || moverOf(cur - 1), score: game.review.positions[cur]?.lines?.[0], prevUci: uciOf(mv) })}>Show the engine's line from here</button>}
              </div>
            </div>
          )}
          {cur === 0 && keyMoments.length > 0 && (
            <div className="panel panel-pad">
              <div className="h-sec mb-2">Key moments{game.you ? ' (yours)' : ''}</div>
              <div className="flex flex-wrap gap-1.5">
                {keyMoments.slice(0, 16).map(k => (
                  <button key={k.i} className="btn btn-sm" onClick={() => jump(k.i + 1)}><ClsDot cls={k.cls} size={16} />{moveNo(k.i)} {moves[k.i].san}</button>
                ))}
              </div>
            </div>
          )}
          {retryable.length > 0 && (
            <button className="btn btn-block !border-amber-600/60 !bg-amber-950/40 !text-amber-100" onClick={() => setRetry({ list: retryable, i: 0, status: 'play' })}>
              Retry {game.you ? 'your' : 'the'} mistakes ({retryable.length})
            </button>
          )}
        </>
      )}

      {!retry && (
        <>
          <div className="panel p-2 flex-1 min-h-[150px] flex flex-col">
            <MoveList sans={moves.map(m => m.san)} cls={cls?.cls.map(x => x.cls)} ply={cur} onJump={jump} startFen={fens[0]} className="flex-1" maxHeight={stage.portrait ? 260 : undefined} />
          </div>
          {engineOn && live.lines.length > 0 && (
            <div className="panel p-2.5 space-y-1">
              {live.lines.map((l, i) => (
                <button key={i} className="text-xs text-ink-200 flex gap-2 w-full text-left hover:text-white" onClick={() => startWalk({ title: `Engine line ${i + 1}`, fen: fens[cur], pv: l.pv, you: game.you || (fens[cur].split(' ')[1]), score: l })}><b className="num text-white w-12 shrink-0">{fmtScore(l)}</b><span className="truncate">{lineSan(fens[cur], l.pv, 8)}</span><span className="ml-auto text-emerald-300 shrink-0">step ▸</span></button>
              ))}
              <div className="text-[10px] text-ink-400">depth {live.lines[0].depth}</div>
            </div>
          )}
          <NavButtons ply={cur} len={len} jump={jump} extra={<button className="ibtn" onClick={() => setFlip(f => !f)} aria-label="Flip">⇅</button>} />
          <div className="grid grid-cols-3 gap-2">
            <button className={`btn ${engineOn ? 'on' : ''}`} onClick={() => setEngineOn(v => !v)} disabled={!!prog}>Engine</button>
            <a className="btn" href={href('/train/scratch', { fen: fens[cur] })}>Explore</a>
            <button className="btn" onClick={() => { navigator.clipboard?.writeText(gamePgn(game)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>{copied ? 'Copied' : 'PGN'}</button>
          </div>
          <div className="flex justify-between">
            <a href="#/review" className="btn btn-quiet btn-sm">← All games</a>
            <div className="flex gap-1">
              {full && <button className="btn btn-quiet btn-sm" onClick={analyze} disabled={!!prog}>Re-analyze</button>}
              <button className="btn btn-quiet btn-sm !text-rose-300" onClick={() => setConfirmDel(true)} disabled={!!prog}>Delete</button>
            </div>
          </div>
        </>
      )}
      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)} title="Delete this game?">
        <div className="grid grid-cols-2 gap-2"><button className="btn" onClick={() => setConfirmDel(false)}>Keep</button>
          <button className="btn btn-danger" onClick={() => { deleteGame(id); go('/review'); }}>Delete</button></div>
      </Sheet>
    </Stage>
  );
}

function Strip({ game, color, sum }) {
  const name = color === 'w' ? game.white : game.black;
  const elo = color === 'w' ? game.whiteElo : game.blackElo;
  const acc = sum?.acc?.[color];
  return (
    <div className="strip">
      <div className="who">
        <span className="avatar" style={{ background: color === 'w' ? '#e9e9e9' : '#2b2b2b' }} />
        <span className="text-sm font-semibold text-white truncate">{name}</span>
        {elo && <span className="text-xs text-ink-300">{elo}</span>}
      </div>
      {acc != null && <span className="text-xs text-ink-300">accuracy <b className="text-white num">{acc.toFixed(1)}</b></span>}
    </div>
  );
}

function Summary({ game, sum }) {
  const rows = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
  return (
    <div className="panel panel-pad">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 text-center">
        <div><div className="text-[11px] uppercase tracking-wider text-ink-300 truncate">{game.white}</div><div className="text-3xl font-semibold text-white num">{sum.acc.w?.toFixed(1) ?? '–'}</div></div>
        <div className="text-[11px] uppercase tracking-wider text-ink-400 pb-2">Accuracy</div>
        <div><div className="text-[11px] uppercase tracking-wider text-ink-300 truncate">{game.black}</div><div className="text-3xl font-semibold text-white num">{sum.acc.b?.toFixed(1) ?? '–'}</div></div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center mt-1">
        <div className="text-sm text-ink-200 num">{sum.est.w ?? '–'}</div>
        <div className="text-[11px] uppercase tracking-wider text-ink-400">Game rating</div>
        <div className="text-sm text-ink-200 num">{sum.est.b ?? '–'}</div>
      </div>
      <div className="mt-3 space-y-0.5">
        {rows.map(k => (sum.counts.w[k] || sum.counts.b[k]) ? (
          <div key={k} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
            <span className="text-right num font-semibold" style={{ color: CLASSES[k].color }}>{sum.counts.w[k]}</span>
            <span className="flex items-center gap-1.5 w-28 justify-center text-ink-200"><ClsDot cls={k} size={16} />{CLASSES[k].label}</span>
            <span className="text-left num font-semibold" style={{ color: CLASSES[k].color }}>{sum.counts.b[k]}</span>
          </div>
        ) : null)}
      </div>
      {sum.opening && <div className="text-xs text-ink-300 mt-3 text-center">{sum.opening.eco} · {sum.opening.name}</div>}
    </div>
  );
}

function RetryPanel({ retry, setRetry, cls, moves, fens, moverOf, setPly }) {
  const idx = retry.list[retry.i];
  const ref = cls.cls[idx];
  const bestSan = uciToSan(fens[idx], ref.bestUci);
  const last = retry.i >= retry.list.length - 1;
  const nextOne = () => last ? (setRetry(null), setPly(idx + 1)) : setRetry({ ...retry, i: retry.i + 1, status: 'play', tried: null, showBest: false });
  return (
    <div className="panel panel-pad space-y-3 fade-up" key={retry.i}>
      <div className="flex items-center justify-between">
        <span className="h-sec">Retry {retry.i + 1} of {retry.list.length}</span>
        <button className="btn btn-quiet btn-sm" onClick={() => { setRetry(null); setPly(idx + 1); }}>Exit</button>
      </div>
      <div className="text-white font-semibold">Move {fens[idx].split(' ')[5]}: {moverOf(idx) === 'w' ? 'White' : 'Black'} played {moves[idx].san} <span style={{ color: CLASSES[ref.cls].color }}>({CLASSES[ref.cls].label.toLowerCase()})</span>. Find something better.</div>
      {retry.status === 'play' && <p className="text-sm text-ink-300">Make your move on the board.</p>}
      {retry.status === 'checking' && <p className="text-sm text-ink-300 flex items-center gap-2"><Spinner size={14} /> Checking {retry.tried.san}…</p>}
      {retry.status === 'right' && <div className="verdict v-good pop"><div className="font-semibold text-white">{retry.tried.uci === ref.bestUci ? `${retry.tried.san}: the best move.` : `${retry.tried.san} works too.`}</div>{retry.tried.uci !== ref.bestUci && <div className="text-sm text-ink-200">The engine's first choice was {bestSan}.</div>}</div>}
      {retry.status === 'wrong' && <div className="verdict v-bad shake"><div className="font-semibold text-white">{retry.tried.same ? 'That is the game move.' : `${retry.tried.san} isn't it either.`}</div>{retry.tried.wAfter != null && <div className="text-sm text-ink-200">Winning chances {Math.round(retry.tried.wAfter)}% (best keeps {Math.round(ref.wBest)}%).</div>}</div>}
      <div className="grid grid-cols-2 gap-2">
        {(retry.status === 'wrong' || retry.status === 'shown') && <button className="btn" onClick={() => setRetry({ ...retry, status: 'play', tried: null, showBest: false })}>Try again</button>}
        {(retry.status === 'wrong' || retry.status === 'play') && <button className="btn" onClick={() => setRetry({ ...retry, showBest: true, status: 'shown', tried: null })}>Show best</button>}
        {retry.showBest && <div className="col-span-2 text-sm text-emerald-300">Best: {bestSan} · {lineSan(fens[idx], ref.bestLine, 6)}</div>}
        {retry.status !== 'play' && retry.status !== 'checking' && <button className="btn btn-primary col-span-2" onClick={nextOne}>{last ? 'Done' : 'Next mistake'}</button>}
      </div>
    </div>
  );
}
