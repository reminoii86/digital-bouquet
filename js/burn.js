// Burns a DOM button away: snapshot to canvas, then a noise-threshold dissolve with a glowing edge,
// char band, flames, embers, smoke, and falling ash.
import { stage } from './stage.js';
import * as P from './particles.js';
import { rand, clamp } from './util.js';

const active = [];

function roundRect(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

function valueNoise(w, h, cell) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = Math.random();
  const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const gy = j / cell, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy);
    for (let i = 0; i < w; i++) {
      const gx = i / cell, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx);
      const a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1], c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
      out[j * w + i] = (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
    }
  }
  return out;
}

function buildKey(w, h, origin) {
  const n1 = valueNoise(w, h, Math.max(6, w / 9));
  const n2 = valueNoise(w, h, Math.max(3, w / 26));
  // The fire starts where her finger touched; keyboard presses ignite from the bottom edge.
  const ix = origin ? origin.x * stage.dpr : rand(0.3, 0.7) * w;
  const iy = origin ? origin.y * stage.dpr : h * 1.05;
  const key = new Float32Array(w * h);
  let mn = Infinity, mx = -Infinity;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const d = Math.hypot((i - ix) / w, ((j - iy) / h) * 0.55);
      const v = d * 0.6 + (n1[k] * 0.7 + n2[k] * 0.3) * 0.4;
      key[k] = v;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
  }
  const span = mx - mn || 1;
  for (let k = 0; k < key.length; k++) key[k] = (key[k] - mn) / span;
  return key;
}

/** Stop every burn without calling onDone (Yes won the race). */
export function cancel() {
  active.length = 0;
}

export function start(el, { onDone, origin } = {}) {
  const r = el.getBoundingClientRect();
  const dpr = stage.dpr;
  const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const x = cv.getContext('2d', { willReadFrequently: true });
  const cs = getComputedStyle(el);
  x.scale(dpr, dpr);
  roundRect(x, 0.5, 0.5, r.width - 1, r.height - 1, parseFloat(cs.borderTopLeftRadius) || 16);
  x.fillStyle = cs.backgroundColor;
  x.fill();
  x.lineWidth = 1;
  x.strokeStyle = cs.borderTopColor;
  x.stroke();
  x.fillStyle = cs.color;
  x.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(el.textContent.trim(), r.width / 2, r.height / 2 + 1);
  x.setTransform(1, 0, 0, 1, 0, 0);

  const src = x.getImageData(0, 0, w, h);
  active.push({
    el, r, cv, x, src, out: x.createImageData(w, h), w, h,
    key: buildKey(w, h, origin),
    t: 0, dur: stage.reduced ? 1.2 : 1.9, onDone, acc: { f: 0, e: 0, s: 0 },
  });
  el.classList.add('is-burning');
}

const E = 0.07;   // glowing edge width (in key units)
const C = 0.13;   // char band
const HT = 0.2;   // heat-tint band

export function frame(dt, ctx) {
  if (stage.scene !== 'landing') { active.length = 0; return; }
  for (let a = active.length - 1; a >= 0; a--) {
    const b = active[a];
    b.t += dt;
    const lin = clamp(b.t / b.dur);
    const p = -0.04 + (lin * lin * 0.35 + lin * 0.65) * 1.24;
    const s = b.src.data, o = b.out.data, key = b.key;

    for (let k = 0, n = b.w * b.h; k < n; k++) {
      const i4 = k * 4;
      const sa = s[i4 + 3];
      if (sa === 0) { o[i4 + 3] = 0; continue; }
      const dl = key[k] - p;
      if (dl < -E) {
        o[i4 + 3] = 0;
      } else if (dl < 0) {
        const f = -dl / E;
        o[i4] = 255;
        o[i4 + 1] = (235 - f * 175) | 0;
        o[i4 + 2] = (150 - f * 140) | 0;
        o[i4 + 3] = ((1 - f * f) * sa) | 0;
      } else if (dl < C) {
        // Char band: the button is near-black, so the scorch has to emit light to be seen.
        const f = dl / C, m = f * f;
        let glow = f < 0.4 ? (1 - f / 0.4) : 0;
        glow *= 0.6 + 0.8 * ((key[k] * 97) % 1); // ember crackle
        o[i4] = 42 + (s[i4] - 42) * m + glow * 190;
        o[i4 + 1] = 26 + (s[i4 + 1] - 26) * m + glow * 60;
        o[i4 + 2] = 18 + (s[i4 + 2] - 18) * m;
        o[i4 + 3] = sa;
      } else if (dl < C + HT) {
        const f = (dl - C) / HT, m = 0.72 + 0.28 * f, h = (1 - f) * (1 - f);
        o[i4] = s[i4] * m + 150 * h;
        o[i4 + 1] = s[i4 + 1] * m * 0.96 + 46 * h;
        o[i4 + 2] = s[i4 + 2] * m * 0.86;
        o[i4 + 3] = sa;
      } else {
        o[i4] = s[i4]; o[i4 + 1] = s[i4 + 1]; o[i4 + 2] = s[i4 + 2]; o[i4 + 3] = sa;
      }
    }
    b.x.putImageData(b.out, 0, 0);

    // Fire particles along the burning edge.
    if (lin < 0.97) {
      const q = stage.quality * (stage.reduced ? 0.4 : 1);
      b.acc.f += dt * 95 * q;
      b.acc.e += dt * 16 * q;
      b.acc.s += dt * 11 * q;
      let need = Math.floor(b.acc.f) + Math.floor(b.acc.e) + Math.floor(b.acc.s);
      for (let tries = 0; tries < 400 && need > 0; tries++) {
        const k = (Math.random() * b.w * b.h) | 0;
        const dl = key[k] - p;
        if (dl > -E && dl < 0.015 && s[k * 4 + 3] > 0) {
          const px = b.r.left + (k % b.w) / stage.dpr;
          const py = b.r.top + ((k / b.w) | 0) / stage.dpr;
          if (b.acc.f >= 1) { P.flame(px, py); b.acc.f--; }
          else if (b.acc.e >= 1) { P.ember(px, py); b.acc.e--; }
          else if (b.acc.s >= 1) { P.smoke(px, py - 6); b.acc.s--; }
          need--;
        }
      }
    }

    const wob = stage.reduced ? 0 : Math.sin(b.t * 23) * 0.022 * (1 - lin);
    ctx.save();
    ctx.translate(b.r.left + b.r.width / 2, b.r.top + b.r.height / 2);
    ctx.rotate(wob);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(b.cv, -b.r.width / 2, -b.r.height / 2, b.r.width, b.r.height);
    ctx.restore();

    if (lin >= 1) {
      for (let i = 0; i < (stage.reduced ? 10 : 26); i++) {
        P.ash(b.r.left + rand(0.1, 0.9) * b.r.width, b.r.top + rand(0.2, 0.9) * b.r.height);
      }
      active.splice(a, 1);
      if (b.onDone) b.onDone();
    }
  }
}
