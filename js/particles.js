// One shared particle system on the fx canvas: hearts, fire, smoke, ash, flower confetti, petals.
import { stage } from './stage.js';
import { rand, pick, TAU, ease } from './util.js';
import { SPR, BLOOM_KEYS } from './pixel.js';

const list = [];
let GL = null;

function soft([r, g, b], size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, size, size);
  return c;
}

export function init() {
  GL = {
    white: soft([255, 246, 220]),
    yellow: soft([255, 212, 110]),
    orange: soft([255, 138, 50]),
    red: soft([210, 56, 28]),
    smoke: soft([66, 58, 56]),
    gold: soft([255, 206, 120]),
  };
}
export const glowSprite = name => GL[name];

const FLAME = ['white', 'yellow', 'orange', 'red'];
const EMBER = ['yellow', 'orange', 'red'];

export function add(p) {
  if (list.length > 1100 * stage.quality) return null;
  const q = Object.assign({
    kind: 'sprite', x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, maxVy: 1e9,
    life: 1, age: 0, size: 3, rot: 0, vr: 0, alpha: 1,
    flutter: 0, phase: rand(TAU), sway: 0, swayF: 2,
    pop: 0, fadeIn: 0, fadeOut: 0.3, grow: 0, shrink: 0, flicker: false,
  }, p);
  list.push(q);
  return q;
}

export const count = () => list.length;

export function update(dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.age += dt;
    if (p.age >= p.life) {
      list[i] = list[list.length - 1];
      list.pop();
      continue;
    }
    if (p.drag) {
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
    }
    p.vy += p.g * dt;
    if (p.vy > p.maxVy) p.vy = p.maxVy;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.flutter) p.phase += p.flutter * dt;
  }
}

function alphaOf(p) {
  const f = p.age / p.life;
  let a = p.alpha;
  if (p.fadeIn && f < p.fadeIn) a *= f / p.fadeIn;
  if (f > 1 - p.fadeOut) a *= (1 - f) / p.fadeOut;
  return a;
}

export function draw(ctx) {
  ctx.imageSmoothingEnabled = true;
  for (const p of list) {
    if (p.kind !== 'smoke') continue;
    const s = p.size * (1 + (p.age / p.life) * 1.8);
    ctx.globalAlpha = alphaOf(p);
    ctx.drawImage(GL.smoke, p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const p of list) {
    if (p.kind !== 'glow') continue;
    const f = p.age / p.life;
    const spr = GL[p.seq[Math.min(p.seq.length - 1, Math.floor(f * p.seq.length))]];
    const s = p.size * (1 - f * p.shrink);
    ctx.globalAlpha = alphaOf(p) * (p.flicker ? 0.72 + 0.28 * Math.sin(p.age * 38 + p.phase) : 1);
    ctx.drawImage(spr, p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  for (const p of list) {
    if (p.kind !== 'sprite' && p.kind !== 'rect') continue;
    let sc = p.size;
    if (p.pop) {
      const tt = p.age / p.pop;
      if (tt < 1) sc *= Math.max(0.01, ease.outBack(tt, 2.4));
    }
    if (p.grow) sc *= 1 + p.grow * (p.age / p.life);
    const fx = p.flutter ? Math.cos(p.phase) : 1;
    let x = p.x + (p.sway ? Math.sin(p.age * p.swayF + p.phase) * p.sway : 0);
    let y = p.y;
    if (!p.rot && !p.flutter) {
      const k = stage.fxDpr; // snap upright sprites to device pixels
      x = Math.round(x * k) / k;
      y = Math.round(y * k) / k;
    }
    ctx.globalAlpha = alphaOf(p);
    ctx.save();
    ctx.translate(x, y);
    if (p.rot) ctx.rotate(p.rot);
    ctx.scale(Math.abs(fx) < 0.02 ? 0.02 : fx, 1);
    if (p.kind === 'sprite') {
      const w = p.sprite.width * sc, h = p.sprite.height * sc;
      ctx.drawImage(p.sprite, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(-sc / 2, -sc / 2, sc, sc);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* Emitters */

// Hearts keep whole art pixels and no rotation, so the pixel art stays crisp on a 3x screen.
export function heart(x, y, burst = false) {
  return add({
    sprite: pick(SPR.hearts), x, y,
    vx: burst ? rand(-180, 180) : rand(-28, 28),
    vy: burst ? -rand(240, 540) : -rand(120, 230),
    g: burst ? 430 : -20,
    drag: burst ? 2.2 : 0.4,
    life: rand(1.0, 1.65),
    size: burst ? pick([3, 4, 5]) : pick([3, 4]),
    sway: burst ? rand(4, 12) : rand(10, 22), swayF: rand(3, 5),
    pop: 0.22, fadeOut: 0.45,
  });
}

export function flame(x, y) {
  return add({ kind: 'glow', seq: FLAME, x: x + rand(-2, 2), y, vx: rand(-14, 14), vy: -rand(45, 120), g: -80, life: rand(0.32, 0.7), size: rand(12, 27), shrink: 0.7, alpha: rand(0.55, 0.9), fadeOut: 0.4, flicker: true });
}
export function ember(x, y) {
  return add({ kind: 'glow', seq: EMBER, x, y, vx: rand(-45, 45), vy: -rand(60, 170), g: 40, drag: 0.6, life: rand(0.7, 1.4), size: rand(4, 7), shrink: 0.5, fadeOut: 0.5, flicker: true });
}
export function smoke(x, y) {
  return add({ kind: 'smoke', x, y, vx: rand(-12, 12), vy: -rand(22, 55), life: rand(1.1, 1.9), size: rand(14, 24), alpha: rand(0.12, 0.22), fadeIn: 0.15, fadeOut: 0.6 });
}
export function ash(x, y) {
  return add({
    kind: 'rect', color: pick(['#3B3431', '#57504B', '#2A2422', '#7A6F68']), x, y,
    vx: rand(-30, 30), vy: rand(-40, 10), g: 140, drag: 1.6, maxVy: 70,
    life: rand(1.4, 2.4), size: rand(2, 3.6), rot: rand(TAU), vr: rand(-3, 3),
    flutter: rand(4, 9), sway: rand(6, 16), swayF: rand(2, 4), fadeOut: 0.4,
  });
}
export function bit(x, y, color, vx, vy, size = 6) {
  return add({ kind: 'rect', color, x, y, vx, vy, g: 1500, drag: 1.2, maxVy: 500, life: rand(1.2, 2), size, rot: rand(TAU), vr: rand(-8, 8), flutter: rand(5, 10), fadeOut: 0.3 });
}

/** Flower confetti from the gift burst. k scales distances to the screen height. */
export function confetti(x, y, k = 1) {
  const spread = Math.random() < 0.7 ? 0.75 : 1.2;
  const ang = -Math.PI / 2 + rand(-1, 1) * spread;
  const sp = rand(420, 1350) * k;
  const key = pick(BLOOM_KEYS);
  const r = Math.random();
  let o;
  if (r < 0.5) o = { sprite: Math.random() < 0.55 ? SPR.flowerA[key] : SPR.flowerB[key], size: rand(2.4, 3.6), maxVy: rand(140, 230) * k, drag: 1.3, flutter: rand(2.5, 6) };
  else if (r < 0.86) o = { sprite: SPR.petal[key], size: rand(2.8, 4), maxVy: rand(80, 150) * k, drag: 1.7, flutter: rand(5, 10) };
  else o = { sprite: pick(SPR.leaf), size: rand(2.6, 3.4), maxVy: rand(160, 220) * k, drag: 1.5, flutter: rand(3, 6) };
  return add(Object.assign(o, {
    x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: 1150 * k,
    life: rand(3.6, 5.6), rot: rand(TAU), vr: rand(-4, 4),
    sway: rand(8, 26), swayF: rand(1.4, 2.8), fadeOut: 0.22, pop: 0.12,
  }));
}

export function seamPetal(x, y) {
  return add({ sprite: SPR.petal[pick(BLOOM_KEYS)], x, y, vx: rand(-40, 40), vy: -rand(60, 150), g: 110, drag: 1.1, maxVy: 60, life: rand(1.2, 1.9), size: rand(2.2, 3), rot: rand(TAU), vr: rand(-3, 3), flutter: rand(4, 8), sway: rand(4, 10), swayF: 3, fadeOut: 0.5, pop: 0.1 });
}

export function puff(x, y, r, key, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = rand(TAU), sp = rand(80, 220);
    add({
      sprite: Math.random() < 0.7 ? SPR.petal[key] : SPR.flowerB[key],
      x: x + Math.cos(a) * r * 0.4, y: y + Math.sin(a) * r * 0.4,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 260, drag: 2.2, maxVy: 90,
      life: rand(1.0, 1.8), size: rand(2.2, 3.2), rot: rand(TAU), vr: rand(-4, 4),
      flutter: rand(4, 9), sway: rand(4, 10), swayF: 3, fadeOut: 0.5, pop: 0.1,
    });
  }
}

export function drift(x, y, key) {
  return add({ sprite: SPR.petal[key], x, y, vx: rand(-10, 10), vy: rand(10, 30), g: 8, maxVy: 40, life: rand(5, 8), size: rand(2.4, 3.2), rot: rand(TAU), vr: rand(-1.5, 1.5), flutter: rand(2, 4), sway: rand(12, 26), swayF: rand(0.8, 1.4), fadeIn: 0.1, fadeOut: 0.3, alpha: 0.85 });
}
