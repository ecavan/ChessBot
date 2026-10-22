/**
 * Insights across your reviewed games: accuracy over time, by phase, where the blunders happen,
 * how your openings score. Only games where we know which side you played count.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { allGames, subscribeGames, resultFor } from '../lib/games.js';
import { analyzeGame, classified } from '../lib/analyze.js';
import { phaseOf, levelFrom, CLASSES } from '../lib/review.js';
import { href } from '../lib/router.js';
import { loadBook } from '../lib/book.js';
import { usePrefs } from '../lib/prefs.js';
import { engine } from '../engine/engine.js';
import { Stat, Progress, Spinner, Seg, ClsDot } from '../ui/kit.jsx';
import { GameRow } from './Review.jsx';

const PHASES = ['opening', 'middlegame', 'endgame'];

function family(name) { return (name || 'Unknown').split(':')[0].trim(); }

export default function Insights() {
  const games = useSyncExternalStore(subscribeGames, allGames);
  const [prefs] = usePrefs();
  const [ready, setReady] = useState(false);
  const [batch, setBatch] = useState(null); // { i, n, done, total }
  const [scope, setScope] = useState('all');
  const stop = useRef(false);
  useEffect(() => { loadBook().then(() => setReady(true)); return () => { stop.current = true; engine.cancel(['review']); }; }, []);

  const mine = useMemo(() => games.filter(g => g.you && (scope === 'all' || (scope === 'here' ? g.source === 'bot' : g.source !== 'bot' && g.source !== 'watch'))), [games, scope]);
  const reviewed = useMemo(() => mine.filter(g => g.review?.summary), [mine]);
  const todo = useMemo(() => mine.filter(g => !g.review?.summary), [mine]);

  const stats = useMemo(() => {
    if (!ready) return null;
    const phase = Object.fromEntries(PHASES.map(p => [p, { acc: 0, n: 0, bad: 0 }]));
    const openings = {};
    const trend = [];
    const ratings = [];
    let blunders = 0, mistakes = 0, moves = 0;
    const moments = []; // your brilliant, great and blunder moves, oldest first
    const totals = {};
    const byColor = { w: { win: 0, draw: 0, loss: 0 }, b: { win: 0, draw: 0, loss: 0 } };
    const chrono = [...reviewed].sort((a, b) => a.at - b.at);
    for (const g of chrono) {
      let c;
      try { c = classified(g); } catch { continue; }
      const first = c.fens[0].split(' ')[1];
      c.cls.forEach((x, i) => {
        const mover = (i % 2 === 0) === (first === 'w') ? 'w' : 'b';
        if (mover !== g.you) return;
        const [, side, , , , full] = c.fens[i].split(' ');
        const ph = phaseOf(c.fens[i], (Number(full) - 1) * 2 + (side === 'b' ? 1 : 0));
        phase[ph].acc += x.acc; phase[ph].n++;
        totals[x.cls] = (totals[x.cls] || 0) + 1;
        if (x.cls === 'brilliant' || x.cls === 'great' || x.cls === 'blunder') moments.push({ g, i, cls: x.cls, san: c.moves[i].san, drop: x.drop, move: Number(full), black: mover === 'b' });
        if (x.cls === 'blunder') { blunders++; phase[ph].bad++; }
        if (x.cls === 'mistake' || x.cls === 'miss') { mistakes++; phase[ph].bad++; }
        moves++;
      });
      const acc = g.review.summary.acc[g.you];
      if (acc != null) trend.push(acc);
      ratings.push(g.review.summary.est?.[g.you] ?? null);
      const res = resultFor(g, g.you);
      if (res !== 'unfinished') byColor[g.you][res]++;
      const fam = family(g.review.summary.opening?.name);
      const o = (openings[fam + '|' + g.you] ||= { name: fam, color: g.you, n: 0, pts: 0, acc: 0 });
      o.n++; o.pts += res === 'win' ? 1 : res === 'draw' ? 0.5 : 0; o.acc += acc || 0;
    }
    return { phase, openings: Object.values(openings).sort((a, b) => b.n - a.n), trend, ratings, moments, totals, blunders, mistakes, moves, byColor, n: chrono.length };
  }, [reviewed, ready]);

  async function analyzeAll() {
    stop.current = false;
    const list = todo.slice(0, 50);
    for (let i = 0; i < list.length; i++) {
      if (stop.current) break;
      setBatch({ i, n: list.length, done: 0, total: list[i].uci.length + 1 });
      await analyzeGame(list[i].id, { ms: Math.min(prefs.analysisTime, 500), onProgress: (done, total) => setBatch({ i, n: list.length, done, total }), isCancelled: () => stop.current });
    }
    setBatch(null);
  }

  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const last10 = stats ? avg(stats.trend.slice(-10)) : null;
  const allAvg = stats ? avg(stats.trend) : null;
  const recent = stats ? stats.ratings.slice(-10).filter(x => x != null) : [];
  const level = levelFrom(recent);
  // your level after each game: the average game rating of that game and the nine before it
  const levels = stats ? stats.ratings.map((_, i) => levelFrom(stats.ratings.slice(Math.max(0, i - 9), i + 1))).filter(x => x != null) : [];
  // brilliant moves first, then great ones, newest first within each
  const best = stats ? stats.moments.filter(m => m.cls !== 'blunder').reverse().sort((a, b) => (a.cls === 'brilliant' ? 0 : 1) - (b.cls === 'brilliant' ? 0 : 1)) : [];
  const bad = stats ? stats.moments.filter(m => m.cls === 'blunder').reverse() : [];
  const worst = stats ? PHASES.map(p => ({ p, a: stats.phase[p].n ? stats.phase[p].acc / stats.phase[p].n : null })).filter(x => x.a != null).sort((a, b) => a.a - b.a)[0] : null;

  return (
    <div className="page fade-up space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <a href="#/review" className="text-sm text-ink-300">← Review</a>
          <h1 className="h-title mt-1">Insights</h1>
          <p className="muted mt-1">{reviewed.length} reviewed game{reviewed.length === 1 ? '' : 's'}{todo.length ? `, ${todo.length} waiting` : ''}.</p>
        </div>
        <Seg value={scope} onChange={setScope} options={[['all', 'All'], ['here', 'vs bots'], ['imported', 'Imported']]} />
      </div>

      {todo.length > 0 && (
        <div className="panel panel-pad space-y-2">
          {batch ? (
            <>
              <div className="flex items-center justify-between text-sm"><span className="text-white font-semibold flex items-center gap-2"><Spinner size={14} /> Reviewing game {batch.i + 1} of {batch.n}</span>
                <button className="btn btn-sm" onClick={() => { stop.current = true; engine.cancel(['review']); }}>Stop</button></div>
              <Progress value={((batch.i + batch.done / Math.max(1, batch.total)) / batch.n) * 100} />
            </>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-ink-200">{todo.length} of your games aren't reviewed yet. Insights only use reviewed games.</span>
              <button className="btn btn-primary" onClick={analyzeAll}>Review {Math.min(50, todo.length)} now</button>
            </div>
          )}
        </div>
      )}

      {!stats || !stats.n ? (
        <div className="panel panel-pad text-center muted">{ready ? 'Review a few of your games to see insights here.' : <Spinner />}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat k="Your level" v={level ?? '–'} s={level != null ? `from your last ${recent.length} games` : 'review 3 or more games'} />
            <Stat k="Accuracy" v={allAvg?.toFixed(1)} s={last10 != null ? `last 10: ${last10.toFixed(1)}` : null} />
            <Stat k="Blunders / game" v={(stats.blunders / stats.n).toFixed(1)} s={`mistakes ${(stats.mistakes / stats.n).toFixed(1)}`} />
            <Stat k="Record (W-D-L)" v={`${stats.byColor.w.win + stats.byColor.b.win}-${stats.byColor.w.draw + stats.byColor.b.draw}-${stats.byColor.w.loss + stats.byColor.b.loss}`} s={`White ${stats.byColor.w.win}-${stats.byColor.w.draw}-${stats.byColor.w.loss} · Black ${stats.byColor.b.win}-${stats.byColor.b.draw}-${stats.byColor.b.loss}`} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <section className="panel panel-pad min-w-0">
              <div className="h-sec mb-3">Your level</div>
              <LevelChart values={levels.slice(-60)} />
              <p className="text-xs text-ink-400 mt-2">The average game rating of your last ten games, after each game. Play better for ten games and it shows.</p>
            </section>
            <section className="panel panel-pad min-w-0">
              <div className="h-sec mb-3">Accuracy by game</div>
              <TrendChart values={stats.trend.slice(-40)} />
            </section>
          </div>

          <section className="panel panel-pad">
            <div className="h-sec mb-3">Your moves</div>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
              {QUALITY.map(k => (
                <div key={k} className="stat !p-2.5 text-center">
                  <div className="flex justify-center"><ClsDot cls={k} size={20} /></div>
                  <div className="text-lg font-semibold text-white num mt-1">{stats.totals[k] || 0}</div>
                  <div className="text-[11px] text-ink-300">{CLASSES[k].label}</div>
                  <div className="text-[11px] text-ink-400 num">{((stats.totals[k] || 0) / stats.n).toFixed(1)} / game</div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-4">
            <MomentList title="Your best moves" empty="No brilliant or great moves yet." list={best} />
            <MomentList title="Blunders to learn from" empty="No blunders. Nice." list={bad} />
          </div>

          <section className="panel panel-pad">
            <div className="h-sec mb-3">By phase</div>
            <div className="grid grid-cols-3 gap-3">
              {PHASES.map(p => {
                const x = stats.phase[p];
                const a = x.n ? x.acc / x.n : null;
                return (
                  <div key={p} className="stat">
                    <div className="k">{p}</div>
                    <div className="v">{a != null ? a.toFixed(1) : '–'}</div>
                    <div className="s">{x.bad} mistakes in {x.n} moves</div>
                    {a != null && <Progress className="mt-2" value={a} color={a >= 85 ? '#34d399' : a >= 70 ? '#facc15' : '#f43f5e'} />}
                  </div>
                );
              })}
            </div>
            {worst && <p className="text-sm text-ink-200 mt-3">Your weakest phase is the <b className="text-white">{worst.p}</b>. {worst.p === 'opening' ? 'Drill your openings in Train.' : worst.p === 'endgame' ? 'The endgame trainer in Train is built for this.' : 'Tactics puzzles and Visualize train exactly this.'}</p>}
          </section>

          <section className="panel panel-pad">
            <div className="h-sec mb-3">Openings</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-ink-400 text-xs uppercase tracking-wider"><th className="py-1.5 font-semibold">Opening</th><th className="font-semibold">As</th><th className="font-semibold text-right">Games</th><th className="font-semibold text-right">Score</th><th className="font-semibold text-right">Accuracy</th></tr></thead>
                <tbody>
                  {stats.openings.slice(0, 15).map(o => (
                    <tr key={o.name + o.color} className="border-t border-ink-800">
                      <td className="py-2 text-white">{o.name}</td>
                      <td className="text-ink-300">{o.color === 'w' ? 'White' : 'Black'}</td>
                      <td className="text-right num">{o.n}</td>
                      <td className={`text-right num font-semibold ${o.pts / o.n >= 0.6 ? 'text-emerald-300' : o.pts / o.n <= 0.4 ? 'text-rose-300' : 'text-ink-100'}`}>{Math.round((o.pts / o.n) * 100)}%</td>
                      <td className="text-right num">{(o.acc / o.n).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="h-sec mb-2">Recent reviewed games</div>
            <div className="panel p-2 divide-y divide-ink-800">{reviewed.slice(0, 8).map(g => <GameRow key={g.id} g={g} />)}</div>
          </section>
        </>
      )}
    </div>
  );
}

const QUALITY = ['brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'miss', 'blunder'];

/** A list of moments (brilliant, great or blunder moves), each opening the review at that move. */
function MomentList({ title, empty, list }) {
  const [all, setAll] = useState(false);
  const shown = all ? list : list.slice(0, 8);
  return (
    <section className="panel panel-pad min-w-0">
      <div className="flex items-center justify-between mb-2"><div className="h-sec">{title}</div><span className="text-xs text-ink-400 num">{list.length}</span></div>
      {!list.length ? <div className="text-sm text-ink-400">{empty}</div> : (
        <div className="divide-y divide-ink-800">
          {shown.map(m => (
            <a key={m.g.id + ':' + m.i} href={href(`/review/game/${encodeURIComponent(m.g.id)}`, { ply: m.i + 1 })} className="flex items-center gap-2.5 py-2 hover:bg-ink-800/40 rounded px-1">
              <ClsDot cls={m.cls} size={18} />
              <span className="font-semibold text-white num w-28 shrink-0 whitespace-nowrap">{m.move}{m.black ? '…' : '.'} {m.san}</span>
              <span className="text-sm text-ink-300 truncate min-w-0">vs {m.g.you === 'w' ? m.g.black : m.g.white}{m.g.date ? ` · ${m.g.date}` : ''}</span>
              {m.cls === 'blunder' && <span className="ml-auto text-xs text-rose-300 num shrink-0">−{Math.round(m.drop)}%</span>}
            </a>
          ))}
        </div>
      )}
      {list.length > 8 && <button className="btn btn-sm btn-quiet mt-2" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button>}
    </section>
  );
}

function LevelChart({ values }) {
  if (values.length < 2) return <div className="text-sm text-ink-400">Needs three or more reviewed games.</div>;
  const W = 600, H = 120;
  const lo = Math.floor((Math.min(...values) - 100) / 100) * 100, hi = Math.ceil((Math.max(...values) + 100) / 100) * 100;
  const x = (i) => (i / (values.length - 1)) * W;
  const y = (v) => H - ((v - lo) / (hi - lo)) * H;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
        <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[11px] text-ink-400 num mt-1"><span>{lo}–{hi}</span><span>now {values[values.length - 1]}</span></div>
    </div>
  );
}

function TrendChart({ values }) {
  if (values.length < 2) return <div className="text-sm text-ink-400">Needs two or more reviewed games.</div>;
  const W = 600, H = 120;
  const x = (i) => (i / (values.length - 1)) * W;
  const y = (v) => H - (v / 100) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
      {[50, 75, 90].map(v => <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="rgb(var(--ink-600))" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />)}
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {values.map((v, i) => <line key={i} x1={x(i)} x2={x(i)} y1={y(v) - 0.5} y2={y(v) + 0.5} stroke="#34d399" strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}
