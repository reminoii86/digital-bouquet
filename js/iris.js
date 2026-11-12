// The Yes transition: a rose iris drawn on the fx canvas in 4px cells (the gift's art pixel).
// It is canvas pixels, not a DOM element, so iOS Safari has no pink background to tint its bars with.
import { stage } from './stage.js';
import { ease, clamp } from './util.js';

const CELL = 4;
const ROSE = [224, 108, 145];
const EDGE = [245, 201, 192];

const low = document.createElement('canvas');
const lx = low.getContext('2d');
let img = null;
let state = null;

export const active = () => !!state;

/** Close over the screen from (x, y), call onCovered, then open again from (ox, oy). */
export function start(x, y, onCovered, ox = stage.W / 2, oy = stage.H / 2) {
  const w = Math.ceil(stage.W / CELL), h = Math.ceil(stage.H / CELL);
  if (low.width !== w || low.height !== h) {
    low.width = w;
    low.height = h;
    img = lx.createImageData(w, h);
  }
  const r = stage.reduced;
  state = {
    t: 0,
    x: x / CELL, y: y / CELL, ox: ox / CELL, oy: oy / CELL,
    inDur: r ? 0.26 : 0.52, hold: r ? 0.05 : 0.12, outDur: r ? 0.3 : 0.62,
    max: Math.hypot(w, h),
    onCovered, covered: false,
  };
  document.body.classList.add('is-wiping');
}

export function frame(dt, ctx) {
  if (!state) return;
  const s = state;
  s.t += dt;
  const w = low.width, h = low.height, d = img.data;
  let grow = -1, hole = -1;
  if (s.t < s.inDur) {
    grow = ease.inOutCubic(clamp(s.t / s.inDur)) * s.max;
  } else {
    if (!s.covered) {
      s.covered = true;
      s.onCovered && s.onCovered();
    }
    const to = s.t - s.inDur - s.hold;
    if (to > s.outDur) {
      state = null;
      document.body.classList.remove('is-wiping');
      return;
    }
    hole = to <= 0 ? 0 : ease.inOutCubic(clamp(to / s.outDur)) * s.max;
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4;
      let on = false, rim = false;
      if (grow >= 0) {
        const dd = Math.hypot(i - s.x, j - s.y);
        on = dd <= grow;
        rim = on && dd > grow - 1.2;
      } else {
        const dd = Math.hypot(i - s.ox, j - s.oy);
        on = dd > hole;
        rim = on && dd < hole + 1.2 && hole > 0;
      }
      if (!on) { d[o + 3] = 0; continue; }
      const c = rim ? EDGE : ROSE;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
  }
  lx.putImageData(img, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const k = CELL * stage.fxDpr;
  ctx.drawImage(low, 0, 0, w, h, 0, 0, w * k, h * k);
  ctx.restore();
}
