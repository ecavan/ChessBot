// Run: node test/review.test.mjs — classification, level stats, clocks, chess.com import filter, mistake puzzles.
import { Chess } from 'chess.js';
// an in-memory localStorage so the stores work under node
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { classifyGame, levelStats, winPct, clsWin, gameRating } = await import('../src/lib/review.js');
const { clocksOf, timeSpent, importChessComGames, allGames, clearGames } = await import('../src/lib/games.js');
const { addMistakePuzzles, dueMine, recordMine, progress } = await import('../src/lib/puzzles.js');

let fails = 0;
const check = (name, cond, got) => { if (!cond) { fails++; console.log('FAIL', name, '\n   ', got); } else console.log('ok  ', name, '|', typeof got === 'string' ? got : JSON.stringify(got)); };

// --- classification: the eval after a move comes from the same search when the move was PV1/PV2
{
  const g = new Chess();
  const fen0 = g.fen();
  const m = g.move('e4');
  const fen1 = g.fen();
  // PV1 played: drop is 0 whatever the next search says
  let cls = classifyGame([{ fen: fen0, lines: [{ cp: 30, pv: ['e2e4'] }, { cp: 25, pv: ['d2d4'] }] }, { fen: fen1, lines: [{ cp: -80, pv: ['e7e5'] }] }], [m]);
  check('pv1 → best, drop 0, source pv1', cls[0].cls === 'best' && cls[0].drop === 0 && cls[0].source === 'pv1', cls[0]);
  // PV2 played: its own eval from the same search, not the next position's
  const g2 = new Chess(); const m2 = g2.move('d4');
  cls = classifyGame([{ fen: fen0, lines: [{ cp: 30, pv: ['e2e4'] }, { cp: 25, pv: ['d2d4'] }] }, { fen: g2.fen(), lines: [{ cp: -200, pv: ['d7d5'] }] }], [m2]);
  check('pv2 → same-search eval (drop < 1), Excellent: only the first choice is Best', cls[0].source === 'pv2' && cls[0].drop < 1 && cls[0].cls === 'excellent', cls[0]);
  // other move: next search, negated for Black's reply
  const g3 = new Chess(); const m3 = g3.move('f3');
  cls = classifyGame([{ fen: fen0, lines: [{ cp: 30, pv: ['e2e4'] }, { cp: 25, pv: ['d2d4'] }] }, { fen: g3.fen(), lines: [{ cp: -300, pv: ['e7e5'] }] }], [m3]);
  check('other → next-search eval, blunder', cls[0].source === 'next' && cls[0].cls === 'blunder' && Math.abs(cls[0].drop - (clsWin(30) - clsWin(-300))) < 1e-9, cls[0]);
}
// --- mate handling: losing a forced mate is a miss; a slower mate is never a blunder
{
  // White to move, mate in 1 available (Qh7#? use a known position): r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR
  const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  const g = new Chess(fen); const m = g.move('Nf3');
  let cls = classifyGame([{ fen, lines: [{ mate: 1, pv: ['h5f7'] }, { cp: 100, pv: ['g1f3'] }] }, { fen: g.fen(), lines: [{ cp: -100, pv: ['g7g6'] }] }], [m]);
  check('mate let go → miss', cls[0].cls === 'miss', cls[0].cls);
  const g2 = new Chess(fen); const m2 = g2.move('Qxf7+');
  cls = classifyGame([{ fen, lines: [{ mate: 1, pv: ['h5f7'] }] }, { fen: g2.fen(), lines: [], terminal: 10000 }], [m2]);
  check('mate delivered → best', cls[0].cls === 'best', cls[0].cls);
  // mate kept but slower (mate 1 → mate 5 by the next search): not a blunder
  const g3 = new Chess(fen); const m3 = g3.move('Bxf7+');
  cls = classifyGame([{ fen, lines: [{ mate: 1, pv: ['h5f7'] }, { cp: 500, pv: ['b1c3'] }] }, { fen: g3.fen(), lines: [{ mate: 5, pv: ['e8e7'] }] }], [m3]);
  check('slower mate is not a blunder', !['blunder', 'mistake', 'miss'].includes(cls[0].cls), cls[0].cls);
}
// --- game rating: the player's rating, moved by the accuracy (chess.com's way)
{
  const at = (acc, rating, timeClass) => gameRating(acc, { rating, timeClass });
  check('about par at 64 accuracy', Math.abs(at(64, 300) - 300) <= 50, at(64, 300));
  check('a clean game: several hundred above', at(86, 300) >= 850 && at(86, 300) <= 1050, at(86, 300));
  check('a poor game: on the floor', at(50, 300) === 100, at(50, 300));
  check('moves with the player\'s rating', at(80, 1000) - at(80, 300) === 700, [at(80, 1000), at(80, 300)]);
  check('daily is held to a higher standard', at(80, 1000, 'daily') < at(80, 1000, 'blitz'), null);
  check('no accuracy → null', gameRating(null, { rating: 300 }) === null, null);
}

// --- your rating against the bots
{
  const { expectedScore, kFactor, preview } = await import('../src/lib/ladder.js');
  check('even match → 50%', Math.abs(expectedScore(800, 800) - 0.5) < 1e-9, expectedScore(800, 800));
  const first = preview(null, 600, 1);
  check('the first game starts at the bot\'s rating', first.before === 600 && first.after === 620, first);
  const st = { rating: 600, n: 12 };
  const up = preview(st, 1000, 1), easy = preview(st, 300, 1), bad = preview(st, 300, 0);
  check('beating a stronger bot is worth more', up.delta > easy.delta && easy.delta >= 0, { up: up.delta, easy: easy.delta });
  check('losing to a weaker bot costs more than beating it gains', -bad.delta > easy.delta, { bad: bad.delta, easy: easy.delta });
  check('K steps down 40 → 24 → 16', kFactor(0) === 40 && kFactor(10) === 24 && kFactor(30) === 16, null);
  check('never under 100', preview({ rating: 100, n: 50 }, 200, 0).after >= 100, null);
}

// --- phases
{
  const { phaseAccuracy, phaseGrade } = await import('../src/lib/review.js');
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const fens = [], cls = [];
  for (let i = 0; i < 12; i++) { fens.push(`${start} ${i % 2 ? 'b' : 'w'} KQkq - 0 ${1 + (i >> 1)}`); cls.push({ acc: i % 2 ? 50 : 95 }); }
  const ph = phaseAccuracy(cls, fens);
  check('opening accuracy per side', ph.opening.w.n === 6 && ph.opening.w.acc > 90 && ph.opening.b.acc < 55, ph.opening);
  check('a phase nobody reached is null', ph.endgame.w === null && ph.middlegame.b === null, ph);
  check('grades read as move classes', phaseGrade(95) === 'best' && phaseGrade(60) === 'inaccuracy' && phaseGrade(20) === 'blunder', null);
}

// --- level with its uncertainty
{
  const s = levelStats([600, 800, 1000, 700, 900, 650, 850, 750, 950, 800]);
  check('level mean rounded to 50', s.level === 800, s);
  check('± is the spread over √n', s.se >= 20 && s.se <= 60, s.se);
  check('too few games → null', levelStats([600, 800]) === null, levelStats([600, 800]));
}
// --- clocks from a chess.com-style PGN
{
  const pgn = '[Event "Live Chess"]\n[TimeControl "600"]\n\n1. e4 {[%clk 0:09:58.1]} 1... e5 {[%clk 0:09:55]} 2. Nf3 {[%clk 0:09:50.5]} 2... Nc6 {[%clk 0:09:40]} 1/2-1/2';
  const c = clocksOf(pgn, 4);
  check('clocks parsed', c && c.length === 4 && Math.abs(c[0] - 598.1) < 1e-9 && c[3] === 580, c);
  check('clocks null when count mismatches', clocksOf(pgn, 5) === null, clocksOf(pgn, 5));
  const t = timeSpent({ clocks: c, timeControl: '600', startFen: undefined }, 'b');
  check('time spent by Black', t.length === 2 && t[0].spent === 5 && t[1].spent === 15, t);
}
// --- chess.com sync filter
{
  clearGames();
  const pgn = (w, b, n) => `[Event "Live Chess"]\n[Site "Chess.com"]\n[Date "2026.10.0${n}"]\n[White "${w}"]\n[Black "${b}"]\n[Result "1-0"]\n[Link "https://www.chess.com/game/live/${n}"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`;
  const raw = [
    { pgn: pgn('eli', 'a', 1), time_class: 'rapid', rules: 'chess', end_time: 100 },
    { pgn: pgn('b', 'eli', 2), time_class: 'bullet', rules: 'chess', end_time: 200 },
    { pgn: pgn('eli', 'c', 3), time_class: 'rapid', rules: 'chess960', end_time: 300 },
    { pgn: pgn('eli', 'd', 4), time_class: 'rapid', rules: 'chess', end_time: 50 },
    { pgn: pgn('eli', 'e', 5), time_class: 'blitz', rules: 'chess', end_time: 400 },
  ];
  const r = importChessComGames(raw, 'eli', { timeClasses: ['rapid', 'blitz'], after: 60 });
  check('only rapid/blitz standard games newer than `after`', r.added === 2 && r.newest === 400, { added: r.added, newest: r.newest, games: r.games.map(g => g.black) });
  check('side detected', r.games.every(g => g.you === 'w'), r.games.map(g => g.you));
  const again = importChessComGames(raw, 'eli', { timeClasses: ['rapid', 'blitz'], after: 60 });
  check('re-import dedupes', again.added === 0 && again.skipped === 2, again);
  const noTc = importChessComGames(raw, 'eli', { timeClasses: ['bullet'], after: 0 });
  check('bullet when asked', noTc.added === 1, noTc.added);
  check('store sorted newest first', allGames()[0].at >= allGames()[allGames().length - 1].at, allGames().map(g => g.date));
}
// --- your mistakes as puzzles
{
  const g = new Chess();
  const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5']; // 4. Nxe5?? walks into Qg5
  const fens = [g.fen()]; const moves = [];
  for (const s of sans) { moves.push(g.move(s)); fens.push(g.fen()); }
  const cls = moves.map((m, i) => ({ cls: i === 6 ? 'blunder' : 'best', drop: i === 6 ? 40 : 0, bestUci: i === 6 ? 'f3d4' : null, bestLine: i === 6 ? ['f3d4', 'e5d4'] : [] }));
  const game = { id: 'test1', you: 'w', white: 'eli', black: 'bob', date: '2026.10.09' };
  const n = addMistakePuzzles(game, { fens, moves, cls });
  check('one puzzle from one blunder', n === 1, n);
  const d = dueMine();
  check('due now, opponent move then the best move', d.length === 1 && d[0].p.moves[0] === 'c6d4' && d[0].p.moves[1] === 'f3d4' && d[0].p.fen === fens[5], d[0]?.p);
  recordMine(d[0].p, true);
  check('right → scheduled later', dueMine().length === 0 && progress().mine[0].box === 1, progress().mine[0]);
  check('no duplicate on re-add', addMistakePuzzles(game, { fens, moves, cls }) === 0, progress().mine.length);
}
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
