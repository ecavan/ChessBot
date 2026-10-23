/** This week's plan (lib/plan.js), for Home and Insights. */
import { useState } from 'react';
import { weeklyPlan } from '../lib/plan.js';
import { lessonState } from './Lessons.jsx';

const KIND_TEXT = {
  hanging: 'left a piece where it could be taken, or missed one you could take',
  defend: 'missed what he was threatening (a fork, pin, skewer or mate)',
  mate1: 'missed a checkmate',
  fork: 'missed a fork',
  pin: 'missed a pin',
  skewer: 'missed a skewer',
  discovered: 'missed a discovered attack',
};

export default function PlanCard({ rows, compact = false }) {
  const [, bump] = useState(0);
  const plan = weeklyPlan(rows);
  if (!plan) {
    return compact ? null : (
      <div className="panel panel-pad text-sm text-ink-300">Review five or more of your games and you'll get a plan for the week here: the mistake that costs you most and the lesson that fixes it.</div>
    );
  }
  const l = plan.lessonData;
  const st = lessonState()[l.id] || {};
  const runs = (st.history || []).filter(h => h.at >= plan.start);
  const bestWeek = runs.length ? Math.max(...runs.map(h => h.score)) : null;
  const daysLeft = Math.max(0, Math.ceil((plan.start + 7 * 86400000 - Date.now()) / 86400000));
  const fmt = (x) => (x == null ? '–' : x.toFixed(1));
  const often = (x) => (x >= 0.95 && x < 1.05 ? 'about once a game' : x < 0.15 ? 'now and then' : `${x.toFixed(1)} times a game`);
  return (
    <div className="panel panel-pad !border-sky-700/50 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="h-sec !text-sky-300">This week · {daysLeft} day{daysLeft === 1 ? '' : 's'} left</div>
          <div className="text-xl font-semibold text-white mt-1">{l.title}</div>
          <p className="text-sm text-ink-300 mt-1 max-w-xl">In your last {plan.baseGames} games you {KIND_TEXT[l.id] || 'made this mistake'} {often(plan.base)}, more than any other mistake.</p>
        </div>
        <a className="btn btn-primary" href={`#/train/basics/${l.id}`}>{st.best >= 7 ? 'Practice' : 'Start the lesson'}</a>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="stat !p-2.5"><div className="k">Lesson</div><div className="text-lg font-semibold text-white num">{st.best != null ? `${st.best}/10` : '–'}</div><div className="s">{st.best >= 7 ? 'done' : 'best score'}</div></div>
        <div className="stat !p-2.5"><div className="k">Practice</div><div className="text-lg font-semibold text-white num">{runs.length}/3</div><div className="s">{bestWeek != null ? `this week, best ${bestWeek}/10` : 'runs this week'}</div></div>
        <div className="stat !p-2.5"><div className="k">In games since</div><div className="text-lg font-semibold text-white num">{plan.since.games ? fmt(plan.since.rate) : '–'}</div><div className="s">{plan.since.games ? `a game over ${plan.since.games} (was ${fmt(plan.base)})` : 'play or import a game'}</div></div>
      </div>
      {!compact && <button className="btn btn-quiet btn-sm" onClick={() => { weeklyPlan(rows, { renew: true }); bump(x => x + 1); }}>Pick a new focus now</button>}
    </div>
  );
}
