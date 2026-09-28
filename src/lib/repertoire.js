/**
 * Opening courses (built by scripts/build-repertoire.py from club-level Lichess games and
 * Stockfish): each is a tree of your moves and the replies people really play against them.
 *
 * A "line" is a path from the course root to a leaf. Lines are drilled with spaced repetition
 * (1, 3, 7, 16, 35 days): play a line from memory without a mistake and it moves up a box; slip
 * and it goes back to the start.
 */
import { Chess } from 'chess.js';
import { load, save, KEYS } from './store.js';

let index = null;
const courses = new Map();

export async function loadCourses() {
  if (index) return index;
  const r = await fetch('/data/rep/index.json');
  if (!r.ok) throw new Error('Opening courses could not be loaded.');
  index = await r.json();
  return index;
}

/** Load a course and flatten it: nodes[id] = { id, parent, san, uci, fen (after), mine, n, p, e, tags, trap, kids: [id] }. */
export async function loadCourse(id) {
  if (courses.has(id)) return courses.get(id);
  const r = await fetch(`/data/rep/${id}.json`);
  if (!r.ok) throw new Error('Course not found.');
  const c = await r.json();
  const g = new Chess();
  for (const s of c.root) g.move(s);
  const rootFen = g.fen();
  const nodes = { root: { id: 'root', parent: null, fen: rootFen, kids: [], depth: 0, san: null, path: [], tags: [], mine: false } };
  const walk = (list, parentId, fen, path) => {
    for (const x of list) {
      const h = new Chess(fen);
      let m;
      try { m = h.move({ from: x.u.slice(0, 2), to: x.u.slice(2, 4), promotion: x.u[4] }); } catch { continue; }
      const id = parentId === 'root' ? x.u : `${parentId} ${x.u}`;
      nodes[id] = { id, parent: parentId, san: m.san, uci: x.u, move: m, fen: h.fen(), mine: x.k === 'mine', n: x.n, p: x.p, e: x.e,
        tags: x.t || [], trap: x.trap || null, kids: [], depth: nodes[parentId].depth + 1, path: [...path, x.u] };
      nodes[parentId].kids.push(id);
      walk(x.c || [], id, h.fen(), [...path, x.u]);
    }
  };
  walk(c.tree, 'root', rootFen, []);
  const leaves = Object.values(nodes).filter(n => n.id !== 'root' && !n.kids.length).map(n => n.id);
  // order lines by how common they are (product of shares along the way)
  const weight = (id) => { let w = 1; for (let n = nodes[id]; n && n.id !== 'root'; n = nodes[n.parent]) if (!n.mine) w *= n.p || 0.01; return w; };
  leaves.sort((a, b) => weight(b) - weight(a));
  const course = { ...c, rootFen, nodes, leaves, weight };
  courses.set(id, course);
  return course;
}

/** The chain of node ids from the root to `id`. */
export function chain(course, id) {
  const out = [];
  for (let n = course.nodes[id]; n && n.id !== 'root'; n = course.nodes[n.parent]) out.unshift(n.id);
  return out;
}

// ------------------------------------------------------------------ progress

const GAPS = [1, 3, 7, 16, 35];
const DAY = 86400000;
const all = () => load(KEYS.train, {}).rep || {};
const put = (rep) => save(KEYS.train, { ...load(KEYS.train, {}), rep });

export function lineState(courseId) { return all()[courseId] || {}; }

/** Record a practice run of a line. ok = no mistakes. */
export function recordLine(courseId, leaf, ok) {
  const rep = all();
  const c = rep[courseId] || {};
  const s = c[leaf] || { box: -1, due: 0 };
  // a clean run only moves the line up when it was actually due (no cramming a line to "mastered")
  const box = ok ? (s.due <= Date.now() ? Math.min(GAPS.length - 1, s.box + 1) : Math.max(0, s.box)) : 0;
  const due = ok ? (s.due <= Date.now() ? Date.now() + GAPS[box] * DAY : s.due) : Date.now() + (0.5 / 24) * DAY;
  c[leaf] = { box, due, runs: (s.runs || 0) + 1, last: Date.now() };
  rep[courseId] = c;
  put(rep);
}

/** Mark a line as seen in Learn (it becomes due for practice right away). */
export function markLearned(courseId, leaf) {
  const rep = all();
  const c = rep[courseId] || {};
  if (!c[leaf]) c[leaf] = { box: -1, due: Date.now(), runs: 0 };
  rep[courseId] = c;
  put(rep);
}

export function courseStats(course) {
  const st = lineState(course.id);
  const now = Date.now();
  let learned = 0, due = 0, mastered = 0;
  for (const l of course.leaves) {
    const s = st[l];
    if (!s) continue;
    learned++;
    if (s.due <= now) due++;
    if (s.box >= 3) mastered++;
  }
  return { total: course.leaves.length, learned, due, mastered, fresh: course.leaves.length - learned };
}

/** Next line to practise: a due one (oldest first), else a new one, else the weakest. */
export function nextLine(course, exclude = null) {
  const st = lineState(course.id);
  const now = Date.now();
  const due = course.leaves.filter(l => st[l] && st[l].due <= now && l !== exclude).sort((a, b) => st[a].due - st[b].due);
  if (due.length) return { leaf: due[0], kind: 'due' };
  const fresh = course.leaves.find(l => !st[l] && l !== exclude);
  if (fresh) return { leaf: fresh, kind: 'new' };
  const weakest = course.leaves.filter(l => l !== exclude).sort((a, b) => (st[a]?.box ?? 0) - (st[b]?.box ?? 0) || (st[a]?.due ?? 0) - (st[b]?.due ?? 0))[0];
  return weakest ? { leaf: weakest, kind: 'review' } : null;
}

export const cpText = (e, color = 'w') => {
  if (e == null) return '';
  const v = color === 'w' ? e : -e;
  if (Math.abs(v) >= 9000) return v > 0 ? 'winning (mate)' : 'losing (mate)';
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v / 100).toFixed(1)}`;
};
