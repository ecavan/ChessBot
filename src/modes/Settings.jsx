/** Settings: board look, engine, review depth, accounts, data. */
import { useState } from 'react';
import { usePrefs, DEFAULT_PREFS } from '../lib/prefs.js';
import { BOARDS, PIECE_SETS } from '../lib/themes.js';
import { useEngineStatus } from '../engine/useEngine.js';
import { FLAVOR_NAME, canThread } from '../engine/engine.js';
import { Toggle, Seg, Sheet } from '../ui/kit.jsx';
import { clearGames, allGames } from '../lib/games.js';
import { resetPuzzles } from '../lib/puzzles.js';
import { KEYS, load, save } from '../lib/store.js';
import Board from '../ui/Board.jsx';

export default function Settings() {
  const [prefs, setPrefs] = usePrefs();
  const st = useEngineStatus();
  const [confirm, setConfirm] = useState(null);
  const [msg, setMsg] = useState(null);

  function exportData() {
    const data = Object.fromEntries(Object.values(KEYS).map(k => [k, load(k, null)]));
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chess-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importData(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      for (const k of Object.values(KEYS)) if (data[k] != null) save(k, data[k]);
      location.reload();
    } catch { setMsg('That file is not a backup from this app.'); }
  }

  return (
    <div className="page fade-up space-y-5 max-w-4xl">
      <h1 className="h-title">Settings</h1>

      <section className="panel panel-pad">
        <div className="h-sec mb-3">Board</div>
        <div className="grid md:grid-cols-[1fr_220px] gap-5 items-start">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-white mb-2">Colours</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(BOARDS).map(([k, b]) => (
                  <button key={k} onClick={() => setPrefs({ boardTheme: k })} className={`rounded-xl p-1 border-2 ${prefs.boardTheme === k ? 'border-emerald-400' : 'border-transparent'}`} title={b.name}>
                    <span className="grid grid-cols-2 w-12 h-12 rounded-lg overflow-hidden">
                      <i style={{ background: b.light }} /><i style={{ background: b.dark }} /><i style={{ background: b.dark }} /><i style={{ background: b.light }} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-white mb-2">Pieces</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PIECE_SETS).map(([k, p]) => {
                  const N = p.set.wN, Q = p.set.bQ;
                  return (
                    <button key={k} onClick={() => setPrefs({ pieceStyle: k })} className={`rounded-xl px-2 py-1.5 border-2 bg-ink-850 flex flex-col items-center ${prefs.pieceStyle === k ? 'border-emerald-400' : 'border-ink-700'}`}>
                      <span className="flex"><span className="w-8 h-8"><N /></span><span className="w-8 h-8"><Q /></span></span>
                      <span className="text-[11px] text-ink-300">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <Toggle on={prefs.coords} onChange={(v) => setPrefs({ coords: v })} label="Coordinates" />
            <Toggle on={prefs.peek} onChange={(v) => setPrefs({ peek: v })} label="Peek at the other side's moves" sub="Tapping a piece that can't move now shows where it could go (red dots)." />
            <Toggle on={prefs.sound} onChange={(v) => setPrefs({ sound: v })} label="Sounds" />
          </div>
          <div className="hidden md:block"><Board fen="r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4" size={216} lastMove={{ from: 'g8', to: 'f6' }} /></div>
        </div>
      </section>

      <section className="panel panel-pad space-y-3">
        <div className="h-sec">Engine</div>
        <div className="text-sm text-ink-200">
          Running: <b className="text-white">{st.flavor ? FLAVOR_NAME[st.flavor] : 'starting…'}</b>{st.threads > 1 ? `, ${st.threads} threads` : ''}.
          {st.loading && <span className="text-amber-300"> Downloading the full network (about 75 MB, once)…</span>}
          {st.error && <span className="text-rose-300"> {st.error}</span>}
        </div>
        <Seg value={prefs.engine} onChange={(v) => setPrefs({ engine: v })} options={[['full', 'Full strength'], ['lite', 'Lite (small download)']]} />
        <p className="text-xs text-ink-400">
          Full is Stockfish 17.1 with its complete neural network, the engine the big sites use for their analysis;
          {canThread() ? ' it uses several cores here.' : ' this browser only allows one thread.'} The app starts on the lite network and switches automatically
          once the full one is downloaded; after that it works offline. Switching to lite takes effect on the next launch.
        </p>
        <div>
          <div className="text-sm font-semibold text-white mb-2">Game review depth</div>
          <Seg value={prefs.analysisTime} onChange={(v) => setPrefs({ analysisTime: v })} options={[[400, 'Fast'], [800, 'Standard'], [1600, 'Deep'], [3000, 'Max']]} />
          <p className="text-xs text-ink-400 mt-1.5">Time per position. Standard reviews a 40-move game in about a minute.</p>
        </div>
      </section>

      <section className="panel panel-pad space-y-3">
        <div className="h-sec">Your accounts</div>
        <p className="text-xs text-ink-400">Used to fetch your games and to know which side you played. Public data only.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-ink-200">chess.com<input type="text" className="w-full mt-1" value={prefs.chesscom} onChange={(e) => setPrefs({ chesscom: e.target.value.trim() })} autoCapitalize="none" autoCorrect="off" /></label>
          <label className="text-sm text-ink-200">Lichess<input type="text" className="w-full mt-1" value={prefs.lichess} onChange={(e) => setPrefs({ lichess: e.target.value.trim() })} autoCapitalize="none" autoCorrect="off" /></label>
        </div>
      </section>

      <section className="panel panel-pad space-y-3">
        <div className="h-sec">Data</div>
        <p className="text-sm text-ink-300">Everything is stored on this device: {allGames().length} games, puzzle progress, settings.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={exportData}>Export backup</button>
          <label className="btn cursor-pointer">Restore backup<input type="file" accept="application/json" className="hidden" onChange={importData} /></label>
          <button className="btn btn-danger" onClick={() => setConfirm('puzzles')}>Reset puzzle progress</button>
          <button className="btn btn-danger" onClick={() => setConfirm('games')}>Delete all games</button>
          <button className="btn btn-quiet" onClick={() => setPrefs(DEFAULT_PREFS)}>Default settings</button>
        </div>
        {msg && <p className="text-sm text-rose-300">{msg}</p>}
      </section>
      <p className="text-xs text-ink-500 text-center">Stockfish 17.1 (GPLv3) · puzzles and opening names from the Lichess open database (CC0)</p>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'games' ? 'Delete every saved game?' : 'Reset puzzle ratings and history?'}>
        <p className="text-sm text-ink-300 mb-4">This can't be undone. Export a backup first if you might want it.</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { if (confirm === 'games') clearGames(); else resetPuzzles(); setConfirm(null); }}>Yes, delete</button>
        </div>
      </Sheet>
    </div>
  );
}
