/**
 * London — a cobbled crescent behind the dais lined with a brick terrace of shops: a corner pub
 * (The Good Egg, with its hanging sign), a café under a striped awning, a cake shop, a bargain
 * corner shop with fruit crates and the evening paper's board, and a chippy, a sash window or six
 * above each. A red double-decker and a black cab (now and then they drive off round the crescent
 * and come back), Victorian lamps, a phone kiosk, a pillar box, railings, a bench, bunting and
 * London plane trees.
 *
 * Behind it a second floating block of taller buildings — a mansion block, a warehouse with a
 * faded painted sign, a brick block with a billboard of the phrases the player is learning and a
 * stone department store — with a lane between them that frames the Gothic clock tower in the
 * distance. Further out: an observation wheel, a twin-towered bascule bridge, a domed cathedral,
 * chimney-pot rooftops and a skyline of far-off blocks. All shapes are generic.
 *
 * Signs (src/world/signs.js) carry the player's phrasebook: shop names, the café's chalkboard,
 * the pub's food board, window posters, the paper's headline, a street-name plate and the
 * billboards. Low quality keeps the terrace and its signs but leaves out the back block, the far
 * skyline and the traffic.
 */
import * as THREE from 'three';
import { mulberry32 } from '../../core/utils.js';
import { Diorama, SHAPE, rbox, groundY, islandR, ribbon, pathX, addLand, tools } from './kit.js';
import { KIND } from '../seasons/shader.js';
import { SignSet, POSTER } from '../signs.js';
import { cityMaterials } from './city/materials.js';
import { cityParts, WINDOW } from './city/parts.js';
import { Traffic } from './city/traffic.js';

const M = 'matte';
const S = 'satin';
const L = 'glow';

const C = {
  iron: 0x262b36,
  gold: 0xe7b84a,
  red: 0xe0262f,
  redDark: 0xa81c25,
  white: 0xfaf5ea,
  cream: 0xf3e3c3,
  glass: 0x8ea9c4,
  glassDark: 0x3c4b63,
  slate: 0x5a6378,
  pot: 0xd8784a,
  brick: 0xb8573f,
  stock: 0xc9a77a,
  stone: 0xe8d6a6,
  stoneDark: 0xcbb27c,
  portland: 0xe9e3d3,
  kerb: 0xd9d3c7,
  grout: 0x6c6862,
  paving: 0xcdc7bb,
  tyre: 0x24252b,
  chrome: 0xc4cad3,
  bark: 0xcfc6a2,
  barkDark: 0x8d8a5c,
  leaf: [0x74c25a, 0x5aae4e, 0x93d36a, 0x63b955],
  water: 0x4f93bf,
  lead: 0x8f9cad,
  blue: 0x6aa6d8,
  spire: 0x41606d,
};
const WARM = 0xffc46b;

/** Centre line of the cobbled crescent behind the dais, and its half width. */
const streetZ = (x) => -2.86 + 0.074 * x * x;
const HALF = 0.58;
/** The terrace: house centres along the crescent, scale, and the module's size (local units). */
const TERRACE = { s: 0.74, W: 1.82, D: 1.3, back: 0.12 };
const houseAt = (x) => {
  const z = streetZ(x) - HALF - 0.95 - TERRACE.back;
  return { x, z, ry: -Math.atan(0.148 * x) * 1.35 };
};
/** Where the bus and the cab park (x along the crescent). */
const BUS_X = 3.25;
const CAB_X = -3.05;

// ── vehicles (drawn into any Batch, at the origin facing +x) ──────────────
function wheel(t, x, z, d = 0.42, w = 0.17) {
  t.b.add(M, SHAPE.cyl, x, d / 2, z, d, w, d, Math.PI / 2, 0, 0, C.tyre);
  t.b.add(S, SHAPE.cyl8, x, d / 2, z + Math.sign(z) * (w / 2 + 0.005), d * 0.5, 0.02, d * 0.5, Math.PI / 2, 0, 0, C.chrome);
}

function cab(t) {
  const { part, block, slab, b } = t;
  for (const x of [-0.62, 0.66]) for (const z of [-0.43, 0.43]) wheel(t, x, z);
  block(0, 0.16, 0, 1.95, 0.5, 0.96, 0x1d1f26, S, 0.16);
  block(-0.12, 0.6, 0, 1.36, 0.56, 0.9, 0x1d1f26, S, 0.14);
  for (const z of [-1, 1]) {
    block(0.2, 0.74, z * 0.452, 0.42, 0.3, 0.02, C.glassDark, S, 0.01);
    block(-0.34, 0.74, z * 0.452, 0.48, 0.3, 0.02, C.glassDark, S, 0.01);
  }
  part(S, rbox(0.03, 0.34, 0.74, 0.01), 0.56, 0.9, 0, 1, 1, 1, C.glassDark, 0, 0, -0.25);
  block(-0.79, 0.74, 0, 0.02, 0.28, 0.66, C.glassDark, S, 0.01);
  slab(0.97, 0.3, 0, 0.04, 0.26, 0.4, C.chrome, S);
  slab(0.98, 0.15, 0, 0.06, 0.07, 0.94, C.chrome, S);
  slab(-0.98, 0.15, 0, 0.06, 0.07, 0.94, C.chrome, S);
  for (const z of [-0.32, 0.32]) {
    b.lit(0xfff4dc, 0.35, () => part(L, SHAPE.cyl, 0.97, 0.44, z, 0.16, 0.05, 0.16, 0xf4f1e6, 0, 0, Math.PI / 2));
    b.lit(0xff3b30, 0.35, () => slab(-0.98, 0.4, z, 0.03, 0.1, 0.12, 0xb3202a, L));
  }
  b.lit(0xffb52e, -1, () => block(0.02, 1.15, 0, 0.36, 0.12, 0.16, 0xffc23d, L, 0.03));
}

/** The double-decker; `ad(x, y, z, w, h, ry)` places the advert panels on its sides. */
function bus(t, ad) {
  const { part, block, slab, b } = t;
  const len = 3.9;
  for (const x of [-1.15, 1.25]) for (const z of [-0.54, 0.54]) wheel(t, x, z, 0.56, 0.2);
  block(0, 0.2, 0, len - 0.08, 0.32, 1.16, 0x2a2b31, M, 0.08);
  block(0, 0.3, 0, len, 2.06, 1.22, C.red, S, 0.2);
  block(0, 1.38, 0, len + 0.02, 0.1, 1.24, C.cream, S, 0.03);
  for (const z of [-1, 1]) {
    b.lit(0xffd590, 0.25, () => {
      block(-0.25, 0.86, z * 0.612, 2.9, 0.42, 0.02, 0x41536b, L, 0.01);
      block(0.02, 1.62, z * 0.612, 3.5, 0.44, 0.02, 0x41536b, L, 0.01);
    });
    for (let i = 0; i < 6; i++) slab(-1.6 + i * 0.6, 0.86, z * 0.622, 0.06, 0.42, 0.02, C.red, S);
    for (let i = 0; i < 7; i++) slab(-1.73 + i * 0.585, 1.62, z * 0.622, 0.06, 0.44, 0.02, C.red, S);
    slab(1.62, 0.5, z * 0.616, 0.36, 0.78, 0.02, 0x41536b, S);
  }
  b.lit(0xffd590, 0.25, () => {
    block(len / 2 + 0.005, 0.86, 0, 0.02, 0.44, 0.96, 0x41536b, L, 0.01);
    block(len / 2 + 0.005, 1.62, 0, 0.02, 0.44, 0.96, 0x41536b, L, 0.01);
  });
  b.lit(0xfff3c4, 0.15, () => slab(len / 2 + 0.01, 1.42, 0, 0.02, 0.16, 0.7, 0xf6f0d8, L));
  for (const z of [-0.42, 0.42]) b.lit(0xfff4dc, 0.35, () => part(L, SHAPE.cyl, len / 2 + 0.01, 0.48, z, 0.16, 0.04, 0.16, 0xf4f1e6, 0, 0, Math.PI / 2));
  slab(len / 2 + 0.02, 0.22, 0, 0.06, 0.08, 1.18, 0x2a2b31);
  // the advert panels between the decks (a frame on each side; the posters are signs)
  for (const z of [-1, 1]) slab(-0.35, 1.3, z * 0.626, 2.14, 0.3, 0.012, 0x2a2b31);
  if (ad) for (const z of [-1, 1]) ad(-0.35, 1.45, z * 0.634, 2.08, 0.27, z > 0 ? 0 : Math.PI);
}

export class London extends Diorama {
  constructor(island, quality) {
    super(island, quality);
    this.rng = mulberry32(1851);
    this.rng2 = mulberry32(18510);
    this.leafT = 0.5;
    this.trees = [];
    Object.assign(this.mats, cityMaterials(this));
    this.signs = new SignSet(this, 'london');
    this.traffic = this.low ? null : new Traffic(this);
    this.build();
    this.finish();
  }

  finish() {
    super.finish();
    // window glass catches the light but casts no shadow of its own
    for (const o of this.group.children) if (o.name === 'glowGlass') o.castShadow = false;
    this.signs.finish();
  }

  update(t, dt = 0) {
    super.update(t);
    this.signs.update(t, dt);
    this.traffic?.update(t, dt);
  }

  build() {
    const b = this.b;
    const rng = this.rng;
    const { part, block, slab, post, ball } = tools(b);
    const lit = () => 0.12 + rng() * 0.95;
    const P = cityParts(this, b, this.rng2);
    const k = P.k;
    const signs = this.signs;

    // ── Victorian street lamp ───────────────────────────────────────────────
    const lamp = () => {
      post(0, 0, 0, 0.3, 0.16, C.iron, S);
      post(0, 0.16, 0, 0.2, 0.22, C.iron, S);
      post(0, 0.3, 0, 0.1, 1.8, C.iron, S);
      post(0, 0.38, 0, 0.16, 0.06, C.gold, S);
      post(0, 1.62, 0, 0.13, 0.05, C.gold, S);
      slab(0, 1.96, 0, 0.56, 0.035, 0.04, C.iron, S);
      ball(-0.28, 1.98, 0, 0.06, C.iron, S);
      ball(0.28, 1.98, 0, 0.06, C.iron, S);
      post(0, 2.06, 0, 0.16, 0.08, C.iron, S);
      slab(0, 2.13, 0, 0.3, 0.05, 0.3, C.iron, S);
      b.lit(WARM, -1, () => b.add(L, SHAPE.lantern, 0, 2.36, 0, 0.26, 0.42, 0.26, 0, 0, 0, 0x5a4630));
      for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) part(S, SHAPE.box, cx * 0.145, 2.37, cz * 0.145, 0.03, 0.44, 0.03, C.iron, -cz * 0.1, 0, cx * 0.1);
      b.add(S, SHAPE.cone4, 0, 2.69, 0, 0.44, 0.24, 0.44, 0, 0, 0, C.iron);
      ball(0, 2.84, 0, 0.08, C.gold, S);
      this.halo(0, 2.38, 0, 2.6);
    };

    // ── red telephone kiosk (generic) ───────────────────────────────────────
    const phoneBox = () => {
      block(0, 0, 0, 1.0, 0.12, 1.0, C.redDark, S, 0.03);
      block(0, 0.12, 0, 0.88, 1.92, 0.88, C.red, S, 0.06);
      for (const ry of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
        b.at(Math.sin(ry) * 0.44, 0, Math.cos(ry) * 0.44, ry, 1, () => {
          b.lit(0xffe9b8, 0.55, () => slab(0, 0.42, 0.005, 0.58, 1.22, 0.02, 0xcfe0ea, L));
          for (let i = 1; i < 3; i++) slab(-0.29 + i * 0.193, 0.42, 0.02, 0.035, 1.22, 0.02, C.red, S);
          for (let i = 1; i < 6; i++) slab(0, 0.42 + i * 0.203, 0.02, 0.58, 0.035, 0.02, C.red, S);
          b.lit(0xfff3d6, 0.3, () => slab(0, 1.73, 0.01, 0.56, 0.15, 0.02, C.white, L));
          signs.add(0, 1.805, 0.022, 0.52, 0.12, { style: 'plate', text: 'TELEPHONE', bg: '#fbf7ee', ink: '#1a1a1a' }, { glow: 0xfff3d6, lit: 0.3 });
        });
      }
      slab(0.31, 1.0, 0.455, 0.05, 0.16, 0.03, C.iron, S);
      block(0, 2.04, 0, 1.02, 0.12, 1.02, C.red, S, 0.04);
      b.add(S, SHAPE.dome, 0, 2.15, 0, 0.98, 0.34, 0.98, 0, 0, 0, C.red);
      ball(0, 2.34, 0, 0.12, C.red, S);
      this.halo(0, 1.2, 0, 1.6, 0xfff0c0);
    };

    // ── pillar box ──────────────────────────────────────────────────────────
    const pillarBox = () => {
      post(0, 0, 0, 0.56, 0.1, C.iron, S, SHAPE.cyl);
      post(0, 0.1, 0, 0.48, 0.92, C.red, S, SHAPE.cyl);
      post(0, 0.98, 0, 0.56, 0.08, C.red, S, SHAPE.cyl);
      b.add(S, SHAPE.dome, 0, 1.05, 0, 0.54, 0.34, 0.54, 0, 0, 0, C.red);
      slab(0, 0.8, 0.235, 0.24, 0.04, 0.04, C.iron, S);
      slab(0, 0.55, 0.235, 0.16, 0.12, 0.02, C.white, M);
      slab(0, 0.3, 0.238, 0.08, 0.06, 0.02, C.gold, S);
    };

    // ── London plane tree ───────────────────────────────────────────────────
    const planeTree = (seed) => {
      const r = mulberry32(seed);
      post(0, 0, 0, 0.36, 2.3, C.bark);
      for (let i = 0; i < 9; i++) {
        const a = r() * Math.PI * 2;
        part(M, SHAPE.ball, Math.cos(a) * 0.14, 0.25 + r() * 1.9, Math.sin(a) * 0.14, 0.16, 0.26, 0.16, i % 2 ? C.barkDark : 0xa79e72, 0, a, 0);
      }
      part(M, SHAPE.cyl8, -0.34, 2.4, 0.05, 0.16, 1.0, 0.16, C.bark, 0, 0, 0.75);
      part(M, SHAPE.cyl8, 0.32, 2.5, -0.05, 0.15, 1.0, 0.15, C.bark, 0.2, 0, -0.65);
      const blobs = [[0, 3.1, 0, 1.55], [-0.95, 2.8, 0.2, 1.15], [0.95, 2.85, -0.1, 1.2], [0.3, 3.7, -0.15, 1.1], [-0.45, 3.55, 0.35, 1.0], [0.2, 2.6, 0.65, 1.0], [-0.2, 2.7, -0.7, 1.05]];
      b.kind(KIND.FOLIAGE, () => blobs.forEach(([x, y, z, d], i) => part(M, SHAPE.sphere, x, y, z, d, d * 0.84, d, C.leaf[i % 4])));
      for (const [x, y, z] of [[0.75, 2.25, 0.45], [-0.55, 2.2, 0.5], [0.1, 2.1, 0.75]]) {
        slab(x, y - 0.02, z, 0.012, 0.2, 0.012, 0x6b5a3a);
        ball(x, y - 0.03, z, 0.1, 0x8a6a40);
      }
    };

    // ── bench, railings, bunting ────────────────────────────────────────────
    const bench = () => {
      for (const x of [-0.62, 0.62]) {
        slab(x, 0, 0, 0.07, 0.42, 0.5, C.iron, S);
        slab(x, 0.4, -0.22, 0.07, 0.48, 0.07, C.iron, S);
      }
      for (let i = 0; i < 3; i++) slab(0, 0.42, -0.14 + i * 0.15, 1.42, 0.05, 0.12, 0xb07444);
      for (let i = 0; i < 3; i++) part(M, SHAPE.box, 0, 0.6 + i * 0.13, -0.25, 1.42, 0.09, 0.04, 0xb07444, -0.15, 0, 0);
    };
    const railings = (len) => {
      const n = Math.round(len / 0.15);
      slab(0, 0.12, 0, len, 0.04, 0.04, C.iron, S);
      slab(0, 0.6, 0, len, 0.04, 0.04, C.iron, S);
      for (let i = 0; i <= n; i++) {
        const x = -len / 2 + (i * len) / n;
        slab(x, 0, 0, 0.03, 0.72, 0.03, C.iron, S);
        part(S, SHAPE.cone4, x, 0.76, 0, 0.06, 0.1, 0.06, C.gold);
      }
    };
    /** a string of pennants between two points (local), sagging in the middle */
    const bunting = (x0, y0, z0, x1, y1, z1, n, sag = 0.35) => {
      const cols = [C.red, C.white, 0x2f5fb3];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      const ry = -Math.atan2(dz, dx);
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = x0 + dx * u;
        const z = z0 + dz * u;
        const y = y0 + (y1 - y0) * u - sag * 4 * u * (1 - u);
        if (i < n) {
          const u2 = (i + 1) / n;
          const y2 = y0 + (y1 - y0) * u2 - sag * 4 * u2 * (1 - u2);
          part(M, SHAPE.cyl6, x + (dx / n) * 0.5, (y + y2) / 2, z + (dz / n) * 0.5, 0.014, Math.hypot(len / n, y2 - y), 0.014, 0xf2f2f2, 0, ry, Math.atan2(y2 - y, len / n) - Math.PI / 2);
        }
        if (i > 0 && i < n) b.at(x, y, z, ry, 1, () => b.wave({ dir: [0, 0, 1], along: [0, -1, 0], len: 0.4, freq: 2.4 + (i % 3) * 0.4, phase: i * 0.9 }, () => part(M, SHAPE.pennant, 0, 0, 0, 0.3, 0.4, 1, cols[i % 3])));
      }
    };

    // ── the island ───────────────────────────────────────────────────────────
    const near = (x, z) => Math.min(0.62, Math.hypot(x, z) / 9);
    const at = (x, z) => groundY(x, z);

    // the cobbled crescent, its kerbs and the pavement behind it
    const path = pathX(streetZ, -6.4, 7.0, 0.2);
    b.pin(0, at(0, -2.86), -2.86, 0.0, () => b.kind(KIND.PAVED, () => {
      part(M, ribbon(path, -HALF, HALF, 0.0, 0.1), 0, 0, 0, 1, 1, 1, C.grout);
      part(M, ribbon(path, HALF, HALF + 0.14, 0.05, 0.12), 0, 0, 0, 1, 1, 1, C.kerb);
      part(M, ribbon(path, -HALF - 0.14, -HALF, 0.05, 0.12), 0, 0, 0, 1, 1, 1, C.kerb);
      part(k.paving, ribbon(path, -HALF - 1.7, -HALF - 0.14, 0.025, 0.1), 0, 0, 0, 1, 1, 1, C.paving);
      const cob = [0x8f8a84, 0x9e978d, 0x7f7c7b, 0xa8a095, 0x8b8379];
      for (const d of [-0.42, -0.14, 0.14, 0.42]) {
        for (let x = -6.4 + d * 0.5; x < 7; ) {
          const dz = 0.148 * x;
          const l = Math.hypot(1, dz);
          const px = x - (dz / l) * d;
          const pz = streetZ(x) + d / l;
          if (islandR(px, pz) < 0.95) part(M, SHAPE.box, px, at(px, pz) + 0.02, pz, 0.25, 0.07, 0.22, cob[(rng() * cob.length) | 0], 0, -Math.atan(dz) + (rng() - 0.5) * 0.12, 0);
          x += 0.29 / l;
        }
      }
    }));

    // ── the terrace of shops along the back of the crescent ──────────────────
    const { W, D } = TERRACE;
    const fz = D / 2;
    /** the upper storeys of a terrace house: wall, string course, sashes, cornice, parapet, roof, chimney */
    const upper = (o) => {
      const wallKey = o.render ? k.render : k.brick;
      block(0, 0, 0, W, 2.78, D, o.wall, wallKey, 0.02);
      slab(0, 1.18, fz - 0.005, W + 0.01, 0.06, 0.05, o.trim ?? 0xebe4d4);
      const cur = [0x9b3b3b, 0x2f5a7a, 0xd9c08a, 0x5a7a4a, null, 0x7a4a6a];
      const rows = [[1.42, 0.56], [2.12, 0.44]];
      rows.forEach(([y, h], r) => {
        for (const x of [-0.56, 0, 0.56]) {
          if (o.plate && r === 0 && x < 0) continue;
          const c = cur[(this.rng2() * cur.length) | 0];
          P.sash(x, y, fz, 0.34, h, { curtain: c, both: r === 0, bars: r === 0 ? [2, 2] : [2, 1], lintel: o.render ? 'flat' : 'arch', lintelCol: o.render ? 0xf3ede0 : 0xc2604a });
        }
      });
      if (o.balcony) {
        slab(0, 1.36, fz + 0.06, W - 0.2, 0.035, 0.14, C.iron, S);
        for (let i = 0; i < 12; i++) slab(-W / 2 + 0.16 + i * ((W - 0.32) / 11), 1.36, fz + 0.12, 0.018, 0.22, 0.018, C.iron, S);
        slab(0, 1.58, fz + 0.12, W - 0.2, 0.025, 0.025, C.iron, S);
      }
      // cornice and parapet, the slate roof behind, a chimney stack on the party wall
      slab(0, 2.66, fz + 0.01, W + 0.04, 0.1, 0.09, o.trim ?? 0xebe4d4);
      block(0, 2.76, 0.0, W, 0.16, D, o.wall, wallKey, 0.015);
      P.roofSlope(0, 2.78, -0.1, W - 0.04, 0.5, D - 0.3);
      P.chimney(o.chimney * (W / 2 - 0.08), 2.8, -0.12, 0.34, 0.5, 0.5, 3, o.render ? 0xb8573f : o.wall);
    };
    /** the fascia sign over a shopfront */
    const fascia = (f, spec, inset = 0.16) => signs.add(0, f.y + f.h / 2, f.z, W - inset * 2, f.h * 0.92, { style: 'fascia', ...spec });

    const pub = () => {
      upper({ wall: 0xa9583f, chimney: -1 });
      // glazed-tile ground floor, gilt fascia, lanterns and a hanging sign
      const f = P.shopfront(0, 0, fz, W, { color: 0x1f4a3a, door: 'mid', h: 1.14, fascia: 0.24, glow: 0xffc27a, lit: 0.12 });
      fascia(f, { id: 'a-good-egg', text: 'The Good Egg', bg: '#173d2f', gilt: true });
      for (const s of [-1, 1]) {
        slab(s * (W / 2 - 0.2), 1.0, fz + 0.06, 0.04, 0.12, 0.08, C.iron, S);
        b.lit(WARM, -1, () => part(L, SHAPE.lantern, s * (W / 2 - 0.2), 0.98, fz + 0.16, 0.1, 0.16, 0.1, 0x5a4630));
        this.halo(s * (W / 2 - 0.2), 0.98, fz + 0.16, 1.1);
        // hanging baskets: an iron arm, a dark basket brimming with trailing flowers
        const bx = s * (W / 2 - 0.42);
        part(S, SHAPE.box, bx, 1.62, fz + 0.1, 0.015, 0.015, 0.2, C.iron);
        slab(bx, 1.5, fz + 0.2, 0.008, 0.12, 0.008, C.iron, S);
        ball(bx, 1.43, fz + 0.2, 0.2, 0x2e2a26, S, 0.55);
        b.kind(KIND.FOLIAGE, () => ball(bx, 1.47, fz + 0.2, 0.21, 0x4f9a48, M, 0.6));
        for (let i = 0; i < 9; i++) {
          const a = i * 0.7 + s;
          ball(bx + Math.cos(a) * 0.1, 1.43 + (i % 3) * 0.03 - (i % 4 === 0 ? 0.06 : 0), fz + 0.2 + Math.sin(a) * 0.1, 0.045, [0xff5a6e, 0xffffff, 0xb05aff, 0xffd23f, 0xff8ab0][i % 5]);
        }
      }
      // the hanging sign on its bracket, turned a little towards the square so its picture shows
      const h = P.bracket(-W / 2 + 0.16, 1.62, fz, 0.46);
      const egg = (g, x, y, r) => {
        g.fillStyle = '#f7f1df';
        g.beginPath();
        g.ellipse(x, y + r * 0.05, r * 0.62, r * 0.82, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#f2b63a';
        g.beginPath();
        g.arc(x, y + r * 0.18, r * 0.34, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#d9ad4a';
        g.lineWidth = r * 0.06;
        g.beginPath();
        g.ellipse(x, y + r * 0.05, r * 0.7, r * 0.9, 0, 0, Math.PI * 2);
        g.stroke();
      };
      b.at(h.x, h.y, h.z, 0.75, 1, () => {
        slab(0, -0.03, 0, 0.02, 0.03, 0.02, C.iron, S);
        slab(0, -0.52, 0, 0.42, 0.5, 0.035, 0x2a2420);
        signs.add(0, -0.27, 0.019, 0.39, 0.47, { style: 'hanging', id: 'a-good-egg', text: 'The Good Egg', bg: '#173d2f', emblem: egg }, { back: 0.038 });
      });
    };

    const cafe = () => {
      // the street-name plate takes the place of a first-floor window
      upper({ wall: C.stock, chimney: 1, plate: true });
      const f = P.shopfront(0, 0, fz, W, { color: 0xf1e6d0, door: 'right', h: 1.14, fascia: 0.22, glow: 0xffd59a, lit: 0.1 });
      fascia(f, { id: 'tuck-in', text: 'Tuck In', bg: '#7a1f2b', ink: '#fff4dc', font: 'display', upper: false });
      const a = P.awning(-W / 2 + 0.1, W / 2 - 0.1, f.y - 0.04, fz + 0.04, 0.22, [0xb3243a, 0xf6efe0]);
      signs.add(0, a.y, a.z, W - 0.32, 0.09, { style: 'awning', id: 'a-brew-and-a-natter', text: 'a brew and a natter', bg: '#b3243a' });
      slab(-0.5, 1.555, fz + 0.004, 0.74, 0.25, 0.016, 0x151515);
      signs.add(-0.5, 1.68, fz + 0.016, 0.72, 0.23, { style: 'street', id: 'mind-the-gap', text: 'Mind the Gap Road', district: 'SE1' });
    };

    const bakery = () => {
      upper({ wall: 0xf3d3d6, render: true, chimney: -1, balcony: true, trim: 0xfdf8f2 });
      const f = P.shopfront(0, 0, fz, W, { color: 0x9fd6c4, door: 'left', h: 1.14, fascia: 0.24, glow: 0xffe1b0, lit: 0.1 });
      fascia(f, { id: 'the-icing-on-the-cake', text: 'The Icing on the Cake', bg: '#f7c6d4', ink: '#5a2a44', font: 'display', upper: false, trim: 'rgba(255,255,255,0.9)' });
      // cakes in the window
      for (const [x, c] of [[0.0, 0xfff1e6], [0.32, 0xf7b6c8], [0.62, 0xc8e8ff]]) {
        post(x, 0.25, fz + 0.04, 0.16, 0.08, 0xffffff, S);
        post(x, 0.33, fz + 0.04, 0.2, 0.12, c);
        post(x, 0.45, fz + 0.04, 0.13, 0.09, c);
        ball(x, 0.56, fz + 0.04, 0.05, 0xe2483a);
      }
      // a poster in the window
      signs.add(0.48, 0.74, fz + 0.03, 0.34, 0.24, { style: 'poster', id: 'sell-like-hot-cakes', text: 'sell like hot cakes', scheme: POSTER[5] });
    };

    const bargain = () => {
      upper({ wall: 0xb5634a, chimney: 1 });
      const f = P.shopfront(0, 0, fz, W, { color: 0xc8202d, door: 'left', h: 1.14, fascia: 0.24, glow: 0xfff0d0, lit: 0.08 });
      fascia(f, { id: 'bag-a-bargain', text: 'Bag a Bargain', bg: '#ffd23f', ink: '#c8202d', trim: 'rgba(200,32,45,0.9)' });
      // posters in the window, fruit crates out front
      signs.add(0.2, 0.76, fz + 0.03, 0.3, 0.22, { style: 'plate', id: 'on-offer', text: 'ON OFFER!', bg: '#fff36b', ink: '#c8202d' });
      signs.add(0.6, 0.66, fz + 0.03, 0.28, 0.32, { style: 'poster', id: 'dirt-cheap', text: 'dirt cheap', scheme: POSTER[2] });
      for (const [x, fruit] of [[0.18, [0x6cc04a, 0x8ad35a]], [0.56, [0xff8a2a, 0xffa94a]]]) {
        block(x, 0.0, fz + 0.2, 0.34, 0.16, 0.24, 0x9a6a45, M, 0.01);
        part(M, SHAPE.box, x, 0.2, fz + 0.2, 0.32, 0.03, 0.22, 0x9a6a45, -0.25, 0, 0);
        for (let i = 0; i < 8; i++) ball(x - 0.12 + (i % 4) * 0.08, 0.19 + Math.floor(i / 4) * 0.04, fz + 0.14 + Math.floor(i / 4) * 0.08, 0.075, fruit[i % 2]);
      }
    };

    const chippy = () => {
      upper({ wall: C.stock, chimney: -1 });
      const f = P.shopfront(0, 0, fz, W, { color: 0x1f5fa8, door: 'right', h: 1.14, fascia: 0.24, glow: 0xfff6dc, lit: 0.08 });
      fascia(f, { id: 'the-chippy', text: 'The Chippy', bg: '#1f5fa8', ink: '#ffffff' });
      signs.add(-0.25, 0.7, fz + 0.03, 0.42, 0.3, { style: 'menu', head: 'Today', lines: [{ id: 'fish-and-chips', text: 'fish and chips' }, { id: 'a-takeaway', text: 'a takeaway' }], bg: '#fffaf0', ink: '#1f5fa8' });
    };

    const endHouse = () => {
      upper({ wall: C.stock, chimney: 1, balcony: true });
      // a front door with a fanlight and steps, a ground-floor sash, area railings
      slab(-0.4, 0, fz - 0.01, 0.62, 0.14, 0.04, 0xece6da);
      slab(-0.4, 0.14, fz + 0.004, 0.46, 0.9, 0.03, C.white);
      block(-0.4, 0.15, fz + 0.016, 0.34, 0.72, 0.03, 0x2b3a67, S, 0.02);
      b.lit(WINDOW, P.lit(), () => part(k.glass, SHAPE.halfDisc, -0.4, 0.88, fz + 0.03, 0.32, 0.32, 0.02, 0x56677c));
      ball(-0.31, 0.5, fz + 0.04, 0.04, C.gold, S);
      for (let i = 0; i < 3; i++) slab(-0.4, 0, fz + 0.1 + i * 0.09, 0.56 + i * 0.06, 0.13 - i * 0.04, 0.1, 0xe2dccf);
      P.sash(0.42, 0.42, fz, 0.38, 0.56, { curtain: 0x9b3b3b, both: true, bars: [2, 2], lintel: 'arch', lintelCol: 0xc2604a });
      slab(0.3, 0, fz + 0.26, 0.9, 0.04, 0.03, C.iron, S);
      for (let i = 0; i < 9; i++) slab(-0.1 + i * 0.1, 0, fz + 0.26, 0.02, 0.36, 0.02, C.iron, S);
    };

    const row = [
      [-3.4, endHouse],
      [-2.05, pub],
      [-0.7, cafe],
      [0.66, bakery],
      [1.98, bargain],
      [3.35, chippy],
    ];
    for (const [x, fn] of row) {
      const h = houseAt(x);
      b.prop(x, at(x, h.z), h.z, h.ry, TERRACE.s, near(x, h.z), fn);
    }

    // pavement furniture in front of the shops (in each shop's frame, on the pavement)
    const onPavement = (x, along, fn) => {
      const h = houseAt(x);
      const ry = h.ry;
      const off = fz * TERRACE.s + 0.29;
      const px = x + Math.sin(ry) * off + Math.cos(ry) * along;
      const pz = h.z + Math.cos(ry) * off - Math.sin(ry) * along;
      b.prop(px, at(px, pz), pz, ry, 1, near(px, pz), fn);
    };
    // the pub's food board, the café's chalkboard, the paper's headline outside the corner shop
    const chalkboard = (lines, head) => () => {
      const a = P.aboard(0.3, 0.42, 0x6b4a32);
      signs.add(0, a.y, a.z, 0.3, 0.42, { style: 'chalk', head, lines }, { rx: a.rx });
    };
    onPavement(-2.05, 0.42, chalkboard([{ id: 'pub-grub', text: 'Pub grub' }, { id: 'fish-and-chips', text: 'Fish and chips' }], 'Food'));
    onPavement(-0.7, -0.38, chalkboard([{ id: 'a-cuppa-and-a-biscuit', text: 'A cuppa and a biscuit' }, { id: 'a-bacon-sarnie', text: 'A bacon sarnie' }], 'Menu'));
    onPavement(1.98, 0.38, () => {
      const a = P.aboard(0.28, 0.4, 0x2b2d33);
      signs.add(0, a.y, a.z, 0.28, 0.4, { style: 'news', id: 'its-chucking-it-down', text: "It's chucking it down", head: 'The Daily Natter' }, { rx: a.rx });
    });
    // a bus stop by the bus
    onPavement(3.35, 0.55, () => {
      post(0, 0, 0, 0.05, 1.7, 0x3a3d44, S);
      slab(0, 1.42, 0.0, 0.34, 0.2, 0.03, 0xc8202d, S);
      signs.add(0, 1.52, 0.017, 0.32, 0.18, { style: 'plate', text: 'BUS STOP', bg: '#ffffff', ink: '#c8202d', keyline: '#c8202d' });
      slab(0, 0.95, 0.03, 0.18, 0.26, 0.04, 0x3a3d44, S);
      slab(0, 0.97, 0.052, 0.15, 0.22, 0.004, 0xf3efe6);
    });

    // vehicles on the crescent: parked (low), or with a life of their own (high / medium)
    const busAt = (x) => {
      const z = streetZ(x) + 0.02;
      return { x, y: at(x, z), z, ry: -Math.atan(0.148 * x) };
    };
    const cabAt = (x) => {
      const z = streetZ(x) - 0.04;
      return { x, y: at(x, z), z, ry: -Math.atan(0.148 * x) };
    };
    const busAd = (bb, group) => (x, y, z, w, h, ry) =>
      signs.add(x, y, z, w, h, { style: 'poster', text: '' }, { ry, live: { period: 10 }, res: 260, batch: bb, group });
    if (this.traffic) {
      const tr = this.traffic;
      const busCar = tr.vehicle({ build: (bb, group) => bus({ ...tools(bb), b: bb }, busAd(bb, group)), park: BUS_X, scale: 0.84, delay: near(BUS_X, -2.1), street: busAt });
      const cabCar = tr.vehicle({ build: (bb) => cab({ ...tools(bb), b: bb }), park: CAB_X, scale: 0.82, delay: near(CAB_X, -2.2), street: cabAt });
      // the bus pulls away first, the cab follows it round; then they come back the same way round
      tr.route([
        { car: busCar, kind: 'out', from: BUS_X, to: 6.7, at: 0, dur: 3.4 },
        { car: cabCar, kind: 'out', from: CAB_X, to: 6.7, at: 1.6, dur: 5.2 },
        { car: busCar, kind: 'in', from: -6.5, to: BUS_X, at: 10, dur: 6.2 },
        { car: cabCar, kind: 'in', from: -6.5, to: CAB_X, at: 13.5, dur: 2.8 },
      ]);
    } else {
      const p = busAt(BUS_X);
      b.prop(p.x, p.y, p.z, p.ry, 0.84, near(p.x, p.z), () => bus({ ...tools(b), b }, (x, y, z, w, h, ry) => signs.add(x, y, z, w, h, { style: 'poster', text: '' }, { ry, live: { period: 10 }, res: 200 })));
      const c = cabAt(CAB_X);
      b.prop(c.x, c.y, c.z, c.ry, 0.82, near(c.x, c.z), () => cab({ ...tools(b), b }));
    }

    // street furniture in the garden square
    const lamps = [[-2.9, -1.05], [2.9, -1.05]];
    for (const [x, z] of lamps) b.prop(x, at(x, z), z, 0, 1, near(x, z), lamp);
    b.prop(-4.45, at(-4.45, 0.55), 0.55, 0.62, 0.92, near(-4.45, 0.55), phoneBox);
    b.prop(3.55, at(3.55, 0.35), 0.35, -0.45, 0.95, near(3.55, 0.35), pillarBox);
    b.prop(-2.95, at(-2.95, 2.75), 2.75, 0.3, 0.9, near(-2.95, 2.75), bench);
    b.prop(4.55, at(4.55, 2.1), 2.1, -0.75, 1, near(4.55, 2.1), () => railings(1.9));
    b.prop(-4.85, at(-4.85, 1.75), 1.75, 0.95, 1, near(-4.85, 1.75), () => railings(1.5));

    // London plane trees
    for (const [x, z, s, seed] of [[-4.75, -1.85, 1.0, 3], [5.0, -0.55, 0.92, 8]]) {
      b.prop(x, at(x, z), z, 0, s, near(x, z), () => planeTree(seed));
      this.trees.push([x, 3.2 * s, z]);
    }

    // bunting between the lamps and the trees
    b.prop(0, 0, -1.05, 0, 1, 0.3, () => {
      bunting(-2.9, 1.98, -1.05, -4.5, 2.75, -1.55, 6, 0.28);
      bunting(2.9, 1.98, -1.05, 4.7, 2.7, -0.5, 7, 0.3);
    });

    // the turf: no grass on the crescent, the pavement or under the terraces
    this.ground = { keep: (x, z) => z > streetZ(x) + HALF + 0.3 };
    /** open ground in front of the crescent (where season props may go) */
    this.free = (x, z) => z > streetZ(x) + HALF + 0.45;

    if (!this.low) this.backBlock(P);
    this.far();
  }

  // ── the block behind: a second floating street of taller buildings ────────
  backBlock(P) {
    const b = this.b;
    const { part, block, slab, post, ball } = P;
    const k = P.k;
    const signs = this.signs;
    const paved = (c, x, y, z, r) => {
      const n = 0.5 + 0.5 * Math.sin(x * 2.1 + z * 1.7);
      const edge = Math.hypot(x, z / 0.36) / r;
      return c.setHex(edge > 0.9 || y < -0.06 ? 0x6fc15a : n > 0.5 ? 0xd3cdc1 : 0xc8c1b4);
    };
    /** a plain block of flats or offices: walls, a stone band per storey, windows in bays */
    const blockOf = (x, z, w, d, storeys, o) => {
      const sh = o.storey ?? 0.62;
      const h = storeys * sh + 0.2;
      const key = o.key ?? k.brick;
      block(x, 0, z, w, h, d, o.wall, key, 0.03);
      slab(x, 0, z + d / 2 - 0.02, w + 0.02, 0.32, 0.06, o.base ?? 0x7b736a);
      const bays = o.bays ?? Math.max(2, Math.round(w / 0.42));
      for (let s = 0; s < storeys; s++) {
        const y = 0.36 + s * sh;
        if (o.bands) slab(x, y - 0.08, z + d / 2, w + 0.01, 0.035, 0.03, o.bands);
        for (let i = 0; i < bays; i++) {
          const wx = x - w / 2 + ((i + 0.5) * w) / bays;
          if (o.skip?.(s, i)) continue;
          P.pane(wx, y, z + d / 2, Math.min(0.24, (w / bays) * 0.55), sh * 0.58, { frame: o.frame ?? 0xf2ede2, sill: o.sill ?? 0xe0d8c8 });
        }
      }
      slab(x, h - 0.12, z + d / 2 + 0.01, w + 0.08, 0.1, 0.08, o.cornice ?? 0xe9e2d2);
      return h;
    };

    b.chunk(1.6, -0.42, -9.9, 0, 1, { delay: 0.7, phase: 1.3, amp: 0.05 }, () => {
      addLand(b, 5.6, { depthScale: 0.36, top: paved });
      // A ── a red-brick mansion block with stone bands and Dutch gables
      const hA = blockOf(-4.0, 0.05, 1.7, 1.2, 5, { wall: 0xa9493a, bands: 0xeae0cc, storey: 0.6 });
      for (const gx of [-4.42, -3.58]) {
        part(k.brick, SHAPE.prism, gx, hA + 0.22, 0.45, 0.62, 0.44, 0.32, 0xa9493a);
        P.pane(gx, hA + 0.06, 0.62, 0.16, 0.2, { frame: 0xf2ede2 });
      }
      P.roofSlope(-4.0, hA - 0.02, -0.15, 1.6, 0.5, 0.8);
      P.chimney(-4.6, hA, -0.2, 0.22, 0.6, 0.3, 2, 0xa9493a);
      // B ── a stock-brick warehouse with a faded painted sign high on its front
      const hB = blockOf(-2.15, 0.15, 1.75, 1.2, 4, { wall: 0xc4a171, storey: 0.6, cornice: 0xd9cdb6, skip: (s) => s === 3 });
      signs.add(-2.15, hB - 0.42, 0.75 + 0.014, 1.5, 0.36, { style: 'plate', id: 'the-best-thing-since-sliced-bread', text: 'THE BEST THING SINCE SLICED BREAD', bg: '#c4a171', ink: 'rgba(246,238,214,0.82)' }, { res: 200 });
      P.roofSlope(-2.15, hB - 0.02, -0.1, 1.7, 0.42, 1.0);
      // C ── a narrow stucco house with a bay
      const hC = blockOf(-0.62, 0.25, 1.05, 1.1, 3, { wall: 0xf1e7d4, key: k.render, storey: 0.66, bays: 2, frame: 0xffffff });
      P.roofSlope(-0.62, hC - 0.02, 0.05, 1.0, 0.45, 0.9);
      P.chimney(-0.3, hC, -0.1, 0.22, 0.5, 0.3, 2, 0xa9583f);
      // the lane between C and D: setts, a lamp, a bollard (it frames the clock tower beyond)
      b.kind(KIND.PAVED, () => slab(0.35, 0.0, -0.2, 0.92, 0.03, 2.6, 0x8f8a84, k.paving));
      post(0.0, 0, 0.75, 0.06, 1.25, C.iron, S);
      b.lit(WARM, -1, () => b.add(L, SHAPE.lantern, 0.0, 1.32, 0.75, 0.13, 0.2, 0.13, 0, 0, 0, 0x5a4630));
      this.halo(0.0, 1.32, 0.75, 1.4);
      for (const z of [0.95, -0.4]) post(0.72, 0, z, 0.08, 0.3, C.iron, S);
      // D ── a tall red-brick block with a billboard of what the player is learning
      const hD = blockOf(1.85, 0.2, 1.75, 1.3, 7, { wall: 0xb5573f, bands: 0xe6dccb, storey: 0.6, skip: (s) => s === 4 || s === 5 });
      P.roofSlope(1.85, hD - 0.02, 0.0, 1.7, 0.4, 1.1, 0x5a6378);
      const bd = P.hoarding(1.85, 3.25, 0.85, 1.36, 0.72);
      signs.add(bd.x, bd.y, bd.z, 1.36, 0.72, { style: 'billboard', text: '' }, { live: { period: 9 }, res: 230, glow: 0xffffff, lit: 0.35 });
      // E ── a Portland stone department store with a corner dome and a banner for the sales
      const hE = blockOf(3.75, 0.0, 1.85, 1.3, 5, { wall: C.portland, key: k.stone, storey: 0.64, bands: 0xd9d1bf, base: 0xcfc6b2, cornice: 0xf3eee2, frame: 0x3b3f46 });
      post(4.55, hE, 0.5, 0.56, 0.4, C.portland, M, SHAPE.cyl);
      part(M, SHAPE.dome, 4.55, hE + 0.4, 0.5, 0.62, 0.55, 0.62, 0x6f9c8c);
      ball(4.55, hE + 0.98, 0.5, 0.08, C.gold, S);
      for (const x of [3.35, 4.1]) {
        post(x, hE - 1.9, 0.67, 0.025, 1.7, 0x9a9488, S);
        slab(x, hE - 1.9, 0.68, 0.34, 1.6, 0.012, 0x2f5fa8);
      }
      signs.add(3.35, hE - 1.1, 0.69, 0.32, 1.5, { style: 'plate', id: 'the-sales', text: 'THE SALES', bg: '#2f5fa8', ink: '#ffffff' }, { rz: 0, res: 200 });
      signs.add(4.1, hE - 1.1, 0.69, 0.32, 1.5, { style: 'plate', id: 'the-sales', text: 'THE SALES', bg: '#c8202d', ink: '#ffffff' }, { res: 200 });
      // street trees and lamps along the front
      for (const [x, z] of [[-3.0, 1.15], [-1.3, 1.25], [2.9, 1.2]]) {
        post(x, 0, z, 0.12, 0.9, C.bark);
        b.kind(KIND.FOLIAGE, () => {
          part(M, SHAPE.sphere, x, 1.15, z, 0.85, 0.75, 0.85, C.leaf[0]);
          part(M, SHAPE.sphere, x + 0.25, 1.0, z + 0.1, 0.6, 0.5, 0.6, C.leaf[2]);
        });
      }
    });
  }

  // ── distant chunks ────────────────────────────────────────────────────────
  far() {
    const b = this.b;
    const rng = this.rng;
    const { part, block, slab, post, ball } = tools(b);
    const pane = (x, y, z, w, h, col = 0x5f7591, t = 0.12 + rng() * 0.9) => b.lit(WINDOW, t, () => slab(x, y, z, w, h, 0.04, col, L));
    const paved = (c, x, y, z, r) => {
      const n = 0.5 + 0.5 * Math.sin(x * 2.1 + z * 1.7);
      const edge = Math.hypot(x, z) / r;
      return c.setHex(edge > 0.86 || y < -0.06 ? 0x6fc15a : n > 0.5 ? 0xd3cdc1 : 0xc8c1b4);
    };
    const pinnacle = (x, y, z, h, col = C.stone) => {
      post(x, y, z, 0.16, h * 0.55, col);
      part(M, SHAPE.cone4, x, y + h * 0.55 + h * 0.225, z, 0.2, h * 0.45, 0.2, col);
      ball(x, y + h + 0.02, z, 0.07, C.gold, S);
    };

    // A ── Gothic clock tower beside a long Gothic hall (seen down the lane behind the terrace), in a
    //      warm honey stone that holds its own against the morning haze
    const TS = 0xd6bc84;
    const TSD = 0xb89c64;
    b.chunk(4.25, -3.3, -26.2, -0.3, 1, { delay: 0.86, phase: 0.4, amp: 0.3 }, () => {
      addLand(b, 3.1, { top: paved });
      // the hall
      b.at(-1.1, 0, 0.25, 0, 1, () => {
        block(0, 0, 0, 3.4, 1.7, 1.5, TS, M, 0.04);
        part(M, SHAPE.prism, 0, 2.05, 0, 3.42, 0.7, 1.3, 0x34505c);
        for (let i = 0; i < 6; i++) {
          const x = -1.45 + i * 0.58;
          slab(x, 0, 0.76, 0.1, 1.7, 0.06, TSD);
          pane(x + 0.29, 0.35, 0.77, 0.22, 0.5);
          pane(x + 0.29, 1.05, 0.77, 0.22, 0.45);
          pinnacle(x, 1.7, 0.7, 0.55, TS);
        }
        pinnacle(1.7, 1.7, 0.7, 0.55, TS);
      });
      // the tower
      b.at(1.15, 0, -0.1, 0, 1, () => {
        block(0, 0, 0, 1.9, 0.55, 1.9, TSD, M, 0.04);
        block(0, 0.55, 0, 1.5, 6.4, 1.5, TS, M, 0.03);
        for (const [fx, fz] of [[0, 1], [1, 0], [-1, 0]]) {
          for (const o of [-0.42, 0, 0.42]) {
            const px = fz ? o : fx * 0.76;
            const pz = fz ? fz * 0.76 : o;
            b.add(M, SHAPE.box, px, 3.75, pz, fz ? 0.06 : 0.04, 6.3, fz ? 0.04 : 0.06, 0, 0, 0, TSD);
          }
          for (let k = 0; k < 4; k++) {
            const y = 1.3 + k * 1.3;
            if (fz) {
              pane(-0.21, y, 0.77, 0.2, 0.55);
              pane(0.21, y, 0.77, 0.2, 0.55);
            }
          }
        }
        // clock stage
        block(0, 6.95, 0, 1.86, 1.9, 1.86, TS, M, 0.04);
        block(0, 6.85, 0, 1.96, 0.14, 1.96, TSD, M, 0.02);
        block(0, 8.82, 0, 1.96, 0.14, 1.96, TSD, M, 0.02);
        for (const ry of [0, Math.PI / 2, -Math.PI / 2]) {
          b.at(Math.sin(ry) * 0.94, 7.9, Math.cos(ry) * 0.94, ry, 1, () => {
            block(0, -0.8, 0, 1.6, 1.6, 0.06, C.gold, S, 0.02);
            part(M, SHAPE.cyl, 0, 0, 0.04, 1.42, 0.05, 1.42, 0x2d3140, Math.PI / 2);
            b.lit(0xfff1c9, 0.2, () => part(L, SHAPE.cyl, 0, 0, 0.07, 1.26, 0.04, 1.26, 0xfaf3df, Math.PI / 2));
            for (let h = 0; h < 12; h++) {
              const a = (h / 12) * Math.PI * 2;
              part(M, SHAPE.box, Math.sin(a) * 0.52, Math.cos(a) * 0.52, 0.1, h % 3 ? 0.03 : 0.05, h % 3 ? 0.08 : 0.14, 0.02, 0x2d3140, 0, 0, -a);
            }
            part(M, SHAPE.box, -0.11, 0.12, 0.12, 0.05, 0.34, 0.02, 0x2d3140, 0, 0, 0.9);
            part(M, SHAPE.box, 0.15, 0.2, 0.13, 0.04, 0.5, 0.02, 0x2d3140, 0, 0, -0.65);
            ball(0, 0, 0.14, 0.08, C.gold, S);
          });
        }
        this.halo(0, 7.9, 1.2, 4.5, 0xfff0c8);
        // belfry and spire
        block(0, 8.96, 0, 1.6, 1.05, 1.6, TS, M, 0.03);
        for (const o of [-0.38, 0, 0.38]) {
          slab(o, 9.12, 0.81, 0.18, 0.7, 0.03, 0x3a3f4f);
          slab(0.81, 9.12, o, 0.03, 0.7, 0.18, 0x3a3f4f);
          slab(-0.81, 9.12, o, 0.03, 0.7, 0.18, 0x3a3f4f);
        }
        part(M, SHAPE.cone4, 0, 11.4, 0, 1.55, 2.9, 1.55, 0x34505c);
        for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pinnacle(cx * 0.78, 10.0, cz * 0.78, 1.1, TS);
        post(0, 12.8, 0, 0.08, 0.6, C.gold, S);
        ball(0, 13.45, 0, 0.16, C.gold, S);
      });
    });

    // B ── observation wheel (turns slowly)
    b.chunk(25, 3.5, -45, 0, 1, { delay: 0.93, phase: 2.1, amp: 0.35 }, () => {
      addLand(b, 3.0, { top: paved });
      const R = 3.9;
      const hy = R + 0.9;
      // A-frame legs and the hub
      for (const z of [-0.55, 0.55]) {
        for (const s of [-1, 1]) part(M, SHAPE.cyl8, s * 1.05, hy / 2, z, 0.16, hy * 1.08, 0.16, 0xf2f4f8, 0, 0, s * 0.42);
      }
      part(S, SHAPE.cyl, 0, hy, 0, 0.55, 1.3, 0.55, 0xdfe5ee, Math.PI / 2);
      b.spin(0, hy, 0, 'z', 0.1, 0, () => {
        const rim = new THREE.TorusGeometry(R, 0.07, 6, 56);
        for (const z of [-0.3, 0.3]) part(S, rim, 0, hy, z, 1, 1, 1, 0xf6f8fb);
        const inner = new THREE.TorusGeometry(R * 0.55, 0.04, 5, 40);
        part(S, inner, 0, hy, 0, 1, 1, 1, 0xf6f8fb);
        const n = 16;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          for (const z of [-0.3, 0.3]) part(M, SHAPE.cyl6, Math.cos(a) * R * 0.5, hy + Math.sin(a) * R * 0.5, z, 0.04, R, 0.04, 0xe9edf3, 0, 0, a - Math.PI / 2);
          b.lit(0xd8f0ff, 0.35, () => part(L, SHAPE.sphere, Math.cos(a) * (R + 0.3), hy + Math.sin(a) * (R + 0.3), 0, 0.5, 0.42, 0.5, 0xbfe3f5));
          b.lit(0xffe2a8, 0.3, () => ball(Math.cos(a + 0.2) * R, hy + Math.sin(a + 0.2) * R, 0.36, 0.09, 0xfff4d8, L));
        }
      });
      block(-1.9, 0, 1.1, 1.0, 0.55, 0.7, 0xe9edf3, M, 0.08);
    });

    // C ── twin-towered bascule bridge over the river (the leaves lift now and then)
    b.chunk(-15, -1.2, -27, 0.12, 1, { delay: 0.8, phase: 4.2, amp: 0.28 }, () => {
      addLand(b, 3.7, {
        depthScale: 0.7,
        top: (c, x, y, z) => c.setHex(y < -0.05 ? 0x6fc15a : Math.abs(x) < 1.25 ? (Math.sin(z * 3 + x) > 0.6 ? 0x6aa8d0 : C.water) : Math.abs(x) < 1.6 ? 0xd2cbbd : 0x7ed06a),
      });
      // a little tug on the river
      b.slide(0, 0, 1.3, 0.25, 0, () => {
        b.at(0, 0, 0, Math.PI / 2, 0.55, () => {
          block(0, -0.1, 0, 1.2, 0.36, 0.5, 0x2c3e5c, S, 0.12);
          block(-0.1, 0.24, 0, 0.5, 0.32, 0.4, C.white, M, 0.05);
          post(0.1, 0.5, 0, 0.12, 0.3, C.red);
        });
      });
      for (const s of [-1, 1]) {
        b.at(s * 1.75, 0, 0, 0, 1, () => {
          block(0, -0.3, 0, 1.25, 0.6, 1.5, 0xc9c0ae, M, 0.04);
          block(0, 0.3, 0, 1.0, 3.2, 1.05, 0xe9dfc8, M, 0.04);
          for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            post(cx * 0.52, 0.3, cz * 0.52, 0.28, 3.5, 0xe9dfc8);
            part(M, SHAPE.cone4, cx * 0.52, 4.05, cz * 0.52, 0.32, 0.5, 0.32, 0x5f7896);
          }
          part(M, SHAPE.cone4, 0, 4.0, 0, 1.0, 1.1, 1.0, 0x5f7896);
          ball(0, 4.6, 0, 0.12, C.gold, S);
          for (const y of [1.2, 2.2]) pane(0, y, 0.54, 0.22, 0.42);
          // side span to the bank: hanging chains
          for (const z of [-0.45, 0.45]) {
            part(M, SHAPE.box, s * 1.05, 2.0, z, 1.5, 0.08, 0.08, C.blue, 0, 0, s * 0.95);
          }
          block(s * 1.05, 0.55, 0, 1.6, 0.18, 1.0, C.blue, M, 0.03);
        });
      }
      // high walkways
      for (const y of [3.0, 3.42]) block(0, y, 0, 2.6, 0.24, 0.5, C.blue, M, 0.04);
      slab(0, 3.24, 0.26, 2.5, 0.18, 0.02, C.white);
      // the bascules
      for (const s of [-1, 1]) {
        b.swing(s * 1.25, 0.65, 0, s * 0.85, 0.35, 0.6, () => block(s * 0.62, 0.55, 0, 1.25, 0.16, 0.95, C.blue, M, 0.03));
      }
    });

    // D ── domed cathedral
    b.chunk(-26, 6.5, -50, 0.35, 1, { delay: 0.96, phase: 1.2, amp: 0.4 }, () => {
      addLand(b, 3.6, { top: paved });
      const W2 = 0xefe8d8;
      block(0, 0, 0, 4.0, 1.7, 2.2, W2, M, 0.05);
      part(M, SHAPE.prism, 0, 2.0, 0, 4.0, 0.6, 2.0, C.lead);
      // portico
      for (let i = 0; i < 6; i++) post(-0.9 + i * 0.36, 0, 1.25, 0.18, 1.5, W2);
      slab(0, 1.5, 1.2, 2.2, 0.22, 0.5, W2);
      part(M, SHAPE.prism, 0, 1.92, 1.2, 2.3, 0.45, 0.5, W2);
      for (let i = 0; i < 5; i++) pane(-1.6 + i * 0.8, 0.5, 1.11, 0.24, 0.55);
      // twin bell towers
      for (const s of [-1, 1]) {
        block(s * 1.6, 1.7, 0.6, 0.7, 1.2, 0.7, W2, M, 0.04);
        post(s * 1.6, 2.9, 0.6, 0.6, 0.35, W2, M, SHAPE.cyl);
        part(M, SHAPE.dome, s * 1.6, 3.25, 0.6, 0.62, 0.5, 0.62, C.lead);
        ball(s * 1.6, 3.55, 0.6, 0.12, C.gold, S);
      }
      // drum, dome and lantern
      post(0, 2.2, -0.2, 2.2, 1.1, W2, M, SHAPE.cyl);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        post(Math.cos(a) * 1.18, 2.2, -0.2 + Math.sin(a) * 1.18, 0.12, 1.0, 0xf7f2e6);
      }
      post(0, 3.25, -0.2, 2.45, 0.12, W2, M, SHAPE.cyl);
      part(M, SHAPE.dome, 0, 3.35, -0.2, 2.3, 2.2, 2.3, C.lead);
      post(0, 4.4, -0.2, 0.42, 0.55, W2);
      part(M, SHAPE.dome, 0, 4.95, -0.2, 0.46, 0.4, 0.46, C.lead);
      ball(0, 5.25, -0.2, 0.18, C.gold, S);
      slab(0, 5.3, -0.2, 0.05, 0.4, 0.05, C.gold, S);
      slab(0, 5.52, -0.2, 0.2, 0.05, 0.05, C.gold, S);
    });

    // E ── chimney-pot rooftops
    b.chunk(-9, -0.2, -19, 0.25, 1, { delay: 0.74, phase: 3.0, amp: 0.25 }, () => {
      addLand(b, 2.5, { top: paved });
      const bodies = [0xb8573f, 0xd9b98a, 0xc96a52, 0xe6c79a, 0xb15f48];
      for (let i = 0; i < 5; i++) {
        const x = -1.6 + i * 0.8;
        const h = 1.5 + (i % 2) * 0.35;
        block(x, 0, -0.3, 0.78, h, 1.2, bodies[i], M, 0.03);
        part(M, SHAPE.prism, x, h + 0.25, -0.3, 0.8, 0.5, 1.1, C.slate);
        pane(x - 0.17, 0.35, 0.31, 0.18, 0.36);
        pane(x + 0.17, 0.35, 0.31, 0.18, 0.36);
        pane(x - 0.17, 0.95, 0.31, 0.18, 0.36);
        pane(x + 0.17, 0.95, 0.31, 0.18, 0.36);
        block(x + 0.38, h - 0.1, -0.35, 0.22, 0.75, 0.36, C.brick, M, 0.02);
        for (const pz of [-0.45, -0.25]) post(x + 0.38, h + 0.65, pz, 0.08, 0.16, C.pot);
        // smoke curling from a couple of the chimneys
        if (i % 2 === 0) for (let k = 0; k < 3; k++) b.rise(x + 0.38, h + 0.9, -0.35, 0.16, k / 3 + i * 0.1, 1.6, () => part(M, SHAPE.sphere, x + 0.38, h + 0.9, -0.35, 0.42, 0.36, 0.42, 0xeeebe6));
      }
      for (let i = 0; i < 3; i++) {
        b.kind(KIND.FOLIAGE, () => part(M, SHAPE.sphere, -1.2 + i * 1.1, 0.35, 1.0, 0.8, 0.6, 0.6, C.leaf[i % 4]));
      }
    });

    // F ── a far-off terrace with a little park (not on low quality)
    if (!this.low) {
      b.chunk(-4, 13, -68, 0.2, 1, { delay: 1, phase: 5.1, amp: 0.4 }, () => {
        addLand(b, 3.0);
        const bodies = [0xa8dcc4, 0xf4b4b9, 0x9ccaf0, 0xf7d98a];
        for (let i = 0; i < 4; i++) {
          const x = -1.5 + i * 0.85;
          block(x, 0, -0.6, 0.82, 1.9, 1.1, bodies[i], M, 0.03);
          part(M, SHAPE.prism, x, 2.15, -0.6, 0.84, 0.5, 1.0, C.slate);
          pane(x, 0.5, -0.03, 0.3, 0.4);
          pane(x, 1.2, -0.03, 0.3, 0.4);
        }
        b.kind(KIND.FOLIAGE, () => part(M, SHAPE.sphere, 1.4, 1.1, 0.9, 1.4, 1.3, 1.4, C.leaf[0]));
        post(1.4, 0, 0.9, 0.2, 0.6, C.bark);
      });

      // G ── the wider city: far blocks of flats and offices, church spires and a few towers
      this.skyline();
    }
  }

  /** Far-off blocks round the clock tower: cheap boxes wearing window patterns (lit at night). */
  skyline() {
    const b = this.b;
    const P = cityParts(this, b, this.rng2);
    const { part, block, slab, post, ball } = P;
    const k = P.k;
    const tower = (x, z, w, d, h, col, key, roof = 0x5a6378) => {
      block(x, 0, z, w, h, d, col, key, 0.03);
      slab(x, h, z, w + 0.06, 0.08, d + 0.06, 0xd8d2c6);
      if (roof) part(k.slate, SHAPE.prism, x, h + 0.08 + 0.22, z, w, 0.44, d * 0.8, roof);
    };
    const spire = (x, z, h, col = 0xeee8da) => {
      block(x, 0, z, 0.5, h * 0.55, 0.5, col, k.stone, 0.02);
      post(x, h * 0.55, z, 0.36, h * 0.12, col, M, SHAPE.cyl8);
      part(M, SHAPE.cone8, x, h * 0.67 + h * 0.17, z, 0.34, h * 0.34, 0.34, col);
      ball(x, h * 1.02, z, 0.06, C.gold, S);
    };
    // left of the clock tower: Victorian blocks and a Wren-ish spire
    b.chunk(-0.6, -3.0, -34, 0.1, 1, { delay: 0.84, phase: 2.6, amp: 0.25 }, () => {
      addLand(b, 3.2, { depthScale: 0.6 });
      tower(-1.6, 0.2, 1.3, 1.0, 5.4, 0xb7654c, k.flats);
      tower(-0.2, -0.4, 1.2, 1.1, 6.6, 0xd8c7a6, k.flats);
      tower(1.2, 0.1, 1.4, 1.0, 4.8, 0xa65a45, k.flats);
      spire(2.4, -0.5, 7.8);
    });
    // right of it: offices and a couple of glass towers far away
    b.chunk(13.5, -3.6, -38, -0.35, 1, { delay: 0.95, phase: 3.7, amp: 0.3 }, () => {
      addLand(b, 3.6, { depthScale: 0.6 });
      tower(-2.0, 0.3, 1.2, 1.1, 5.0, 0xe2dccd, k.office, null);
      tower(-0.6, -0.2, 1.3, 1.2, 8.2, 0x8fa8c0, k.office, null);
      tower(0.9, 0.4, 1.1, 1.0, 6.4, 0xcfc8b8, k.office, null);
      tower(2.1, -0.3, 1.0, 1.0, 4.2, 0xb7654c, k.flats);
      post(-0.6, 8.2, -0.2, 0.06, 1.2, 0xd8dde4, S);
      b.lit(0xff3b30, -1, () => ball(-0.6, 9.45, -0.2, 0.14, 0xff5a4a, L));
    });
  }

  ambient(fx, dt, quality, season) {
    // plane-tree leaves drifting down in autumn
    if (season !== 'autumn') return;
    this.leafT -= dt;
    if (this.leafT > 0 || quality === 'low') return;
    this.leafT = 0.7 + Math.random() * 1.1;
    const [x, y, z] = this.trees[(Math.random() * this.trees.length) | 0];
    const cols = [0xd9b043, 0xe0782c, 0xc98f3a, 0xb5562a];
    fx.petal(x + (Math.random() - 0.5) * 2.2, y + Math.random() * 0.8, z + (Math.random() - 0.3) * 1.6, cols[(Math.random() * cols.length) | 0]);
  }
}
