// Light leaking from the gift, written in the bouquet's own glyphs (. : + *) on its character grid,
// plus the ring of glyphs that expands at the burst.
import { stage } from './stage.js';
import { glyph, atlasRow } from './ascii.js';
import { clamp } from './util.js';

const RAYS = 7;
let gold = null;      // the glyph atlas tinted warm gold
let goldFor = null;   // which atlas it was built from
let cells = [];       // { x, y, a, r } around the seam, r normalised to the reach
let origin = null;

function tint() {
  if (gold && goldFor === glyph.atlas) return;
  const a = glyph.atlas;
  gold = document.createElement('canvas');
  gold.width = a.width;
  gold.height = a.height;
  const x = gold.getContext('2d');
  x.drawImage(a, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#FFD9A0';
  x.fillRect(0, 0, gold.width, gold.height);
  goldFor = a;
}

/** Precompute the cells around the seam (every other grid cell, so the light reads as rays). */
export function setup(cx, cy) {
  if (!glyph.ready) return;
  tint();
  origin = { x: cx, y: cy };
  const step = glyph.cs * 2;
  const reach = Math.min(stage.H * 0.62, stage.W * 1.15);
  cells = [];
  for (let y = step / 2; y < stage.H; y += step) {
    for (let x = step / 2; x < stage.W; x += step) {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      if (d > reach || d < step) continue;
      cells.push({ x, y, a: Math.atan2(dy, dx), r: d / reach });
    }
  }
}

const I = ch => glyph.index[ch];

function put(ctx, ch, lv, x, y) {
  const { gw, gh } = glyph;
  const k = stage.dpr; // atlas pixels per CSS px
  ctx.drawImage(gold, I(ch) * gw, atlasRow(0, lv) * gh, gw, gh, x - gw / (2 * k), y - gh / (2 * k), gw / k, gh / k);
}

/** e: tension 0..1, rot: slow rotation, ring: seconds since the burst (or -1). */
export function draw(ctx, e, rot, ring = -1) {
  if (!origin || !cells.length || !gold) return;
  ctx.save();
  if (e > 0.02) {
    for (const c of cells) {
      const beam = Math.pow(0.5 + 0.5 * Math.cos(RAYS * c.a + rot), 6);
      const b = beam * Math.pow(1 - c.r, 1.3) * e;
      if (b < 0.1) continue;
      ctx.globalAlpha = clamp(b * 1.4, 0, 1);
      const ch = b < 0.25 ? '.' : b < 0.45 ? ':' : b < 0.65 ? '+' : '*';
      put(ctx, ch, b > 0.5 ? 3 : 2, c.x, c.y);
    }
  }
  if (ring >= 0 && ring < 0.6 && !stage.reduced) {
    const reach = Math.min(stage.H * 0.62, stage.W * 1.15);
    const R = reach * (1 - Math.pow(1 - ring / 0.6, 3));
    const fade = Math.pow(1 - ring / 0.6, 1.5);
    const band = glyph.cs * 2.5;
    for (const c of cells) {
      const d = c.r * reach - R;
      if (d > 0 || d < -band * 2) continue;
      const lead = -d / (band * 2); // 0 at the leading edge
      ctx.globalAlpha = fade * (1 - lead * 0.7);
      put(ctx, lead < 0.2 ? '*' : lead < 0.45 ? '+' : lead < 0.7 ? '=' : '.', 3, c.x, c.y);
    }
  }
  ctx.restore();
}
