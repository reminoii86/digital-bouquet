// The bouquet: kraft paper unfolds from the tie, the ribbon and tag go on, then flowers arrive one by
// one until it is full, and each flower's hidden "iloveyou" lights rose. ASCII roots curl in from the
// corners, and in the finale every tap adds another flower. Everything is painted into one source and
// rendered as characters by the glyph field, inside the safe frame from bouquet.layout().
import { stage, bctx, bloomCanvas, onResize } from './stage.js';
import { glyph, GlyphField, buildAtlas, atlasRow } from './ascii.js';
import { makeFlower, makeStem, paintFlower, paintStem, paintLeaf } from './flowers.js';
import { box, BX, BY, toBox, tie, makeWrap, paintWrapBack, paintWrapFront, paintStemBundle, paintRibbon, drawTag } from './bouquet.js';
import * as P from './particles.js';
import * as audio from './audio.js';
import { TAU, clamp, lerp, rand, pick, ease, haptic, seeded, smoothstep } from './util.js';

// Flowers in arrival order: the heart of the bouquet first, then outward and upward, buds last.
// x in box widths, y in composition heights, r in box widths; z is the paint order (back to front).
const BOUQUET = [
  { type: 'peony', pal: 'cream', x: 0.5, y: 0.285, r: 0.16, layers: 4, z: 6 },
  { type: 'lily', pal: 'lily', x: 0.34, y: 0.405, r: 0.13, rot: 0.5, z: 9 },
  { type: 'peony', pal: 'raspberry', x: 0.66, y: 0.415, r: 0.12, z: 10 },
  { type: 'pansy', pal: 'teal', x: 0.2, y: 0.47, r: 0.085, z: 11 },
  { type: 'bud', pal: 'marigold', x: 0.82, y: 0.465, r: 0.07, z: 12 },
  { type: 'rose', pal: 'blush', x: 0.16, y: 0.355, r: 0.1, z: 7 },
  { type: 'tulip', pal: 'coral', x: 0.86, y: 0.345, r: 0.095, z: 8 },
  { type: 'lily', pal: 'lily', x: 0.27, y: 0.215, r: 0.15, rot: 0.2, z: 4 },
  { type: 'lily', pal: 'lily', x: 0.75, y: 0.225, r: 0.15, rot: -0.15, z: 5 },
  { type: 'hydrangea', pal: 'blue', x: 0.6, y: 0.12, r: 0.12, z: 2 },
  { type: 'lilybud', pal: 'lilybud', x: 0.41, y: 0.065, r: 0.06, rot: -0.12, z: 3 },
  { type: 'lilybud', pal: 'lilybud', x: 0.15, y: 0.13, r: 0.07, rot: -0.5, z: 0 },
  { type: 'lilybud', pal: 'lilybud', x: 0.85, y: 0.115, r: 0.07, rot: 0.45, z: 1 },
];
// Seconds after the wrap is tied: the heart arrives alone, then the bouquet fills in faster.
const ARRIVE = [0, 1.6, 2.9, 4.0, 5.0, 5.9, 6.7, 7.4, 8.0, 8.55, 9.05, 9.5, 9.9];
const WRAP_DONE = 2.4;
// Long leaves fanning out of the bouquet; `after` is the flower they follow.
const LEAVES = [
  { x: 0.36, y: 0.45, to: [0.03, 0.5], len: 0.2, after: 1 },
  { x: 0.64, y: 0.44, to: [0.97, 0.49], len: 0.2, after: 2 },
  { x: 0.3, y: 0.4, to: [0.02, 0.27], len: 0.24, after: 5 },
  { x: 0.7, y: 0.4, to: [0.98, 0.25], len: 0.24, after: 6 },
  { x: 0.5, y: 0.3, to: [0.54, 0.0], len: 0.2, after: 10 },
];
const PAPER_START = 0.55; // back paper height before any flower; it rises to 1 as they arrive
// ASCII roots: from each corner of the safe frame, curling toward a point on the bouquet.
const VINES = [
  { corner: 'tl', to: [0.05, 0.2], delay: 4.4, tip: ['rose', 'blush'], buds: [['tulip', 'coral']] },
  { corner: 'tr', to: [0.95, 0.19], delay: 4.9, tip: ['hydrangea', 'blue'], buds: [['rose', 'blush']] },
  { corner: 'bl', to: [0.37, 0.77], delay: 5.4, tip: ['peony', 'cream'], buds: [['tulip', 'marigold']] },
  { corner: 'br', to: [0.63, 0.77], delay: 5.9, tip: ['peony', 'raspberry'], buds: [['hydrangea', 'blue']] },
];
const DOME = { x: 0.5, y: 0.28, rx: 0.42, ry: 0.21 }; // where taps place new flowers (box coords)
const FRAGS = ['i', 'love', 'you', 'iloveyou', 'love', 'you'];

const field = new GlyphField();
let mode = 'off';
let T = 0, ts = 1, dirty = true, isReady = false;
let flowers = [], stems = [], leaves = [], tweens = [], timers = [], vines = [], added = [], owners = [];
let wrap = makeWrap();
let onGrownCb = null, grown = false, revealing = false, driftAcc = 0, paintTick = 0;
let animT = 0; // ambient clock; it stops while the pause button is on
const finger = { x: -999, y: -999, s: 0 };
let dust = [], dustAlpha = 0, dustTarget = 0, pull = null;
const perf = { n: 0, sum: 0, checked: false };
const prof = { paint: 0, sample: 0, render: 0 };

function place(f) {
  const { bw } = box();
  if (f.place.box) {
    f.x = BX(f.place.x);
    f.y = BY(f.place.y);
  } else {
    f.x = f.place.x * stage.W;
    f.y = f.place.y * stage.H;
  }
  f.r = f.place.r * bw;
}

/* Timeline */
function tween(obj, key, to, dur, ez = ease.inOutCubic, onDone) {
  tweens.push({ obj, key, to, dur: Math.max(dur, 1e-4), ez, onDone, t: 0, from: null });
}
function at(time, fn) { timers.push({ time, fn }); }
function updateTimeline(dt) {
  T += dt;
  for (let i = timers.length - 1; i >= 0; i--) {
    if (T >= timers[i].time) {
      const tm = timers[i];
      timers.splice(i, 1);
      tm.fn();
    }
  }
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (tw.from === null) tw.from = tw.obj[tw.key];
    tw.t += dt;
    const p = clamp(tw.t / tw.dur);
    tw.obj[tw.key] = lerp(tw.from, tw.to, tw.ez(p));
    if (tw.key !== 'reveal') dirty = true; // the reveal is a render-time tint, not a repaint
    if (p >= 1) {
      tweens.splice(i, 1);
      if (tw.onDone) tw.onDone();
    }
  }
}

/* Setup */
export function ready() {
  isReady = true;
  field.resize();
  initDust();
}

onResize(dprChanged => {
  if (!isReady) return;
  if (dprChanged) buildAtlas(glyph.cs);
  field.resize();
  initDust();
  if (mode === 'garden') relayout();
});

function relayout() {
  for (const f of flowers) if (!f.vine) place(f);
  for (const s of stems) s.calc(s);
  for (const v of vines) layoutVine(v);
  for (const f of flowers) if (f.vine) place(f);
  dirty = true;
}

/* Landing dust: "iloveyou" fragments that the gift later pulls into its seam */
function spawnFrag(d, edge) {
  d.word = [...pick(FRAGS)].map(ch => glyph.index[ch]);
  if (edge) {
    const side = Math.floor(rand(0, 4));
    d.x = side === 0 ? -20 : side === 1 ? stage.W + 20 : rand(stage.W);
    d.y = side === 2 ? -20 : side === 3 ? stage.H + 20 : rand(stage.H);
  } else {
    d.x = rand(stage.W);
    d.y = rand(stage.H);
  }
  d.vx = rand(-3, 3);
  d.vy = -rand(4, 10);
}

function initDust() {
  dust = [];
  const n = Math.round(clamp((stage.W * stage.H) / 36000, 8, 12));
  for (let i = 0; i < n; i++) {
    const d = { a: rand(0.1, 0.22), ph: rand(TAU), rose: Math.random() < 0.4 };
    spawnFrag(d, false);
    dust.push(d);
  }
}
export function setDust(on) { dustTarget = on ? 1 : 0; }
/** The gift pulls the dust toward its seam: { x, y, k } or null. */
export function setDustPull(p) { pull = p; }

function drawDust(ctx, dt) {
  const { atlas, rose, gw, gh, cs } = glyph, dpr = stage.dpr, row = atlasRow(0, 3);
  const still = stage.paused || stage.reduced;
  for (const d of dust) {
    if (pull) {
      const k = pull.k;
      d.vx += ((pull.x - d.x) * 1.2 - d.vx) * dt * 1.5 * k;
      d.vy += ((pull.y - d.y) * 1.2 - d.vy) * dt * 1.5 * k;
      if (Math.hypot(pull.x - d.x, pull.y - d.y) < 16) spawnFrag(d, true);
    }
    if (!still || pull) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y < -30) { spawnFrag(d, false); d.y = stage.H + 20; }
    }
    // Quieter behind the headline column, brighter as the gift pulls.
    const calm = pull ? 1 : 0.2 + 0.8 * smoothstep(0.14, 0.34, Math.abs(d.x / stage.W - 0.5));
    const tw = still ? 1 : 0.6 + 0.4 * Math.sin(animT * 1.3 + d.ph);
    ctx.globalAlpha = clamp(d.a * dustAlpha * calm * tw * (pull ? 1 + 2.5 * pull.k : 1));
    const src = d.rose ? rose : atlas;
    d.word.forEach((gi, i) => {
      ctx.drawImage(src, gi * gw, row * gh, gw, gh, Math.round((d.x + i * cs) * dpr) - gw / 2, Math.round(d.y * dpr) - gh / 2, gw, gh);
    });
  }
  ctx.globalAlpha = 1;
}

/* Bouquet pieces */
function stemFor(f) {
  // A stem from the tie up to the flower, mostly hidden behind the paper and petals.
  return makeStem(s => {
    const Tp = tie(), { bw } = box();
    s.unit = bw;
    s.p0 = { x: Tp.x + (f.x - Tp.x) * 0.06, y: Tp.y };
    s.p2 = { x: f.x, y: f.y };
    s.p1 = { x: lerp(Tp.x, f.x, 0.35), y: lerp(Tp.y, f.y, 0.55) };
  }, { w: 0.8, leaves: [] });
}

function paintBouquetLeaf(rc, l) {
  if (l.g <= 0.01) return;
  const x = BX(l.x), y = BY(l.y), tx = BX(l.to[0]), ty = BY(l.to[1]);
  paintLeaf(rc, x, y, Math.atan2(ty - y, tx - x), l.len * box().bw * ease.outBack(clamp(l.g), 1.3));
}

/* ASCII roots */
function cubicPt(p, t) {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
}

function mini(type, pal, r, seed) {
  const f = makeFlower(type, { place: { box: false, x: 0, y: 0, r }, pal, seed, layers: 3, small: true });
  f.vine = true;
  f.mini = true;
  return f;
}

function makeVine(def, vi) {
  const rnd = seeded(431 + vi * 97);
  const tendrils = [0.3, 0.55, 0.78].map((t, k) => {
    const bud = k === 1 && def.buds[0] ? mini(def.buds[0][0], def.buds[0][1], 0.032, 950 + vi * 7 + k) : null;
    return { t, kind: bud ? 'bloom' : 'curl', bud, len: rnd() * 0.04 + 0.08, bend: rnd() * 0.5 + 0.2, pts: [], leaf: null, popped: false };
  });
  return { ...def, vi, prog: 0, pts: [], leaves: [], tendrils, tipFlower: mini(def.tip[0], def.tip[1], 0.045, 900 + vi), popped: false };
}

/** Root geometry inside the safe frame: clear of the status bar, the controls and the dock. */
function layoutVine(v) {
  const { W, H } = stage;
  const f = stage.frame, { bw } = box();
  const top = f.t + 6, bot = f.b - 6, L = 6, R = W - 6, fh = f.b - f.t;
  let p0, p1, p2;
  if (v.corner === 'tl') { p0 = [L - 10, top + fh * 0.36]; p1 = [L + W * 0.01, top + fh * 0.08]; p2 = [L + W * 0.1, top]; }
  else if (v.corner === 'tr') { p0 = [R + 10, top + fh * 0.34]; p1 = [R - W * 0.01, top + fh * 0.08]; p2 = [R - W * 0.1, top]; }
  else if (v.corner === 'bl') { p0 = [W * 0.04, bot + 24]; p1 = [L, bot - fh * 0.05]; p2 = [L + W * 0.06, top + fh * 0.72]; }
  else { p0 = [W * 0.96, bot + 24]; p1 = [R, bot - fh * 0.05]; p2 = [R - W * 0.06, top + fh * 0.72]; }
  const p3 = [BX(v.to[0]), BY(v.to[1])];
  const cps = [p0, p1, p2, p3];

  const N = 64;
  v.pts = [];
  for (let s = 0; s <= N; s++) {
    const t = s / N;
    const [x, y] = cubicPt(cps, t);
    const [x2, y2] = cubicPt(cps, Math.min(1, t + 0.01));
    const tx = x2 - x, ty = y2 - y, tl = Math.hypot(tx, ty) || 1;
    const wig = Math.sin(t * 14 + v.vi * 1.3) * 3 * (0.3 + t);
    v.pts.push({ x: x - (ty / tl) * wig, y: y + (tx / tl) * wig, tx: tx / tl, ty: ty / tl });
  }

  const cx = W / 2, cy = (f.t + f.b) / 2;
  const at = t => v.pts[Math.min(N, Math.round(t * N))];
  v.leaves = [];
  let side = 1;
  for (let t = 0.12; t < 0.93; t += 0.1) {
    const p = at(t);
    v.leaves.push({ t, x: p.x, y: p.y, ang: Math.atan2(p.ty, p.tx) + side * 0.85, len: bw * 0.05 });
    side = -side;
  }

  for (const td of v.tendrils) {
    const b = at(td.t);
    let nx = -b.ty, ny = b.tx;
    if (nx * (cx - b.x) + ny * (cy - b.y) < 0) { nx = -nx; ny = -ny; }
    const hx = nx * 0.75 + b.tx * 0.45, hy = ny * 0.75 + b.ty * 0.45, hl = Math.hypot(hx, hy) || 1;
    const Lt = Math.min(W, fh) * td.len;
    const ex = b.x + (hx / hl) * Lt, ey = b.y + (hy / hl) * Lt;
    const mx = (b.x + ex) / 2 + b.tx * Lt * td.bend * 0.6, my = (b.y + ey) / 2 + b.ty * Lt * td.bend * 0.6;
    const pts = [];
    for (let s = 0; s <= 14; s++) {
      const t = s / 14, u = 1 - t;
      pts.push({ x: u * u * b.x + 2 * u * t * mx + t * t * ex, y: u * u * b.y + 2 * u * t * my + t * t * ey });
    }
    const r0 = Lt * 0.24;
    if (td.kind === 'curl' && r0 >= glyph.cs * 2.5) {
      const a = pts[pts.length - 2], z = pts[pts.length - 1];
      let h = [z.x - a.x, z.y - a.y];
      const hl2 = Math.hypot(h[0], h[1]) || 1;
      h = [h[0] / hl2, h[1] / hl2];
      const sgn = (nx * h[1] - ny * h[0]) > 0 ? 1 : -1;
      const ns = sgn > 0 ? [-h[1], h[0]] : [h[1], -h[0]];
      const ox = z.x + ns[0] * r0, oy = z.y + ns[1] * r0;
      const phi0 = Math.atan2(z.y - oy, z.x - ox);
      for (let s = 1; s <= 26; s++) {
        const q = s / 26, rr = r0 * (1 - 0.85 * q), phi = phi0 + sgn * q * Math.PI * 3;
        pts.push({ x: ox + Math.cos(phi) * rr, y: oy + Math.sin(phi) * rr });
      }
    }
    td.pts = pts;
    td.leaf = { x: pts[7].x, y: pts[7].y, ang: Math.atan2(pts[8].y - pts[6].y, pts[8].x - pts[6].x) - 0.8, len: bw * 0.035 };
    if (td.bud) td.bud.place = { box: false, x: ex / W, y: ey / H, r: 0.032 };
  }
  v.tipFlower.place = { box: false, x: p3[0] / W, y: p3[1] / H, r: 0.045 };
}

function polyline(c, pts, prog) {
  const m = prog * (pts.length - 1);
  const n = Math.floor(m);
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i <= n; i++) c.lineTo(pts[i].x, pts[i].y);
  if (n < pts.length - 1) {
    const f = m - n, a = pts[n], b = pts[n + 1];
    c.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
  }
}

const tendrilProg = (v, td) => clamp((v.prog - td.t) / 0.32);

function paintVine(rc, v) {
  if (v.prog <= 0.001) return;
  const { c, mode: m, cs } = rc;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  polyline(c, v.pts, v.prog);
  c.lineWidth = cs * (m === 'grid' ? 1.0 : 1.5);
  c.strokeStyle = '#6F8C5C';
  c.stroke();
  for (const td of v.tendrils) {
    const tp = tendrilProg(v, td);
    if (tp <= 0) continue;
    polyline(c, td.pts, tp);
    c.lineWidth = cs * (m === 'grid' ? 0.7 : 1.1);
    c.strokeStyle = '#88A475';
    c.stroke();
    if (tp > 0.5) paintLeaf(rc, td.leaf.x, td.leaf.y, td.leaf.ang, td.leaf.len * ease.outBack(clamp((tp - 0.5) / 0.3), 1.4));
  }
  for (const l of v.leaves) {
    if (v.prog < l.t) continue;
    paintLeaf(rc, l.x, l.y, l.ang, l.len * ease.outBack(clamp((v.prog - l.t) / 0.12), 1.4));
  }
  c.restore();
}

function bloomMini(f, big) {
  f.g = 0.22;
  tween(f, 'g', 1, 0.9 * ts, ease.outCubic);
  P.puff(f.x, f.y, f.r, f.puff, stage.reduced ? 3 : (big ? 8 : 5));
  audio.sfx.pop();
}

function updateVines() {
  for (const v of vines) {
    for (const td of v.tendrils) {
      if (td.bud && !td.popped && tendrilProg(v, td) >= 1) {
        td.popped = true;
        bloomMini(td.bud, false);
      }
    }
    if (!v.popped && v.prog >= 0.999) {
      v.popped = true;
      bloomMini(v.tipFlower, true);
    }
  }
}

/* Growth */
function arrive(f, st, delay, first) {
  at(delay, () => {
    if (first) audio.startMusic(); // the song comes in with the first flower
    tween(st, 'prog', 1, 0.45 * ts, ease.outCubic, () => {
      audio.sfx.pop();
      haptic(6);
      P.puff(f.x, f.y, f.r, f.puff, stage.reduced ? 4 : 9);
      // inOutCubic lingers on the bud a moment before the petals open.
      tween(f, 'g', 1, (f.type === 'lilybud' ? 0.7 : 1.5) * ts, f.type === 'lilybud' ? ease.outCubic : ease.inOutCubic);
    });
  });
}

/** Light each flower's word rose, in reading order, one flower after another. */
function startReveal() {
  revealing = true;
  const order = owners.filter(f => !f.mini).slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
  order.forEach((f, i) => at(T + (stage.reduced ? 0 : i * 0.32), () => tween(f, 'reveal', 1, stage.reduced ? 0.01 : 0.5, ease.outCubic)));
  return order.length;
}

export function startGarden({ instant = false, onGrown } = {}) {
  mode = 'garden';
  T = 0;
  ts = stage.reduced ? 0.6 : 1;
  grown = false;
  revealing = false;
  onGrownCb = onGrown || null;
  flowers = []; stems = []; tweens = []; timers = []; added = []; owners = [];
  dustTarget = 0;
  pull = null;
  wrap = makeWrap();
  leaves = LEAVES.map(l => ({ ...l, g: 0 }));
  bloomCanvas.removeAttribute('aria-hidden');
  bloomCanvas.setAttribute('role', 'img');
  bloomCanvas.setAttribute('aria-label', 'A bouquet of lilies, peonies, a rose, a tulip, a hydrangea and a pansy, drawn in letters, wrapped in kraft paper with a pink ribbon and a tag that says for Kyla, from Pipip.');

  const bq = BOUQUET.map((d, k) => {
    const f = makeFlower(d.type, { place: { box: true, x: d.x, y: d.y, r: d.r }, pal: d.pal, seed: 101 + k * 37, layers: d.layers || 3, rot: d.rot || 0 });
    f.reveal = 0;
    place(f);
    return { f, st: stemFor(f) };
  });
  vines = VINES.map(makeVine);
  for (const v of vines) layoutVine(v);
  const vineFlowers = vines.flatMap(v => [v.tipFlower, ...v.tendrils.filter(t => t.bud).map(t => t.bud)]);
  for (const f of vineFlowers) place(f);

  stems.push(...bq.map(b => b.st));
  const backToFront = bq.map((b, k) => ({ f: b.f, z: BOUQUET[k].z })).sort((a, b) => a.z - b.z).map(o => o.f);
  flowers.push(...backToFront, ...vineFlowers);

  if (instant) {
    Object.assign(wrap, { stems: 1, back: 1, front: 1, ribbon: 1, tag: 1 });
    for (const l of leaves) l.g = 1;
    for (const s of stems) s.prog = 1;
    for (const f of flowers) { f.g = 1; f.reveal = 1; }
    for (const v of vines) {
      v.prog = 1;
      v.popped = true;
      for (const td of v.tendrils) td.popped = true;
    }
    revealing = true;
    dirty = true;
    at(0.01, finish);
    return;
  }

  // The wrap builds up out of the opened gift.
  at(0.25 * ts, () => tween(wrap, 'stems', 1, 0.8 * ts, ease.linear));
  at(0.4 * ts, () => tween(wrap, 'back', PAPER_START, 1.1 * ts, t => ease.outBack(t, 1.1)));
  at(0.9 * ts, () => tween(wrap, 'front', 1, 0.9 * ts, ease.linear));
  at(1.7 * ts, () => {
    audio.sfx.pop();
    tween(wrap, 'ribbon', 1, 0.5 * ts, ease.linear);
  });
  at(2.0 * ts, () => {
    audio.sfx.shimmer();
    tween(wrap, 'tag', 1, 0.9 * ts, ease.linear);
  });
  leaves.forEach(l => at((WRAP_DONE + ARRIVE[l.after] + 0.6) * ts, () => tween(l, 'g', 1, 0.6 * ts, ease.linear)));
  // Flowers arrive one by one, and the back paper rises with them.
  bq.forEach((b, k) => {
    arrive(b.f, b.st, (WRAP_DONE + ARRIVE[k]) * ts, k === 0);
    const lift = PAPER_START + (1 - PAPER_START) * ((k + 1) / bq.length);
    at((WRAP_DONE + ARRIVE[k] + 0.2) * ts, () => tween(wrap, 'back', lift, 0.45 * ts, ease.outCubic));
  });
  for (const v of vines) at(v.delay * ts, () => tween(v, 'prog', 1, 4.5 * ts, ease.inOutCubic));
  const full = (WRAP_DONE + ARRIVE[ARRIVE.length - 1] + 1.8) * ts;
  at(full, () => {
    const n = startReveal();
    at(T + (stage.reduced ? 0.3 : n * 0.32 + 1.0), finish);
  });
}

function finish() {
  if (grown) return;
  grown = true;
  if (onGrownCb) onGrownCb();
}

/** Finale: a tap adds one more flower into the bouquet, near where she tapped. */
export function plant(x, y) {
  if (mode !== 'garden') return;
  const p = toBox(x, y);
  let dx = (p.x - DOME.x) / DOME.rx;
  let dy = (p.y - DOME.y) / DOME.ry;
  const d = Math.hypot(dx, dy);
  if (d > 0.92) { dx *= 0.92 / d; dy *= 0.92 / d; }
  const type = pick(['lily', 'lily', 'rose', 'peony', 'hydrangea', 'tulip', 'pansy', 'lilybud']);
  const pal = { lily: 'lily', rose: 'blush', peony: pick(['raspberry', 'cream']), hydrangea: 'blue', tulip: pick(['coral', 'marigold']), pansy: 'teal', lilybud: 'lilybud' }[type];
  const f = makeFlower(type, {
    place: { box: true, x: DOME.x + dx * DOME.rx, y: DOME.y + dy * DOME.ry, r: rand(0.07, 0.11) },
    pal, layers: 3, small: true, rot: rand(-0.5, 0.5),
  });
  f.reveal = 0;
  place(f);
  const st = stemFor(f);
  stems.push(st);
  const at0 = flowers.findIndex(q => q.vine); // after the bouquet, before the root blossoms
  if (at0 < 0) flowers.push(f);
  else flowers.splice(at0, 0, f);
  added.push({ f, st });
  tween(st, 'prog', 1, 0.4, ease.outCubic, () => {
    audio.sfx.pop();
    P.puff(f.x, f.y, f.r, f.puff, stage.reduced ? 4 : 8);
    tween(f, 'g', 1, 1.0, ease.outCubic, () => { if (revealing) tween(f, 'reveal', 1, 0.5, ease.outCubic); });
  });
  finger.x = x;
  finger.y = y;
  finger.s = 1;
  haptic(8);
  if (added.length > 24) {
    const old = added.shift();
    tween(old.f, 'alpha', 0, 0.8, ease.linear, () => {
      flowers = flowers.filter(q => q !== old.f);
      stems = stems.filter(q => q !== old.st);
      dirty = true;
    });
    tween(old.st, 'alpha', 0, 0.8, ease.linear);
  }
}

/* Per frame */
const INF = { cos: 0, sin: 0, dn: 99, cx: 0, cy: 0, seed: 0 };
function influence(x, y) {
  // Only flowers within 1.6 normalised radii matter (ripple and contour bands fade out beyond).
  let best2 = 2.56, bf = null;
  for (const f of flowers) {
    if (f.g < 0.15) continue;
    const R = f.r * 1.25, reach = R * 1.6;
    const dx = x - f.x;
    if (dx > reach || dx < -reach) continue;
    const dy = y - f.y;
    if (dy > reach || dy < -reach) continue;
    const dn2 = (dx * dx + dy * dy) / (R * R);
    if (dn2 < best2) { best2 = dn2; bf = f; }
  }
  if (!bf) { INF.dn = 99; return INF; }
  const dx = x - bf.x, dy = y - bf.y, d = Math.hypot(dx, dy) || 1;
  INF.cos = dx / d;
  INF.sin = dy / d;
  INF.dn = Math.sqrt(best2);
  INF.cx = bf.x;
  INF.cy = bf.y;
  INF.seed = (bf.seed % 628) / 100;
  return INF;
}

function paintScene(rc) {
  for (const v of vines) paintVine(rc, v);
  paintWrapBack(rc, wrap);
  for (const l of leaves) paintBouquetLeaf(rc, l);
  paintStemBundle(rc, wrap);
  for (const s of stems) paintStem(rc, s);
  for (const f of flowers) if (!f.vine) paintFlower(rc, f);
  paintWrapFront(rc, wrap);
  paintRibbon(rc, wrap);
  for (const f of flowers) if (f.vine) paintFlower(rc, f);
}

const revealOf = i => (owners[i] ? owners[i].reveal * owners[i].alpha : 0);

export function frame(dt) {
  const ctx = bctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);
  if (!isReady) return;
  if (!stage.paused) animT += dt;

  dustAlpha += (dustTarget - dustAlpha) * Math.min(1, dt * 2.5);
  if (dustAlpha > 0.01) drawDust(ctx, dt);
  if (mode !== 'garden') return;

  updateTimeline(dt);
  updateVines();
  finger.s *= Math.exp(-dt * 2.2);

  const t0 = performance.now();
  // While things grow, repaint and resample every other frame (~30 Hz); motion still renders at 60.
  let doPaint = dirty;
  if (dirty && tweens.length > 0) {
    paintTick ^= 1;
    doPaint = paintTick === 1;
  }
  if (doPaint) {
    field.paint(paintScene);
    const t1 = performance.now();
    owners = flowers.filter(f => !f.mini && f.g > 0.9 && f.alpha > 0.5);
    field.sample(influence, owners);
    const t2 = performance.now();
    prof.paint += (t1 - t0 - prof.paint) * 0.1;
    prof.sample += (t2 - t1 - prof.sample) * 0.1;
    dirty = false;
  }
  const t3 = performance.now();
  field.render(ctx, animT, dt, finger, revealOf);
  drawTag(ctx, wrap, animT);
  prof.render += (performance.now() - t3 - prof.render) * 0.1;

  if (grown && !stage.reduced && !stage.paused) {
    driftAcc += dt * 0.7;
    if (driftAcc >= 1) {
      driftAcc = 0;
      const f = pick(flowers);
      if (f && f.alpha > 0.5 && !f.mini) P.drift(f.x + rand(-f.r, f.r) * 0.6, f.y + rand(-f.r, f.r) * 0.4, f.puff);
    }
  }

  // Adaptive quality: if the bouquet is heavy on this phone, use bigger cells.
  if (!perf.checked && T > 4) {
    perf.n++;
    perf.sum += dt;
    if (perf.n >= 60) {
      perf.checked = true;
      if (perf.sum / perf.n > 0.024) {
        buildAtlas(glyph.cs + 2);
        field.resize();
        dirty = true;
        stage.quality = 0.6;
      }
    }
  }
}

export const stats = () => ({ glyphs: field.count, cs: glyph.cs, prof });

function onPointer(e) {
  if (mode !== 'garden') return;
  finger.x = e.clientX;
  finger.y = e.clientY;
  finger.s = Math.min(1, finger.s + (e.type === 'pointerdown' ? 1 : 0.25));
}
window.addEventListener('pointermove', onPointer, { passive: true });
window.addEventListener('pointerdown', onPointer, { passive: true });
