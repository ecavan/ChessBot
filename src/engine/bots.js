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
// rating, Maia level, temperature: read off the measured strength of each setting (docs/BOTS.md)
export const BOTS = [
  human(200, 1100, 2.6, 'Pawnstorm Pete', '🐣', 'Just learned how the pieces move.'),
  human(300, 1100, 2.35, 'Casual Cam', '🙂', 'Knows the rules, hangs pieces.'),
  human(400, 1100, 2.0, 'Weekend Wes', '🧢', 'Takes what is free, when he sees it.'),
  human(500, 1100, 1.85, 'Club Night Kim', '😎', 'Sees one-move threats, mostly.'),
  human(600, 1100, 1.7, 'Lunch Break Lou', '🥪', 'Develops, castles, then drifts.'),
  human(700, 1100, 1.53, 'Improving Ivy', '📚', 'Solid basics, misses tactics.'),
  human(800, 1100, 1.3, 'Steady Sam', '🧑', 'Fewer gifts. Still walks into forks.'),
  human(900, 1100, 1.05, 'Tactical Tom', '⚔️', 'Finds forks, plays fast.'),
  human(1000, 1100, 0.84, 'Rapid Rosa', '⏱️', 'A decent club player.'),
  human(1100, 1100, 0.55, 'Careful Cora', '🔎', 'Checks for threats before moving.'),
  human(1200, 1500, 0.7, 'Positional Pia', '🧭', 'Plans, pawn structure, patience.'),
  human(1300, 1900, 0.32, 'Tournament Tess', '🏟️', 'Plays the main moves and waits for yours.'),
  human(1400, 1900, 0.1, 'Expert Elena', '🎯', 'Few mistakes. Punishes yours.'),
  sf(1600, 2000, 'Engine 1600', '🤖', 'Stockfish held to about 1600.'),
  sf(1800, 2200, 'Engine 1800', '🤖', 'Stockfish held to about 1800.'),
  sf(2000, 2400, 'Candidate Master', '🏅', 'Strong everywhere.'),
  sf(2200, 2550, 'National Master', '🎖️', 'Rarely blunders.'),
  sf(2500, 2800, 'Grandmaster', '👑', 'Grandmaster strength.'),
  sf(2800, 3050, 'World Champion', '🏆', 'Top-player strength.'),
  { id: 'max', elo: 3500, name: 'Stockfish 17.1', icon: '🐟', blurb: 'Full strength. Every thread, the full network.', max: true },
];
export const HUMAN_BOTS = BOTS.filter(b => b.human);
export const ENGINE_BOTS = BOTS.filter(b => !b.human);
export const ALL_BOTS = BOTS;
/** Bots from before the ladder was re-measured, by the rung that plays most like them now. */
const LEGACY = { b400: 'h400', b600: 'h600', b800: 'h800', b1000: 'h1000', b1200: 'h1200', b1400: 'h1000', b1600: 'h1200', b1800: 'h1400', b2000: 'e1600', b2200: 'e1800', b2500: 'e2200', b2800: 'e2500', maia1100: 'h900', maia1300: 'h900', maia1500: 'h1100', maia1700: 'h1100', maia1900: 'h1000' };
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
