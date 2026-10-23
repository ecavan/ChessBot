/**
 * The course (src/data/lessons.js): Part 1, Basics (below 1000), and Part 2, Club player (1000 to
 * 1500). A lesson is the idea and what to ask yourself, three worked examples to solve on the board,
 * then ten practice puzzles of that theme near your puzzle rating, kept within the part's range
 * (they count, like theme puzzles, and misses come back for review). Done at 7/10 or better.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../ui/Board.jsx';
import { Stage, useStage, Spinner } from '../ui/kit.jsx';
import { LESSONS, PARTS, lessonById } from '../data/lessons.js';
import { pick, record, progress } from '../lib/puzzles.js';
import { playUci, uciOf } from '../lib/chessutil.js';
import { motifOf } from '../lib/coach.js';
import { moveSound, sfx } from '../lib/sound.js';
import { load, save, KEYS } from '../lib/store.js';
import { href } from '../lib/router.js';

const KEY = KEYS.lessons;
const PRACTICE = 10, PASS = 7;
export const lessonState = () => load(KEY, {});
const saveLesson = (id, patch) => { const s = lessonState(); save(KEY, { ...s, [id]: { ...(s[id] || {}), ...patch } }); };
export const lessonDone = (id) => (lessonState()[id]?.best ?? 0) >= PASS;

/** The lesson cards for the Train page, by part. */
export function LessonsSection() {
  const st = lessonState();
  return (
    <>
      {Object.entries(PARTS).map(([part, P]) => {
        const list = LESSONS.filter(l => String(l.part) === part);
        const done = list.filter(l => lessonDone(l.id)).length;
        return (
          <section key={part}>
            <div className="flex items-end justify-between gap-3 mb-1">
              <div className="h-sec">Course · Part {part}: {P.name}</div>
              <span className="text-xs text-ink-400 num">{done}/{list.length} done</span>
            </div>
            <p className="text-sm text-ink-300 mb-3">{P.blurb} Each lesson: the idea, three examples to solve, then ten practice puzzles.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {list.map(l => {
                const s = st[l.id];
                const n = LESSONS.indexOf(l) + 1;
                return (
                  <a key={l.id} href={`#/train/basics/${l.id}`} className="card-link !p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white"><span className="text-ink-400 num mr-1.5">{n}</span>{l.title}</span>
                      {s?.best != null ? <span className={`tag num shrink-0 ${s.best >= PASS ? '!text-emerald-300' : '!text-amber-300'}`}>{s.best >= PASS ? '✓ ' : ''}{s.best}/{PRACTICE}</span> : null}
                    </div>
                    <div className="text-xs text-ink-300 mt-1 leading-relaxed">{l.idea}</div>
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

const PIECE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
/** A move the coach has no motif for, in words. */
function plain(m) {
  if (m.promotion) return `${m.san}: the pawn promotes.`;
  if (m.captured) return `${m.san} takes the ${PIECE[m.captured]}.`;
  if (m.san.includes('+')) return `${m.san}, with check.`;
  return `${m.san}: a quiet move, and it's the one that works.`;
}

/** Solve one puzzle on the board. puzzle = { fen, moves: [uci] } (the first move is the opponent's). */
function useSolver(puzzle, onDone) {
  const [k, setK] = useState(0);
  const [status, setStatus] = useState('wait'); // wait | play | done
  const [wrong, setWrong] = useState(null);
  const [hint, setHint] = useState(0);
  const [missed, setMissed] = useState(false);
  const [alt, setAlt] = useState(null); // a mate that isn't the listed move: { fen, move, ply }
  // a new puzzle: reset now, in this render, so nothing of the last one (its length) is used
  const [shown, setShown] = useState(puzzle);
  if (shown !== puzzle) { setShown(puzzle); setK(0); setStatus('wait'); setWrong(null); setHint(0); setMissed(false); setAlt(null); }
  const timers = useRef([]);
  const later = (f, ms) => { const t = setTimeout(f, ms); timers.current.push(t); };
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => {
    clear();
    if (puzzle) later(() => { setK(1); setStatus('play'); sfx.move(); }, 600);
    return clear;
  }, [puzzle]); // eslint-disable-line react-hooks/exhaustive-deps

  const fens = useMemo(() => {
    if (!puzzle) return [];
    const c = new Chess(puzzle.fen); const out = [c.fen()];
    for (const u of puzzle.moves) { try { c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; } out.push(c.fen()); }
    return out;
  }, [puzzle]);
  const moves = useMemo(() => (puzzle ? playUci(puzzle.fen, puzzle.moves).moves : []), [puzzle]);
  const you = puzzle ? (puzzle.fen.split(' ')[1] === 'w' ? 'b' : 'w') : 'w';

  function finish(ok) { setStatus('done'); if (ok) sfx.good(); onDone?.(ok); }
  function onMove({ from, to, promotion }) {
    if (status !== 'play') return false;
    const c = new Chess(fens[k]);
    let m;
    try { m = c.move({ from, to, promotion }); } catch { return false; }
    if (uciOf(m) !== puzzle.moves[k] && !c.isCheckmate()) {
      sfx.bad(); setMissed(true); setWrong({ to, fen: c.fen() }); setStatus('wait');
      later(() => { setWrong(null); setStatus('play'); }, 900);
      return true;
    }
    moveSound(m, c.inCheck());
    setHint(0);
    if (uciOf(m) !== puzzle.moves[k]) setAlt({ fen: c.fen(), move: m, ply: k });
    const reached = k + 1;
    setK(reached);
    if (reached >= puzzle.moves.length || c.isCheckmate()) { finish(!missed); return true; }
    setStatus('wait');
    later(() => { setK(reached + 1); sfx.move(); setStatus('play'); }, 450);
    return true;
  }
  function showAnswer() {
    if (status !== 'play') return;
    setMissed(true); setStatus('wait');
    let i = k;
    const step = () => { i++; if (i > puzzle.moves.length) { finish(false); return; } setK(i); sfx.move(); later(step, 650); };
    later(step, 200);
  }
  const answer = puzzle?.moves[k];
  const marks = {};
  const arrows = [];
  if (status === 'play' && hint >= 1 && answer) marks[answer.slice(0, 2)] = 'rgba(16,185,129,.55)';
  if (status === 'play' && hint >= 2 && answer) arrows.push({ from: answer.slice(0, 2), to: answer.slice(2, 4), color: 'rgba(16,185,129,.85)' });
  if (wrong) marks[wrong.to] = 'rgba(244,63,94,.55)';
  // what each of your moves did, for the explanation afterwards
  const notes = status === 'done' ? moves.map((m, i) => (i % 2 === 1 ? (alt?.ply === i ? motifOf(fens[i], uciOf(alt.move), puzzle.moves[i - 1]) || plain(alt.move) : motifOf(fens[i], puzzle.moves[i], puzzle.moves[i - 1]) || plain(m)) : null)).filter(Boolean) : [];
  return {
    fen: wrong?.fen || alt?.fen || fens[Math.min(k, fens.length - 1)], lastMove: wrong ? null : alt ? alt.move : k > 0 ? moves[Math.min(k, moves.length) - 1] : null, you, status, marks, arrows, onMove, notes, missed,
    hint: () => { setMissed(true); setHint(h => Math.min(2, h + 1)); }, hintLevel: hint, showAnswer,
  };
}

export default function Lesson({ id }) {
  const lesson = lessonById(id);
  const stage = useStage();
  const [step, setStep] = useState(0); // 0 = the idea, 1–3 = examples, 4 = practice, 5 = result
  const [practice, setPractice] = useState(null); // { results: [bool], p: puzzle | null, loading }
  const seen = useRef(new Set());
  const idx = LESSONS.findIndex(l => l.id === id);
  const next = LESSONS[idx + 1];

  const example = step >= 1 && step <= 3 ? lesson.examples[step - 1] : null;
  const exPuzzle = useMemo(() => (example ? { id: example[0], fen: example[1], moves: example[2].split(' '), rating: example[3], why: example[4] } : null), [example]);
  const puzzle = step === 4 ? practice?.p : exPuzzle;

  const solver = useSolver(puzzle, (ok) => {
    if (step === 4 && practice?.p) {
      record(practice.p, ok, 'theme');
      setPractice(pr => ({ ...pr, results: [...pr.results, ok] }));
    }
  });

  async function loadPractice(results) {
    setPractice({ results, p: null, loading: true });
    const [lo, hi] = PARTS[lesson.part].practice;
    const target = Math.max(lo, Math.min(hi, progress().ratings.rated - 100));
    try {
      const p = await pick(target, { theme: lesson.theme, exclude: seen.current });
      seen.current.add(p.id);
      setPractice({ results, p, loading: false });
    } catch (e) { setPractice({ results, p: null, loading: false, err: e.message }); }
  }
  function startPractice() { seen.current = new Set(); setStep(4); loadPractice([]); }
  function nextPractice() {
    const r = practice.results;
    if (r.length >= PRACTICE) {
      const score = r.filter(Boolean).length;
      const prev = lessonState()[id]?.best ?? 0;
      saveLesson(id, { best: Math.max(prev, score), last: score, at: Date.now(), runs: (lessonState()[id]?.runs || 0) + 1, history: [...(lessonState()[id]?.history || []), { at: Date.now(), score }].slice(-50) });
      setStep(5);
      return;
    }
    loadPractice(r);
  }

  if (!lesson) return <div className="page"><div className="panel panel-pad text-center"><p className="muted mb-3">Lesson not found.</p><a href="#/train" className="btn">Back</a></div></div>;

  const results = practice?.results || [];
  const score = results.filter(Boolean).length;
  const showBoard = step >= 1 && step <= 4;
  const boardFen = showBoard && puzzle ? solver.fen : (exPuzzle ? null : lesson.examples[0][1]);

  return (
    <Stage stage={stage}
      top={<div className="strip"><span className="text-sm font-semibold text-ink-200">{PARTS[lesson.part].name} · {lesson.title}</span>
        <span className="text-xs text-ink-300">{step === 0 ? 'The idea' : step <= 3 ? `Example ${step} of 3` : step === 4 ? `Practice ${Math.min(PRACTICE, results.length + 1)} of ${PRACTICE}` : 'Done'}</span></div>}
      bottom={<div className="strip"><span className="text-sm text-ink-300">{showBoard && puzzle && solver.status !== 'done' ? `${solver.you === 'w' ? 'White' : 'Black'} to move` : ''}</span></div>}
      board={showBoard && puzzle ? (
        <Board fen={solver.fen} orientation={solver.you === 'w' ? 'white' : 'black'} size={stage.size}
          movable={solver.status === 'play' ? solver.you : 'none'} onMove={solver.onMove} lastMove={solver.lastMove} marks={solver.marks} arrows={solver.arrows} />
      ) : showBoard ? (
        <div className="cb flex items-center justify-center bg-ink-900" style={{ width: stage.size, height: stage.size }}><Spinner size={28} /></div>
      ) : (
        <Board fen={boardFen} orientation={new Chess(boardFen).turn() === 'w' ? 'black' : 'white'} size={stage.size} movable="none" dim />
      )}
    >
      <div className="panel panel-pad space-y-3">
        {step === 0 && (
          <>
            <div className="text-xl font-semibold text-white">{lesson.title}</div>
            <p className="text-ink-100 font-medium leading-relaxed">{lesson.idea}</p>
            {lesson.body.map((b, i) => <p key={i} className="text-sm text-ink-300 leading-relaxed">{b}</p>)}
            <div className="verdict v-info">
              <div className="text-xs font-semibold uppercase tracking-wider text-sky-300 mb-1">Ask yourself</div>
              <ul className="text-sm text-ink-100 space-y-1">{lesson.checks.map((c, i) => <li key={i}>· {c}</li>)}</ul>
            </div>
            <button className="btn btn-primary btn-lg w-full" onClick={() => setStep(1)}>Start: three examples</button>
            <button className="btn w-full" onClick={startPractice}>Skip to practice</button>
          </>
        )}
        {step >= 1 && step <= 3 && (
          <>
            <div className="text-lg font-semibold text-white">{solver.status === 'done' ? (solver.missed ? 'That was the idea' : 'Solved!') : `Find the move for ${solver.you === 'w' ? 'White' : 'Black'}`}</div>
            {solver.status !== 'done' && <p className="text-sm text-ink-300">{lesson.checks[0]}</p>}
            {solver.status === 'done' && (
              <div className={`verdict ${solver.missed ? 'v-info' : 'v-good'} pop`}>
                {exPuzzle?.why ? <div className="text-sm text-ink-100">{exPuzzle.why}</div> : solver.notes.map((n, i) => <div key={i} className="text-sm text-ink-100">{n}</div>)}
              </div>
            )}
            {solver.status !== 'done' ? (
              <div className="grid grid-cols-2 gap-2">
                <button className="btn" onClick={solver.hint} disabled={solver.status !== 'play' || solver.hintLevel >= 2}>{solver.hintLevel === 0 ? 'Hint' : 'Show move'}</button>
                <button className="btn" onClick={solver.showAnswer} disabled={solver.status !== 'play'}>Show answer</button>
              </div>
            ) : (
              <button className="btn btn-primary btn-lg w-full" onClick={() => (step < 3 ? setStep(step + 1) : startPractice())}>{step < 3 ? 'Next example' : `Practice: ${PRACTICE} puzzles`}</button>
            )}
            <button className="btn btn-quiet btn-sm" onClick={() => setStep(0)}>← The idea</button>
          </>
        )}
        {step === 4 && (
          <>
            <div className="flex items-end justify-between">
              <div className="text-lg font-semibold text-white">{practice?.loading ? 'Finding a puzzle…' : practice?.err ? 'No puzzle' : solver.status === 'done' ? (solver.missed ? 'Not this time' : 'Solved!') : `Find the move for ${solver.you === 'w' ? 'White' : 'Black'}`}</div>
              <span className="text-sm text-ink-300 num">{score}/{results.length}</span>
            </div>
            <div className="flex gap-1">{Array.from({ length: PRACTICE }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < results.length ? (results[i] ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-ink-700'}`} />)}</div>
            {practice?.err && <p className="text-sm text-rose-300">{practice.err}</p>}
            {solver.status === 'done' && solver.notes.length > 0 && <div className={`verdict ${solver.missed ? 'v-info' : 'v-good'} pop`}>{solver.notes.map((n, i) => <div key={i} className="text-sm text-ink-100">{n}</div>)}</div>}
            {practice?.err ? (
              <button className="btn btn-primary btn-lg w-full" onClick={() => loadPractice(results)}>Try again</button>
            ) : solver.status === 'done' ? (
              <button className="btn btn-primary btn-lg w-full" onClick={nextPractice}>{results.length >= PRACTICE ? 'See your score' : 'Next puzzle'}</button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button className="btn" onClick={solver.hint} disabled={solver.status !== 'play' || solver.hintLevel >= 2}>{solver.hintLevel === 0 ? 'Hint' : 'Show move'}</button>
                <button className="btn" onClick={solver.showAnswer} disabled={solver.status !== 'play'}>Show answer</button>
              </div>
            )}
            <p className="text-xs text-ink-400">These count toward your puzzle rating. A hint or a wrong move counts as a miss, and missed puzzles come back for review.</p>
          </>
        )}
        {step === 5 && (
          <>
            <div className="text-2xl font-semibold text-white num">{score}/{PRACTICE}</div>
            <p className="text-sm text-ink-200">{score >= PASS ? `Lesson done. ${next ? `Next up: ${next.title}.` : 'That was the last one.'}` : `${PASS}/${PRACTICE} completes the lesson. Read the idea again, then have another go.`}</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn" onClick={startPractice}>Practice again</button>
              {next ? <a className="btn btn-primary" href={`#/train/basics/${next.id}`}>Next lesson</a> : <a className="btn btn-primary" href="#/train">All lessons</a>}
            </div>
            <a className="btn btn-quiet btn-sm" href={href('/puzzles/solve', { mode: 'theme', theme: lesson.theme })}>More {lesson.title.toLowerCase()} puzzles</a>
          </>
        )}
      </div>
      <a href="#/train" className="btn btn-quiet btn-sm self-start">← Train</a>
    </Stage>
  );
}
