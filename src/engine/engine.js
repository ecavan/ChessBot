/**
 * Stockfish 17.1 (WASM, in a Web Worker) behind a small job queue.
 *
 * Flavours, strongest first:
 *   full   the full NNUE network (~75 MB, downloaded once, then cached), multi-threaded when the
 *          page is cross-origin isolated (COOP/COEP headers), single-threaded otherwise;
 *   lite   a much smaller network (~7 MB): loads instantly, clearly weaker.
 * The app starts on lite, loads full in the background and switches over when it's ready, so
 * the first launch is fast and every later search is at full strength.
 *
 * Jobs run one at a time. A job with `preempt` stops the running one (which resolves with what
 * it had found). Each job waits for the previous `bestmove`, so no stale output leaks across.
 */

const FILES = {
  'full-mt': '/stockfish/stockfish-17.1-8e4d048.js',
  'full-single': '/stockfish/stockfish-17.1-single-a496a04.js',
  'lite-mt': '/stockfish/stockfish-17.1-lite-51f59da.js',
  'lite-single': '/stockfish/stockfish-17.1-lite-single-03e3232.js',
};

let threadsBroken = false;
export const canThread = () => !threadsBroken && typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated === true;
/** A thread worker that fails to start makes the loader print this and try again, without end. */
const THREAD_FAIL = /^worker sent an (error!|unknown command)/;
const single = (flavor) => flavor.replace('-mt', '-single');
const cores = () => Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1));

/** Parse one "info ..." line. Scores are from the side to move. */
function parseInfo(line) {
  const out = {};
  const num = (k) => { const m = line.match(new RegExp(` ${k} (-?\\d+)`)); return m ? Number(m[1]) : undefined; };
  out.depth = num('depth');
  out.multipv = num('multipv') ?? 1;
  out.nodes = num('nodes');
  out.nps = num('nps');
  const cp = line.match(/ score cp (-?\d+)/);
  const mate = line.match(/ score mate (-?\d+)/);
  if (cp) out.cp = Number(cp[1]);
  if (mate) out.mate = Number(mate[1]);
  if (/ (upperbound|lowerbound)/.test(line)) out.bound = true;
  const pv = line.match(/ pv (.+)$/);
  if (pv) out.pv = pv[1].trim().split(/\s+/);
  return out;
}

class Worker1 {
  constructor(flavor) {
    this.flavor = flavor;
    this.threads = flavor.endsWith('-mt') ? cores() : 1;
    this.w = new Worker(FILES[flavor]);
    this.listeners = new Set();
    this.threadFails = 0;
    this.w.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      if (THREAD_FAIL.test(line)) {
        // the loader would keep spawning threads that die (and each one's error lands on the page):
        // stop it here and let the manager fall back to one thread
        if (++this.threadFails < 8 || this.dead) return;
        this.dead = true;
        this.w.terminate();
        for (const l of [...this.listeners]) l('__error__ threads');
        return;
      }
      for (const l of [...this.listeners]) l(line);
    };
    this.dead = false;
  }
  send(cmd) { this.w.postMessage(cmd); }
  waitFor(pred, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.listeners.delete(f); reject(new Error('engine timeout')); }, timeoutMs);
      const f = (line) => { if (pred(line)) { clearTimeout(t); this.listeners.delete(f); resolve(line); } };
      this.listeners.add(f);
    });
  }
  async init() {
    this.w.onerror = (e) => { this.dead = true; for (const l of [...this.listeners]) l('__error__ ' + (e.message || 'worker error')); };
    // the full network is ~75 MB; on a slow link or a cold cache this takes minutes, so wait generously
    const ok = this.waitFor(l => l === 'uciok' || l.startsWith('__error__'), this.flavor.startsWith('full') ? 600000 : 180000);
    this.send('uci');
    const r = await ok;
    if (r.startsWith('__error__')) throw new Error(r);
    // threads are started with the option; a thread that cannot start shows up right away
    if (this.threads > 1) {
      const probe = this.waitFor(l => l.startsWith('__error__'), 1500).catch(() => null);
      this.send(`setoption name Threads value ${this.threads}`);
      const bad = await probe;
      if (bad) throw new Error(bad);
    }
    if (this.threads === 1) this.send('setoption name Threads value 1');
    this.send('setoption name Hash value 64');
    const ready = this.waitFor(l => l === 'readyok', 60000);
    this.send('isready');
    await ready;
  }
  terminate() { this.dead = true; this.w.terminate(); }
}

class EngineManager {
  constructor() {
    this.worker = null;
    this.queue = [];
    this.running = null;
    this.status = { flavor: null, threads: 0, loading: null, error: null };
    this.subs = new Set();
    this.opts = {}; // last options sent, to avoid resending
    this.fullTried = 0;
  }
  subscribe(fn) { this.subs.add(fn); fn(this.status); return () => this.subs.delete(fn); }
  emit() { for (const f of this.subs) f(this.status); }

  /** The flavour currently answering searches ('full-mt', 'lite-single', …) or null before start. */
  flavor() { return this.worker?.flavor || null; }
  isFull() { return !!this.worker?.flavor?.startsWith('full'); }
  /** Resolves once the full network is running, or when it has given up (error) — never rejects. */
  whenFull(timeoutMs = 240000) {
    if (this.isFull()) return Promise.resolve(true);
    if (!this.started || this.status.error || this.pref === 'lite') return Promise.resolve(this.isFull());
    return new Promise((resolve) => {
      const t = setTimeout(() => { off(); resolve(this.isFull()); }, timeoutMs);
      const off = this.subscribe((s) => { if (s.flavor?.startsWith('full') || s.error) { clearTimeout(t); off(); resolve(this.isFull()); } });
    });
  }
  /** Resolves when nothing is running and nothing is queued. */
  whenIdle() {
    if (!this.running && !this.queue.length) return Promise.resolve();
    return new Promise((resolve) => { this.idleWaiters = this.idleWaiters || []; this.idleWaiters.push(resolve); });
  }
  /** True while a job tagged `tag` runs or waits. */
  busyWith(tag) { return this.running?.job.tag === tag || this.queue.some(q => q.job.tag === tag); }

  /** Start: lite now, full in the background (unless the saved preference is lite). */
  async start(pref = 'full') {
    if (this.started) return this.ready;
    this.started = true;
    this.pref = pref;
    const boot = async (flavor) => {
      const lite = new Worker1(flavor);
      try { await lite.init(); } catch (e) {
        lite.terminate();
        if (flavor.endsWith('-mt') && this.threadsFailed(e)) return boot(single(flavor));
        throw e;
      }
      if (this.worker) { lite.terminate(); return; } // full got there first
      this.worker = lite;
      this.status = { ...this.status, flavor: lite.flavor, threads: lite.threads };
      this.emit();
    };
    this.ready = boot(canThread() ? 'lite-mt' : 'lite-single')
      .catch((e) => { this.status = { ...this.status, error: String(e.message || e) }; this.emit(); });
    await this.ready;
    if (pref === 'full') this.upgrade(canThread() ? 'full-mt' : 'full-single');
    return this.ready;
  }

  /** A multi-threaded worker whose threads could not start: use one thread for the rest of the session. */
  threadsFailed(e) {
    if (!/__error__ threads/.test(String(e?.message || e))) return false;
    threadsBroken = true;
    return true;
  }

  /** The user switched to full strength in Settings (lite takes effect on the next launch). */
  setPref(pref) {
    this.pref = pref;
    if (!this.started || pref !== 'full') return;
    this.ready.then(() => this.upgrade(canThread() ? 'full-mt' : 'full-single'));
  }

  /** A worker died (out of memory, say): replace it with a fresh lite one so play goes on. */
  recover(dead, err) {
    if (this.worker !== dead) return;
    dead.terminate();
    this.worker = null;
    this.opts = {};
    if (err) this.threadsFailed(err);
    if (this.next) { this.swap(); return; }
    this.recoveries = (this.recoveries || 0) + 1;
    if (this.recoveries > 3) {
      this.status = { ...this.status, flavor: null, loading: null, error: 'The engine keeps stopping. Reload the app to try again.' };
      this.emit();
      for (const q of this.queue) q.resolve(null);
      this.queue = [];
      return;
    }
    const lite = new Worker1(canThread() ? 'lite-mt' : 'lite-single');
    this.status = { ...this.status, flavor: null, loading: null, error: 'The engine stopped unexpectedly and was restarted on the lite network.' };
    this.emit();
    this.ready = lite.init().then(() => {
      this.worker = lite;
      this.status = { ...this.status, flavor: lite.flavor, threads: lite.threads };
      this.emit();
    }).catch((e) => { this.status = { ...this.status, error: String(e.message || e) }; this.emit(); });
  }

  /** Load the full network in a second worker and switch to it between two searches. */
  async upgrade(flavor) {
    if (this.status.loading || this.worker?.flavor === flavor || this.next) return;
    this.status = { ...this.status, loading: flavor };
    this.emit();
    try {
      const full = new Worker1(flavor);
      try { await full.init(); } catch (e) {
        full.terminate();
        if (flavor.endsWith('-mt') && this.threadsFailed(e)) {
          this.status = { ...this.status, loading: null };
          return this.upgrade(single(flavor));
        }
        throw e;
      }
      this.next = full;
      if (!this.running) this.swap();
    } catch (e) {
      this.fullTried++;
      this.status = { ...this.status, loading: null, error: `Full engine failed to load: ${e.message || e}` };
      this.emit();
      // one more go after a pause (a stalled download usually completes the second time)
      if (this.fullTried < 2) setTimeout(() => { this.status = { ...this.status, error: null }; this.upgrade(flavor); }, 15000);
    }
  }

  swap() {
    if (!this.next) return;
    const old = this.worker;
    this.worker = this.next;
    this.next = null;
    this.opts = {};
    old?.terminate();
    this.status = { ...this.status, flavor: this.worker.flavor, threads: this.worker.threads, loading: null, error: null };
    this.emit();
  }

  /**
   * Search a position. job: {
   *   fen, moves?: [uci], movetime?: ms, depth?, nodes?, multipv?: 1..5,
   *   elo?: 1320..3190 (UCI_LimitStrength), skill?: 0..20,
   *   tag?: string, preempt?: bool (stop jobs with the same tag), stops?: [tags] (stop those),
   *   priority?: 'low'  (runs only when nothing else is waiting, and yields to any other job:
   *                      the result then has `yielded: true` and should be searched again),
   *   onInfo?: (lines) => void   (live updates, White's point of view)
   * }
   * Resolves { bestmove, ponder, lines: [{ multipv, depth, cp?, mate?, pv }] } with scores from
   * White's point of view, or null if the job was cancelled before it started.
   */
  search(job) {
    return new Promise((resolve) => {
      const entry = { job: { tag: 'job', ...job }, resolve };
      const kill = new Set([...(job.stops || []), ...(job.preempt ? [entry.job.tag] : [])]);
      if (kill.size) this.cancel(kill);
      this.queue.push(entry);
      // a background job steps aside for anything the user is waiting on
      if (entry.job.priority !== 'low' && this.running?.job.priority === 'low' && !this.running.yielded) { this.running.yielded = true; this.worker?.send('stop'); }
      this.pump();
    });
  }

  /** Stop whatever is running and drop the queue (only jobs with these tags, if given). */
  cancel(tags = null) {
    const hit = (e) => !tags || tags.has?.(e.job.tag) || (Array.isArray(tags) && tags.includes(e.job.tag)) || tags === e.job.tag;
    for (const q of this.queue.filter(hit)) q.resolve(null);
    this.queue = this.queue.filter(q => !hit(q));
    if (this.running && hit(this.running)) { this.running.stopped = true; this.worker?.send('stop'); }
  }

  async pump() {
    if (this.running || !this.queue.length) return;
    await this.ready;
    if (this.running || !this.queue.length) return;
    if (this.next) this.swap();
    const w = this.worker;
    if (!w) { for (const q of this.queue) q.resolve(null); this.queue = []; return; }
    const pick = this.queue.findIndex(q => q.job.priority !== 'low');
    const entry = this.queue.splice(pick >= 0 ? pick : 0, 1)[0];
    this.running = entry;
    const { job } = entry;
    const whiteToMove = (job.fen || '').split(' ')[1] !== 'b';
    const sideToMove = job.moves?.length % 2 ? !whiteToMove : whiteToMove;
    const sign = sideToMove ? 1 : -1;
    // options (only when they change)
    const want = {
      MultiPV: job.multipv || 1,
      UCI_LimitStrength: job.elo ? 'true' : 'false',
      UCI_Elo: job.elo || this.opts.UCI_Elo || 1500,
      'Skill Level': job.skill ?? 20,
    };
    for (const [k, v] of Object.entries(want)) {
      if (this.opts[k] !== v) { w.send(`setoption name ${k} value ${v}`); this.opts[k] = v; }
    }
    const lines = [];
    const listener = (line) => {
      if (line.startsWith('info') && line.includes(' pv ') && !line.includes(' currmove ')) {
        const i = parseInfo(line);
        if (i.bound || i.depth == null) return;
        const k = (i.multipv || 1) - 1;
        lines[k] = { multipv: i.multipv, depth: i.depth, pv: i.pv || [], nps: i.nps,
          ...(i.cp != null ? { cp: sign * i.cp } : {}), ...(i.mate != null ? { mate: sign * i.mate } : {}) };
        job.onInfo?.(lines.filter(Boolean));
      }
    };
    w.listeners.add(listener);
    const done = w.waitFor(l => l.startsWith('bestmove') || l.startsWith('__error__'), (job.movetime || 60000) + 120000);
    if (job.newGame) w.send('ucinewgame');
    w.send(`position fen ${job.fen}${job.moves?.length ? ` moves ${job.moves.join(' ')}` : ''}`);
    const go = job.depth ? `depth ${job.depth}` : job.nodes ? `nodes ${job.nodes}` : `movetime ${job.movetime || 1000}`;
    w.send(`go ${go}`);
    let res = null;
    let crashed = null;
    try {
      const line = await done;
      if (line.startsWith('__error__')) throw new Error(line);
      const [, best, , ponder] = line.split(' ');
      res = { bestmove: best && best !== '(none)' ? best : null, ponder: ponder || null, lines: lines.filter(Boolean), flavor: w.flavor, threads: w.threads, stopped: !!entry.stopped, yielded: !!entry.yielded };
    } catch (e) {
      crashed = e || new Error('engine error');
      res = { bestmove: null, lines: [], flavor: w.flavor };
    }
    w.listeners.delete(listener);
    if (crashed) this.recover(w, crashed);
    this.running = null;
    if (this.next && !crashed) this.swap();
    entry.resolve(res);
    if (!this.queue.length && this.idleWaiters?.length) { const ws = this.idleWaiters; this.idleWaiters = []; ws.forEach(f => f()); }
    this.pump();
  }
}

export const engine = new EngineManager();

/** Engine score (White's POV) → a single number in pawns, mates as ±(100 − distance). */
export function scoreOf(line) {
  if (!line) return 0;
  if (line.mate != null) return line.mate > 0 ? 100 - line.mate : line.mate === 0 ? 0 : -100 - line.mate;
  return (line.cp ?? 0) / 100;
}

export const FLAVOR_NAME = {
  'full-mt': 'Stockfish 17.1 · full network',
  'full-single': 'Stockfish 17.1 · full network, 1 thread',
  'lite-mt': 'Stockfish 17.1 · lite network',
  'lite-single': 'Stockfish 17.1 · lite network, 1 thread',
};
