// Run: node test/engine.test.mjs — the engine manager against a fake Stockfish worker: a
// multi-threaded build whose threads cannot start (the loader prints "worker sent an error!"
// without end) must be stopped and replaced by the single-threaded build, not retried forever.
globalThis.self = globalThis;
globalThis.crossOriginIsolated = true;
globalThis.SharedArrayBuffer = globalThis.SharedArrayBuffer || class {};
Object.defineProperty(globalThis, "navigator", { value: { hardwareConcurrency: 8 }, configurable: true });

const made = [];
class FakeWorker {
  constructor(url) {
    this.url = url;
    this.mt = !url.includes('single');
    this.posted = [];
    this.alive = true;
    made.push(this);
  }
  emit(line) { if (this.alive) setTimeout(() => this.onmessage?.({ data: line }), 0); }
  postMessage(cmd) {
    this.posted.push(cmd);
    if (cmd === 'uci') this.emit('uciok');
    else if (cmd === 'isready') this.emit('readyok');
    else if (cmd.startsWith('setoption name Threads') && this.mt && !cmd.endsWith('value 1')) {
      // the fork bomb: the loader keeps spawning threads that die, and says so each time
      const storm = () => { if (!this.alive) return; this.emit('worker sent an error! x.js:11: Uncaught [object ErrorEvent]'); this.emit('worker sent an unknown command undefined'); setTimeout(storm, 1); };
      storm();
    } else if (cmd.startsWith('go')) { this.emit('info depth 10 multipv 1 score cp 20 pv e2e4'); this.emit('bestmove e2e4'); }
  }
  terminate() { this.alive = false; }
}
globalThis.Worker = FakeWorker;

const { engine } = await import('../src/engine/engine.js');

let fails = 0;
const check = (name, cond, got) => { if (!cond) { fails++; console.log('FAIL', name, '\n   ', got); } else console.log('ok  ', name, '|', JSON.stringify(got)); };

await engine.start('full');
await new Promise(r => setTimeout(r, 2500)); // the thread probe is 1.5 s per build
const flavors = made.map(w => w.url.split('/').pop());
check('lite-mt died on its threads and a single-threaded build took over', /-single$/.test(engine.flavor() || ''), { flavor: engine.flavor(), made: flavors });
check('the storm was stopped (the dead worker was terminated)', made.filter(w => w.mt).every(w => !w.alive), made.filter(w => w.mt).map(w => w.alive));
const r = await engine.search({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', movetime: 10 });
check('searches run on a single-threaded build', r?.bestmove === 'e2e4' && /-single$/.test(r.flavor) && r.threads === 1, { bestmove: r?.bestmove, flavor: r?.flavor, threads: r?.threads });
await new Promise(r => setTimeout(r, 2500));
check('the full network came up single-threaded, not multi-threaded', engine.flavor() === 'full-single' && !engine.status.error, { flavor: engine.flavor(), error: engine.status.error });
check('no multi-threaded worker was started again this session (the full network went straight to one thread)', made.filter(w => w.mt).length === 1, made.map(w => w.url.split('/').pop()));

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log('\nall good');
process.exit(0);
