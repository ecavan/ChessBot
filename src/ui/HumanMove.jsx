/**
 * The practical move: what strong club players (Maia 1900) actually play in this position, next
 * to the engine's best. When the engine's move is one almost nobody finds and the human move is
 * nearly as good, say so: "how did the computer find that" has an answer — it didn't have to.
 */
import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { maiaPredict } from '../engine/maiaClient.js';
import { MAIA_LEVELS } from '../engine/maia.js';
import { lessonById } from '../data/lessons.js';
import { winPct, cpOf } from '../lib/review.js';

const HUMAN = 1900;

/**
 * fens: the game's positions up to and including the one before the move; lines: the engine's two
 * lines for that position (White's view); played: the uci played (optional, for context).
 */
export default function HumanMove({ fens, lines, played = null, lesson = null }) {
  const [r, setR] = useState(null);
  const [levels, setLevels] = useState(null); // p(played) at each Maia level
  const fen = fens[fens.length - 1];
  useEffect(() => {
    let live = true;
    setR(null); setLevels(null);
    maiaPredict(HUMAN, fens).then(({ moves }) => { if (live) setR(moves); }).catch(() => { if (live) setR(false); });
    if (played) {
      Promise.all(MAIA_LEVELS.map(lv => maiaPredict(lv, fens).then(({ moves }) => moves.find(m => m.uci === played)?.p ?? 0)))
        .then(ps => { if (live) setLevels(ps); }).catch(() => {});
    }
    return () => { live = false; };
  }, [fen, played]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r || !lines?.[0]?.pv?.[0]) return null;
  const white = fen.split(' ')[1] === 'w';
  const pov = (cp) => (white ? cp : -cp);
  const best = lines[0].pv[0];
  const human = r[0];
  const pBest = r.find(x => x.uci === best)?.p ?? 0;
  const san = (uci) => { try { return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san; } catch { return uci; } };
  // what the human move costs, when the engine looked at it (its second line)
  let cost = null;
  if (human.uci === best) cost = 0;
  else if (lines[1]?.pv?.[0] === human.uci) cost = Math.max(0, winPct(pov(cpOf(lines[0]))) - winPct(pov(cpOf(lines[1]))));
  const pct = (p) => `${Math.round(100 * p)}%`;
  let text;
  if (human.uci === best) {
    text = pBest >= 0.3
      ? <>Strong players find this one: <b className="text-ink-100">{pct(pBest)}</b> of 1900s play {san(best)} here.</>
      : <>Even strong players rarely see it: only <b className="text-ink-100">{pct(pBest)}</b> of 1900s play {san(best)}; the rest spread over {r.slice(1, 3).map(x => `${x.san} (${pct(x.p)})`).join(', ')}.</>;
  } else if (cost != null && cost <= 10) {
    text = <>The practical move: <b className="text-emerald-200">{human.san}</b>, what <b className="text-ink-100">{pct(human.p)}</b> of 1900s play{cost <= 2 ? ', and just as good' : `, worth about ${Math.round(cost)}% less`}. The engine's {san(best)} is found by {pct(pBest)} of them.</>;
  } else {
    text = <>Most 1900s play <b className="text-ink-100">{human.san}</b> here ({pct(human.p)}); the engine's {san(best)} is found by {pct(pBest)} of them.</>;
  }
  const mine = played && played !== best && played !== human.uci ? r.find(x => x.uci === played) : null;
  // where players stop making this move: the first level at which fewer than 1 in 12 play it
  let grow = null;
  if (levels && played && played !== best) {
    const first = levels.findIndex(p => p < 0.08);
    const peak = Math.max(...levels);
    if (peak < 0.08) grow = 'Rare at every level: a slip, not a habit.';
    else if (first < 0) grow = `Even 1900s play this ${pct(levels[levels.length - 1])} of the time: a hard spot, not a habit.`;
    else if (first === 0) grow = `Uncommon even at 1100 (${pct(levels[0])}).`;
    else grow = `A move players grow out of: ${pct(levels[0])} of 1100s play it, ${pct(levels[first])} of ${MAIA_LEVELS[first]}s.`;
  }
  const les = lesson ? lessonById(lesson) : null;
  return (
    <div className="text-xs text-ink-300 mt-1.5 space-y-1">
      <p><span className="text-sky-300 font-semibold">Human move</span> {text}{mine ? <> Your {san(played)}: {pct(mine.p)} of them.</> : null}</p>
      {grow && <p><span className="text-amber-300 font-semibold">Your level</span> {grow}{les ? <> The lesson for it: <a className="underline" href={`#/train/basics/${les.id}`}>{les.title}</a>.</> : null}</p>}
    </div>
  );
}
