// Pixel-art sprites (Ref 2 vibe), built from tiny character maps at 1px per cell.
// Drawn scaled up with image smoothing off so they stay crisp.

const BASE = {
  k: '#2A121C', // outline
  R: '#C2405E', // box raspberry
  r: '#8E2A45', // box shade
  H: '#E06A86', // box highlight
  Y: '#E8B23A', // ribbon gold
  y: '#B4822A', // ribbon shade
  W: '#F7E7B8', // ribbon highlight
  d: '#1A0A12', // inside of box
};

const BOW = [
  '.kkk....kkk.',
  'kYYYk..kYYYk',
  'kYyyYkkYyyYk',
  'kYYyYYYYyYYk',
  '.kkkkYYkkkk.',
];
const LID = [
  'kkkkkkkkWYkkkkkkkk',
  'kHHHHHHHWYHHHHHHHk',
  'kRRRRRRRWYRRRRRRRk',
  'krrrrrrrWyrrrrrrrk',
  'kkkkkkkkkkkkkkkkkk',
];
const BODY = [
  'kddddddWYddddddk',
  'kHHRRRRWYRRRRRRk',
  'kHRRRRRWYRRRRRrk',
  'kHRRRRRWYRRRRRrk',
  'kWWWWWWWYWWWWWWk',
  'kYYYYYYYyYYYYYYk',
  'kRRRRRRWYRRRRRrk',
  'kRRRRRRWYRRRRRrk',
  'krRRRRRWYRRRRrrk',
  'krrrrrrWyrrrrrrk',
  'kkkkkkkkkkkkkkkk',
];
const HEART = [
  '.HH.HH.',
  'HwHHHHH',
  'HHHHHHH',
  '.HHHHH.',
  '..HHH..',
  '...H...',
];
const FLOWER_A = [
  '.pp.pp.',
  'ppp.ppp',
  'ppscspp',
  '..ccc..',
  'ppscspp',
  'ppp.ppp',
  '.pp.pp.',
];
const FLOWER_B = [
  '.ppp.',
  'ppspp',
  'pscsp',
  'ppspp',
  '.ppp.',
];
const BUD = [
  '.p.',
  'pcp',
  '.p.',
];
const PETAL = [
  'pp.',
  '.ps',
];
const LEAF = [
  '..gl',
  '.ggg',
  'gG..',
];

// Palette taken from Ref 1 (the painterly bouquet).
export const BLOOMS = {
  coral: { p: '#EE8A78', s: '#C9604F', c: '#F2C14E' },
  blush: { p: '#F5C9C0', s: '#D9968E', c: '#E8B23A' },
  cream: { p: '#F4EEE3', s: '#CFC2AE', c: '#E8B23A' },
  blue: { p: '#9CC4D6', s: '#6C97AA', c: '#F4EEE3' },
  raspberry: { p: '#D2577A', s: '#8E2A45', c: '#F2C14E' },
  teal: { p: '#4F9DB3', s: '#2E6F82', c: '#EBA23A' },
  marigold: { p: '#EBA23A', s: '#B97818', c: '#C2405E' },
};
export const BLOOM_KEYS = Object.keys(BLOOMS);

// The pressed-Yes rose family, so the hearts and the button belong together.
const HEART_COLORS = [
  { H: '#E06C91', w: '#FFE3EA' },
  { H: '#E06C91', w: '#FFE3EA' },
  { H: '#C2405E', w: '#F5C9C0' },
  { H: '#F5C9C0', w: '#FFF6F1' },
  { H: '#EE8A78', w: '#FBE1D8' },
];

export const SPR = {};

export function makeSprite(rows, colors) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const ch = rows[j][i];
      if (ch === '.' || ch === ' ' || !colors[ch]) continue;
      x.fillStyle = colors[ch];
      x.fillRect(i, j, 1, 1);
    }
  }
  return c;
}

function compose(w, h, parts) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  for (const [spr, px, py] of parts) x.drawImage(spr, px, py);
  return c;
}

export function init() {
  const bow = makeSprite(BOW, BASE);
  const lid = makeSprite(LID, BASE);
  SPR.body = makeSprite(BODY, BASE);
  SPR.lidbow = compose(18, 10, [[bow, 3, 0], [lid, 0, 5]]);
  SPR.gift = compose(18, 20, [[SPR.body, 1, 9], [SPR.lidbow, 0, 0]]);
  SPR.hearts = HEART_COLORS.map(c => makeSprite(HEART, c));
  SPR.flowerA = {};
  SPR.flowerB = {};
  SPR.bud = {};
  SPR.petal = {};
  for (const k of BLOOM_KEYS) {
    SPR.flowerA[k] = makeSprite(FLOWER_A, BLOOMS[k]);
    SPR.flowerB[k] = makeSprite(FLOWER_B, BLOOMS[k]);
    SPR.bud[k] = makeSprite(BUD, BLOOMS[k]);
    SPR.petal[k] = makeSprite(PETAL, BLOOMS[k]);
  }
  SPR.leaf = [
    makeSprite(LEAF, { g: '#7E9A6A', G: '#4F6B45', l: '#A9C08F' }),
    makeSprite(LEAF, { g: '#6E8C5E', G: '#3F5838', l: '#9DB884' }),
  ];
}

/** Paint a sprite into a DOM canvas (CSS scales it up with image-rendering: pixelated). */
export function paintInto(canvas, sprite) {
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const x = canvas.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(sprite, 0, 0);
}
