// Finale: the letter chip opens a native dialog where the letter types out; after the first full read
// the dock promotes "send a heart back", and taps on the bouquet add flowers.
import { CONFIG } from '../config.js';
import { stage, bloomCanvas } from './stage.js';
import * as bloom from './bloom.js';
import * as audio from './audio.js';
import * as P from './particles.js';
import { SPR, paintInto } from './pixel.js';
import { haptic, $ } from './util.js';

const chars = [];
let letter, paper, dock, chip, typing = false, typed = false, index = 0;
let timer = 0, openTimer = 0, hintTimer = 0, openedAt = 0, planting = false, hinted = false;

function spanText(el, text) {
  el.textContent = '';
  const out = [];
  for (const ch of text) {
    const sp = document.createElement('span');
    sp.className = ch === '♡' ? 'ch heart' : 'ch';
    sp.textContent = ch;
    el.appendChild(sp);
    out.push(sp);
  }
  return out;
}

export function init() {
  letter = $('#letter');
  paper = $('#paper');
  dock = $('#dock');
  chip = $('#letterChip');
  chars.push(...spanText($('#letterMsg'), CONFIG.letter.message));
  spanText($('#letterSig'), CONFIG.letter.signature).forEach(sp => sp.classList.add('on'));
  $('#chipTitle').textContent = CONFIG.ui.chip;
  $('#chipMeta').textContent = CONFIG.ui.chipMeta;
  $('#replyBtn').textContent = CONFIG.ui.reply;
  $('#saveBtn').textContent = CONFIG.ui.save;
  $('#replayBtn').textContent = CONFIG.ui.again;
  $('#plantHint').textContent = CONFIG.ui.plantHint;
  document.querySelectorAll('canvas.seal').forEach(cv => paintInto(cv, SPR.hearts[0]));
  paper.tabIndex = -1;

  chip.addEventListener('click', open);
  $('#letterClose').addEventListener('click', e => { e.stopPropagation(); close(); });
  paper.addEventListener('click', () => { if (typing) finish(); });
  // A tap on the dark backdrop closes the letter, but not in the first moments (a double tap).
  letter.addEventListener('click', e => {
    if (e.target === letter && typed && performance.now() - openedAt > 700) close();
  });
  letter.addEventListener('cancel', e => { e.preventDefault(); close(); }); // Escape
  $('#saveBtn').addEventListener('click', save);
  $('#replayBtn').addEventListener('click', () => { location.href = location.pathname; });
  const reply = $('#replyBtn');
  reply.href = replyHref();
  reply.addEventListener('click', () => {
    const r = reply.getBoundingClientRect();
    for (let i = 0; i < (stage.reduced ? 3 : 10); i++) P.heart(r.left + r.width * Math.random(), r.top, true);
    audio.sfx.pop();
  });
  $('#finale').addEventListener('pointerdown', onPlant);
}

function replyHref() {
  const { app, to = '', text = '' } = CONFIG.reply || {};
  const t = encodeURIComponent(text);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (app === 'imessage') return `sms:${to}${ios ? '&' : '?'}body=${t}`;
  if (app === 'instagram') {
    return to ? `https://ig.me/m/${encodeURIComponent(to.replace(/^@/, ''))}` : 'https://www.instagram.com/direct/inbox/';
  }
  return `https://wa.me/${to.replace(/\D/g, '')}?text=${t}`;
}

export function show() {
  chip.classList.add('show');
}

function open() {
  if (letter.open) return;
  audio.sfx.whoosh();
  haptic(8);
  if (letter.showModal) letter.showModal();
  else letter.setAttribute('open', '');
  openedAt = performance.now();
  paper.focus({ preventScroll: true });
  if (!typed && !typing) openTimer = setTimeout(type, stage.reduced ? 200 : 650);
}

function type() {
  if (typed || typing) return;
  typing = true;
  const step = () => {
    if (!typing) return;
    if (index >= chars.length) { done(); return; }
    const sp = chars[index++];
    sp.classList.add('on');
    const ch = sp.textContent;
    if (index % 2 === 0 && ch.trim()) audio.sfx.tick();
    let d = 34;
    if (ch === ',') d = 230;
    else if (ch === '.' || ch === '!' || ch === '?') d = 420;
    else if (ch === ' ') d = 22;
    timer = setTimeout(step, d);
  };
  step();
}

function finish() {
  clearTimeout(timer);
  chars.forEach(c => c.classList.add('on'));
  index = chars.length;
  done();
}

function done() {
  typing = false;
  typed = true;
  $('#letterSig').classList.add('show');
  setTimeout(() => $('#letterClose').classList.add('show'), 500);
}

function close() {
  clearTimeout(openTimer);
  clearTimeout(timer);
  typing = false; // typing resumes from the same letter next time
  if (letter.open) letter.close();
  chip.focus({ preventScroll: true });
  if (!typed || dock.dataset.state === 'read') return;
  dock.dataset.state = 'read';
  chip.setAttribute('aria-label', 'Read the letter again');
  planting = true;
  hintTimer = setTimeout(hideHint, 8000);
}

function hideHint() {
  if (hinted) return;
  hinted = true;
  $('#plantHint').classList.add('gone');
}

function onPlant(e) {
  if (!planting) return;
  if (e.target.closest('button, a, dialog, .dock')) return;
  bloom.plant(e.clientX, e.clientY);
  clearTimeout(hintTimer);
  hideHint();
}

function save() {
  haptic(8);
  const src = bloomCanvas;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const x = c.getContext('2d');
  x.fillStyle = '#0B0A0D';
  x.fillRect(0, 0, c.width, c.height);
  x.drawImage(src, 0, 0);
  const dpr = stage.dpr;
  x.font = `italic ${Math.round(24 * dpr)}px "Instrument Serif", serif`;
  x.fillStyle = 'rgba(243,237,228,0.8)';
  x.textAlign = 'center';
  x.fillText(CONFIG.saveCaption, c.width / 2, c.height - (stage.insets.b + 34) * dpr);

  // A synchronous data URL keeps this inside the tap, which iOS needs for the share sheet.
  const url = c.toDataURL('image/png');
  const name = 'bouquet.png';
  let file = null;
  try {
    const bin = atob(url.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    file = new File([bytes], name, { type: 'image/png' });
  } catch (_) { /* fall back to a download */ }

  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'my bouquet' }).catch(() => {});
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
