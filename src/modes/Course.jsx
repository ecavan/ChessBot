/**
 * An opening course, chessreps-style.
 *   Explore   walk the tree: every reply people play at your level, how often, and what to do.
 *   Learn     go through each line with the moves shown and explained.
 *   Practice  spaced repetition: play the lines from memory; slips come back sooner.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../ui/Board.jsx';
import { Stage, useStage, EvalBar, MoveList, Seg, Spinner, Progress } from '../ui/kit.jsx';
import { loadCourse, chain, courseStats, nextLine, recordLine, markLearned, lineState, cpText } from '../lib/repertoire.js';
import { explainMove, motifOf, lineGain } from '../lib/coach.js';
import { loadBook, nameOf } from '../lib/book.js';
import { moveSound, sfx } from '../lib/sound.js';
import { href, go } from '../lib/router.js';
import { uciOf, lineSan, START } from '../lib/chessutil.js';

const worth = (g) => (g >= 8 ? 'the queen' : g >= 4.5 ? 'a rook' : g >= 2.5 ? 'a piece' : g >= 1.5 ? 'two pawns' : 'a pawn');

/** Plain-English notes for a node (the move that led to it). */
export function noteFor(course, node) {
  if (!node || node.id === 'root') return [];
  const parent = course.nodes[node.parent];
  const out = [];
  if (node.mine) {
    const punish = parent && !parent.mine && (parent.tags.includes('mistake') || parent.tags.includes('blunder'));
    if (punish) {
      const why = motifOf(parent.fen, node.uci);
      out.push(`This punishes their mistake${why ? `: ${why}` : '.'}`);
    }
    const ex = explainMove(parent.fen, node.uci, { cls: 'best' });
    for (const p of ex.points) if (!out.some(o => o.includes(p))) out.push(p);
  } else {
    const nm = nameOf(node.fen);
    if (nm && (!parent || !nameOf(parent.fen) || nameOf(parent.fen).name !== nm.name)) out.push(`This is the ${nm.name}.`);
    if (node.tags.includes('blunder') || node.tags.includes('mistake')) {
      const reply = course.nodes[node.kids[0]];
      const gain = reply ? lineGain(node.fen, reply.path.slice(node.path.length).concat(deepest(course, reply.id)), reply.move.color) : null;
      out.push(`${node.tags.includes('blunder') ? 'A blunder' : 'A mistake'}${node.p ? `, but ${Math.round(node.p * 100)}% of players at your level play it` : ''}.${gain && gain.gain >= 1 ? ` Punish it and you win ${worth(gain.gain)}.` : ''}`);
    }
    const why = motifOf(parent.fen, node.uci);
    if (why && /forks|pins|skewers|uncovers|attacks|takes/.test(why)) out.push(`Watch out: ${why}`);
    else {
      const ex = explainMove(parent.fen, node.uci, { cls: 'good' });
      if (ex.points[0]) out.push(`${ex.points[0]}`);
    }
  }
  return out.slice(0, 3);
}

function deepest(course, id) {
  const out = [];
  let n = course.nodes[id];
  while (n && n.kids.length === 1) { n = course.nodes[n.kids[0]]; out.push(n.uci); }
  return out;
}

function trapNote(course, node) {
  const t = node?.trap;
  if (!t) return null;
  const parent = course.nodes[node.parent];
  const g = new Chess(parent.fen);
  let after;
  try { g.move({ from: t.u.slice(0, 2), to: t.u.slice(2, 4), promotion: t.u[4] }); after = g.fen(); } catch { return null; }
  const why = t.ref?.[0] ? motifOf(after, t.ref[0]) : null;
  const gain = t.ref?.length ? lineGain(after, t.ref, parent.fen.split(' ')[1] === 'w' ? 'b' : 'w') : null;
  const line = t.ref?.length ? lineSan(after, t.ref, 6) : '';
  return `${t.s} is what ${Math.round(t.share * 100)}% of players at your level play here, and it's a mistake.${why ? ` After ${t.s}, ${why}` : ''}${gain && gain.gain >= 1 ? ` It costs ${worth(gain.gain)}.` : ''}${line ? ` The refutation: ${line}.` : ''} Play ${node.san} instead.`;
}

export default function Course({ id, mode: initMode }) {
  const [course, setCourse] = useState(null);
  const [err, setErr] = useState(null);
  const [mode, setMode] = useState(initMode || 'explore');
  const [, bump] = useState(0);
  useEffect(() => { loadBook(); loadCourse(id).then(setCourse).catch(e => setErr(e.message)); }, [id]);
  if (err) return <div className="page"><div className="panel panel-pad"><p className="text-rose-300">{err}</p><a className="btn mt-3" href="#/train">Back</a></div></div>;
  if (!course) return <div className="page flex items-center gap-2 text-ink-300"><Spinner /> Loading the course…</div>;
  const stats = courseStats(course);
  const header = (
    <div className="panel panel-pad space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="h-sec">{course.color === 'w' ? 'As White' : 'As Black'}</div>
          <h1 className="text-lg font-semibold text-white leading-tight">{course.name}</h1>
        </div>
        <a href="#/train" className="btn btn-quiet btn-sm shrink-0">All courses</a>
      </div>
      <Seg value={mode} onChange={(m) => { setMode(m); bump(x => x + 1); }} options={[['explore', 'Explore'], ['learn', 'Learn'], ['practice', `Practice${stats.due ? ` · ${stats.due}` : ''}`]]} className="w-full [&>button]:flex-1" />
      <div>
        <div className="flex justify-between text-xs text-ink-300 mb-1"><span>{stats.learned} of {stats.total} lines learned</span><span>{stats.mastered} mastered</span></div>
        <Progress value={(stats.learned / Math.max(1, stats.total)) * 100} />
      </div>
    </div>
  );
  if (mode === 'learn') return <Drill key="learn" course={course} header={header} learn onDone={() => bump(x => x + 1)} />;
  if (mode === 'practice') return <Drill key="practice" course={course} header={header} onDone={() => bump(x => x + 1)} />;
  return <Explore course={course} header={header} />;
}

// ------------------------------------------------------------------ explore

function Explore({ course, header }) {
  const stage = useStage({ evalBar: true });
  const [cur, setCur] = useState('root');
  const node = course.nodes[cur];
  const path = chain(course, cur);
  const kids = node.kids.map(k => course.nodes[k]);
  const orientation = course.color === 'w' ? 'white' : 'black';
  const toMoveMine = kids[0]?.mine ?? ((node.fen.split(' ')[1] === 'w') === (course.color === 'w'));
  const notes = noteFor(course, node);
  const trap = kids[0]?.mine ? trapNote(course, kids[0]) : null;
  const name = nameOf(node.fen) || [...path].reverse().map(p => nameOf(course.nodes[p].fen)).find(Boolean);
  const arrows = kids.map(k => ({ from: k.uci.slice(0, 2), to: k.uci.slice(2, 4), color: k.mine ? 'rgba(16,185,129,.85)' : k.tags.some(t => t === 'mistake' || t === 'blunder') ? 'rgba(244,63,94,.6)' : 'rgba(56,189,248,.55)', width: k.mine ? 0.17 : Math.max(0.08, Math.min(0.2, (k.p || 0.05) * 0.4)) }));

  function onMove({ from, to, promotion }) {
    const k = kids.find(x => x.uci.slice(0, 4) === from + to && (!promotion || x.uci[4] === promotion));
    if (k) { moveSound(k.move, k.san.includes('+')); setCur(k.id); return true; }
    sfx.bad();
    return false;
  }
  useEffect(() => {
    const f = (e) => {
      if (e.key === 'ArrowLeft' && node.parent) setCur(node.parent);
      if (e.key === 'ArrowRight' && kids[0]) setCur(kids[0].id);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  });

  return (
    <Stage stage={stage}
      top={<div className="strip"><span className="text-sm font-semibold text-ink-200 truncate">{name ? `${name.eco} · ${name.name}` : course.name}</span></div>}
      bottom={<div className="strip text-xs text-ink-300">Green arrow: your move. Blue: their common replies (thicker = more common). Red: their mistakes.</div>}
      evalBar={<EvalBar height={stage.size} orientation={orientation} line={node.e != null ? (Math.abs(node.e) >= 9000 ? { mate: Math.sign(node.e) * (10000 - Math.abs(node.e)) } : { cp: node.e }) : { cp: 20 }} />}
      board={<Board fen={node.fen} orientation={orientation} size={stage.size} movable="both" onMove={onMove} lastMove={node.move} arrows={arrows} />}
    >
      {header}
      {node.id !== 'root' && (
        <div className="panel panel-pad fade-up" key={cur}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`tag ${node.mine ? '!text-emerald-300' : ''}`}>{node.mine ? 'Your move' : 'Their move'}</span>
            <span className="font-semibold text-white">{moveLabel(node)}</span>
            {node.tags.includes('mistake') && <span className="tag !text-rose-300">mistake</span>}
            {node.tags.includes('blunder') && <span className="tag !text-rose-300">blunder</span>}
            <span className="ml-auto text-xs text-ink-300 num">{cpText(node.e, course.color)}</span>
          </div>
          {notes.map((t, i) => <p key={i} className="text-sm text-ink-200 mt-1">{t}</p>)}
        </div>
      )}
      {node.id === 'root' && <div className="panel panel-pad"><p className="text-sm text-ink-200">{course.blurb}</p><p className="text-xs text-ink-400 mt-2">The replies below are what club players (700–2000) actually play, from millions of Lichess games. Your moves are checked by Stockfish.</p></div>}

      {kids.length > 0 && (
        <div className="panel panel-pad space-y-2">
          <div className="h-sec">{toMoveMine ? 'Your move' : 'What they play here'}</div>
          {kids.map(k => (
            <button key={k.id} onClick={() => setCur(k.id)} className="row-link !px-2.5 !py-2 border border-ink-700/60">
              <span className="font-semibold text-white w-16 shrink-0">{k.san}</span>
              {!k.mine && k.p ? (
                <span className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="bar flex-1"><i style={{ width: `${Math.round(k.p * 100)}%`, background: k.tags.some(t => t === 'mistake' || t === 'blunder') ? '#f43f5e' : '#38bdf8' }} /></span>
                  <span className="text-xs num text-ink-300 w-10 text-right">{Math.round(k.p * 100)}%</span>
                </span>
              ) : <span className="flex-1 text-xs text-ink-300 truncate">{k.mine ? (nameOf(k.fen)?.name || 'main line') : k.tags.includes('trap-line') ? 'rare, but a trap to know' : 'Stockfish\'s reply'}</span>}
              {k.tags.includes('mistake') && <span className="tag !text-rose-300">punish</span>}
              {k.tags.includes('blunder') && <span className="tag !text-rose-300">punish!</span>}
              {k.trap && <span className="tag !text-amber-300">trap</span>}
            </button>
          ))}
          {trap && <div className="verdict v-warn"><div className="text-sm font-semibold text-white">Common trap</div><p className="text-sm text-ink-200 mt-0.5">{trap}</p></div>}
        </div>
      )}
      {!kids.length && node.id !== 'root' && (
        <div className="panel panel-pad space-y-2">
          <p className="text-sm text-ink-300">End of this line. From here it's a middlegame.</p>
          <a className="btn btn-primary btn-sm" href={href('/play', { fen: node.fen, color: course.color, coach: 1 })}>Play it out with the coach</a>
        </div>
      )}
      <div className="panel p-2"><MoveList sans={[...course.root, ...path.map(p => course.nodes[p].san)]} ply={course.root.length + path.length} startFen={START} onJump={(p) => setCur(p <= course.root.length ? 'root' : path[p - course.root.length - 1])} maxHeight={120} /></div>
      <div className="grid grid-cols-3 gap-2">
        <button className="btn" onClick={() => setCur('root')} disabled={cur === 'root'}>Start</button>
        <button className="btn" onClick={() => setCur(node.parent)} disabled={!node.parent}>◀ Back</button>
        <button className="btn" onClick={() => kids[0] && setCur(kids[0].id)} disabled={!kids.length}>Next ▶</button>
      </div>
    </Stage>
  );
}

function moveLabel(node) {
  const [, turn, , , , full] = node.fen.split(' ');
  const n = Number(full) || 1;
  // the move was made by the side NOT to move now
  return turn === 'b' ? `${n}. ${node.san}` : `${n - 1}… ${node.san}`;
}

// ------------------------------------------------------------------ learn / practice

function Drill({ course, header, learn = false, onDone }) {
  const stage = useStage();
  const [leaf, setLeaf] = useState(() => (learn ? firstUnlearned(course) : nextLine(course)?.leaf));
  const [step, setStep] = useState(0); // how many nodes of the line are on the board
  const [slip, setSlip] = useState(null); // { wanted: node, tried: san }
  const [slips, setSlips] = useState(0);
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  const line = useMemo(() => (leaf ? chain(course, leaf) : []), [course, leaf]);
  const node = step ? course.nodes[line[step - 1]] : course.nodes.root;
  const next = course.nodes[line[step]];
  const orientation = course.color === 'w' ? 'white' : 'black';
  const kind = useMemo(() => (learn ? 'learn' : leaf ? (lineState(course.id)[leaf] ? 'due' : 'new') : null), [leaf]); // eslint-disable-line react-hooks/exhaustive-deps

  // opponent moves play themselves
  useEffect(() => {
    clearTimeout(timer.current);
    if (done || !next || next.mine) return undefined;
    timer.current = setTimeout(() => { moveSound(next.move, next.san.includes('+')); setStep(s => s + 1); }, step === 0 ? 600 : 750);
    return () => clearTimeout(timer.current);
  }, [step, leaf, done]); // eslint-disable-line react-hooks/exhaustive-deps

  // line finished
  useEffect(() => {
    if (!leaf || done || step < line.length || !line.length) return;
    setDone(true);
    if (learn) markLearned(course.id, leaf);
    else recordLine(course.id, leaf, slips === 0);
    if (slips === 0) sfx.good();
    onDone?.();
  }, [step, line.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function onMove({ from, to, promotion }) {
    if (!next || !next.mine || done) return false;
    const g = new Chess(node.fen);
    let m;
    try { m = g.move({ from, to, promotion }); } catch { return false; }
    if (uciOf(m) === next.uci) {
      moveSound(m, g.inCheck());
      setSlip(null);
      setStep(s => s + 1);
      return true;
    }
    sfx.bad();
    setSlips(s => s + 1);
    setSlip({ wanted: next, tried: m.san, triedUci: uciOf(m) });
    return false;
  }

  function nextOne() {
    const n = learn ? firstUnlearned(course, leaf) : nextLine(course, leaf)?.leaf;
    setLeaf(n); setStep(0); setSlip(null); setSlips(0); setDone(false);
  }

  if (!leaf) {
    return (
      <Stage stage={stage} board={<Board fen={course.rootFen} orientation={orientation} size={stage.size} />}>
        {header}
        <div className="panel panel-pad"><p className="text-sm text-ink-200">{learn ? 'You have seen every line in this course. Switch to Practice to drill them.' : 'Nothing to practise yet. Learn a few lines first.'}</p></div>
      </Stage>
    );
  }

  const showHint = learn && next?.mine && !done;
  const arrows = [];
  if (showHint) arrows.push({ from: next.uci.slice(0, 2), to: next.uci.slice(2, 4), color: 'rgba(16,185,129,.85)' });
  if (slip) arrows.push({ from: slip.wanted.uci.slice(0, 2), to: slip.wanted.uci.slice(2, 4), color: 'rgba(16,185,129,.85)' });
  const lastNode = step ? course.nodes[line[step - 1]] : null;
  const noteNode = showHint ? next : lastNode;
  const notes = noteNode ? noteFor(course, noteNode) : [];
  const idx = course.leaves.indexOf(leaf);
  const name = [...line.slice(0, step)].reverse().map(p => nameOf(course.nodes[p].fen)).find(Boolean);

  return (
    <Stage stage={stage}
      top={<div className="strip"><span className="text-sm font-semibold text-ink-200 truncate">{name ? name.name : course.name}</span><span className="text-xs text-ink-300">line {idx + 1}/{course.leaves.length}</span></div>}
      bottom={<div className="strip text-xs text-ink-300">{learn ? 'Play the green arrow. Their replies play themselves.' : 'Play your moves from memory.'}</div>}
      board={<Board fen={node.fen} orientation={orientation} size={stage.size} movable={next?.mine && !done ? course.color : 'none'} onMove={onMove} lastMove={node.move} arrows={arrows} />}
    >
      {header}
      <div className="panel panel-pad space-y-2">
        {kind && !learn && <span className={`tag ${kind === 'new' ? '!text-sky-300' : '!text-amber-300'}`}>{kind === 'new' ? 'new line' : 'due for review'}</span>}
        {done ? (
          <div className={`verdict ${slips ? 'v-info' : 'v-good'} pop`}>
            <div className="font-semibold text-white">{learn ? 'Line learned' : slips ? `Done, with ${slips} slip${slips > 1 ? 's' : ''}` : 'Perfect!'}</div>
            <div className="text-sm text-ink-200">{learn ? 'It\'s now in your practice queue.' : slips ? 'This line comes back soon.' : 'It moves up a box: you\'ll see it again later.'}</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button className="btn btn-primary col-span-2" onClick={nextOne}>Next line</button>
              <a className="btn" href={href('/play', { fen: node.fen, color: course.color, coach: 1 })}>Play it out</a>
              <button className="btn" onClick={() => { setStep(0); setSlip(null); setSlips(0); setDone(false); }}>Repeat</button>
            </div>
          </div>
        ) : slip ? (
          <div className="verdict v-bad shake">
            <div className="font-semibold text-white">{slip.tried} isn't the move here. Play {slip.wanted.san}.</div>
            {noteFor(course, slip.wanted).map((t, i) => <p key={i} className="text-sm text-ink-200 mt-1">{t}</p>)}
          </div>
        ) : (
          <>
            <div className="text-white font-semibold">{next?.mine ? (learn ? `Play ${next.san}` : 'Your move') : 'Their move…'}</div>
            {notes.map((t, i) => <p key={i} className="text-sm text-ink-200">{t}</p>)}
            {showHint && next.trap && <div className="verdict v-warn !py-2"><p className="text-sm text-ink-200">{trapNote(course, next)}</p></div>}
          </>
        )}
      </div>
      <div className="panel p-2"><MoveList sans={[...course.root, ...line.slice(0, step).map(p => course.nodes[p].san)]} ply={course.root.length + step} startFen={START} maxHeight={120} /></div>
      {!done && <div className="grid grid-cols-2 gap-2">
        <button className="btn" onClick={() => { setStep(0); setSlip(null); }}>Restart line</button>
        <button className="btn" onClick={nextOne}>Skip</button>
      </div>}
    </Stage>
  );
}

function firstUnlearned(course, after = null) {
  const st = lineState(course.id);
  const fresh = course.leaves.filter(l => !st[l] && l !== after);
  return fresh[0] || null;
}
