let ctx;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function play(freq, duration, type = 'sine', volume = 0.3) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(c.destination);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.start();
    osc.stop(c.currentTime + duration);
  } catch {
    // Audio not available
  }
}

export const sounds = {
  move: () => play(600, 0.08, 'sine', 0.15),
  capture: () => play(400, 0.12, 'square', 0.2),
  check: () => play(800, 0.15, 'triangle', 0.25),
  success: () => {
    play(523, 0.15, 'sine', 0.2);
    setTimeout(() => play(659, 0.15, 'sine', 0.2), 150);
    setTimeout(() => play(784, 0.2, 'sine', 0.2), 300);
  },
  error: () => play(200, 0.2, 'sawtooth', 0.1),
};

export function playMoveSound(game, move) {
  if (!move) return;
  if (game.inCheck()) {
    sounds.check();
  } else if (move.captured) {
    sounds.capture();
  } else {
    sounds.move();
  }
}
