// The gift: pixel art at whole-pixel scale that twitches in art-pixel steps while light leaks from
// its seam, pulls the landing's letters in, then bursts into flower confetti and a ring of glyphs.
import { stage } from './stage.js';
import * as P from './particles.js';
import * as audio from './audio.js';
import * as light from './light.js';
import { setDustPull } from './bloom.js';
import { tie } from './bouquet.js';
import { SPR } from './pixel.js';
import { rand, clamp, ease, haptic, pick, $ } from './util.js';

let active = false, opened = false, tapped = false;
let t = 0, tension = 0, tOpen = 0, jolt = 0, rot = 0, petalAcc = 0, twitchAcc = 0;
let ox = 0, oy = 0, lift = 0;
let lid = null, cbs = {}, hintEl = null, hintTimer = 0;

export function init() {
  hintEl = $('#giftHint');
  $('#gift').addEventListener('pointerdown', () => {
    if (!active || opened) return;
    tension = Math.min(1, tension + 0.2);
    jolt = 1;
    tapped = true;
    hintEl.classList.remove('show');
    audio.unlock();
    audio.sfx.knock();
    haptic(10);
  });
}

/** Whole-pixel geometry, with the box sitting where the bouquet's tie will be. */
function geom() {
  const { W, H } = stage;
  const s = clamp(Math.floor(Math.min(W * 0.46, 230, H * 0.27) / 18), 4, 14);
  const cx = Math.round(W / 2);
  const by = Math.round(Math.min(tie().y + 5.5 * s, H * 0.78));
  return { s, cx, by, top: by - 11 * s };
}

/** Where the iris opens from: the gift's seam. */
export function seam() {
  const G = geom();
  return { x: G.cx, y: G.top };
}

export function start(callbacks = {}) {
  cbs = callbacks;
  active = true;
  opened = false;
  tapped = false;
  t = tension = tOpen = jolt = petalAcc = twitchAcc = ox = oy = lift = 0;
  lid = null;
  const G = geom();
  light.setup(G.cx, G.top);
  document.getElementById('gift').style.setProperty('--gift-base', `${G.by + G.s * 3}px`);
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { if (!opened && !tapped) hintEl.classList.add('show'); }, 1200);
}

function burst(G) {
  opened = true;
  tOpen = 0;
  clearTimeout(hintTimer);
  hintEl.classList.remove('show');
  setDustPull(null);
  const k = stage.H / 844;
  stage.shake = stage.reduced ? 0 : 8;
  haptic([30, 40, 80]);
  audio.sfx.burst();
  lid = { x: G.cx, y: G.top - 5 * G.s, vx: rand(-220, 220), vy: -1900 * k, rot: 0, vr: rand(-6, 6) };
  const area = clamp((stage.W * stage.H) / (390 * 844), 0.7, 1.5);
  const n = Math.round((stage.reduced ? 60 : 220) * stage.quality * area);
  for (let i = 0; i < n; i++) P.confetti(G.cx + rand(-6.5, 6.5) * G.s, G.top + rand(0, 2) * G.s, k);
  for (let i = 0; i < 14; i++) {
    P.bit(G.cx + rand(-1, 1) * G.s, G.top, pick(['#E8B23A', '#F7E7B8', '#B4822A']), rand(-520, 520), -rand(400, 1100) * k, G.s);
  }
  if (cbs.onBurst) cbs.onBurst(G);
}

export function frame(dt, ctx) {
  if (!active) return;
  t += dt;
  jolt *= Math.exp(-dt * 6);
  if (!stage.paused) rot += dt * 0.25;
  const G = geom();
  const s = G.s;
  const R = stage.reduced;

  if (!opened) {
    if (t > 0.6) tension = Math.min(1, tension + dt / (R ? 2.4 : 6.5)); // a moment to settle after the iris
    if (tension >= 1) burst(G);
    else setDustPull({ x: G.cx, y: G.top, k: 0.25 + 0.75 * tension });
  } else {
    tOpen += dt;
  }
  const e = opened ? 1 : Math.pow(tension, 1.5);

  // Light under the box: rays while it strains, a ring of glyphs at the burst.
  const lightE = opened ? Math.max(0, 1 - tOpen / 1.4) : e;
  light.draw(ctx, lightE, rot, opened ? tOpen : -1);
  if (opened && tOpen < 0.25) {
    const r = Math.min(stage.W, stage.H) * 0.28;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6 * (1 - tOpen / 0.25) * (R ? 0.5 : 1);
    ctx.drawImage(P.glowSprite('gold'), G.cx - r, G.top - r, r * 2, r * 2);
    ctx.restore();
  }

  // Stepped twitch: whole art pixels, never rotation or squash, so the pixel grid stays intact.
  if (!opened && !R) {
    twitchAcc += dt;
    if (twitchAcc >= 1 / 15) {
      twitchAcc = 0;
      const strong = e > 0.75 || jolt > 0.5;
      const go = Math.random() < 0.15 + 0.85 * e;
      ox = go ? (Math.random() < 0.5 ? -1 : 1) * (strong ? 2 : 1) * s : 0;
      oy = go && Math.random() < 0.5 ? -(strong ? 2 : 1) * s * 0.5 : 0;
      const hop = jolt > 0.5 ? 2 : e > 0.75 ? 2 : e > 0.35 ? 1 : 0;
      lift = hop && Math.random() < 0.4 ? hop * s : 0;
    }
  } else if (!opened) {
    ox = oy = lift = 0;
  }

  let alpha = 1, sink = 0;
  if (opened) {
    const kk = clamp((tOpen - 0.9) / 1.2);
    alpha = 1 - kk;
    sink = Math.round(ease.inCubic(kk) * 6) * s;
    ox = oy = 0;
  }

  if (alpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    const bx = G.cx + ox - 8 * s, by = G.by + oy + sink;
    ctx.drawImage(SPR.body, bx, by - 11 * s, 16 * s, 11 * s);
    if (!opened) ctx.drawImage(SPR.lidbow, G.cx + ox - 9 * s, by - 20 * s - lift, 18 * s, 10 * s);
    ctx.restore();
  }

  if (!opened && e > 0.15 && !R) {
    petalAcc += dt * 6 * e;
    while (petalAcc >= 1) {
      petalAcc -= 1;
      P.seamPetal(G.cx + rand(-7, 7) * s, G.top - s * 0.5);
    }
  }

  if (lid) {
    lid.vy += 1600 * (stage.H / 844) * dt;
    lid.x += lid.vx * dt;
    lid.y += lid.vy * dt;
    lid.rot += lid.vr * dt;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (R) {
      ctx.globalAlpha = Math.max(0, 1 - tOpen / 0.3);
      ctx.drawImage(SPR.lidbow, G.cx - 9 * s, G.top - 9 * s, 18 * s, 10 * s);
    } else {
      ctx.translate(lid.x, lid.y);
      ctx.rotate(lid.rot);
      ctx.drawImage(SPR.lidbow, -9 * s, -5 * s, 18 * s, 10 * s);
    }
    ctx.restore();
    if (lid.y < -12 * s || lid.y > stage.H + 12 * s || (R && tOpen > 0.3)) lid = null;
  }

  if (opened && tOpen > 2.3) {
    active = false;
    lid = null;
    if (cbs.onDone) cbs.onDone();
  }
}
