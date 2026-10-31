// Run: node test/coach.test.mjs
import { Chess } from 'chess.js';
import { explainMove, motifOf, describeThreat, planIdeas, nullFen, lines, forkAt } from '../src/lib/coach.js';

const fenAfter = (sans) => { const g = new Chess(); for (const s of sans.split(' ').filter(Boolean)) g.move(s); return g.fen(); };
const uci = (fen, san) => { const g = new Chess(fen); const m = g.move(san); return m.from + m.to + (m.promotion || ''); };
let fails = 0;
const check = (name, cond, got) => { if (!cond) { fails++; console.log('FAIL', name, '\n   ', got); } else console.log('ok  ', name, '|', typeof got === 'string' ? got : JSON.stringify(got)); };

// 1. walking into mate
{
  const f = fenAfter('e4 e5 Bc4 Nc6 Qh5');
  const r = explainMove(f, uci(f, 'Nf6'), { cls: 'blunder', bestUci: uci(f, 'g6'), afterLine: ['h5f7'], bestLine: [uci(f, 'g6')] });
  check('allows mate', r.points.some(p => /mate/.test(p)), r.points);
  check('mate text has no weird doubling', !r.points.some(p => /After this, After/.test(p)), r.points);
}
// 2. the fork after Nxe5?? Qg5
{
  const f = fenAfter('e4 e5 Nf3 Nc6 Bc4 Nd4');
  const r = explainMove(f, uci(f, 'Nxe5'), { cls: 'blunder', bestUci: uci(f, 'Nxd4'), afterLine: ['d8g5', 'e5f7', 'g5g2', 'h1f1', 'g2e4', 'c4e2', 'd4f3'] });
  check('Qg5 fork explained', r.points.some(p => /forks/.test(p) && /Qg5/.test(p)), r.points);
}
// 3. knight fork motif
{
  const f = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
  check('Nc7+ fork', /forks the king and rook/.test(motifOf(f, 'b5c7') || ''), motifOf(f, 'b5c7'));
}
// 4. early queen
{
  const f = fenAfter('e4 e5');
  const r = explainMove(f, uci(f, 'Qh5'), { cls: 'inaccuracy', bestUci: uci(f, 'Nf3'), afterLine: [] , bestLine: [] });
  check('early queen', r.points.some(p => /queen comes out/.test(p)), r.points);
}
// 5. f3 weakening
{
  const f = fenAfter('e4 e5');
  const r = explainMove(f, uci(f, 'f3'), { cls: 'inaccuracy', bestUci: uci(f, 'Nf3'), afterLine: [], bestLine: [] });
  check('f3 weakens', r.points.some(p => /f-pawn/.test(p)), r.points);
}
// 6. pawn in front of castled king
{
  const f = fenAfter('e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 d6 c3 O-O');
  const r = explainMove(f, uci(f, 'g4'), { cls: 'mistake', bestUci: uci(f, 'Re1'), afterLine: [], bestLine: [] });
  check('g4 weakens king', r.points.some(p => /in front of your king/.test(p)), r.points);
}
// 7. development and castling praise
{
  const f = fenAfter('e4 e5');
  const r = explainMove(f, uci(f, 'Nf3'), { cls: 'best' });
  check('develops', r.points.some(p => /Develops the knight toward the centre/.test(p)), r.points);
  const f2 = fenAfter('e4 e5 Nf3 Nc6 Bc4 Bc5');
  const r2 = explainMove(f2, uci(f2, 'O-O'), { cls: 'best' });
  check('castles', r2.points.some(p => /Castles/.test(p)), r2.points);
}
// 8. threat: Qxf7# threatened
{
  const f = fenAfter('e4 e5 Bc4 Nc6 Qh5'); // black to move, white threatens Qxf7#
  const nf = nullFen(f);
  const t = describeThreat(f, ['h5f7'], 10000);
  check('threat of mate', t && /mate/.test(t.text), t);
}
// 9. pin
{
  const f = fenAfter('e4 e5 Nf3 Nc6 Bc4 d6 Nc3');
  check('Bg4 pins', /pins the knight on f3 to the queen/.test(motifOf(f, uci(f, 'Bg4')) || ''), motifOf(f, uci(f, 'Bg4')));
}
// 10. plans in a quiet Italian
{
  const f = fenAfter('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3 h6 Nbd2 Re8');
  const p = planIdeas(f, 'w', [uci(f, 'Nf1')]);
  check('plans exist', p.ideas.length >= 1, p.ideas.map(i => i.title + ': ' + i.text));
}
// 11. missed tactic
{
  const f = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
  const r = explainMove(f, 'e1e2', { cls: 'miss', bestUci: 'b5c7', bestLine: ['b5c7', 'e8d7', 'c7a8'] });
  check('missed fork', r.points.some(p => /missed Nc7\+/.test(p) && /forks/.test(p)), r.points);
}
// 12. a queen trade you started is not "a queen left undefended" / "you lose a piece"
{
  const f = fenAfter('d4 d5 Nc3 Nf6 Nf3 Nc6 Bd2 Bf5 e4 dxe4 Ne5 Nxe5 dxe5 Nd5 Nxd5 Qxd5 Qe2 Qxe5 g4 Qxb2 Rd1 Bg6 Bh3 O-O-O O-O Qxc2 g5 e6 f4 Bc5+ Kh1 e3 Bxe6+ Kb8 Bb3 Be4+ Kg1 Qd3 Rde1');
  const r = explainMove(f, uci(f, 'Qxe2'), { cls: 'miss', bestUci: uci(f, 'exd2+'), bestLine: ['e3d2', 'e2e3', 'c5e3', 'e1e3', 'd3e3', 'f1f2', 'd2d1q', 'b3d1'], afterLine: ['e2e2'.replace('e2e2', 'e1e2'), 'e3d2', 'e2f2', 'h8e8', 'h2h4', 'e4f3'] });
  check('no "left undefended" for a recapture', !r.points.some(p => /left undefended/.test(p)), r.points);
  check('no "you lose" after a trade that wins a piece', !r.points.some(p => /You lose/.test(p)), r.points);
  check('the missed exd2+ is named', r.points.some(p => /missed exd2\+/.test(p)), r.points);
}
// 13. a piece already under attack, and the move does not save it
{
  const f = fenAfter('e4 e5 Nf3 Nf6 d4 exd4 Nxd4 Bc5 Be3 Nxe4 Nc3');
  const r = explainMove(f, uci(f, 'Nc6'), { cls: 'blunder', bestUci: uci(f, 'Nxc3'), bestLine: ['e4c3', 'b2c3', 'd7d6'], afterLine: ['d4c6', 'b7c6', 'c3e4', 'c5e3', 'f2e3', 'd8h4'] });
  check('names the attacked knight on e4', r.points.some(p => /knight on e4 was attacked and Nc6 does not save it/.test(p)), r.points);
  check('and the material lost', r.points.some(p => /You lose a piece/.test(p)), r.points);
}
// 14. a pawn attacks the knight, and the bishop move ignores it
{
  const f = fenAfter('e4 e5 Nf3 Nc6 Bc4 Nf6 Nc3 Nxe4 Nxe4 d5');
  const r = explainMove(f, uci(f, 'Bb3'), { cls: 'blunder', bestUci: uci(f, 'Bd3'), bestLine: ['c4d3', 'd5e4', 'd3e4'], afterLine: ['d5e4', 'f3g1', 'd8d4'] });
  check('knight on e4 attacked, Bb3 does not save it', r.points.some(p => /knight on e4 was attacked and Bb3 does not save it/.test(p)), r.points);
}
// 15. the queen for a bishop, not "a rook"; a bishop-for-knight trade is not "a piece lost"
{
  const f = fenAfter('e4 e5 Nf3 Nf6 d4 exd4 Nxd4 Bc5 Be3 Nxe4 Nc3 Nc6 Bd3 Nxd4 Bxd4 Bxd4 Bxe4 Bxc3+ bxc3 d6 Qe2 Qe7 O-O-O');
  const r = explainMove(f, uci(f, 'O-O'), { cls: 'blunder', bestUci: uci(f, 'Qg5+'), bestLine: ['e7g5', 'c1b2'], afterLine: ['e4h7', 'g8h7', 'e2e7', 'h7g8', 'e7h4', 'c8e6'] });
  check('queen for a bishop', r.points.some(p => /You lose the queen for a bishop/.test(p)), r.points);
  const f2 = fenAfter('e4 e5 Nf3 Nf6 d4 exd4 Nxd4 Bc5 Be3 Nxe4 Nc3 Nc6 Bd3 Nxd4 Bxd4 Bxd4 Bxe4');
  const r2 = explainMove(f2, uci(f2, 'Bxc3+'), { cls: 'mistake', bestUci: uci(f2, 'Qf6'), bestLine: ['d8f6', 'e1g1'], afterLine: ['b2c3', 'c7c6', 'd1d6', 'd8e7', 'e1c1', 'e7d6'] });
  check('a trade is not a piece lost', !r2.points.some(p => /You lose|left undefended/.test(p)), r2.points);
}
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
