/**
 * The bot ladder, labelled on chess.com's rating scale.
 *
 * Up to 1400 the bots are human-like: Maia (McIlroy-Young et al., 2020), a network trained on
 * millions of real games to predict the move a player of a given level actually makes. It plays
 * the natural moves and makes the natural mistakes (hangs pieces to forks, misses backward moves),
 * where a throttled engine makes engine-shaped ones. Each rung is a Maia level and a temperature:
 * the move is drawn from the model's probabilities raised to 1/temperature, so above 1 it strays
 * to the moves weaker players pick more often, and below 1 it sticks to the main ones.
 *
 * The labels are measured, not the nets' names (Maia's own levels are lichess ratings, several
 * hundred points above chess.com's at the bottom): scripts/qa/bot-match.mjs plays the settings
 * against each other for the spacing, and scripts/qa/bot-arena.mjs reviews their games next to
 * real chess.com games for the anchor (the accuracy players of each rating average). See
 * docs/BOTS.md for the numbers.
 *
 * Above that: Stockfish's own strength limiter (UCI_LimitStrength + UCI_Elo), shifted by the
 * measured gap between its scale and the ladder's. "Stockfish" is full strength.
 */
import { Chess } from 'chess.js';
import { engine } from './engine.js';
import { fensFromUci } from './maia.js';
import { maiaPredict } from './maiaClient.js';

const human = (elo, maia, temp, name, icon, blurb) => ({ id: `h${elo}`, elo, maia, temp, name, icon, blurb, human: true });
const sf = (elo, uciElo, name, icon, blurb) => ({ id: `e${elo}`, elo, uciElo, name, icon, blurb });
// PROVISIONAL settings: the matches that space the rungs are still running (see docs/BOTS.md once written).
export const BOTS = [
  human(200, 1100, 2.5, 'Pawnstorm Pete', '🐣', 'Just learned how the pieces move.'),
  human(300, 1100, 2, 'Casual Cam', '🙂', 'Knows the rules, hangs pieces.'),
  human(400, 1100, 1.25, 'Club Night Kim', '😎', 'Sees one-move threats, mostly.'),
  human(500, 1100, 1, 'Improving Ivy', '📚', 'Takes what you leave hanging.'),
  human(600, 1100, 0.7, 'Tactical Tom', '⚔️', 'Finds forks, plays fast.'),
  human(800, 1300, 1, 'Steady Sam', '🧑', 'Fewer gifts. Still misses tactics.'),
  human(1000, 1500, 1, 'Rapid Rosa', '⏱️', 'A decent club player.'),
  human(1200, 1700, 1, 'Positional Pia', '🧭', 'Plans, pawn structure, patience.'),
  human(1400, 1900, 0.7, 'Expert Elena', '🎯', 'Few mistakes. Punishes yours.'),
  sf(1600, 1600, 'Engine 1600', '🤖', 'Stockfish held to about 1600.'),
  sf(1800, 1800, 'Engine 1800', '🤖', 'Stockfish held to about 1800.'),
  sf(2000, 2000, 'Candidate Master', '🏅', 'Strong everywhere.'),
  sf(2200, 2200, 'National Master', '🎖️', 'Rarely blunders.'),
  sf(2500, 2500, 'Grandmaster', '👑', 'Grandmaster strength.'),
  sf(2800, 2800, 'World Champion', '🏆', 'Top-player strength.'),
  { id: 'max', elo: 3500, name: 'Stockfish 17.1', icon: '🐟', blurb: 'Full strength. Every thread, the full network.', max: true },
];
export const HUMAN_BOTS = BOTS.filter(b => b.human);
export const ENGINE_BOTS = BOTS.filter(b => !b.human);
export const ALL_BOTS = BOTS;
/** Bots from before the ladder was re-measured, by the rung that plays most like them now. */
const LEGACY = { b400: 'h400', b600: 'h500', b800: 'h500', b1000: 'h1000', b1200: 'h1200', b1400: 'h1400', b1600: 'e1600', b1800: 'e1800', b2000: 'e2000', b2200: 'e2200', b2500: 'e2500', b2800: 'e2800', maia1100: 'h500', maia1300: 'h800', maia1500: 'h1000', maia1700: 'h1200', maia1900: 'h1400' };
export const botById = (id) => BOTS.find(b => b.id === id) || BOTS.find(b => b.id === LEGACY[id]) || BOTS.find(b => b.elo === 400) || BOTS[0];
/** The rung closest to a rating (your chess.com rating, say). */
export const botNear = (rating) => BOTS.filter(b => !b.max).reduce((a, b) => (Math.abs(b.elo - rating) < Math.abs(a.elo - rating) ? b : a));

/**
 * The bot's move for `fen` (UCI). thinkMs: how long a limited bot thinks (full strength uses more).
 */
export async function botMove(bot, fen, { tag = 'bot', stops = ['eval', 'hint', 'guard', 'coach'], uci = null, startFen = null } = {}) {
  if (bot.maia) {
    // the human model: its context is the game so far (lc0 sees the last eight positions)
    const fens = uci ? fensFromUci(startFen, uci) : [fen];
    if (fens[fens.length - 1].split(' ').slice(0, 4).join(' ') !== fen.split(' ').slice(0, 4).join(' ')) fens.push(fen);
    if (!new Chess(fen).moves().length) return null;
    const [{ moves }] = await Promise.all([maiaPredict(bot.maia, fens), new Promise(r => setTimeout(r, 300 + Math.random() * 500))]);
    // draw from the model's probabilities, flattened or sharpened by the rung's temperature
    const t = bot.temp || 1;
    const ws = moves.map(m => Math.pow(m.p, 1 / t));
    let x = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < moves.length; i++) { x -= ws[i]; if (x <= 0) return moves[i].uci; }
    return moves[0]?.uci || null;
  }
  if (bot.max) {
    const r = await engine.search({ fen, movetime: 2500, tag, stops });
    return r?.bestmove || null;
  }
  const r = await engine.search({ fen, movetime: 600 + Math.random() * 500, elo: Math.min(3190, Math.max(1320, bot.uciElo || bot.elo)), tag, stops });
  return r?.bestmove || null;
}
