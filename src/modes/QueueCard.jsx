/** The sync + review-queue card: what came in from chess.com, what is being reviewed, a Sync button. */
import { useState, useSyncExternalStore } from 'react';
import { useQueue, enqueueUnreviewed, requeueLite, pause } from '../lib/reviewQueue.js';
import { sync, syncState, subscribeSync } from '../lib/sync.js';
import { usePrefs } from '../lib/prefs.js';
import { allGames, subscribeGames, getGame } from '../lib/games.js';
import { Progress, Spinner } from '../ui/kit.jsx';
import { href } from '../lib/router.js';

export default function QueueCard({ compact = false }) {
  const [prefs] = usePrefs();
  const q = useQueue();
  const games = useSyncExternalStore(subscribeGames, allGames);
  const st = useSyncExternalStore(subscribeSync, syncState);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const unreviewed = games.filter(g => g.you && !g.review?.summary).length;
  const cur = q.progress ? getGame(q.progress.id) : null;
  const recent = st.lastResult;
  if (!prefs.chesscom && !q.pending.length && !unreviewed) return <ConnectCard />;
  async function doSync() {
    setBusy(true); setMsg(null);
    const r = await sync({ manual: true });
    setBusy(false);
    if (r.error && r.error !== 'off') setMsg(r.error === 'no username' ? 'Add your chess.com username in Settings first.' : r.error);
    else setMsg(r.added ? `${r.added} new game${r.added === 1 ? '' : 's'} from chess.com, queued for review.` : 'Nothing new on chess.com.');
  }
  const nothing = !q.pending.length && !q.lite.length && !unreviewed;
  if (compact && nothing && !busy && !msg) return null;
  return (
    <div className="panel panel-pad space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-white font-semibold flex items-center gap-2">
            {q.progress ? <Spinner size={14} /> : null}
            {q.progress && cur ? `Reviewing vs ${cur.you === 'w' ? cur.black : cur.white}` : q.pending.length ? `${q.pending.length} game${q.pending.length === 1 ? '' : 's'} waiting for review` : unreviewed ? `${unreviewed} of your games aren't reviewed` : 'Everything is reviewed'}
          </div>
          <div className="text-xs text-ink-300">
            {q.progress ? `${q.progress.done}/${q.progress.total} positions · ${q.pending.length - 1 > 0 ? `${q.pending.length - 1} more waiting · ` : ''}reviews run while the app is open` : recent?.at ? `chess.com checked ${ago(recent.at)}${recent.added ? ` · ${recent.added} new` : ''}${recent.error ? ` · ${recent.error}` : ''}` : prefs.chesscom ? 'Sync runs when you open the app.' : ''}
            {prefs.chesscom && !q.progress ? <> · <span className="text-ink-200">{prefs.chesscom}</span> <a className="underline" href="#/settings">change</a></> : null}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {prefs.chesscom && <button className="btn btn-sm" onClick={doSync} disabled={busy}>{busy ? <Spinner size={12} /> : null}Sync chess.com</button>}
          {!q.pending.length && unreviewed > 0 && <button className="btn btn-sm btn-primary" onClick={() => enqueueUnreviewed()}>Review all</button>}
          {q.progress && <button className="btn btn-sm btn-quiet" onClick={pause}>Pause</button>}
        </div>
      </div>
      {q.progress && <Progress value={(q.progress.done / Math.max(1, q.progress.total)) * 100} />}
      {msg && <div className="text-sm text-ink-200">{msg}</div>}
      {q.lite.length > 0 && !q.pending.length && (
        <div className="text-xs text-amber-200 flex items-center justify-between gap-2 flex-wrap">
          <span>{q.lite.length} game{q.lite.length === 1 ? ' was' : 's were'} reviewed with the lite network (rough numbers).</span>
          <button className="btn btn-sm" onClick={requeueLite}>Re-review with full</button>
        </div>
      )}
      {!compact && q.pending.length > 1 && (
        <div className="text-xs text-ink-400 truncate">Next: {q.pending.slice(q.progress ? 1 : 0, 4).map(id => getGame(id)).filter(Boolean).map(g => <a key={g.id} className="underline mr-2" href={href(`/review/game/${encodeURIComponent(g.id)}`)}>vs {g.you === 'w' ? g.black : g.white}</a>)}</div>
      )}
    </div>
  );
}

/**
 * The first step for a new person: link a chess.com account. chess.com has no sign-in for outside
 * apps, and none is needed: the public API serves anyone's games by username, so the username is
 * the account. It is remembered on this device, new games come in whenever the app opens, and
 * each is reviewed in the background.
 */
export function ConnectCard() {
  const [, setPrefs] = usePrefs();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function connect(e) {
    e?.preventDefault?.();
    const user = name.trim();
    if (!user) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}`);
      if (r.status === 404) { setErr(`No chess.com player called "${user}".`); setBusy(false); return; }
      if (!r.ok) { setErr('chess.com did not answer. Try again in a minute.'); setBusy(false); return; }
      const p = await r.json();
      setPrefs({ chesscom: p.username || user, syncAuto: true, syncBackfillMonths: 2 });
      const s = await sync({ manual: true });
      if (s.error && s.error !== 'off') setErr(s.error);
      enqueueUnreviewed();
    } catch { setErr('Could not reach chess.com. Check your connection.'); }
    setBusy(false);
  }
  return (
    <form className="panel panel-pad space-y-2" onSubmit={connect}>
      <div className="text-white font-semibold">Connect your chess.com account</div>
      <div className="text-sm text-ink-300">Your recent games appear here and get reviewed by themselves whenever you open the app: tap one to see every mistake explained. Just the username — no password, nothing is sent anywhere but chess.com.</div>
      <div className="flex gap-2 flex-wrap">
        <input type="text" className="flex-1 min-w-[180px]" placeholder="chess.com username" value={name} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || busy}>{busy ? <Spinner size={12} /> : null}Connect</button>
      </div>
      {err && <div className="text-sm text-rose-300">{err}</div>}
      <div className="text-xs text-ink-400">Lichess, or a PGN file: <a className="underline" href="#/review/import">Import</a>.</div>
    </form>
  );
}

function ago(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
