// Music = a plain <audio> element (plays even with the iPhone silent switch on, like a video).
// Sound effects = tiny synths in WebAudio, no files needed.
import { CONFIG } from '../config.js';
import { rand, pick } from './util.js';

const music = document.getElementById('music');
let ctx = null, master = null, noiseBuf = null;
let muted = false, musicOk = false, musicStarted = false, musicUnlocked = false, lastHeart = 0;

export function init() {
  // Only attach the song if it actually exists, so a missing file stays silent and quiet.
  const src = CONFIG.music && CONFIG.music.src;
  if (!src || !music) return;
  fetch(src, { method: 'HEAD' })
    .then(r => {
      if (!r.ok) return;
      musicOk = true;
      music.src = src;
      music.load();
    })
    .catch(() => {});
  music.addEventListener('error', () => { musicOk = false; });
}

/** Call from any user gesture. Creates/resumes the audio context. */
export function unlock() {
  try {
    if (!ctx) {
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.6;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (_) { /* audio is a nice-to-have */ }
}

/** Call inside her Yes press: playing muted once lets the song start later without a tap (iOS rule). */
export function unlockMusic() {
  if (!musicOk || musicUnlocked) return;
  musicUnlocked = true;
  music.muted = true;
  const p = music.play();
  const settle = () => { if (!musicStarted) { music.pause(); music.currentTime = 0; } music.muted = muted; };
  if (p && p.then) p.then(settle).catch(() => { musicUnlocked = false; music.muted = muted; });
  else settle();
}

/** Starts the song with a fade. If Safari still refuses, it starts on her next tap. */
export function startMusic() {
  if (!musicOk || musicStarted) return;
  musicStarted = true;
  music.muted = muted;
  try { music.currentTime = 0; } catch (_) {}
  const target = (CONFIG.music && CONFIG.music.volume) || 0.7;
  try { music.volume = 0; } catch (_) {}
  const p = music.play();
  if (p && p.catch) {
    p.catch(() => {
      musicStarted = false;
      window.addEventListener('pointerdown', () => startMusic(), { once: true, capture: true });
    });
  }
  // Fade in where the browser allows volume changes (iOS ignores volume and just plays).
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / 3500);
    try { music.volume = target * k; } catch (_) {}
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function toggleMute() {
  muted = !muted;
  if (music) music.muted = muted;
  if (master) master.gain.value = muted ? 0 : 0.6;
  return muted;
}

export function pauseAll() {
  if (musicStarted && !music.paused) music.pause();
  if (ctx && ctx.state === 'running') ctx.suspend();
}
export function resumeAll() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
  if (musicStarted && music.paused) {
    const p = music.play();
    if (p && p.catch) p.catch(() => {});
  }
}

/* Synth helpers */

function ok() { return ctx && master && !muted && ctx.state === 'running'; }

function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function tone({ type = 'sine', f0, f1, dur, peak = 0.2, a = 0.005, when = 0 }) {
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + a + dur);
  const g = ctx.createGain();
  env(g, t0, a, peak, dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + a + dur + 0.05);
}

function noise({ type = 'bandpass', f0 = 1000, f1, q = 1, dur, peak = 0.1, a = 0.005, when = 0 }) {
  const t0 = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(f0, t0);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + a + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t0, a, peak, dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0, rand(0, 0.5));
  src.stop(t0 + a + dur + 0.05);
}

export const sfx = {
  heart() {
    if (!ok()) return;
    const now = ctx.currentTime;
    if (now - lastHeart < 0.06) return;
    lastHeart = now;
    tone({ type: 'triangle', f0: rand(640, 900), f1: rand(1100, 1500), dur: 0.09, peak: 0.06 });
  },
  accept() {
    if (!ok()) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ f0: f, dur: 0.55, peak: 0.07, a: 0.01, when: i * 0.06 }));
  },
  crackle(dur = 1.9) {
    if (!ok()) return;
    noise({ type: 'bandpass', f0: 300, f1: 1800, q: 0.8, dur: 0.45, peak: 0.08, a: 0.05 });
    noise({ type: 'lowpass', f0: 420, dur, peak: 0.1, a: 0.25 });
    for (let i = 0; i < 70; i++) {
      noise({ type: 'bandpass', f0: rand(1400, 5200), q: 2.2, dur: rand(0.008, 0.035), peak: rand(0.04, 0.16), when: rand(0, dur) });
    }
  },
  knock() {
    if (!ok()) return;
    tone({ f0: 190, f1: 90, dur: 0.12, peak: 0.16 });
    noise({ type: 'lowpass', f0: 900, dur: 0.05, peak: 0.05 });
  },
  burst() {
    if (!ok()) return;
    tone({ f0: 150, f1: 42, dur: 0.55, peak: 0.32 });
    noise({ type: 'highpass', f0: 1800, dur: 0.35, peak: 0.1 });
    noise({ type: 'bandpass', f0: 500, f1: 3200, q: 0.7, dur: 0.6, peak: 0.1, a: 0.02 });
    for (let i = 0; i < 7; i++) {
      tone({ f0: pick([1318.5, 1568, 1760, 2093, 2637]), dur: 0.7, peak: 0.035, when: 0.08 + i * 0.07 });
    }
  },
  whoosh() {
    if (!ok()) return;
    noise({ type: 'bandpass', f0: 240, f1: 2400, q: 0.8, dur: 0.5, peak: 0.1, a: 0.22 });
  },
  shimmer() {
    if (!ok()) return;
    [659.25, 830.61, 987.77, 1318.5, 1661.2].forEach((f, i) => tone({ f0: f, dur: 1.7, peak: 0.04, a: 0.09, when: i * 0.13 }));
  },
  pop() {
    if (!ok()) return;
    tone({ f0: rand(420, 600), f1: rand(900, 1300), dur: 0.12, peak: 0.1 });
    noise({ type: 'highpass', f0: 3000, dur: 0.03, peak: 0.035 });
  },
  tick() {
    if (!ok()) return;
    tone({ type: 'square', f0: rand(1800, 2400), dur: 0.012, peak: 0.01 });
  },
};
