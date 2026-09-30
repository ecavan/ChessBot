import { useEffect, useRef } from 'react';
import { useRoute, href } from './lib/router.js';
import { usePrefs } from './lib/prefs.js';
import { engine, FLAVOR_NAME } from './engine/engine.js';
import { useEngineStatus } from './engine/useEngine.js';
import { loadBook } from './lib/book.js';
import { Spinner } from './ui/kit.jsx';
import Home from './modes/Home.jsx';
import Play from './modes/Play.jsx';
import Watch from './modes/Watch.jsx';
import Puzzles from './modes/Puzzles.jsx';
import Train from './modes/Train.jsx';
import Review from './modes/Review.jsx';
import Settings from './modes/Settings.jsx';

const TABS = [
  ['', 'Home', HomeIcon],
  ['play', 'Play', PlayIcon],
  ['watch', 'Watch', WatchIcon],
  ['puzzles', 'Puzzles', PuzzleIcon],
  ['train', 'Train', TrainIcon],
  ['review', 'Review', ReviewIcon],
];

export default function App() {
  const route = useRoute();
  const [prefs] = usePrefs();
  useEffect(() => { engine.start(prefs.engine); loadBook(); try { navigator.storage?.persist?.(); } catch { /* not supported */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    const apply = () => {
      const t = prefs.theme === 'system' ? (mq?.matches ? 'light' : 'dark') : prefs.theme;
      document.documentElement.dataset.theme = t;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#ffffff' : '#07090d');
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [prefs.theme]);
  const firstPref = useRef(true);
  useEffect(() => { if (firstPref.current) { firstPref.current = false; return; } engine.setPref(prefs.engine); }, [prefs.engine]);
  const sec = route.parts[0] || '';
  let page;
  switch (sec) {
    case 'play': page = <Play route={route} />; break;
    case 'watch': page = <Watch />; break;
    case 'puzzles': page = <Puzzles route={route} />; break;
    case 'train': page = <Train route={route} />; break;
    case 'review': page = <Review route={route} />; break;
    case 'settings': page = <Settings />; break;
    default: page = <Home />;
  }
  return (
    <div className="shell">
      <header className="topbar">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 h-[52px] md:h-14 max-w-[1500px] mx-auto">
          <a href="#/" className="flex items-center gap-2.5 shrink-0">
            <img src="/icon.svg" alt="" className="w-8 h-8 rounded-[9px] shadow-card" />
            <span className="font-semibold text-white tracking-tight hidden sm:block">Chess Trainer</span>
          </a>
          <nav className="tabbar-top">
            {TABS.map(([k, label]) => <a key={k} href={`#/${k}`} className={sec === k ? 'on' : ''}>{label}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <EnginePill />
            <a href="#/settings" aria-label="Settings" className={`ibtn !w-10 !h-10 ${sec === 'settings' ? '!border-emerald-500' : ''}`}><GearIcon /></a>
          </div>
        </div>
      </header>
      <main className="flex-1" key={sec}>{page}</main>
      <nav className="tabbar-bottom">
        {TABS.map(([k, label, Icon]) => (
          <a key={k} href={`#/${k}`} className={sec === k ? 'on' : ''}><Icon /><span>{label}</span></a>
        ))}
      </nav>
    </div>
  );
}

function EnginePill() {
  const st = useEngineStatus();
  const full = st.flavor?.startsWith('full');
  return (
    <a href={href('/settings')} className="pill !py-1.5 hidden sm:inline-flex" title={st.flavor ? FLAVOR_NAME[st.flavor] : 'Starting engine'}>
      {st.loading ? <Spinner size={12} /> : <span className={`w-2 h-2 rounded-full ${st.error ? 'bg-rose-500' : full ? 'bg-emerald-400' : 'bg-amber-400'}`} />}
      <span>SF 17.1</span>
      <span className="text-ink-300 font-medium">{st.loading && !full ? 'loading full…' : full ? `full${st.threads > 1 ? ` · ${st.threads} threads` : ''}` : st.flavor ? 'lite' : '…'}</span>
    </a>
  );
}

const I = (d) => function Icon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>; };
function HomeIcon() { return I(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>)(); }
function PlayIcon() { return I(<><path d="M9 20h6" /><path d="M10 20l-1-6h6l-1 6" /><path d="M12 4a3 3 0 110 6 3 3 0 010-6z" /></>)(); }
function WatchIcon() { return I(<><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M10 9l4 2-4 2z" /><path d="M8 21h8" /></>)(); }
function PuzzleIcon() { return I(<><path d="M4 8h4a2 2 0 114 0h4v4a2 2 0 110 4v4H4z" /></>)(); }
function TrainIcon() { return I(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>)(); }
function ReviewIcon() { return I(<><path d="M3 17l5-6 4 4 8-9" /><path d="M14 6h6v6" /></>)(); }
function GearIcon() { return I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>)(); }
