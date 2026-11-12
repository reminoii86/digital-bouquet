import { clamp } from './util.js';

/** Shared, mutable view state. All coordinates are CSS px unless noted. */
export const stage = {
  W: 1,
  H: 1,
  dpr: 1,      // ASCII canvas (capped at 2 for speed)
  fxDpr: 1,    // effects canvas: the true density, so pixel art stays crisp on 3x phones
  t: 0,
  scene: 'landing',
  reduced: false,
  paused: false,
  shake: 0,
  quality: 1,
  insets: { t: 0, r: 0, b: 0, l: 0 },
  frame: { l: 0, t: 0, r: 1, b: 1 }, // the bouquet's safe rectangle, from #frame
};

export const bloomCanvas = document.getElementById('bloom');
export const fxCanvas = document.getElementById('fx');
export const bctx = bloomCanvas.getContext('2d');
export const fctx = fxCanvas.getContext('2d');

const handlers = [];
export const onResize = fn => handlers.push(fn);

function readPadding(id) {
  const el = document.getElementById(id);
  if (!el) return { t: 0, r: 0, b: 0, l: 0 };
  const cs = getComputedStyle(el);
  return {
    t: parseFloat(cs.paddingTop) || 0,
    r: parseFloat(cs.paddingRight) || 0,
    b: parseFloat(cs.paddingBottom) || 0,
    l: parseFloat(cs.paddingLeft) || 0,
  };
}

export function measure() {
  const prevDpr = stage.dpr;
  const raw = window.devicePixelRatio || 1;
  stage.dpr = clamp(raw, 1, 2);
  stage.fxDpr = clamp(raw, 1, 3);
  stage.W = Math.max(1, window.innerWidth);
  stage.H = Math.max(1, window.innerHeight);
  bloomCanvas.width = Math.round(stage.W * stage.dpr);
  bloomCanvas.height = Math.round(stage.H * stage.dpr);
  fxCanvas.width = Math.round(stage.W * stage.fxDpr);
  fxCanvas.height = Math.round(stage.H * stage.fxDpr);
  stage.insets = readPadding('safe');
  const f = readPadding('frame');
  stage.frame = { l: f.l, t: f.t, r: stage.W - f.r, b: stage.H - f.b };
  handlers.forEach(fn => fn(prevDpr !== stage.dpr));
}
