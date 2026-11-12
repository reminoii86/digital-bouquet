// Landing: an entrance that types the question, Yes as press-and-hold to untie (a tap still works),
// and No that burns from her fingertip before Yes slides to the middle.
import { CONFIG } from '../config.js';
import { stage } from './stage.js';
import * as P from './particles.js';
import * as burn from './burn.js';
import * as audio from './audio.js';
import { SPR, paintInto } from './pixel.js';
import { rand, clamp, haptic, $ } from './util.js';

const HOLD = 0.9; // seconds of holding to untie the ribbon

let yes, no, choices, subText, subLive, hint;
let entered = false, enterTimers = [], typeTimer = 0;
let hot = false, pressed = false, accepted = false, burning = false;
let hold = 0, emitAcc = 0, afterglow = 0, activeId = null, centerTimer = 0, onAccept = null;

export function init({ onAccepted }) {
  onAccept = onAccepted;
  yes = $('#btnYes');
  no = $('#btnNo');
  choices = $('#choices');
  subText = $('#subText');
  subLive = $('#subLive');
  hint = $('#yesHint');
  paintInto($('#giftIcon'), SPR.gift);
  subLive.textContent = CONFIG.landing.question;
  for (const el of [$('#giftIcon'), $('#title'), $('#sub'), no, yes, hint]) el.classList.add('enter');

  yes.addEventListener('pointerdown', onDown);
  yes.addEventListener('pointermove', onMove);
  yes.addEventListener('pointerup', onUp);
  yes.addEventListener('pointercancel', () => { activeId = null; release(); });
  yes.addEventListener('contextmenu', e => e.preventDefault());
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    yes.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && !accepted) setHot(true); });
    yes.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && activeId === null && !accepted) release(); });
  }
  // Enter and Space produce a click with detail 0.
  yes.addEventListener('click', e => { if (e.detail === 0 && !accepted) { audio.unlock(); accept(); } });

  no.addEventListener('pointerdown', () => audio.unlock());
  no.addEventListener('click', onNo);
  no.addEventListener('contextmenu', e => e.preventDefault());

  // Any touch during the entrance completes it at once.
  $('#landing').addEventListener('pointerdown', () => finishEnter(), { capture: true });
}

/* Entrance */
function typeInto(el, text, ms, done) {
  clearTimeout(typeTimer);
  let i = 0;
  const step = () => {
    el.textContent = text.slice(0, ++i);
    if (i < text.length) typeTimer = setTimeout(step, ms);
    else if (done) done();
  };
  step();
}

function backspace(el, ms, done) {
  clearTimeout(typeTimer);
  const step = () => {
    el.textContent = el.textContent.slice(0, -1);
    if (el.textContent.length) typeTimer = setTimeout(step, ms);
    else if (done) done();
  };
  step();
}

export function enter() {
  if (stage.reduced) { finishEnter(); return; }
  const at = (ms, fn) => enterTimers.push(setTimeout(fn, ms));
  at(0, () => $('#giftIcon').classList.add('is-in'));
  at(300, () => $('#title').classList.add('is-in'));
  at(820, () => {
    $('#sub').classList.add('is-in');
    typeInto(subText, CONFIG.landing.question, 28, () => {
      no.classList.add('is-in');
      enterTimers.push(setTimeout(() => yes.classList.add('is-in'), 80));
      enterTimers.push(setTimeout(() => { hint.classList.add('is-in'); entered = true; }, 320));
    });
  });
}

function finishEnter() {
  if (entered) return;
  entered = true;
  enterTimers.forEach(clearTimeout);
  clearTimeout(typeTimer);
  subText.textContent = CONFIG.landing.question;
  document.querySelectorAll('#landing .enter').forEach(el => el.classList.add('is-in'));
}

export const skip = finishEnter;

/* Yes: press and hold */
function inside(e, pad = 30) {
  const r = yes.getBoundingClientRect();
  return e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
}

function onDown(e) {
  if (accepted || (e.pointerType === 'mouse' && e.button !== 0)) return;
  activeId = e.pointerId;
  audio.unlock();
  audio.unlockMusic(); // inside the gesture, so the song may start later without one
  try { yes.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
  pressed = true;
  hold = 0;
  setHot(true);
  haptic(8);
  for (let i = 0; i < 3; i++) spawnHeart(false);
}

function onMove(e) {
  if (accepted || e.pointerId !== activeId) return;
  const inOk = inside(e);
  if (!inOk && hot) release();
  else if (inOk && !hot) { pressed = true; setHot(true); }
}

function onUp(e) {
  if (accepted || e.pointerId !== activeId) return;
  activeId = null;
  if (inside(e)) accept(); // a tap, or a hold released early, still accepts
  else release();
}

function setHot(v) {
  if (hot === v) return;
  hot = v;
  yes.classList.toggle('is-hot', v);
  if (v) audio.sfx.heart();
}

function release() {
  pressed = false;
  hold = 0;
  yes.style.setProperty('--hold', '0');
  setHot(false);
}

function accept() {
  accepted = true;
  burn.cancel();
  clearTimeout(centerTimer);
  setHot(true);
  yes.style.setProperty('--hold', '1');
  afterglow = 0.45;
  audio.sfx.accept();
  haptic([10, 30, 16]);
  const n = stage.reduced ? 8 : Math.round(14 + 16 * hold);
  for (let i = 0; i < n; i++) spawnHeart(true);
  const r = yes.getBoundingClientRect();
  setTimeout(() => onAccept && onAccept(r.left + r.width / 2, r.top + r.height / 2), stage.reduced ? 200 : 420);
}

function spawnHeart(isBurst) {
  const r = yes.getBoundingClientRect();
  P.heart(r.left + r.width * rand(0.18, 0.82), r.top + r.height * rand(0.05, 0.4), isBurst);
}

export function frame(dt) {
  if (stage.scene !== 'landing' || !hot) return;
  if (accepted) {
    afterglow -= dt;
    if (afterglow <= 0) return;
  } else if (pressed) {
    hold = clamp(hold + dt / HOLD);
    yes.style.setProperty('--hold', hold.toFixed(3));
    if (hold >= 1) { activeId = null; accept(); return; }
  }
  emitAcc += dt * (stage.reduced ? 5 : 10 + 18 * hold);
  while (emitAcc >= 1) {
    emitAcc -= 1;
    spawnHeart(false);
    if (Math.random() < 0.3) audio.sfx.heart();
  }
}

/* No: burns from where she touched */
function onNo(e) {
  if (burning || accepted) return;
  burning = true;
  audio.unlock();
  haptic([16, 40, 16, 40, 30]);
  audio.sfx.crackle(stage.reduced ? 1.2 : 1.9);
  const r = no.getBoundingClientRect();
  const origin = e && e.detail ? { x: e.clientX - r.left, y: e.clientY - r.top } : null;
  burn.start(no, { origin, onDone: centerYes });
  // The question backspaces away, then the punchline types in.
  backspace(subText, 14, () => {
    subText.classList.add('is-alt');
    typeInto(subText, CONFIG.landing.afterBurn, 32);
    subLive.textContent = CONFIG.landing.afterBurn;
  });
}

function centerYes() {
  if (accepted) return;
  const first = yes.getBoundingClientRect();
  no.hidden = true;
  choices.classList.add('is-solo');
  const last = yes.getBoundingClientRect();
  const dx = first.left - last.left, dy = first.top - last.top;
  if (yes.animate && (dx || dy)) {
    yes.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
      { duration: stage.reduced ? 1 : 700, easing: 'cubic-bezier(.34,1.4,.64,1)' },
    );
  }
}
