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
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
