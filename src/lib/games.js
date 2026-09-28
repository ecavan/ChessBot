/**
 * Saved games: games played here (vs a bot, or watched) and imported ones (PGN paste, chess.com,
 * Lichess). Each keeps its moves as UCI plus SAN, the headers, and the engine review once it has
 * been run (so reviewing again is instant).
 *
 * game = {
 *   id, source: 'bot'|'watch'|'import'|'chesscom'|'lichess', at (ms), date ('YYYY.MM.DD'),
 *   white, black, whiteElo?, blackElo?, result ('1-0'|'0-1'|'1/2-1/2'|'*'), how?,
 *   you: 'w'|'b'|null, startFen, uci: [...], san: [...], url?, timeControl?,
 *   review?: { ms, positions: [{ lines: [{cp?, mate?, pv}] , terminal? }], summary }
 * }
 */
import { Chess } from 'chess.js';
import { load, save, KEYS } from './store.js';
import { START, uciOf, parsePgn, splitPgns, toPgn } from './chessutil.js';

let games = load(KEYS.games, []);
const subs = new Set();
const emit = () => { for (const f of subs) f(games); };
export const subscribeGames = (f) => { subs.add(f); return () => subs.delete(f); };
export const allGames = () => games;
export const getGame = (id) => games.find(g => g.id === id);

function persist() {
  games = games.slice(0, 400);
  let ok = save(KEYS.games, games);
  // out of room: drop the stored reviews of the oldest games until it fits
  for (let i = games.length - 1; !ok && i >= 0; i--) {
    if (games[i].review) { games[i] = { ...games[i], review: undefined }; ok = save(KEYS.games, games); }
  }
  emit();
  return ok;
}

export function saveGame(g) {
  const i = games.findIndex(x => x.id === g.id);
  if (i >= 0) games[i] = g; else games = [g, ...games];
  games.sort((a, b) => b.at - a.at);
  persist();
  return g;
}
export function deleteGame(id) { games = games.filter(g => g.id !== id); persist(); }
export function clearGames() { games = []; persist(); }

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '.');

/** A game played in the app. moves = chess.js verbose moves. */
export function recordPlayed({ id, source = 'bot', white, black, you, startFen = START, moves, result, how, whiteElo, blackElo }) {
  return saveGame({
    id: id || newId(), source, at: Date.now(), date: today(), white, black, whiteElo, blackElo, result, how, you,
    startFen, uci: moves.map(uciOf), san: moves.map(m => m.san),
  });
}

/** Parse a PGN into a game record (not saved). `me` = usernames to recognise which side you were. */
function fromPgn(text, source, me = []) {
  const { headers, startFen, moves } = parsePgn(text);
  const variant = (headers.Variant || 'Standard').toLowerCase();
  if (!['standard', 'from position'].includes(variant)) throw new Error(`${headers.Variant} games can't be reviewed.`);
  const lower = me.filter(Boolean).map(s => s.toLowerCase());
  const white = headers.White || 'White', black = headers.Black || 'Black';
  const you = lower.includes(white.toLowerCase()) ? 'w' : lower.includes(black.toLowerCase()) ? 'b' : null;
  let at = Date.now();
  const d = (headers.UTCDate || headers.Date || '').replace(/\./g, '-');
  const t = headers.UTCTime || headers.StartTime || '00:00:00';
  if (/^\d{4}-\d\d-\d\d$/.test(d)) { const x = Date.parse(`${d}T${t}Z`); if (!Number.isNaN(x)) at = x; }
  const how = headers.Termination || '';
  const link = headers.Link || (headers.Site?.startsWith('http') ? headers.Site : null);
  return {
    id: link ? `u:${link}` : `p:${hash(moves.map(uciOf).join(' ') + white + black + d)}`,
    source, at, date: (headers.Date || today()), white, black,
    whiteElo: headers.WhiteElo ? Number(headers.WhiteElo) || undefined : undefined,
    blackElo: headers.BlackElo ? Number(headers.BlackElo) || undefined : undefined,
    result: headers.Result || '*', how, you, startFen,
    uci: moves.map(uciOf), san: moves.map(m => m.san),
    url: link || undefined,
    timeControl: headers.TimeControl, event: headers.Event,
  };
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
}

/** Import pasted PGN text (one or several games). Returns { added, skipped, errors }. */
export function importPgnText(text, source = 'import', me = []) {
  let added = 0, skipped = 0;
  const errors = [];
  const out = [];
  for (const one of splitPgns(text)) {
    try {
      const g = fromPgn(one, source, me);
      if (games.some(x => x.id === g.id)) { skipped++; continue; }
      games.push(g); out.push(g); added++;
    } catch (e) { errors.push(e.message); }
  }
  games.sort((a, b) => b.at - a.at);
  persist();
  return { added, skipped, errors, games: out };
}

/** Recent games from chess.com's public API (no login needed). */
export async function fetchChessCom(user, months = 1) {
  const u = user.trim().toLowerCase();
  const r = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(u)}/games/archives`);
  if (r.status === 404) throw new Error(`No chess.com player called "${user}".`);
  if (!r.ok) throw new Error('chess.com did not answer. Try again in a minute.');
  const { archives = [] } = await r.json();
  if (!archives.length) return { added: 0, skipped: 0, errors: [] };
  const pick = archives.slice(-months);
  let text = '';
  for (const url of pick) {
    const m = await fetch(url);
    if (!m.ok) continue;
    const { games: gs = [] } = await m.json();
    for (const g of gs) if (g.pgn && (g.rules || 'chess') === 'chess') text += g.pgn.trim() + '\n\n';
  }
  return importPgnText(text, 'chesscom', [user]);
}

/** Recent games from Lichess (public API). */
export async function fetchLichess(user, max = 40) {
  const r = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(user.trim())}?max=${max}&perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence&clocks=false&evals=false&opening=false`, { headers: { Accept: 'application/x-chess-pgn' } });
  if (r.status === 404) throw new Error(`No Lichess player called "${user}".`);
  if (!r.ok) throw new Error('Lichess did not answer. Try again in a minute.');
  const text = await r.text();
  return importPgnText(text.replace(/\n\n\n+/g, '\n\n'), 'lichess', [user]);
}

/** PGN for a stored game. */
export function gamePgn(g) {
  const h = { Event: g.event || (g.source === 'bot' ? 'vs Stockfish' : 'Game'), Date: g.date, White: g.white, Black: g.black, Result: g.result };
  if (g.whiteElo) h.WhiteElo = g.whiteElo;
  if (g.blackElo) h.BlackElo = g.blackElo;
  if (g.url) h.Link = g.url;
  return toPgn(h, g.san, g.startFen);
}

/** FENs of every position of a game (length = moves + 1) plus the verbose moves. */
export function replay(g) {
  const c = new Chess(g.startFen || START);
  const fens = [c.fen()];
  const moves = [];
  for (const u of g.uci) {
    let m;
    try { m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; }
    moves.push(m);
    fens.push(c.fen());
  }
  return { fens, moves, game: c };
}

export function resultFor(g, side) {
  if (g.result === '1/2-1/2') return 'draw';
  if (g.result === '1-0') return side === 'w' ? 'win' : 'loss';
  if (g.result === '0-1') return side === 'b' ? 'win' : 'loss';
  return 'unfinished';
}
