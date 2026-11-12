// Pure-ASCII renderer. Flowers are painted into a hidden canvas, sampled on a character grid, and
// every cell picks a character from its 3x3 neighbourhood:
//   outlines   - _ ( ) / \   (direction of the edge)
//   thin lines | / \ -       (stems, along their length)
//   creases    | / \ -       (dark folds, along the crease)
//   interior   . : - = + *   (by brightness), and whole "iloveyou" words where it is bright
// Each flower owns the word nearest its centre; that word can be lit rose (the reveal).
import { stage } from './stage.js';
import { CONFIG } from '../config.js';
import { clamp, smoothstep } from './util.js';

const LEVELS = [0.42, 0.62, 0.82, 1];
const WEIGHTS = [500, 700];
const RAMP = ['.', ':', '-', '=', '+', '*'];
const SHAPES = ['-', '_', '|', '/', '\\', '(', ')'];
// Per cell: x, y, char, level, weight, cos, sin, dn, cx, cy, seed, i, j, phrasePos, flowerId
const ST = 15;
const EL = -2; // phrase-eligible cell, waiting for the row pass

export const glyph = {
  ready: false, cs: 8, phrase: 'iloveyou',
  chars: [], index: {}, letters: [],
  atlas: null, rose: null, gw: 0, gh: 0,
};

export async function initGlyphs() {
  glyph.cs = stage.W < 520 ? 7 : 9;
  try {
    await Promise.race([
      Promise.all([document.fonts.load('500 16px "JetBrains Mono"'), document.fonts.load('700 16px "JetBrains Mono"')]),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch (_) { /* system mono fallback */ }
  buildAtlas(glyph.cs);
  glyph.ready = true;
}

export function buildAtlas(cs = glyph.cs) {
  const dpr = stage.dpr;
  glyph.cs = cs;
  const phrase = String(CONFIG.glyphPhrase || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'iloveyou';
  glyph.phrase = phrase;
  const chars = [...new Set([...phrase, ...RAMP, ...SHAPES, '·'])];
  glyph.chars = chars;
  glyph.index = Object.fromEntries(chars.map((ch, i) => [ch, i]));
  glyph.letters = [...new Set(phrase)].map(ch => glyph.index[ch]);

  // Even cell sizes so a centred glyph lands on whole device pixels.
  const px = Math.round(cs * 1.22 * dpr);
  const gw = 2 * Math.ceil(cs * 0.55 * dpr), gh = 2 * Math.ceil(cs * 0.75 * dpr);
  const atlas = document.createElement('canvas');
  atlas.width = gw * chars.length;
  atlas.height = gh * LEVELS.length * WEIGHTS.length;
  const ax = atlas.getContext('2d');
  ax.textAlign = 'center';
  ax.textBaseline = 'middle';
  ax.fillStyle = '#fff';
  WEIGHTS.forEach((w, wi) => {
    ax.font = `${w} ${px}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
    LEVELS.forEach((a, li) => {
      ax.globalAlpha = a;
      const row = wi * LEVELS.length + li;
      chars.forEach((ch, i) => ax.fillText(ch, i * gw + gw / 2, row * gh + gh / 2));
    });
  });
  glyph.atlas = atlas;
  glyph.gw = gw;
  glyph.gh = gh;

  const rose = document.createElement('canvas');
  rose.width = atlas.width;
  rose.height = atlas.height;
  const rx = rose.getContext('2d');
  rx.drawImage(atlas, 0, 0);
  rx.globalCompositeOperation = 'source-in';
  rx.fillStyle = '#F07FA2';
  rx.fillRect(0, 0, rose.width, rose.height);
  glyph.rose = rose;
}

/** Source row in the atlas for (weight, level). */
export const atlasRow = (wt, lv) => wt * LEVELS.length + lv;

function canvas2d(opts) {
  const c = document.createElement('canvas');
  return [c, c.getContext('2d', opts)];
}

export class GlyphField {
  constructor() {
    [this.grid, this.gx] = canvas2d({ willReadFrequently: true }); // brightness, one pixel per cell
    [this.S, this.Sx] = canvas2d();    // colour painting (half res)
    [this.S2, this.S2x] = canvas2d();  // dilated, lifted copy used to tint characters
    [this.G, this.Gx] = canvas2d();    // character layer (device res)
    this.cells = new Float32Array(0);
    this.B = new Float32Array(0);
    this.flags = new Uint8Array(0);
    this.count = 0;
    this.k = 0.5;
    this.shim = [];
    this.shimAcc = 0;
  }

  resize() {
    const { W, H, dpr } = stage;
    const cs = glyph.cs;
    this.cols = Math.ceil(W / cs);
    this.rows = Math.ceil(H / cs);
    this.grid.width = this.cols;
    this.grid.height = this.rows;
    this.S.width = this.S2.width = Math.ceil(W * this.k);
    this.S.height = this.S2.height = Math.ceil(H * this.k);
    this.G.width = Math.round(W * dpr);
    this.G.height = Math.round(H * dpr);
    const n = this.cols * this.rows;
    this.cells = new Float32Array(n * ST);
    this.B = new Float32Array(n);
    this.flags = new Uint8Array(n);
    this.count = 0;
    this.shim.length = 0;
  }

  /** paintFn(rc) draws the whole scene in CSS px; called once for the grid, once for colour. */
  paint(paintFn) {
    const cs = glyph.cs;
    const g = this.gx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.cols, this.rows);
    g.setTransform(1 / cs, 0, 0, 1 / cs, 0, 0);
    paintFn({ c: g, mode: 'grid', cs, edgeW: cs * 0.4, edgeA: 0.45 });

    const s = this.Sx, k = this.k;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.clearRect(0, 0, this.S.width, this.S.height);
    s.setTransform(k, 0, 0, k, 0, 0);
    paintFn({ c: s, mode: 'color', cs, edgeW: 1.1, edgeA: 0.35 });

    const s2 = this.S2x;
    s2.setTransform(1, 0, 0, 1, 0, 0);
    s2.clearRect(0, 0, this.S2.width, this.S2.height);
    const d = Math.max(1, cs * k * 0.6);
    for (const [ox, oy] of [[-2 * d, 0], [2 * d, 0], [0, -2 * d], [0, 2 * d], [-d, -d], [d, -d], [-d, d], [d, d], [0, 0]]) {
      s2.drawImage(this.S, ox, oy);
    }
    s2.globalCompositeOperation = 'screen';
    s2.globalAlpha = 0.35;
    s2.drawImage(this.S, 0, 0);
    s2.globalAlpha = 1;
    s2.globalCompositeOperation = 'source-over';
  }

  /**
   * influence(x, y) gives the nearest flower for ripples and contour bands.
   * owners: flowers that may own a word ({ x, y, r }); a word's owner is stored as index + 1.
   */
  sample(influence, owners = []) {
    const { cols, rows } = this;
    const cs = glyph.cs, nL = LEVELS.length, I = glyph.index;
    const d = this.gx.getImageData(0, 0, cols, rows).data;
    const B = this.B;

    for (let k = 0, n = cols * rows; k < n; k++) {
      const a = d[k * 4 + 3];
      if (a < 8) { B[k] = 0; continue; }
      const v = (Math.max(d[k * 4], d[k * 4 + 1], d[k * 4 + 2]) / 255) * (a / 255);
      B[k] = v < 0.045 ? 0 : clamp((v - 0.1) / 0.78, 0.02, 1);
    }

    const c = this.cells;
    const dirChar = [I['-'], I['|'], I['\\'], I['/']];
    let n = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const b = B[k];
        if (!b) continue;
        const hasL = i > 0, hasR = i < cols - 1, hasU = j > 0, hasD = j < rows - 1;
        const L = hasL ? B[k - 1] : 0, R = hasR ? B[k + 1] : 0;
        const U = hasU ? B[k - cols] : 0, D = hasD ? B[k + cols] : 0;
        const UL = hasU && hasL ? B[k - cols - 1] : 0, UR = hasU && hasR ? B[k - cols + 1] : 0;
        const DL = hasD && hasL ? B[k + cols - 1] : 0, DR = hasD && hasR ? B[k + cols + 1] : 0;
        // Neighbour sums along each direction: horizontal, vertical, '\', '/'.
        const s0 = L + R, s1 = U + D, s2 = UL + DR, s3 = UR + DL;
        let mx = 0, mn = 0, vmx = s0, vmn = s0;
        if (s1 > vmx) { mx = 1; vmx = s1; } if (s1 < vmn) { mn = 1; vmn = s1; }
        if (s2 > vmx) { mx = 2; vmx = s2; } if (s2 < vmn) { mn = 2; vmn = s2; }
        if (s3 > vmx) { mx = 3; vmx = s3; } if (s3 < vmn) { mn = 3; vmn = s3; }
        const range = vmx - vmn;
        const avg = (s0 + s1 + s2 + s3) / 8;

        const x = (i + 0.5) * cs, y = (j + 0.5) * cs;
        const inf = influence(x, y);
        let ci, wt = 0, lv, p = -1;

        if (b < avg - 0.18 && range > 0.3) {
          ci = dirChar[mn]; // a dark fold, drawn along its own direction
          lv = clamp(Math.floor(b * nL), 0, nL - 2);
        } else if (range > 0.3 && range > 0.65 * b) {
          const across = mx === 0 ? s1 : mx === 1 ? s0 : mx === 2 ? s3 : s2;
          const thin = across < 0.5 * b;
          if (mx === 0) ci = thin ? I['-'] : (D < U ? I['_'] : I['-']);
          else if (mx === 1) ci = thin ? I['|'] : (L < R ? I['('] : I[')']);
          else ci = dirChar[mx];
          wt = 1;
          lv = clamp(Math.floor(b * nL), 1, nL - 2);
        } else {
          let bb = b;
          if (inf.dn < 1.15) {
            const wob = Math.sin(Math.atan2(inf.sin, inf.cos) * 7 + inf.seed) * 0.7;
            bb *= 0.86 + 0.14 * Math.sin(inf.dn * 23 + wob);
          }
          if (bb >= 0.58) {
            ci = I['*'];
            p = EL;
            wt = bb > 0.86 ? 1 : 0;
          } else {
            ci = I[RAMP[Math.min(RAMP.length - 1, Math.floor((bb / 0.58) * RAMP.length))]];
          }
          lv = clamp(Math.floor(bb * (nL - 1)), 0, nL - 2);
        }

        const q = n * ST;
        c[q] = x; c[q + 1] = y; c[q + 2] = ci; c[q + 3] = lv; c[q + 4] = wt;
        c[q + 5] = inf.cos; c[q + 6] = inf.sin; c[q + 7] = inf.dn; c[q + 8] = inf.cx; c[q + 9] = inf.cy;
        c[q + 10] = inf.seed; c[q + 11] = i; c[q + 12] = j; c[q + 13] = p; c[q + 14] = 0;
        n++;
      }
    }
    this.count = n;

    // Row pass: lay whole "iloveyou" words, centred, into each run of bright cells.
    const word = [...glyph.phrase].map(ch => I[ch]);
    const WL = word.length;
    const words = [];
    let k = 0;
    while (k < n) {
      if (c[k * ST + 13] !== EL) { k++; continue; }
      let e = k;
      while (e + 1 < n && c[(e + 1) * ST + 13] === EL && c[(e + 1) * ST + 12] === c[k * ST + 12] && c[(e + 1) * ST + 11] === c[e * ST + 11] + 1) e++;
      const len = e - k + 1;
      const nw = Math.floor((len + 1) / (WL + 1));
      if (nw === 0) {
        for (let m = 0; m < len; m++) { c[(k + m) * ST + 2] = word[m % WL]; c[(k + m) * ST + 13] = m % WL; }
      } else {
        const used = nw * WL + (nw - 1);
        const off = Math.floor((len - used) / 2);
        for (let m = 0; m < len; m++) {
          const q = (k + m) * ST;
          const r = m - off;
          if (r < 0 || r >= used) { c[q + 2] = I[m % 2 ? '+' : '*']; c[q + 13] = -1; continue; }
          const pos = r % (WL + 1);
          if (pos === WL) { c[q + 2] = I['·']; c[q + 13] = -1; continue; }
          c[q + 2] = word[pos];
          c[q + 13] = pos;
          if (pos === 0) words.push({ k0: k + m, x: c[q] + (WL - 1) * cs / 2, y: c[q + 1] });
        }
      }
      k = e + 1;
    }

    // Each owner flower takes the free whole word nearest its centre, on its own petals (the word's
    // cells must belong to that flower, not the paper below it): bold, brightest, revealable.
    const taken = new Uint8Array(words.length);
    owners.forEach((f, oi) => {
      let best = -1, bd = Infinity;
      for (let w = 0; w < words.length; w++) {
        if (taken[w]) continue;
        const q0 = words[w].k0 * ST;
        if (Math.abs(c[q0 + 8] - f.x) > 0.5 || Math.abs(c[q0 + 9] - f.y) > 0.5 || c[q0 + 7] > 0.8) continue;
        const dd = Math.hypot(words[w].x - f.x, words[w].y - f.y);
        if (dd < bd && dd < f.r * 1.1) { bd = dd; best = w; }
      }
      if (best < 0) return;
      taken[best] = 1;
      for (let m = 0; m < WL; m++) {
        const q = (words[best].k0 + m) * ST;
        c[q + 3] = nL - 1;
        c[q + 4] = 1;
        c[q + 14] = oi + 1;
      }
    });

    this.flags.fill(0);
    this.shim.length = 0;
  }

  /** revealOf(ownerIndex) returns 0..1: how rose that flower's word is. */
  render(ctx, t, dt, finger, revealOf) {
    const G = this.Gx, dpr = stage.dpr, cs = glyph.cs;
    const { atlas, rose, gw, gh } = glyph;
    const hw = gw / 2, hh = gh / 2, nL = LEVELS.length;
    const R = stage.reduced;
    const still = R || stage.paused;
    const c = this.cells, n = this.count, flags = this.flags;

    G.globalCompositeOperation = 'source-over';
    G.setTransform(1, 0, 0, 1, 0, 0);
    G.clearRect(0, 0, this.G.width, this.G.height);

    // Letter shimmer: a few phrase letters at a time scramble and resettle.
    if (still) {
      for (const sh of this.shim) flags[sh.k] = 0;
      this.shim.length = 0;
    } else if (n) {
      this.shimAcc += dt * n * 0.006;
      while (this.shimAcc >= 1) {
        this.shimAcc -= 1;
        const k = (Math.random() * n) | 0;
        if (c[k * ST + 13] >= 0 && !c[k * ST + 14] && !flags[k] && this.shim.length < 40) {
          flags[k] = 1;
          this.shim.push({ k, t: 0.32 });
        }
      }
      for (let s = this.shim.length - 1; s >= 0; s--) {
        const sh = this.shim[s];
        sh.t -= dt;
        if (sh.t <= 0) { flags[sh.k] = 0; this.shim.splice(s, 1); }
      }
    }

    // Light sweep: a soft diagonal band every 7 s.
    const span = stage.W * 0.8 + stage.H * 0.6;
    const pos = -160 + ((t % 7) / 7) * (span + 320);
    const letters = glyph.letters, tick = Math.floor(t * 16);
    const A = R ? 0 : cs * 0.24;
    const fOn = finger.s > 0.02;
    const roseCells = [];

    for (let k = 0; k < n; k++) {
      const o = k * ST;
      const x = c[o], y = c[o + 1], dn = c[o + 7];
      let dx = 0, dy = 0;
      if (dn < 1.6) {
        // The contour ripple: rows breathe along each flower's petals.
        const w = 1 - smoothstep(0.2, 1.6, dn);
        const sd = c[o + 10];
        const rip = Math.sin(dn * 9.5 - t * 1.8 + sd) * A * w;
        dx += c[o + 5] * rip;
        dy += c[o + 6] * rip;
      }
      if (fOn) {
        const fx = x - finger.x, fy = y - finger.y, d2 = fx * fx + fy * fy;
        if (d2 < 12100) {
          const dd = Math.sqrt(d2) + 0.001;
          const push = finger.s * Math.exp(-d2 / 2400) * cs * 1.7;
          dx += (fx / dd) * push;
          dy += (fy / dd) * push;
        }
      }
      let ci = c[o + 2], lv = c[o + 3], wt = c[o + 4];
      if (!still) {
        const s = x * 0.8 + y * 0.6 - pos;
        if (s > -110 && s < 110) {
          const kk = Math.exp(-(s * s) / 3200);
          if (kk > 0.25) {
            lv = Math.min(nL - 1, lv + (kk > 0.65 ? 2 : 1));
            if (c[o + 13] >= 0) wt = 1;
          }
        }
      }
      if (flags[k]) {
        ci = letters[(tick + k) % letters.length];
        lv = Math.min(nL - 1, lv + 1);
        wt = 1;
      }
      const X = Math.round((x + dx) * dpr) - hw, Y = Math.round((y + dy) * dpr) - hh;
      const fid = c[o + 14];
      if (fid && revealOf) {
        const a = revealOf(fid - 1);
        if (a > 0) roseCells.push(ci, wt, X, Y, a);
      }
      G.drawImage(atlas, ci * gw, (wt * nL + lv) * gh, gw, gh, X, Y, gw, gh);
    }

    G.globalCompositeOperation = 'source-in';
    G.drawImage(this.S2, 0, 0, this.S2.width, this.S2.height, 0, 0, this.G.width, this.G.height);
    G.globalCompositeOperation = 'source-over';

    // The reveal: each flower's word, lit rose over its own colour.
    for (let r = 0; r < roseCells.length; r += 5) {
      G.globalAlpha = roseCells[r + 4];
      G.drawImage(rose, roseCells[r] * gw, (roseCells[r + 1] * nL + nL - 1) * gh, gw, gh, roseCells[r + 2], roseCells[r + 3], gw, gh);
    }
    G.globalAlpha = 1;
    ctx.drawImage(this.G, 0, 0);
  }
}
