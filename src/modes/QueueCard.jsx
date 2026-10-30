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
  if (!prefs.chesscom && !q.pending.length && !unreviewed) {
    if (compact) return null;
    return (
      <div className="panel panel-pad flex items-center justify-between gap-3 flex-wrap">
        <div><div className="text-white font-semibold">Link your chess.com username</div><div className="text-sm text-ink-300">New games come in by themselves when you open the app, reviewed and ready.</div></div>
        <a className="btn btn-primary" href="#/settings">Settings</a>
      </div>
    );
  }
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

function ago(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
