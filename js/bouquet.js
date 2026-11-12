// The wrapped bouquet (new reference): kraft-paper back sheet with a crumpled top and fanning
// creases, two front sheets folded over the stems, a pink ribbon bow at the tie, a stem bundle
// below it, and a literal ASCII tag hanging from the bow. Painted into the glyph field like the
// flowers, so it all comes out as characters.
import { stage } from './stage.js';
import { glyph } from './ascii.js';
import { CONFIG } from '../config.js';
import { clamp, ease, seeded, TAU } from './util.js';

// The composition was drawn for a phone: x in box widths, y in heights 2.165 times the box width.
// It spans y 0.03..0.775, and is fitted into the safe frame (below the controls, above the dock).
const ASPECT = 2.165;
const SPAN = 0.745;

export function layout() {
  const f = stage.frame;
  const fw = Math.max(1, f.r - f.l), fh = Math.max(1, f.b - f.t);
  const bw = Math.min(fw, fh / (SPAN * ASPECT));
  const Heff = bw * ASPECT;
  return { bw, bx: f.l + (fw - bw) / 2, Heff, top: f.t + (fh - SPAN * Heff) * 0.4 };
}
export const box = () => { const L = layout(); return { bw: L.bw, bx: L.bx }; };
export const BX = x => { const L = layout(); return L.bx + x * L.bw; };
export const BY = y => { const L = layout(); return L.top + (y - 0.03) * L.Heff; };
/** Inverse of BX/BY: screen point to composition coordinates. */
export const toBox = (x, y) => { const L = layout(); return { x: (x - L.bx) / L.bw, y: (y - L.top) / L.Heff + 0.03 }; };
const HE = () => layout().Heff;
export const tie = () => ({ x: BX(0.5), y: BY(0.645) });

/** Wrap state; each part animates 0 → 1. */
export function makeWrap(seed = 11) {
  const rnd = seeded(seed);
  const zig = n => Array.from({ length: n + 1 }, () => rnd() - 0.5);
  return { stems: 0, back: 0, front: 0, ribbon: 0, tag: 0, top: zig(10), fl: zig(5), fr: zig(5) };
}

function edge(rc, mul = 1) {
  const c = rc.c;
  c.lineWidth = rc.edgeW * mul;
  c.strokeStyle = rc.mode === 'grid' ? `rgba(0,0,0,${rc.edgeA})` : 'rgba(60,38,20,0.5)';
  c.stroke();
}

function creases(rc, lines) {
  const c = rc.c;
  c.beginPath();
  for (const [x0, y0, cx, cy, x1, y1] of lines) {
    c.moveTo(x0, y0);
    c.quadraticCurveTo(cx, cy, x1, y1);
  }
  c.lineWidth = rc.mode === 'grid' ? rc.cs * 0.5 : 1;
  c.strokeStyle = rc.mode === 'grid' ? 'rgba(0,0,0,0.4)' : 'rgba(80,52,30,0.45)';
  c.stroke();
}

/** Crumpled edge from (x0,y0) to (x1,y1): little scallops offset by `offs`. */
function crumple(c, x0, y0, x1, y1, offs, amp) {
  const n = offs.length - 1;
  for (let k = 1; k <= n; k++) {
    const t = k / n, tm = (k - 0.5) / n;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + offs[k] * amp;
    const xm = x0 + (x1 - x0) * tm, ym = y0 + (y1 - y0) * tm + (offs[k - 1] + offs[k]) * 0.5 * amp - amp * 0.7;
    c.quadraticCurveTo(xm, ym, x, y);
  }
}

export function paintWrapBack(rc, w) {
  if (w.back <= 0.01) return;
  const c = rc.c, { bw } = box(), T = tie(), H = HE();
  const e = clamp(w.back, 0, 1.1); // the timeline already eases it, and raises it as flowers arrive
  const L = { x: BX(0.03), y: BY(0.17) }, R = { x: BX(0.97), y: BY(0.155) };
  c.save();
  c.translate(T.x, T.y);
  c.scale(0.55 + 0.45 * e, Math.max(0.01, e));
  c.translate(-T.x, -T.y);
  c.beginPath();
  c.moveTo(T.x - bw * 0.04, T.y);
  c.quadraticCurveTo(BX(0.15), BY(0.44), L.x, L.y);
  crumple(c, L.x, L.y, R.x, R.y, w.top, H * 0.022);
  c.quadraticCurveTo(BX(0.85), BY(0.44), T.x + bw * 0.04, T.y);
  c.closePath();
  // The back sheet sits in shadow: it reads as sparse ': = +' texture so the flowers stand out.
  const g = c.createLinearGradient(0, T.y, 0, L.y);
  g.addColorStop(0, '#47321F');
  g.addColorStop(0.5, '#6E5238');
  g.addColorStop(1, '#8A6A48');
  c.fillStyle = g;
  c.fill();
  edge(rc);
  const lines = [];
  for (let k = 0; k < 7; k++) {
    const t = (k + 0.5) / 7;
    const tx = L.x + (R.x - L.x) * t;
    const ty = L.y + (R.y - L.y) * t + w.top[Math.round(t * 10)] * H * 0.022 + H * 0.012;
    lines.push([T.x + (t - 0.5) * bw * 0.06, T.y - H * 0.03, T.x + (t - 0.5) * bw * 0.55, (T.y + ty) / 2, tx, ty]);
  }
  creases(rc, lines);
  c.restore();
}

export function paintWrapFront(rc, w) {
  if (w.front <= 0.01) return;
  const c = rc.c, { bw } = box(), T = tie(), H = HE();
  const e = ease.outCubic(clamp(w.front));
  for (const side of [-1, 1]) {
    c.save();
    c.translate(T.x, T.y);
    c.rotate(side * (1 - e) * 0.65);
    c.translate(-T.x, -T.y);
    c.globalAlpha = clamp(w.front * 2);
    const outer = { x: BX(0.5 + side * 0.41), y: BY(0.455) };
    const inner = { x: BX(0.5 - side * 0.09), y: BY(0.525) };
    c.beginPath();
    c.moveTo(T.x + side * bw * 0.015, T.y + H * 0.005);
    c.quadraticCurveTo(BX(0.5 + side * 0.3), BY(0.585), outer.x, outer.y);
    crumple(c, outer.x, outer.y, inner.x, inner.y, side < 0 ? w.fl : w.fr, H * 0.012);
    c.quadraticCurveTo(BX(0.5 - side * 0.02), BY(0.6), T.x - side * bw * 0.02, T.y);
    c.closePath();
    const g = c.createLinearGradient(0, T.y, 0, outer.y);
    g.addColorStop(0, side < 0 ? '#94704A' : '#A07A50');
    g.addColorStop(1, side < 0 ? '#DDBB8F' : '#E8C99E');
    c.fillStyle = g;
    c.fill();
    edge(rc);
    const lines = [];
    for (let k = 0; k < 3; k++) {
      const t = (k + 1) / 4;
      const tx = outer.x + (inner.x - outer.x) * t, ty = outer.y + (inner.y - outer.y) * t + H * 0.012;
      lines.push([T.x + side * bw * 0.01, T.y - H * 0.015, (T.x + tx) / 2 + side * bw * 0.04, (T.y + ty) / 2, tx, ty]);
    }
    creases(rc, lines);
    c.restore();
  }
}

export function paintStemBundle(rc, w) {
  if (w.stems <= 0.01) return;
  const c = rc.c, { bw } = box(), T = tie(), H = HE();
  c.save();
  c.lineCap = 'round';
  c.lineWidth = rc.cs * (rc.mode === 'grid' ? 0.9 : 1.3);
  for (let k = 0; k < 7; k++) {
    const o = k - 3;
    c.beginPath();
    c.moveTo(T.x + o * bw * 0.008, T.y - H * 0.01);
    c.lineTo(T.x + o * bw * 0.022, T.y + H * 0.13 * ease.outCubic(clamp(w.stems)));
    c.strokeStyle = k % 2 ? '#7E9A6A' : '#6A8758';
    c.stroke();
  }
  c.restore();
}

export function paintRibbon(rc, w) {
  if (w.ribbon <= 0.01) return;
  const c = rc.c, u = box().bw, T = tie();
  const s = ease.outBack(clamp(w.ribbon), 2);
  c.save();
  c.translate(T.x, T.y);
  c.scale(s, s);
  for (const side of [-1, 1]) {
    // tail
    c.beginPath();
    c.moveTo(side * u * 0.01, 0);
    c.quadraticCurveTo(side * u * 0.05, u * 0.08, side * u * 0.085, u * 0.16);
    c.lineTo(side * u * 0.055, u * 0.17);
    c.quadraticCurveTo(side * u * 0.03, u * 0.08, -side * u * 0.005, u * 0.012);
    c.closePath();
    c.fillStyle = '#E68AA8';
    c.fill();
    edge(rc, 0.6);
  }
  for (const side of [-1, 1]) {
    // loop
    c.save();
    c.rotate(side * 0.35);
    c.beginPath();
    c.ellipse(side * u * 0.062, -u * 0.004, u * 0.066, u * 0.036, 0, 0, TAU);
    const g = c.createLinearGradient(side * u * 0.12, 0, 0, 0);
    g.addColorStop(0, '#F7B8CB');
    g.addColorStop(1, '#D9708F');
    c.fillStyle = g;
    c.fill();
    edge(rc, 0.6);
    c.beginPath();
    c.ellipse(side * u * 0.06, -u * 0.002, u * 0.03, u * 0.013, 0, 0, TAU);
    c.fillStyle = '#A84E70';
    c.fill();
    c.restore();
  }
  c.beginPath();
  c.arc(0, 0, u * 0.022, 0, TAU);
  c.fillStyle = '#F29BB7';
  c.fill();
  edge(rc, 0.6);
  c.restore();
}

/** The tag, drawn as literal ASCII characters on top of the rendered bouquet. */
export function drawTag(ctx, w, t) {
  if (w.tag <= 0.01 || !glyph.ready) return;
  const to = `for ${(CONFIG.toName || 'you').toLowerCase()}`;
  const from = `from ${CONFIG.fromName.toLowerCase()} ♡`;
  const inner = Math.max(to.length, from.length);
  const bar = '-'.repeat(inner + 2);
  const lines = [`.${bar}.`, `| ${to.padEnd(inner)} |`, `| ${from.padEnd(inner)} |`, `'${bar}'`];
  const fs = 11, adv = fs * 0.6, lh = fs * 1.3;
  const dpr = stage.dpr, T = tie(), { bw } = box();
  const settle = ease.outCubic(clamp(w.tag));
  const angle = (1 - settle) * 0.7 + (stage.reduced || stage.paused ? 0 : Math.sin(t * 1.6) * 0.03);
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(T.x + bw * 0.05, T.y + HE() * 0.026);
  ctx.rotate(angle);
  ctx.globalAlpha = clamp(w.tag * 1.6);
  // Knock out the letters behind the tag so it reads cleanly over the bouquet.
  ctx.fillStyle = '#0B0A0D';
  ctx.fillRect(-2, -lh / 2 - 2, lines[0].length * adv + 4, lines.length * lh + 4);
  ctx.font = `700 ${fs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#C9A57A';
  ctx.fillText('\\', -adv * 0.6, -lh * 0.9); // the string from the bow
  const nameAt = 6, nameEnd = 6 + (CONFIG.toName || 'you').length;
  lines.forEach((ln, li) => {
    [...ln].forEach((ch, ci) => {
      let col = '#C9A57A';
      if (li === 1 && ci >= 2 && ci < ln.length - 2) col = ci >= nameAt && ci < nameEnd ? '#F5C9C0' : '#D9BE96';
      if (li === 2 && ci >= 2 && ci < ln.length - 2) col = ch === '♡' ? '#E06C91' : '#D9BE96';
      ctx.fillStyle = col;
      ctx.fillText(ch, ci * adv + adv / 2, li * lh);
    });
  });
  ctx.restore();
}
