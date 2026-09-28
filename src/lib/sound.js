/** Small synthesized sounds (no files to download). */
import { getPrefs } from './prefs.js';

let ctx;
function tone(freq, dur, type = 'sine', vol = 0.18, delay = 0) {
  if (!getPrefs().sound) return;
  if (!ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return; // no sound before the first tap
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch { /* no audio */ }
}
function knock(vol = 0.25, freq = 220) {
  tone(freq, 0.06, 'triangle', vol);
  tone(freq * 2.1, 0.03, 'sine', vol * 0.4);
}

export const sfx = {
  move: () => knock(0.22, 240),
  capture: () => { knock(0.28, 180); tone(120, 0.08, 'triangle', 0.18, 0.02); },
  check: () => { knock(0.24, 260); tone(880, 0.12, 'sine', 0.08, 0.03); },
  castle: () => { knock(0.2, 240); knock(0.2, 250); },
  good: () => { tone(660, 0.1, 'sine', 0.12); tone(990, 0.16, 'sine', 0.12, 0.09); },
  bad: () => { tone(220, 0.18, 'sawtooth', 0.06); },
  end: () => { tone(523, 0.14, 'sine', 0.12); tone(659, 0.14, 'sine', 0.12, 0.12); tone(784, 0.22, 'sine', 0.12, 0.24); },
};

/** The right sound for a chess.js verbose move made in `game` (after the move). */
export function moveSound(move, inCheck) {
  if (!move) return;
  if (inCheck) sfx.check();
  else if (move.captured) sfx.capture();
  else if (move.flags?.includes('k') || move.flags?.includes('q')) sfx.castle();
  else sfx.move();
}
