// Procedural flower painters (palette from Ref 1). Each flower has a growth value g in 0..1:
// 0–0.22 is the bud swelling, then petals unfurl. Painted twice per change (grid + colour),
// so shapes are bold and petal bases are darker: that is what gives the ASCII version structure.
import { TAU, clamp, ease, seeded, mixHex, rgba, pick } from './util.js';

export const PALS = {
  cream: {
    layers: [['#857A70', '#E8E2D9'], ['#9E8A76', '#F8F3EA'], ['#B08A66', '#F5EBDD'], ['#BE7C46', '#F1DFC6'], ['#A9561F', '#EBC896']],
    center: '#5A240C', stamen: ['#E8B23A', '#F7D27A', '#D9862B'], filament: '#C98A2E', bud: ['#9E8A76', '#F4EEE3'],
    edge: 'rgba(40,22,12,0.45)', bubble: '#F4EEE3', glow: { a: 0.55, size: 2.2 }, puff: 'cream',
  },
  raspberry: {
    layers: [['#8A2443', '#E86A8C'], ['#9A2C4E', '#F08AA6'], ['#A8385A', '#F7A8BE']],
    center: '#4A0E1E', stamen: ['#E8B23A', '#F7D27A'], filament: '#D9A040', bud: ['#9A2C4E', '#E86A8C'],
    edge: 'rgba(30,6,14,0.5)', bubble: '#F08AA6', glow: { a: 0.3, size: 1.5 }, puff: 'raspberry',
  },
  blush: {
    inner: ['#C9687E', '#F2AEBB'], outer: ['#DDA19F', '#FFE6DE'], center: '#8E3248', bud: ['#C9687E', '#F5C9C0'],
    edge: 'rgba(60,20,26,0.45)', bubble: '#F5C9C0', glow: { a: 0.22, size: 1.3 }, puff: 'blush',
  },
  coral: {
    back: ['#C25A4A', '#F4A08C'], side: ['#D46B5A', '#F8B4A2'], front: ['#E07E6C', '#FFD2C4'], bud: ['#D46B5A', '#F8B4A2'],
    edge: 'rgba(50,16,10,0.45)', bubble: '#F5B3A4', glow: null, puff: 'coral',
  },
  marigold: {
    back: ['#B9601A', '#F2AA40'], side: ['#CC7222', '#F8BC50'], front: ['#DA8228', '#FFD46A'], bud: ['#CC7222', '#F8BC50'],
    edge: 'rgba(50,22,6,0.45)', bubble: '#F6C66A', glow: null, puff: 'marigold',
  },
  blue: {
    florets: ['#A8D0E2', '#C4E0EC', '#8EBBD0', '#DCEBF2', '#B4CBF0'], base: '#5E8FA6', mass: '#2E5A6E', center: '#F4EEE3',
    bud: ['#5E8FA6', '#A8D0E2'], edge: 'rgba(10,26,34,0.45)', bubble: '#C4E0EC', glow: null, puff: 'blue',
  },
  // Pink lilies and their buds, from the wrapped-bouquet reference.
  lily: {
    base: '#B83A6E', mid: '#EC8CB2', tip: '#FCE6EF', speck: '#7C1A47', filament: '#D6E2A0', anther: '#A44A1C',
    throat: '#D9E8B0', bud: ['#6E9150', '#EBA9C4'], edge: 'rgba(70,14,36,0.45)', bubble: '#F5C9DA', glow: null, puff: 'blush',
  },
  lilybud: {
    bud: ['#5F8547', '#E39BB9'], edge: 'rgba(20,40,16,0.45)', bubble: '#B9D69A', glow: null, puff: 'blush',
  },
  teal: {
    top: ['#1F5A6B', '#5FB3CB'], side: ['#246676', '#6CC0D6'], bottom: ['#1C5464', '#58AAC2'],
    face: '#0B2630', eye: '#EBA23A', stamen: '#D8455E', bud: ['#246676', '#6CC0D6'],
    edge: 'rgba(4,16,20,0.5)', bubble: '#8FCBDD', glow: null, puff: 'teal',
  },
};

/* Shapes */

function petalPath(c, L, Wd, ruffle, r) {
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(-Wd * 0.6, -L * 0.12, -Wd * 0.64, -L * 0.7, -Wd * 0.36, -L * 0.92);
  if (ruffle > 0) {
    const x0 = -Wd * 0.36, span = Wd * 0.72;
    for (let i = 0; i < ruffle; i++) {
      const xm = x0 + (span * (i + 0.5)) / ruffle, x1 = x0 + (span * (i + 1)) / ruffle;
      const top = L * (1.04 + 0.05 * Math.sin(r * 11 + i * 2.3));
      const y1 = i === ruffle - 1 ? -L * 0.92 : -L * (0.95 + 0.03 * Math.sin(r * 7 + i * 1.7));
      c.quadraticCurveTo(xm, -top, x1, y1);
    }
  } else {
    c.quadraticCurveTo(0, -L * 1.12, Wd * 0.36, -L * 0.92);
  }
  c.bezierCurveTo(Wd * 0.64, -L * 0.7, Wd * 0.6, -L * 0.12, 0, 0);
  c.closePath();
}

function roundPetal(c, L, Wd) {
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(-Wd * 0.78, -L * 0.08, -Wd * 0.72, -L * 1.02, 0, -L);
  c.bezierCurveTo(Wd * 0.72, -L * 1.02, Wd * 0.78, -L * 0.08, 0, 0);
  c.closePath();
}

/** Pointed lily petal. */
function lancePath(c, L, Wd) {
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(-Wd * 0.55, -L * 0.18, -Wd * 0.5, -L * 0.62, 0, -L);
  c.bezierCurveTo(Wd * 0.5, -L * 0.62, Wd * 0.55, -L * 0.18, 0, 0);
  c.closePath();
}

/** Closed, elongated lily bud pointing up (length s). */
function lilyBudShape(rc, f, s, cols) {
  if (s <= 1) return;
  const c = rc.c;
  c.beginPath();
  c.moveTo(0, s * 0.12);
  c.bezierCurveTo(-s * 0.21, 0, -s * 0.2, -s * 0.62, 0, -s);
  c.bezierCurveTo(s * 0.2, -s * 0.62, s * 0.21, 0, 0, s * 0.12);
  c.closePath();
  const g = c.createLinearGradient(0, s * 0.12, 0, -s);
  g.addColorStop(0, cols[0]);
  g.addColorStop(0.6, mixHex(cols[0], cols[1], 0.45));
  g.addColorStop(1, cols[1]);
  c.fillStyle = g;
  c.fill();
  edge(rc, f);
  // seam where the petals will split
  c.beginPath();
  c.moveTo(0, -s * 0.15);
  c.lineTo(0, -s * 0.92);
  c.lineWidth = rc.mode === 'grid' ? rc.cs * 0.3 : 0.8;
  c.strokeStyle = rc.mode === 'grid' ? 'rgba(0,0,0,0.3)' : 'rgba(40,60,30,0.4)';
  c.stroke();
}

function leafPath(c, L, Wd) {
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(Wd, -L * 0.45, 0, -L);
  c.quadraticCurveTo(-Wd, -L * 0.45, 0, 0);
  c.closePath();
}

function shade(c, L, base, mid, tip, rim) {
  const g = c.createLinearGradient(0, 0, 0, -L);
  g.addColorStop(0, base);
  if (mid) g.addColorStop(0.5, mid);
  if (rim) {
    g.addColorStop(0.8, tip); // light band near the tip …
    g.addColorStop(1, rim);   // … then a slightly darker rim, so petals read as folded
  } else {
    g.addColorStop(1, tip);
  }
  c.fillStyle = g;
  c.fill();
}

/** Thin veins from the petal base toward the tip (gives letters texture inside each petal). */
function veins(rc, L, Wd, r, n = 3) {
  if (rc.mode === 'grid') return; // colour texture only; in the character grid they read as noise
  const c = rc.c;
  c.save();
  c.lineWidth = rc.mode === 'grid' ? rc.cs * 0.35 : 0.8;
  c.strokeStyle = rc.mode === 'grid' ? 'rgba(0,0,0,0.3)' : 'rgba(70,40,25,0.2)';
  c.beginPath();
  for (let k = 0; k < n; k++) {
    const off = (k - (n - 1) / 2) * Wd * 0.22;
    c.moveTo(0, -L * 0.12);
    c.quadraticCurveTo(off * 0.6 + Math.sin(r * 9 + k) * Wd * 0.05, -L * 0.5, off, -L * 0.86);
  }
  c.stroke();
  c.restore();
}

function edge(rc, f, mul = 1) {
  const c = rc.c;
  c.lineWidth = rc.edgeW * mul;
  c.strokeStyle = rc.mode === 'grid' ? `rgba(0,0,0,${rc.edgeA})` : f.pal.edge;
  c.stroke();
}

function bud(rc, f, s, cols) {
  if (s <= 0.2) return;
  const c = rc.c;
  c.beginPath();
  c.arc(0, 0, s, 0, TAU);
  const g = c.createRadialGradient(-s * 0.3, -s * 0.35, s * 0.1, 0, 0, s);
  g.addColorStop(0, cols[1]);
  g.addColorStop(1, cols[0]);
  c.fillStyle = g;
  c.fill();
  c.beginPath();
  c.arc(s * 0.1, s * 0.05, s * 0.55, -0.4, 2.6);
  edge(rc, f);
}

/* Species */

const PANSY = [
  { a: -0.42, len: 1.0, wid: 1.05, k: 'top', st: 0 },
  { a: 0.42, len: 1.0, wid: 1.05, k: 'top', st: 0.04 },
  { a: -1.45, len: 0.85, wid: 0.95, k: 'side', st: 0.12 },
  { a: 1.45, len: 0.85, wid: 0.95, k: 'side', st: 0.16 },
  { a: Math.PI, len: 0.95, wid: 1.25, k: 'bottom', st: 0.24 },
];

const INIT = {
  peony(f, rnd, o) {
    const P = f.pal;
    const nL = o.layers || 3;
    const spec = nL >= 5
      ? [{ n: 10, len: 1.04, wid: 0.84, ruffle: 5 }, { n: 9, len: 0.9, wid: 0.78, ruffle: 5 }, { n: 8, len: 0.72, wid: 0.72, ruffle: 4 }, { n: 7, len: 0.54, wid: 0.7, ruffle: 3 }, { n: 6, len: 0.36, wid: 0.74, ruffle: 2 }]
      : nL >= 4
        ? [{ n: 9, len: 1.0, wid: 0.78, ruffle: 4 }, { n: 8, len: 0.8, wid: 0.72, ruffle: 3 }, { n: 7, len: 0.6, wid: 0.7, ruffle: 3 }, { n: 6, len: 0.4, wid: 0.74, ruffle: 2 }]
        : [{ n: 8, len: 1.0, wid: 0.8, ruffle: 3 }, { n: 7, len: 0.72, wid: 0.74, ruffle: 3 }, { n: 6, len: 0.44, wid: 0.76, ruffle: 2 }];
    // A 5-layer flower uses every palette layer (greyer outer petals, like Ref 3); smaller ones skip it.
    const off = nL >= 5 ? 0 : Math.max(0, P.layers.length - 4);
    f.layers = spec.map((s, i) => {
      const cols = P.layers[Math.min(i + off, P.layers.length - 1)];
      const petals = [];
      for (let k = 0; k < s.n; k++) {
        petals.push({ a: (k * TAU) / s.n + i * 0.37 + (rnd() - 0.5) * 0.16, lj: 0.9 + rnd() * 0.2, wj: 0.88 + rnd() * 0.24, r: rnd() });
      }
      return {
        ...s, petals, start: i * 0.11, span: 0.6, dir: i % 2 ? 1 : -1,
        base: cols[0], tip: cols[1], mid: mixHex(cols[0], cols[1], 0.62), rim: mixHex(cols[1], cols[0], 0.2),
      };
    });
    f.detail = nL >= 4;
    f.stamens = [];
    const ns = nL >= 5 ? 44 : 24;
    for (let k = 0; k < ns; k++) f.stamens.push({ a: rnd() * TAU, d: 0.35 + rnd() * 0.65, col: pick(P.stamen, rnd) });
  },
  rose(f, rnd) {
    const P = f.pal, N = 17;
    f.petals = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      f.petals.push({
        a: i * 2.39996 + rnd() * 0.4, len: 0.28 + 0.74 * t, wid: 0.42 + 0.5 * t, start: t * 0.55,
        base: mixHex(P.inner[0], P.outer[0], t), tip: mixHex(P.inner[1], P.outer[1], t),
      });
    }
  },
  tulip(f, rnd) {
    f.open = 1;
    f.tilt = (rnd() - 0.5) * 0.3;
    f.budScale = 1;
  },
  bud(f, rnd) {
    INIT.tulip(f, rnd);
    f.open = 0.22;
    f.budScale = 0.85;
  },
  hydrangea(f, rnd, o) {
    const P = f.pal, N = o.small ? 13 : 16;
    f.florets = [];
    for (let k = 0; k < N; k++) {
      const rr = 0.74 * Math.sqrt((k + 0.5) / N), a = k * 2.39996 + rnd() * 0.3;
      f.florets.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr * 0.9, s: 0.3 - 0.08 * rr, start: rr * 0.6 + rnd() * 0.12, col: pick(P.florets, rnd), rot: rnd() * TAU });
    }
    f.florets.sort((p, q) => p.y - q.y);
  },
  pansy(f, rnd) {
    f.petals = PANSY.map(p => ({ ...p, j: 0.92 + rnd() * 0.16 }));
  },
  lily(f, rnd) {
    const specks = () => {
      const s = [];
      for (let k = 0; k < 6; k++) s.push({ u: 0.12 + rnd() * 0.4, v: (rnd() - 0.5) * 0.5, s: 0.5 + rnd() * 0.6 });
      return s;
    };
    f.petals = [];
    for (let k = 0; k < 6; k++) f.petals.push({ a: (k * TAU) / 6 + (rnd() - 0.5) * 0.12, len: 1.0, wid: 0.36, layer: 0, j: 0.92 + rnd() * 0.16, specks: specks() });
    for (let k = 0; k < 6; k++) f.petals.push({ a: (k * TAU) / 6 + TAU / 12 + (rnd() - 0.5) * 0.12, len: 0.8, wid: 0.42, layer: 1, j: 0.92 + rnd() * 0.16, specks: specks() });
    f.stamens = [];
    for (let k = 0; k < 6; k++) f.stamens.push({ a: (k * TAU) / 6 + TAU / 12 + (rnd() - 0.5) * 0.3, len: 0.48 + rnd() * 0.14 });
  },
  lilybud() {},
};

function begin(c, f) {
  c.save();
  c.translate(f.x, f.y);
  c.rotate(f.rot);
  c.globalAlpha = f.alpha;
}

const PAINT = {
  peony(rc, f) {
    const c = rc.c, R = f.r, P = f.pal;
    begin(c, f);
    if (f.g < 0.22) {
      bud(rc, f, R * 0.3 * ease.outCubic(f.g / 0.22), P.bud);
      c.restore();
      return;
    }
    const g2 = (f.g - 0.22) / 0.78;
    for (const L of f.layers) {
      const p = clamp((g2 - L.start) / L.span);
      const e = ease.outBack(p, 1.25);
      const len = R * L.len * (0.3 + 0.7 * e), wid = R * L.wid * (0.5 + 0.5 * e);
      const tw = (1 - ease.outCubic(p)) * 0.75 * L.dir;
      for (const pt of L.petals) {
        const pl = len * pt.lj, pw = wid * pt.wj;
        c.save();
        c.rotate(pt.a + tw);
        petalPath(c, pl, pw, L.ruffle, pt.r);
        shade(c, pl, L.base, L.mid, L.tip, L.rim);
        edge(rc, f);
        if (f.detail && p > 0.25) veins(rc, pl, pw, pt.r);
        c.restore();
      }
    }
    const pc = clamp((g2 - 0.3) / 0.5);
    if (pc > 0) {
      const cr = R * (f.detail ? 0.17 : 0.16) * ease.outBack(pc, 1.6);
      c.beginPath();
      c.arc(0, 0, cr * (f.detail ? 0.8 : 1), 0, TAU);
      c.fillStyle = P.center;
      c.fill();
      if (f.detail) {
        // Filaments radiating from the center, each tipped with a gold anther.
        c.lineWidth = rc.mode === 'grid' ? rc.cs * 0.3 : 0.9;
        c.strokeStyle = P.filament || P.stamen[0];
        c.beginPath();
        for (const s of f.stamens) {
          const ca = Math.cos(s.a), sa = Math.sin(s.a);
          c.moveTo(ca * cr * 0.25, sa * cr * 0.25);
          c.lineTo(ca * s.d * cr * 1.45, sa * s.d * cr * 1.45);
        }
        c.stroke();
      }
      const dotR = R * (f.detail ? 0.024 : 0.034) * pc;
      for (const s of f.stamens) {
        const k = f.detail ? 1.45 : 1.25;
        c.beginPath();
        c.arc(Math.cos(s.a) * s.d * cr * k, Math.sin(s.a) * s.d * cr * k, dotR, 0, TAU);
        c.fillStyle = s.col;
        c.fill();
      }
    }
    c.restore();
  },

  rose(rc, f) {
    const c = rc.c, R = f.r, P = f.pal;
    begin(c, f);
    if (f.g < 0.22) {
      bud(rc, f, R * 0.3 * ease.outCubic(f.g / 0.22), P.bud);
      c.restore();
      return;
    }
    const g2 = (f.g - 0.22) / 0.78;
    for (let i = f.petals.length - 1; i >= 0; i--) {
      const pt = f.petals[i];
      const p = clamp((g2 - pt.start) / 0.5);
      if (p <= 0) continue;
      const e = ease.outBack(p, 1.2);
      const len = R * pt.len * (0.35 + 0.65 * e), wid = R * pt.wid * (0.5 + 0.5 * e);
      c.save();
      c.rotate(pt.a + (1 - p) * 0.7);
      roundPetal(c, len, wid);
      shade(c, len, pt.base, null, pt.tip);
      edge(rc, f);
      c.restore();
    }
    c.beginPath();
    c.arc(0, 0, R * 0.07, 0, TAU);
    c.fillStyle = P.center;
    c.fill();
    c.restore();
  },

  tulip(rc, f) {
    const c = rc.c, R = f.r, P = f.pal, sc = f.budScale;
    c.save();
    c.translate(f.x, f.y);
    c.rotate(f.rot + f.tilt);
    c.globalAlpha = f.alpha;
    if (f.g < 0.22) {
      const s = ease.outCubic(f.g / 0.22);
      if (s > 0.05) {
        c.translate(0, R * 0.35 * s);
        petalPath(c, R * 0.7 * s * sc, R * 0.5 * s * sc, 0, 0);
        shade(c, R * 0.7 * s, P.bud[0], null, P.bud[1]);
        edge(rc, f);
      }
      c.restore();
      return;
    }
    const g2 = (f.g - 0.22) / 0.78;
    const e = ease.outBack(clamp(g2 / 0.85), 1.2);
    const h = R * 1.3 * sc * (0.55 + 0.45 * e), w = R * 0.5 * sc * (0.75 + 0.25 * e);
    const lean = (0.06 + 0.34 * e) * f.open;
    c.translate(0, h * 0.5);
    const petal = (rot, L, Wd, cols) => {
      c.save();
      c.rotate(rot);
      petalPath(c, L, Wd, 0, 0);
      shade(c, L, cols[0], null, cols[1]);
      edge(rc, f);
      if (rc.mode === 'color') {
        // soft rim highlight
        c.lineWidth = 0.7;
        c.strokeStyle = 'rgba(255,240,228,0.35)';
        c.stroke();
      }
      veins(rc, L, Wd, 0.3, 1);
      c.restore();
    };
    petal(0, h, w * 2.1, P.back);
    petal(-lean - 0.06, h * 0.96, w * 1.6, P.side);
    petal(lean + 0.06, h * 0.96, w * 1.6, P.side);
    petal(0, h * 0.9, w * 1.4, P.front);
    c.restore();
  },

  hydrangea(rc, f) {
    const c = rc.c, R = f.r, P = f.pal;
    begin(c, f);
    if (f.g < 0.22) {
      bud(rc, f, R * 0.3 * ease.outCubic(f.g / 0.22), P.bud);
      c.restore();
      return;
    }
    const g2 = (f.g - 0.22) / 0.78;
    const m = ease.outCubic(clamp(g2 / 0.5));
    c.beginPath();
    c.arc(0, R * 0.04, R * 0.82 * m, 0, TAU);
    c.fillStyle = P.mass;
    c.fill();
    for (const fl of f.florets) {
      const p = clamp((g2 - fl.start) / 0.42);
      if (p <= 0) continue;
      const e = ease.outBack(p, 1.8);
      const s = R * fl.s * e;
      c.save();
      c.translate(fl.x * R, fl.y * R);
      c.rotate(fl.rot + (1 - p) * 1.2);
      for (let q = 0; q < 4; q++) {
        c.rotate(TAU / 4);
        roundPetal(c, s, s * 1.1);
        shade(c, s, P.base, null, fl.col);
        edge(rc, f, 0.45);
      }
      c.beginPath();
      c.arc(0, 0, s * 0.16, 0, TAU);
      c.fillStyle = P.center;
      c.fill();
      c.restore();
    }
    c.restore();
  },

  pansy(rc, f) {
    const c = rc.c, R = f.r, P = f.pal;
    begin(c, f);
    if (f.g < 0.22) {
      bud(rc, f, R * 0.3 * ease.outCubic(f.g / 0.22), P.bud);
      c.restore();
      return;
    }
    const g2 = (f.g - 0.22) / 0.78;
    for (const p of f.petals) {
      const pp = clamp((g2 - p.st) / 0.6);
      if (pp <= 0) continue;
      const e = ease.outBack(pp, 1.3);
      const len = R * p.len * p.j * (0.3 + 0.7 * e), wid = R * p.wid * (0.5 + 0.5 * e);
      c.save();
      c.rotate(p.a);
      roundPetal(c, len, wid);
      shade(c, len, P[p.k][0], null, P[p.k][1]);
      edge(rc, f);
      c.restore();
    }
    const fc = clamp((g2 - 0.25) / 0.5);
    if (fc > 0) {
      const fr = R * 0.34 * fc;
      const g = c.createRadialGradient(0, 0, 0, 0, 0, fr);
      g.addColorStop(0, rgba(P.face, 0.95));
      g.addColorStop(1, rgba(P.face, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, fr, 0, TAU);
      c.fill();
      if (rc.mode === 'color') {
        c.strokeStyle = rgba(P.face, 0.55);
        c.lineWidth = 0.8;
        for (let k = 0; k < 7; k++) {
          const a = Math.PI / 2 + (k - 3) * 0.3;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(Math.cos(a) * R * 0.48 * fc, Math.sin(a) * R * 0.48 * fc);
          c.stroke();
        }
      }
      c.beginPath();
      c.arc(0, -R * 0.02, R * 0.08 * fc, 0, TAU);
      c.fillStyle = P.eye;
      c.fill();
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        c.arc((k - 1) * R * 0.07, -R * 0.11, R * 0.032 * fc, 0, TAU);
        c.fillStyle = P.stamen;
        c.fill();
      }
    }
    c.restore();
  },
};
PAINT.bud = PAINT.tulip;

PAINT.lily = (rc, f) => {
  const c = rc.c, R = f.r, P = f.pal;
  begin(c, f);
  if (f.g < 0.22) {
    c.translate(0, R * 0.4);
    lilyBudShape(rc, f, R * 1.1 * ease.outCubic(f.g / 0.22), P.bud);
    c.restore();
    return;
  }
  const g2 = (f.g - 0.22) / 0.78;
  for (const pt of f.petals) {
    const p = clamp((g2 - pt.layer * 0.15) / 0.7);
    const e = ease.outBack(p, 1.2);
    const L = R * pt.len * pt.j * (0.3 + 0.7 * e), Wd = R * pt.wid * (0.55 + 0.45 * e);
    c.save();
    c.rotate(pt.a + (1 - p) * 0.5 * (pt.layer ? 1 : -1));
    lancePath(c, L, Wd);
    shade(c, L, P.base, P.mid, P.tip);
    edge(rc, f);
    if (rc.mode === 'color') {
      c.beginPath(); // midrib
      c.moveTo(0, -L * 0.08);
      c.lineTo(0, -L * 0.86);
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(255,240,245,0.55)';
      c.stroke();
    }
    if (p > 0.4 && rc.mode === 'color') {
      c.fillStyle = P.speck;
      for (const s of pt.specks) {
        c.beginPath();
        c.arc(s.v * Wd, -s.u * L, R * 0.022 * s.s, 0, TAU);
        c.fill();
      }
    }
    c.restore();
  }
  c.beginPath();
  c.arc(0, 0, R * 0.08, 0, TAU);
  c.fillStyle = P.throat;
  c.fill();
  const sp = clamp((g2 - 0.4) / 0.5);
  if (sp > 0) {
    c.lineWidth = rc.mode === 'grid' ? rc.cs * 0.3 : 1;
    c.strokeStyle = P.filament;
    c.beginPath();
    for (const s of f.stamens) {
      c.moveTo(0, 0);
      c.lineTo(Math.sin(s.a) * s.len * R * sp, -Math.cos(s.a) * s.len * R * sp);
    }
    c.stroke();
    c.fillStyle = P.anther;
    for (const s of f.stamens) {
      c.beginPath();
      c.ellipse(Math.sin(s.a) * s.len * R * sp, -Math.cos(s.a) * s.len * R * sp, R * 0.045, R * 0.022, s.a, 0, TAU);
      c.fill();
    }
  }
  c.restore();
};

PAINT.lilybud = (rc, f) => {
  const c = rc.c, R = f.r;
  begin(c, f);
  const s = R * 2.1 * (0.3 + 0.7 * ease.outCubic(f.g));
  c.translate(0, s * 0.45);
  lilyBudShape(rc, f, s, f.pal.bud);
  c.restore();
};

/* Public API */

export function makeFlower(type, opts = {}) {
  const pal = PALS[opts.pal] || PALS.cream;
  const f = {
    type, place: opts.place, x: 0, y: 0, r: 10, rot: opts.rot || 0, g: 0, alpha: 1,
    seed: opts.seed ?? Math.floor(Math.random() * 1e6), pal, puff: pal.puff, glow: pal.glow ? { ...pal.glow } : null,
  };
  INIT[type](f, seeded(f.seed * 9301 + 49297), opts);
  return f;
}

export function paintFlower(rc, f) {
  if (f.g <= 0 || f.alpha <= 0.01) return;
  // In the character grid, each opened flower sits on a dark backing so it reads as its own shape
  // (with its own ASCII outline) instead of melting into the paper and its neighbours.
  if (rc.mode === 'grid' && f.type !== 'lilybud' && f.g > 0.3) {
    const c = rc.c;
    c.save();
    c.globalAlpha = 0.88 * clamp((f.g - 0.3) / 0.4) * f.alpha;
    c.fillStyle = '#000';
    c.beginPath();
    if (f.type === 'tulip' || f.type === 'bud') c.ellipse(f.x, f.y, f.r * 0.72, f.r * 0.95, f.rot + (f.tilt || 0), 0, TAU);
    else c.arc(f.x, f.y, f.r * 0.94, 0, TAU);
    c.fill();
    c.restore();
  }
  PAINT[f.type](rc, f);
}

function qb(s, t) {
  const u = 1 - t;
  return {
    x: u * u * s.p0.x + 2 * u * t * s.p1.x + t * t * s.p2.x,
    y: u * u * s.p0.y + 2 * u * t * s.p1.y + t * t * s.p2.y,
  };
}
function qbTan(s, t) {
  return {
    x: 2 * (1 - t) * (s.p1.x - s.p0.x) + 2 * t * (s.p2.x - s.p1.x),
    y: 2 * (1 - t) * (s.p1.y - s.p0.y) + 2 * t * (s.p2.y - s.p1.y),
  };
}

/** A stem is a quadratic curve; calc(s) sets p0/p1/p2 (and s.unit) from the current layout. */
export function makeStem(calc, { w = 1, leaves = [], color = '#7E9A6A' } = {}) {
  const s = { calc, w, leaves, color, prog: 0, alpha: 1, unit: 100, p0: null, p1: null, p2: null };
  calc(s);
  return s;
}

export function paintStem(rc, s) {
  if (s.prog <= 0.001 || s.alpha <= 0.01) return;
  const { c, mode, cs } = rc;
  const N = 28, n = Math.max(1, Math.ceil(N * s.prog));
  c.save();
  c.globalAlpha = s.alpha;
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = qb(s, Math.min(s.prog, i / N));
    if (i === 0) c.moveTo(p.x, p.y);
    else c.lineTo(p.x, p.y);
  }
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.lineWidth = cs * s.w * (mode === 'grid' ? 1.0 : 1.5);
  c.strokeStyle = s.color;
  c.stroke();
  for (const l of s.leaves) {
    if (s.prog < l.t) continue;
    const grow = clamp((s.prog - l.t) / 0.25);
    const p = qb(s, l.t), tg = qbTan(s, l.t);
    paintLeaf(rc, p.x, p.y, Math.atan2(tg.y, tg.x) + l.side * 0.9, l.len * s.unit * ease.outBack(grow, 1.4));
  }
  c.restore();
}

/** A leaf pointing along `ang` (radians, screen space), with a midrib. */
export function paintLeaf(rc, x, y, ang, len) {
  if (len < 1) return;
  const c = rc.c;
  c.save();
  c.translate(x, y);
  c.rotate(ang + Math.PI / 2);
  leafPath(c, len, len * 0.36);
  const g = c.createLinearGradient(0, 0, 0, -len);
  g.addColorStop(0, '#4F6B45');
  g.addColorStop(1, '#9DB884');
  c.fillStyle = g;
  c.fill();
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, -len * 0.85);
  c.lineWidth = rc.mode === 'grid' ? rc.cs * 0.3 : 0.7;
  c.strokeStyle = rc.mode === 'grid' ? 'rgba(0,0,0,0.35)' : 'rgba(40,60,32,0.5)';
  c.stroke();
  c.restore();
}

export function paintBubble(rc, b) {
  if (b.s <= 0.01 || b.a <= 0.01) return;
  const { c, cs, mode } = rc;
  const f = b.f, r = f.r * 0.62 * b.s, tip = f.pal.bubble;
  c.save();
  c.globalAlpha = b.a;
  c.beginPath();
  c.arc(f.x, f.y, r, 0, TAU);
  c.fillStyle = rgba(tip, 0.2);
  c.fill();
  c.lineWidth = cs * (mode === 'grid' ? 0.9 : 1.3);
  c.strokeStyle = tip;
  c.stroke();
  c.restore();
}
