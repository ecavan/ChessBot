/**
 * The bot ladder.
 *
 * 1400 and up: Stockfish's own strength limiter (UCI_LimitStrength + UCI_Elo), which is
 * calibrated against rated engines at rapid time controls; it plays like a steady human of about
 * that strength. Below that the limiter can't go (its floor is 1320), so weaker bots search
 * shallowly with several candidate lines and pick among them with a temperature, sometimes
 * playing a random move instead: they hang pieces and miss tactics the way beginners do.
 * "Stockfish" is full strength: every thread, the full network, a few seconds a move.
 */
import { Chess } from 'chess.js';
import { engine } from './engine.js';
import { cpOf } from '../lib/review.js';

export const BOTS = [
  { id: 'b400', elo: 400, name: 'Pawnstorm Pete', icon: '🐣', blurb: 'Just learned how the pieces move.', weak: { depth: 1, temp: 260, random: 0.3 } },
  { id: 'b600', elo: 600, name: 'Casual Cam', icon: '🙂', blurb: 'Knows the rules, hangs pieces.', weak: { depth: 2, temp: 190, random: 0.2 } },
  { id: 'b800', elo: 800, name: 'Club Night Kim', icon: '😎', blurb: 'Sees one-move threats, mostly.', weak: { depth: 3, temp: 130, random: 0.12 } },
  { id: 'b1000', elo: 1000, name: 'Improving Ivy', icon: '📚', blurb: 'Solid basics, misses tactics.', weak: { depth: 5, temp: 85, random: 0.06 } },
  { id: 'b1200', elo: 1200, name: 'Tactical Tom', icon: '⚔️', blurb: 'Finds forks, plays fast.', weak: { depth: 7, temp: 55, random: 0.03 } },
  { id: 'b1400', elo: 1400, name: 'Rapid Rosa', icon: '⏱️', blurb: 'A good club player.' },
  { id: 'b1600', elo: 1600, name: 'Positional Pia', icon: '🧭', blurb: 'Plans, pawn structure, patience.' },
  { id: 'b1800', elo: 1800, name: 'Expert Elena', icon: '🎯', blurb: 'Few mistakes. Punishes yours.' },
  { id: 'b2000', elo: 2000, name: 'Candidate Master', icon: '🏅', blurb: 'Strong everywhere.' },
  { id: 'b2200', elo: 2200, name: 'National Master', icon: '🎖️', blurb: 'Rarely blunders.' },
  { id: 'b2500', elo: 2500, name: 'Grandmaster', icon: '👑', blurb: 'Grandmaster strength.' },
  { id: 'b2800', elo: 2800, name: 'World Champion', icon: '🏆', blurb: 'Top-player strength.' },
  { id: 'max', elo: 3500, name: 'Stockfish 17.1', icon: '🐟', blurb: 'Full strength. Every thread, the full network.', max: true },
];
export const botById = (id) => BOTS.find(b => b.id === id) || BOTS[5];

/**
 * The bot's move for `fen` (UCI). thinkMs: how long a limited bot thinks (full strength uses more).
 */
export async function botMove(bot, fen, { tag = 'bot', stops = ['eval', 'hint', 'guard'] } = {}) {
  if (bot.max) {
    const r = await engine.search({ fen, movetime: 2500, tag, stops });
    return r?.bestmove || null;
  }
  if (!bot.weak) {
    const r = await engine.search({ fen, movetime: 600 + Math.random() * 500, elo: Math.min(3190, Math.max(1320, bot.elo)), tag, stops });
    return r?.bestmove || null;
  }
  const { depth, temp, random } = bot.weak;
  const g = new Chess(fen);
  const legal = g.moves({ verbose: true });
  if (!legal.length) return null;
  // a random move now and then — but never walk into mate in one, beginners see that much
  if (Math.random() < random) {
    const safe = legal.filter(m => { const h = new Chess(fen); h.move(m); return !h.moves({ verbose: true }).some(x => { const k = new Chess(h.fen()); k.move(x); return k.isCheckmate(); }); });
    const pool = safe.length ? safe : legal;
    await new Promise(r => setTimeout(r, 350 + Math.random() * 400));
    const m = pool[Math.floor(Math.random() * pool.length)];
    return m.from + m.to + (m.promotion || '');
  }
  const r = await engine.search({ fen, depth, multipv: Math.min(5, legal.length), tag, stops });
  if (!r?.lines?.length) return r?.bestmove || null;
  const white = fen.split(' ')[1] === 'w';
  const scored = r.lines.filter(l => l.pv?.length).map(l => ({ uci: l.pv[0], cp: (white ? 1 : -1) * cpOf(l) }));
  const top = Math.max(...scored.map(s => s.cp));
  const w = scored.map(s => Math.exp((s.cp - top) / temp));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  await new Promise(res => setTimeout(res, 250 + Math.random() * 350));
  for (let i = 0; i < scored.length; i++) { x -= w[i]; if (x <= 0) return scored[i].uci; }
  return scored[0].uci;
}
