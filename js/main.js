import { CONFIG } from '../config.js';
import { stage, measure, fctx } from './stage.js';
import { params, rand, $ } from './util.js';
import * as pixel from './pixel.js';
import * as P from './particles.js';
import * as ascii from './ascii.js';
import * as bloom from './bloom.js';
import * as landing from './landing.js';
import * as burn from './burn.js';
import * as gift from './gift.js';
import * as iris from './iris.js';
import * as finale from './finale.js';
import * as audio from './audio.js';

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
stage.reduced = motionQuery.matches || params.get('reduced') === '1';
motionQuery.addEventListener?.('change', e => { stage.reduced = e.matches || params.get('reduced') === '1'; });

/* Text from config */
document.title = CONFIG.pageTitle;
{
  const [before, after = ''] = CONFIG.landing.title.split('{name}');
  const t = $('#title');
  t.textContent = before;
  const em = document.createElement('em');
  em.textContent = CONFIG.fromName;
  t.append(em, after);
  $('#btnYes .btn__label').textContent = CONFIG.landing.yes;
  $('#btnNo').textContent = CONFIG.landing.no;
  $('#giftHint').textContent = CONFIG.ui.giftHint;
  $('#letter').setAttribute('aria-label', `A letter from ${CONFIG.fromName}`);
}

/* Boot */
measure();
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(measure, 120);
});

pixel.init();
P.init();
audio.init();
landing.init({ onAccepted: toGift });
gift.init();
finale.init();

const muteBtn = $('#mute');
muteBtn.addEventListener('click', () => {
  muteBtn.setAttribute('aria-pressed', String(audio.toggleMute()));
});

// Pause freezes the ambient loops (ripple, shimmer, sweep, dust); the story itself still plays.
// Deliberately not remembered: a one-time gift should never open frozen.
const motionBtn = $('#motion');
motionBtn.addEventListener('click', () => {
  stage.paused = !stage.paused;
  document.body.classList.toggle('motion-paused', stage.paused);
  motionBtn.setAttribute('aria-pressed', String(stage.paused));
});

/* Scenes */
function setScene(name) {
  stage.scene = name;
  document.body.dataset.scene = name;
  document.querySelectorAll('.scene').forEach(s => s.classList.toggle('is-active', s.id === name));
}

function startGiftScene() {
  setScene('gift');
  gift.start({
    onBurst: () => bloom.startGarden({ onGrown: toFinale }),
    onDone: () => { if (stage.scene === 'gift') setScene('bloom'); },
  });
}

function toGift(x, y) {
  audio.sfx.whoosh();
  const seam = gift.seam();
  iris.start(x, y, startGiftScene, seam.x, seam.y);
}

function toFinale() {
  setScene('finale');
  finale.show();
}

// The headline is set in Instrument Serif; its fallback is much wider and would re-wrap under her eyes.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fontsReady = Promise.race([
  Promise.all([
    document.fonts.load('400 40px "Instrument Serif"'),
    document.fonts.load('italic 400 40px "Instrument Serif"'),
    document.fonts.load('400 15px "JetBrains Mono"'),
  ]).catch(() => {}),
  sleep(1200),
]);

Promise.all([fontsReady, ascii.initGlyphs()]).then(() => {
  document.body.classList.add('is-ready');
  bloom.ready();
  const jump = params.get('scene');
  if (jump === 'gift') { landing.skip(); startGiftScene(); }
  else if (jump === 'bloom') { landing.skip(); setScene('bloom'); bloom.startGarden({ onGrown: toFinale }); }
  else if (jump === 'finale') { landing.skip(); setScene('finale'); bloom.startGarden({ instant: true }); finale.show(); }
  else {
    bloom.setDust(true);
    landing.enter();
  }
});

/* Frame loop */
const fpsEl = $('#fps');
const showFps = params.get('fps') === '1';
if (showFps) fpsEl.hidden = false;
let fpsAcc = 0, fpsN = 0, fpsWorst = 0;

let last = performance.now();
let raf = 0;
function frame(now) {
  raf = requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) return;
  tick(dt);
}

// ?debug=1 exposes window.__bouquet.step(seconds) to advance the animation by hand.
if (params.get('debug') === '1') {
  window.__bouquet = {
    step(seconds = 1) {
      const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) tick(1 / 60);
      return stage.scene;
    },
    stats: () => bloom.stats(),
  };
}

function tick(dt) {
  stage.t += dt;
  bloom.frame(dt);

  const k = stage.fxDpr;
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.clearRect(0, 0, fctx.canvas.width, fctx.canvas.height);
  let sx = 0, sy = 0;
  if (stage.shake > 0.2) {
    sx = Math.round(rand(-1, 1) * stage.shake);
    sy = Math.round(rand(-1, 1) * stage.shake);
    stage.shake *= Math.exp(-dt * 9);
  } else stage.shake = 0;
  fctx.setTransform(k, 0, 0, k, sx * k, sy * k);

  landing.frame(dt);
  burn.frame(dt, fctx);
  gift.frame(dt, fctx);
  P.update(dt);
  P.draw(fctx);
  iris.frame(dt, fctx);

  if (showFps) {
    fpsAcc += dt; fpsN++; fpsWorst = Math.max(fpsWorst, dt);
    if (fpsAcc > 0.5) {
      const s = bloom.stats();
      fpsEl.textContent = `${Math.round(fpsN / fpsAcc)} fps  avg ${(1000 * fpsAcc / fpsN).toFixed(1)}ms  worst ${(1000 * fpsWorst).toFixed(0)}ms\n` +
        `glyphs ${s.glyphs}  cell ${s.cs}px  particles ${P.count()}  dpr ${stage.dpr}/${stage.fxDpr}\n` +
        `inner ${innerWidth}x${innerHeight}  insets t${stage.insets.t} b${stage.insets.b}`;
      fpsAcc = 0; fpsN = 0; fpsWorst = 0;
    }
  }
}
raf = requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    audio.pauseAll();
  } else {
    last = performance.now();
    raf = requestAnimationFrame(frame);
    audio.resumeAll();
  }
});
