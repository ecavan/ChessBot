/**
 * Insights across your reviewed games: accuracy over time, by phase, where the blunders happen,
 * how your openings score. Only games where we know which side you played count.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { allGames, subscribeGames, resultFor } from '../lib/games.js';
import { analyzeGame, classified } from '../lib/analyze.js';
import { phaseOf } from '../lib/review.js';
import { loadBook } from '../lib/book.js';
import { usePrefs } from '../lib/prefs.js';
import { engine } from '../engine/engine.js';
import { Stat, Progress, Spinner, Seg } from '../ui/kit.jsx';
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
    let blunders = 0, mistakes = 0, moves = 0;
    const byColor = { w: { win: 0, draw: 0, loss: 0 }, b: { win: 0, draw: 0, loss: 0 } };
    const chrono = [...reviewed].sort((a, b) => a.at - b.at);
    for (const g of chrono) {
      let c;
      try { c = classified(g); } catch { continue; }
      const first = c.fens[0].split(' ')[1];
      c.cls.forEach((x, i) => {
        const mover = (i % 2 === 0) === (first === 'w') ? 'w' : 'b';
        if (mover !== g.you) return;
        const ph = phaseOf(c.fens[i], i);
        phase[ph].acc += x.acc; phase[ph].n++;
        if (x.cls === 'blunder') { blunders++; phase[ph].bad++; }
        if (x.cls === 'mistake' || x.cls === 'miss') { mistakes++; phase[ph].bad++; }
        moves++;
      });
      const acc = g.review.summary.acc[g.you];
      if (acc != null) trend.push(acc);
      const res = resultFor(g, g.you);
      if (res !== 'unfinished') byColor[g.you][res]++;
      const fam = family(g.review.summary.opening?.name);
      const o = (openings[fam + '|' + g.you] ||= { name: fam, color: g.you, n: 0, pts: 0, acc: 0 });
      o.n++; o.pts += res === 'win' ? 1 : res === 'draw' ? 0.5 : 0; o.acc += acc || 0;
    }
    return { phase, openings: Object.values(openings).sort((a, b) => b.n - a.n), trend, blunders, mistakes, moves, byColor, n: chrono.length };
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
            <Stat k="Accuracy" v={allAvg?.toFixed(1)} s={last10 != null ? `last 10: ${last10.toFixed(1)}` : null} />
            <Stat k="Blunders / game" v={(stats.blunders / stats.n).toFixed(1)} s={`mistakes ${(stats.mistakes / stats.n).toFixed(1)}`} />
            <Stat k="As White" v={`${stats.byColor.w.win}-${stats.byColor.w.draw}-${stats.byColor.w.loss}`} s="W-D-L" />
            <Stat k="As Black" v={`${stats.byColor.b.win}-${stats.byColor.b.draw}-${stats.byColor.b.loss}`} s="W-D-L" />
          </div>

          <section className="panel panel-pad">
            <div className="h-sec mb-3">Accuracy by game</div>
            <TrendChart values={stats.trend.slice(-40)} />
          </section>

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

function TrendChart({ values }) {
  if (values.length < 2) return <div className="text-sm text-ink-400">Needs two or more reviewed games.</div>;
  const W = 600, H = 120;
  const x = (i) => (i / (values.length - 1)) * W;
  const y = (v) => H - (v / 100) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
      {[50, 75, 90].map(v => <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="#2a3442" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />)}
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {values.map((v, i) => <line key={i} x1={x(i)} x2={x(i)} y1={y(v) - 0.5} y2={y(v) + 0.5} stroke="#34d399" strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}
