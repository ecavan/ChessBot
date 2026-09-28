/** Home: where you left off, today's puzzle, your numbers. */
import { useSyncExternalStore } from 'react';
import { load } from '../lib/store.js';
import { progress, dueReviews, today } from '../lib/puzzles.js';
import { allGames, subscribeGames } from '../lib/games.js';
import { botById } from '../engine/bots.js';
import { href } from '../lib/router.js';
import { GameRow } from './Review.jsx';

export default function Home() {
  const games = useSyncExternalStore(subscribeGames, allGames);
  const cur = load('chess.current.v2', null);
  const inGame = cur && !cur.over && cur.uci.length > 0;
  const pr = progress();
  const due = dueReviews().length;
  const daily = pr.daily[today()];
  const mine = games.filter(g => g.you && g.review?.summary);
  const accs = mine.slice(0, 10).map(g => g.review.summary.acc[g.you]).filter(x => x != null);
  const avgAcc = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null;
  const bot = cur ? botById(cur.botId) : null;
  return (
    <div className="page fade-up space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        <a href={inGame ? '#/play/game' : '#/play'} className="card-link !p-6 !border-emerald-700/50 bg-gradient-to-br from-emerald-950/50 to-ink-900">
          <div className="h-sec !text-emerald-300">{inGame ? 'Game in progress' : 'Play'}</div>
          <div className="text-2xl font-semibold text-white mt-2">{inGame ? `vs ${bot.name}` : 'Play Stockfish'}</div>
          <div className="text-sm text-ink-300 mt-1">{inGame ? `${bot.max ? 'Max strength' : bot.elo} · move ${Math.ceil(cur.uci.length / 2)}` : 'Thirteen opponents from 400 to full-strength Stockfish 17.1.'}</div>
          <span className="btn btn-primary mt-4">{inGame ? 'Continue' : 'New game'}</span>
        </a>
        <a href={href('/puzzles/solve', { mode: 'daily' })} className="card-link !p-6">
          <div className="h-sec">Daily puzzle</div>
          <div className="text-2xl font-semibold text-white mt-2">{daily ? (daily.ok ? 'Solved ✓' : 'Missed. Try again?') : 'Ready for you'}</div>
          <div className="text-sm text-ink-300 mt-1">A new one every day, rated 1500–2100.</div>
          <span className="btn mt-4">{daily ? 'Open' : 'Solve'}</span>
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <a href="#/puzzles" className="stat hover:border-ink-500 transition"><div className="k">Puzzle rating</div><div className="v">{pr.ratings.rated}</div><div className="s">streak {pr.streak} · best {pr.best}</div></a>
        <a href="#/puzzles" className="stat hover:border-ink-500 transition"><div className="k">Visualize</div><div className="v">{pr.ratings.visual}</div><div className="s">{pr.plays.visual} played</div></a>
        <a href={due ? href('/puzzles/solve', { mode: 'review' }) : '#/puzzles'} className="stat hover:border-ink-500 transition"><div className="k">Mistakes to review</div><div className="v">{due}</div><div className="s">{pr.queue.length} in the queue</div></a>
        <a href="#/review/insights" className="stat hover:border-ink-500 transition"><div className="k">Game accuracy</div><div className="v">{avgAcc != null ? avgAcc.toFixed(1) : '–'}</div><div className="s">{accs.length ? `last ${accs.length} reviewed` : 'review a game'}</div></a>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <a href="#/train/scratch" className="card-link">
          <div className="h-sec !text-sky-300">Scratch pad</div>
          <div className="text-white font-semibold mt-1">Calculate on a board</div>
          <div className="text-sm text-ink-300 mt-1">Move pieces, see what they hit, grade your lines.</div>
        </a>
        <a href={href('/puzzles/solve', { mode: 'visual' })} className="card-link">
          <div className="h-sec !text-sky-300">Visualize</div>
          <div className="text-white font-semibold mt-1">See it without moving it</div>
          <div className="text-sm text-ink-300 mt-1">Puzzles where the first moves happen only in your head.</div>
        </a>
        <a href="#/review/import" className="card-link">
          <div className="h-sec">Import</div>
          <div className="text-white font-semibold mt-1">Your chess.com games</div>
          <div className="text-sm text-ink-300 mt-1">Fetch by username and get a full review of each.</div>
        </a>
      </div>

      {games.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2"><div className="h-sec">Recent games</div><a href="#/review" className="text-sm text-ink-300 hover:text-white">All games →</a></div>
          <div className="panel p-2 divide-y divide-ink-800">{games.slice(0, 5).map(g => <GameRow key={g.id} g={g} />)}</div>
        </section>
      )}
    </div>
  );
}
