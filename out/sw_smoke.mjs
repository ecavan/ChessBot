// Does the engine run multi-threaded with the service worker in control? (fork-bomb regression)
import pw from '/opt/npm-tools/node_modules/playwright/index.js';
const { chromium } = pw;
const url = 'http://localhost:4174/';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 100)); });
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e).slice(0, 100)));
await page.goto(url);
// first load installs the SW; wait for it to control the page, then reload so everything goes through it
await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 60000 }).catch(() => {});
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(3000);
await page.reload();
await page.waitForTimeout(1500);
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
const log = [];
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(5000);
  const st = await page.evaluate(() => ({ pill: [...document.querySelectorAll('a.pill')].map(a => a.innerText.trim()).join(''), coi: crossOriginIsolated, mem: (() => { try { new WebAssembly.Memory({ initial: 16 }); return 'ok'; } catch { return 'FAIL'; } })() }));
  log.push(`${(i + 1) * 5}s ${st.pill} coi=${st.coi} mem=${st.mem} errors=${errors.length}`);
  if (/full · \d+ threads/.test(st.pill) || /failed/.test(st.pill)) break;
}
console.log('controlled by SW:', controlled);
console.log(log.join('\n'));
console.log('errors:', errors.length, errors.slice(0, 5));
// thread test: a worker with the thread fragment must stay silent
const threadMsgs = await page.evaluate(async () => {
  const base = location.origin + '/stockfish/stockfish-17.1-lite-51f59da';
  const msgs = []; const w = new Worker(base + '.js#' + base + '.wasm,worker');
  w.onmessage = e => msgs.push(String(e.data).slice(0, 50));
  await new Promise(r => setTimeout(r, 2500)); w.terminate(); return msgs.length;
});
console.log('thread-fragment worker messages (want 0):', threadMsgs);
await browser.close();
