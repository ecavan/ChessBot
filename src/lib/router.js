/** Hash routing: #/section/sub?x=y */
import { useSyncExternalStore } from 'react';

function parse() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { path, parts, query: Object.fromEntries(new URLSearchParams(qs)), key: h };
}
let cur = parse();
const subs = new Set();
window.addEventListener('hashchange', () => { cur = parse(); for (const f of subs) f(); window.scrollTo(0, 0); });

export function useRoute() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => cur);
}
export function go(path, query) {
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')).toString() : '';
  const h = '#' + path + (qs.length > 1 ? qs : '');
  if (location.hash === h) return;
  location.hash = h;
}
export const href = (path, query) => '#' + path + (query ? '?' + new URLSearchParams(query).toString() : '');
