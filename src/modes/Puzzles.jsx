/**
 * Puzzles: rated, by theme, the daily one, the review queue (puzzles you missed come back after
 * 1, 3, 7 and 21 days) and Visualize, a calculation drill where the first moves of the line are
 * only announced and you find the next move on the board in your head.
 *
 * While solving you can open the scratch pad: move both sides freely from the puzzle position
 * to check a line, then go back and play your answer. Nothing you do there counts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../ui/Board.jsx';
import { Stage, useStage, Seg, Spinner, Stat, MoveList } from '../ui/kit.jsx';
import { pick, daily, record, progress, dueReviews, today, themeName, THEME_GROUPS, loadIndex } from '../lib/puzzles.js';
import { playUci, uciOf } from '../lib/chessutil.js';
import { moveSound, sfx } from '../lib/sound.js';
import { usePrefs } from '../lib/prefs.js';
import { href, go } from '../lib/router.js';
import { control } from '../lib/insight.js';

export default function Puzzles({ route }) {
  if (route.parts[1] === 'solve') return <Solver key={route.key} mode={route.query.mode || 'rated'} theme={route.query.theme} id={route.query.id} />;
  return <Hub />;
}

// ------------------------------------------------------------------ hub

function Sparkline({ values, height = 56 }) {
  if (values.length < 2) return <div className="text-xs text-ink-400">Play a few puzzles to see your rating move.</div>;
  const lo = Math.min(...values), hi = Math.max(...values);
  const W = 300, H = height, span = Math.max(20, hi - lo);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 4 - ((v - lo) / span) * (H - 8)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polyline points={pts} fill="none" stroke="#34d399" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Hub() {
  const [prefs, setPrefs] = usePrefs();
  const pr = progress();
  const due = dueReviews();
  const hist = pr.history.filter(h => h.mode === 'rated' || h.mode === 'theme');
  const last = hist.slice(-50);
  const solvedPct = last.length ? Math.round((last.filter(h => h.ok).length / last.length) * 100) : null;
  const dailyDone = pr.daily[today()];
  const [count, setCount] = useState(null);
  useEffect(() => { loadIndex().then(ix => setCount(ix.bands.reduce((a, b) => a + b.count, 0))).catch(() => {}); }, []);
  return (
    <div className="page fade-up space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-title">Puzzles</h1>
          <p className="muted mt-1">{count ? `${count.toLocaleString()} puzzles` : 'Puzzles'} from real games, checked by thousands of solvers.</p>
        </div>
        <Seg value={prefs.puzzleDifficulty} onChange={(v) => setPrefs({ puzzleDifficulty: v })}
          options={[[-300, 'Easier'], [0, 'Normal'], [300, 'Harder']]} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <a href={href('/puzzles/solve', { mode: 'rated' })} className="card-link md:col-span-2 !border-emerald-700/50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="h-sec !text-emerald-300">Rated puzzles</div>
              <div className="text-4xl font-semibold text-white num mt-1">{pr.ratings.rated}</div>
              <div className="text-sm text-ink-300 mt-1">{pr.plays.rated} played{solvedPct != null ? ` · ${solvedPct}% of the last ${last.length} solved` : ''} · streak {pr.streak}</div>
            </div>
            <span className="btn btn-primary btn-lg">Solve</span>
          </div>
          <div className="mt-3"><Sparkline values={hist.slice(-60).map(h => h.after)} /></div>
        </a>
        <div className="grid gap-4">
          <a href={href('/puzzles/solve', { mode: 'daily' })} className="card-link">
            <div className="h-sec">Daily puzzle</div>
            <div className="text-white font-semibold mt-1">{dailyDone ? (dailyDone.ok ? 'Solved today ✓' : 'Missed today, try again') : 'Today’s puzzle is ready'}</div>
          </a>
          <a href={due.length ? href('/puzzles/solve', { mode: 'review' }) : undefined} className={`card-link ${due.length ? '' : 'opacity-60 pointer-events-none'}`}>
            <div className="h-sec">Review mistakes</div>
            <div className="text-white font-semibold mt-1">{due.length ? `${due.length} due now` : pr.queue.length ? `${pr.queue.length} scheduled, none due` : 'Nothing to review'}</div>
          </a>
        </div>
      </div>

      <a href={href('/puzzles/solve', { mode: 'visual' })} className="card-link flex items-center justify-between gap-4">
        <div>
          <div className="h-sec !text-sky-300">Visualize · calculation training</div>
          <div className="text-white font-semibold mt-1">The first moves are only announced. Find the next one in your head.</div>
          <div className="text-sm text-ink-300 mt-0.5">Rating {pr.ratings.visual} · {pr.plays.visual} played</div>
        </div>
        <span className="btn">Start</span>
      </a>

      <section className="panel panel-pad">
        <div className="h-sec mb-3">Practice a theme</div>
        <div className="space-y-4">
          {THEME_GROUPS.map(g => (
            <div key={g.name}>
              <div className="text-xs font-semibold text-ink-300 mb-2">{g.name}</div>
              <div className="flex flex-wrap gap-2">
                {g.themes.map(t => <a key={t} className="btn btn-sm" href={href('/puzzles/solve', { mode: 'theme', theme: t })}>{themeName(t)}</a>)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ solver

const MODE_LABEL = { rated: 'Rated', theme: 'Theme', daily: 'Daily puzzle', review: 'Review', visual: 'Visualize', free: 'Puzzle' };

function Solver({ mode, theme, id }) {
  const [prefs] = usePrefs();
  const stage = useStage();
  const [p, setP] = useState(null);
  const [err, setErr] = useState(null);
  const [k, setK] = useState(0); // plies of the solution played so far (0 = before the opponent's first move)
  const [status, setStatus] = useState('loading'); // loading | play | wait | wrong | solved | failed
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(0);
  const [delta, setDelta] = useState(null);
  const [wrongMove, setWrongMove] = useState(null);
  const [sandbox, setSandbox] = useState(null); // { uci: [] } while exploring
  const [depth, setDepth] = useState(1); // visualize: your moves announced
  const [shown, setShown] = useState(false); // visualize: announced line is visible on the board (peek)
  const [solving, setSolving] = useState(false); // visualize: after the answer, the board catches up
  const [reach, setReach] = useState(null);
  const recorded = useRef(false);
  const timers = useRef([]);
  const later = (f, ms) => { const t = setTimeout(f, ms); timers.current.push(t); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const pr = progress();
  const visual = mode === 'visual';

  async function next() {
    timers.current.forEach(clearTimeout);
    setP(null); setErr(null); setK(0); setStatus('loading'); setFailed(false); setHint(0); setDelta(null); setWrongMove(null); setSandbox(null); setShown(false); setSolving(false);
    recorded.current = false;
    try {
      let q;
      if (mode === 'daily') q = await daily();
      else if (mode === 'review') { const d = dueReviews(); if (!d.length) { go('/puzzles'); return; } q = d[0].p; }
      else if (visual) q = await pick(pr.ratings.visual + prefs.puzzleDifficulty, { minPlies: 2 + depth * 2, maxPlies: 4 + depth * 2 });
      else q = await pick(pr.ratings.rated + prefs.puzzleDifficulty, { theme: mode === 'theme' ? theme : undefined });
      setP(q);
      // the opponent's move that sets the puzzle up
      later(() => { setK(1); setStatus('play'); sfx.move(); }, 650);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { next(); }, [depth]); // eslint-disable-line react-hooks/exhaustive-deps

  const lineFens = useMemo(() => {
    if (!p) return [];
    const c = new Chess(p.fen);
    const out = [c.fen()];
    for (const u of p.moves) { try { c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; } out.push(c.fen()); }
    return out;
  }, [p]);
  const lineMoves = useMemo(() => (p ? playUci(p.fen, p.moves).moves : []), [p]);
  const you = p ? (p.fen.split(' ')[1] === 'w' ? 'b' : 'w') : 'w';

  // visualize: how many plies are announced but not shown
  const hidden = visual ? depth * 2 : 0;
  const visualTarget = 1 + hidden; // the ply you must find
  const inVisual = visual && status !== 'loading' && k === 1 && !solving && !shown;
  const displayFen = !p ? null : sandbox ? playUci(lineFens[k], sandbox.uci).game.fen() : wrongMove?.fen || lineFens[k];
  const logicFen = !p ? null : sandbox ? displayFen : inVisual ? lineFens[visualTarget] : wrongMove?.fen || lineFens[k];

  function fail() {
    if (!recorded.current && p) { recorded.current = true; setDelta(record(p, false, mode)); }
    setFailed(true);
  }

  function onMove({ from, to, promotion }) {
    if (sandbox) {
      const c = new Chess(displayFen);
      try { const m = c.move({ from, to, promotion }); moveSound(m, c.inCheck()); setSandbox(s => ({ uci: [...s.uci, uciOf(m)] })); return true; } catch { return false; }
    }
    if (status !== 'play') return false;
    const at = inVisual ? visualTarget : k;
    const c = new Chess(lineFens[at]);
    let m;
    try { m = c.move({ from, to, promotion }); } catch { return false; }
    const u = uciOf(m);
    const right = u === p.moves[at] || c.isCheckmate();
    if (!right) {
      sfx.bad();
      setWrongMove({ from, to, fen: inVisual ? null : c.fen() });
      setStatus('wrong');
      fail();
      later(() => { setWrongMove(null); setStatus('play'); }, 900);
      return true;
    }
    moveSound(m, c.inCheck());
    setHint(0);
    let reached = at + 1;
    if (inVisual) {
      // play the announced moves on the board, then your answer
      setSolving(true);
      setStatus('wait');
      for (let i = 2; i <= at + 1; i++) later(() => { setK(i); sfx.move(); }, (i - 1) * 420);
      reached = at + 1;
      later(() => afterRight(reached, c.isCheckmate()), (at + 1) * 420);
      return true;
    }
    setK(reached);
    afterRight(reached, c.isCheckmate());
    return true;
  }

  function afterRight(reached, mate) {
    if (reached >= p.moves.length || mate) {
      setK(reached);
      setStatus('solved');
      if (!recorded.current) { recorded.current = true; setDelta(record(p, !failed && hint === 0, mode)); }
      sfx.good();
      return;
    }
    setStatus('wait');
    later(() => { setK(reached + 1); sfx.move(); setStatus('play'); }, 450);
  }

  function showSolution() {
    fail();
    setShown(true);
    setStatus('wait');
    let i = k;
    const step = () => {
      i++;
      if (i > p.moves.length) { setStatus('failed'); return; }
      setK(i); sfx.move();
      later(step, 650);
    };
    later(step, 300);
  }

  function takeHint() {
    if (!recorded.current) fail();
    setHint(h => Math.min(2, h + 1));
  }

  if (err) return <div className="page"><div className="panel panel-pad text-center"><p className="text-rose-300 mb-3">{err}</p><a className="btn" href="#/puzzles">Back</a></div></div>;

  const at = inVisual ? visualTarget : k;
  const answer = p?.moves[at];
  const done = status === 'solved' || status === 'failed';
  const arrows = [];
  const marks = {};
  if (hint >= 1 && answer && !done && !sandbox) marks[answer.slice(0, 2)] = 'rgba(16,185,129,.55)';
  if (hint >= 2 && answer && !done && !sandbox) arrows.push({ from: answer.slice(0, 2), to: answer.slice(2, 4), color: 'rgba(16,185,129,.85)' });
  if (wrongMove) { marks[wrongMove.to] = 'rgba(244,63,94,.55)'; }
  const lm = sandbox?.uci.length ? { from: sandbox.uci.at(-1).slice(0, 2), to: sandbox.uci.at(-1).slice(2, 4) } : k > 0 && lineMoves[k - 1] ? lineMoves[k - 1] : null;
  const announced = visual && p ? lineMoves.slice(1, visualTarget) : [];

  return (
    <Stage stage={stage}
      top={<div className="strip"><span className="text-sm font-semibold text-ink-200">{MODE_LABEL[mode]}{mode === 'theme' && theme ? ` · ${themeName(theme)}` : ''}</span>
        <span className="text-xs text-ink-300">{visual ? `Visualize ${pr.ratings.visual}` : `Rating ${pr.ratings.rated}`}</span></div>}
      bottom={<div className="strip"><span className="text-sm text-ink-300">{p ? `${you === 'w' ? 'White' : 'Black'} to move` : ''}</span>
        {sandbox && <span className="tag !bg-sky-950 !border-sky-700 !text-sky-200">Scratch pad</span>}</div>}
      board={p ? (
        <Board fen={displayFen} logicFen={logicFen} orientation={you === 'w' ? 'white' : 'black'} size={stage.size}
          movable={sandbox ? 'both' : status === 'play' ? you : 'none'} onMove={onMove} hideDots={inVisual}
          lastMove={inVisual ? lineMoves[0] : lm} arrows={arrows} marks={marks}
          onSelect={(s) => setReach(s)}
          reachOf={sandbox && reach ? { squares: reachSquares(displayFen, reach), color: 'rgba(56,189,248,.28)' } : null} />
      ) : <div className="cb flex items-center justify-center bg-ink-900" style={{ width: stage.size, height: stage.size }}><Spinner size={28} /></div>}
    >
      <div className="panel panel-pad space-y-3">
        {visual && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">Calculate ahead</span>
            <Seg value={depth} onChange={setDepth} options={[[1, '1 move'], [2, '2 moves']]} />
          </div>
        )}
        {!p ? <div className="text-ink-300 text-sm flex items-center gap-2"><Spinner /> Finding a puzzle…</div> : sandbox ? (
          <div className="verdict v-info">
            <div className="font-semibold text-white">Scratch pad</div>
            <div className="text-sm text-ink-200 mt-0.5">Move both sides to test a line. Tap a piece to see what it controls. Nothing here counts.</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button className="btn" onClick={() => setSandbox(s => ({ uci: s.uci.slice(0, -1) }))} disabled={!sandbox.uci.length}>Undo</button>
              <button className="btn btn-primary" onClick={() => { setSandbox(null); setReach(null); }}>Back to puzzle</button>
            </div>
            {sandbox.uci.length > 0 && <div className="mt-3"><MoveList sans={playUci(lineFens[k], sandbox.uci).moves.map(m => m.san)} ply={sandbox.uci.length} startFen={lineFens[k]} maxHeight={150} /></div>}
          </div>
        ) : (
          <>
            {inVisual && status === 'play' && (
              <div className="verdict v-info">
                <div className="text-xs font-semibold uppercase tracking-wider text-sky-300 mb-1">Picture this line</div>
                <div className="text-lg font-semibold text-white leading-snug">
                  {announced.map((m, i) => (
                    <span key={i} className="mr-2">{i % 2 === 0 ? 'You ' : (you === 'w' ? 'Black ' : 'White ')}<span className="text-amber-300">{m.san}</span>{i < announced.length - 1 ? ',' : ''}</span>
                  ))}
                </div>
                <div className="text-sm text-ink-200 mt-2">Now play your next move from the position in your head (tap the squares; the board hasn't moved).</div>
              </div>
            )}
            <StatusCard status={status} p={p} delta={delta} failed={failed} hint={hint} mode={mode} you={you} />
            {p && done && (
              <div className="flex flex-wrap gap-1.5">
                <span className="tag">Rating {p.rating}</span>
                {p.themes.filter(t => !['short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM', 'crushing', 'advantage', 'equality'].includes(t)).slice(0, 5).map(t => <span key={t} className="tag !normal-case">{themeName(t)}</span>)}
              </div>
            )}
          </>
        )}
      </div>

      {p && !sandbox && (
        <div className="grid grid-cols-2 gap-2">
          {done ? (
            <>
              <button className="btn btn-primary btn-lg col-span-2" onClick={next}>{mode === 'daily' ? 'Again' : 'Next puzzle'}</button>
              <a className="btn" href={href('/train/scratch', { fen: lineFens[1] })}>Analyze</a>
              <button className="btn" onClick={() => { timers.current.forEach(clearTimeout); setK(1); setStatus('play'); setShown(false); setSolving(false); setHint(0); setWrongMove(null); setSandbox(null); }}>Retry</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={takeHint} disabled={status !== 'play' || hint >= 2}>{hint === 0 ? 'Hint' : 'Show move'}</button>
              <button className="btn" onClick={showSolution} disabled={status !== 'play'}>Solution</button>
              <button className="btn col-span-2" onClick={() => { setSandbox({ uci: [] }); setReach(null); }} disabled={status !== 'play' || inVisual}>Scratch pad: try a line first</button>
              {visual && inVisual && <button className="btn col-span-2" onClick={() => { fail(); setShown(true); setK(visualTarget); }}>Peek at the position</button>}
            </>
          )}
        </div>
      )}
      {p && done && <div className="text-xs text-ink-400 px-1">Puzzle {p.id} · <a className="underline" href={`https://lichess.org/training/${p.id}`} target="_blank" rel="noreferrer">open on Lichess</a></div>}
      <a href="#/puzzles" className="btn btn-quiet btn-sm self-start">← All puzzle modes</a>
    </Stage>
  );
}

function reachSquares(fen, sq) {
  const c = control(fen);
  return Object.entries(c).filter(([, v]) => v.w.includes(sq) || v.b.includes(sq)).map(([s]) => s);
}

function StatusCard({ status, p, delta, failed, hint, mode, you }) {
  if (!p) return null;
  const d = delta != null && delta !== 0 ? <span className={`num font-semibold ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}> {delta > 0 ? '+' : ''}{delta}</span> : null;
  if (status === 'solved') {
    return (
      <div className={`verdict ${failed || hint ? 'v-info' : 'v-good'} pop`}>
        <div className="text-lg font-semibold text-white">{failed || hint ? 'Solved, with help' : 'Solved!'}{d}</div>
        <div className="text-sm text-ink-200">{failed || hint ? (mode === 'rated' || mode === 'theme' || mode === 'visual' ? 'Counted as a miss. It will come back for review.' : 'It will come back for review.') : mode === 'review' ? 'Nice. It moves to a longer interval.' : 'Clean solve.'}</div>
      </div>
    );
  }
  if (status === 'failed') return <div className="verdict v-bad pop"><div className="text-lg font-semibold text-white">That was the line{d}</div><div className="text-sm text-ink-200">It will come back in your review queue.</div></div>;
  if (status === 'wrong') return <div className="verdict v-bad shake"><div className="font-semibold text-white">Not the move{d}</div><div className="text-sm text-ink-200">Try again.</div></div>;
  if (status === 'loading') return <div className="text-sm text-ink-300">Setting up…</div>;
  return (
    <div>
      <div className="text-lg font-semibold text-white">{status === 'wait' ? '…' : `Find the best move for ${you === 'w' ? 'White' : 'Black'}`}</div>
      <div className="text-sm text-ink-300 mt-0.5">{failed ? 'This one counts as a miss now, but finish it.' : hint ? 'Hint used.' : 'Tap a piece to see its moves.'}</div>
    </div>
  );
}
