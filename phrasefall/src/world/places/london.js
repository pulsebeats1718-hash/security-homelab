/**
 * London — a cobbled crescent behind the dais with pastel terraces, a red double-decker and a
 * black cab, Victorian lamps, a phone kiosk, a pillar box, railings, a bench, bunting and London
 * plane trees. Distant chunks: a Gothic clock tower, an observation wheel, a twin-towered bascule
 * bridge over the river, a domed cathedral and chimney-pot rooftops. All shapes are generic.
 */
import * as THREE from 'three';
import { mulberry32 } from '../../core/utils.js';
import { Diorama, SHAPE, rbox, groundY, islandR, ribbon, pathX, addLand, tools } from './kit.js';
import { KIND } from '../seasons/shader.js';

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
  stone: 0xe8d6a6,
  stoneDark: 0xcbb27c,
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
const WINDOW = 0xd9a35a;

/** Centre line of the cobbled crescent behind the dais, and its half width. */
const streetZ = (x) => -2.86 + 0.074 * x * x;
const HALF = 0.58;

export class London extends Diorama {
  constructor(island, quality) {
    super(island, quality);
    this.rng = mulberry32(1851);
    this.leafT = 0.5;
    this.trees = [];
    this.build();
    this.finish();
  }

  build() {
    const b = this.b;
    const rng = this.rng;
    const { part, block, slab, post, ball } = tools(b);
    const lit = () => 0.12 + rng() * 0.95;

    /** a white sash window on a wall facing +z (wall plane at z), bottom at y */
    const sash = (x, y, z, w, h, frame = C.white, glow = WINDOW) => {
      slab(x, y - 0.06, z + 0.04, w + 0.16, 0.06, 0.1, frame);
      slab(x, y - 0.02, z + 0.015, w + 0.1, h + 0.06, 0.04, frame);
      b.lit(glow, lit(), () => slab(x, y + 0.01, z + 0.03, w, h, 0.02, C.glass, L));
      slab(x, y + h * 0.5 - 0.01, z + 0.045, w, 0.035, 0.02, frame);
      slab(x, y, z + 0.045, 0.03, h, 0.02, frame);
    };

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

    // ── vehicles ────────────────────────────────────────────────────────────
    const wheel = (x, z, d = 0.42, w = 0.17) => {
      b.add(M, SHAPE.cyl, x, d / 2, z, d, w, d, Math.PI / 2, 0, 0, C.tyre);
      b.add(S, SHAPE.cyl8, x, d / 2, z + Math.sign(z) * (w / 2 + 0.005), d * 0.5, 0.02, d * 0.5, Math.PI / 2, 0, 0, C.chrome);
    };
    const cab = () => {
      for (const x of [-0.62, 0.66]) for (const z of [-0.43, 0.43]) wheel(x, z);
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
    };
    const bus = () => {
      const len = 3.9;
      for (const x of [-1.15, 1.25]) for (const z of [-0.54, 0.54]) wheel(x, z, 0.56, 0.2);
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
    };

    // ── terrace house ───────────────────────────────────────────────────────
    const house = (body, door, chimneySide = 1) => {
      const w = 1.5;
      const d = 1.4;
      const z = d / 2;
      block(0, 0, 0, w, 2.7, d, body, M, 0.04);
      block(0, 0, 0, w + 0.02, 0.22, d + 0.02, C.white, M, 0.02);
      slab(0, 1.28, z, w + 0.02, 0.08, 0.06, C.white);
      block(0, 2.62, 0, w + 0.1, 0.14, d + 0.1, C.white, M, 0.03);
      // door with fanlight, frame and steps
      const dx = -0.36;
      slab(dx, 0.22, z + 0.005, 0.54, 1.02, 0.04, C.white);
      block(dx, 0.24, z + 0.02, 0.4, 0.84, 0.04, door, S, 0.02);
      b.lit(WINDOW, lit(), () => part(L, SHAPE.halfDisc, dx, 1.09, z + 0.035, 0.38, 0.38, 0.02, C.glass));
      ball(dx + 0.12, 0.66, z + 0.06, 0.05, C.gold, S);
      slab(dx, 0, z + 0.14, 0.62, 0.12, 0.3, C.white);
      slab(dx, 0, z + 0.28, 0.72, 0.06, 0.3, C.white);
      // windows, a little iron balcony upstairs
      sash(0.34, 0.5, z, 0.44, 0.64);
      sash(-0.36, 1.56, z, 0.4, 0.74);
      sash(0.36, 1.56, z, 0.4, 0.74);
      slab(0, 1.46, z + 0.1, 1.26, 0.04, 0.12, C.iron, S);
      for (let i = 0; i < 9; i++) slab(-0.6 + i * 0.15, 1.46, z + 0.15, 0.022, 0.24, 0.022, C.iron, S);
      slab(0, 1.7, z + 0.15, 1.26, 0.03, 0.03, C.iron, S);
      // slate roof and a chimney stack with pots
      part(M, SHAPE.prism, 0, 2.95, 0, w + 0.06, 0.5, d - 0.1, C.slate);
      const cx = chimneySide * (w / 2 - 0.2);
      block(cx, 2.6, -0.1, 0.34, 0.92, 0.5, C.brick, M, 0.03);
      slab(cx, 3.5, -0.1, 0.4, 0.06, 0.56, C.white);
      for (const pz of [-0.25, -0.1, 0.05]) post(cx, 3.56, pz, 0.1, 0.2, C.pot);
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
    b.pin(0, at(0, -2.86), -2.86, 0.0, () => {
      part(M, ribbon(path, -HALF, HALF, 0.0, 0.1), 0, 0, 0, 1, 1, 1, C.grout);
      part(M, ribbon(path, HALF, HALF + 0.14, 0.05, 0.12), 0, 0, 0, 1, 1, 1, C.kerb);
      part(M, ribbon(path, -HALF - 0.14, -HALF, 0.05, 0.12), 0, 0, 0, 1, 1, 1, C.kerb);
      part(M, ribbon(path, -HALF - 1.7, -HALF - 0.14, 0.025, 0.1), 0, 0, 0, 1, 1, 1, C.paving);
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
      for (let x = -3.1; x < 3.3; x += 0.62) {
        const dz = 0.148 * x;
        const l = Math.hypot(1, dz);
        const d = -HALF - 0.92;
        const px = x - (dz / l) * d;
        const pz = streetZ(x) + d / l;
        if (islandR(px, pz) < 0.93) part(M, SHAPE.box, px, at(px, pz) + 0.026, pz, 0.025, 0.012, 1.5, 0xb4aea2, 0, -Math.atan(dz), 0);
      }
    });

    // terraces along the back of the crescent
    const terrace = [
      [-2.05, 0.42, 0xa8dcc4, 0x2b3a67, -1],
      [-0.7, 0.13, 0xf4b4b9, 0x2f6b4f, 1],
      [0.66, -0.12, 0x9ccaf0, 0xd23b3b, -1],
      [1.98, -0.4, 0xf7d98a, 0x24262e, 1],
    ];
    for (const [x, ry, body, door, side] of terrace) {
      const z = streetZ(x) - HALF - 0.95;
      b.prop(x, at(x, z), z, ry, 0.74, near(x, z), () => house(body, door, side));
    }

    // vehicles on the crescent
    {
      const x = 3.25;
      const z = streetZ(x) + 0.02;
      b.prop(x, at(x, z), z, -Math.atan(0.148 * x), 0.84, near(x, z), bus);
    }
    {
      const x = -3.05;
      const z = streetZ(x) - 0.04;
      b.prop(x, at(x, z), z, Math.PI - Math.atan(0.148 * x), 0.82, near(x, z), cab);
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

    this.far();
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

    // A ── Gothic clock tower beside a long Gothic hall
    b.chunk(14, 0.8, -30, -0.3, 1, { delay: 0.86, phase: 0.4, amp: 0.3 }, () => {
      addLand(b, 3.1, { top: paved });
      // the hall
      b.at(-1.1, 0, 0.25, 0, 1, () => {
        block(0, 0, 0, 3.4, 1.7, 1.5, C.stone, M, 0.04);
        part(M, SHAPE.prism, 0, 2.05, 0, 3.42, 0.7, 1.3, C.spire);
        for (let i = 0; i < 6; i++) {
          const x = -1.45 + i * 0.58;
          slab(x, 0, 0.76, 0.1, 1.7, 0.06, C.stoneDark);
          pane(x + 0.29, 0.35, 0.77, 0.22, 0.5);
          pane(x + 0.29, 1.05, 0.77, 0.22, 0.45);
          pinnacle(x, 1.7, 0.7, 0.55);
        }
        pinnacle(1.7, 1.7, 0.7, 0.55);
      });
      // the tower
      b.at(1.15, 0, -0.1, 0, 1, () => {
        block(0, 0, 0, 1.9, 0.55, 1.9, C.stoneDark, M, 0.04);
        block(0, 0.55, 0, 1.5, 6.4, 1.5, C.stone, M, 0.03);
        for (const [fx, fz] of [[0, 1], [1, 0], [-1, 0]]) {
          for (const o of [-0.42, 0, 0.42]) {
            const px = fz ? o : fx * 0.76;
            const pz = fz ? fz * 0.76 : o;
            b.add(M, SHAPE.box, px, 3.75, pz, fz ? 0.06 : 0.04, 6.3, fz ? 0.04 : 0.06, 0, 0, 0, C.stoneDark);
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
        block(0, 6.95, 0, 1.86, 1.9, 1.86, C.stone, M, 0.04);
        block(0, 6.85, 0, 1.96, 0.14, 1.96, C.stoneDark, M, 0.02);
        block(0, 8.82, 0, 1.96, 0.14, 1.96, C.stoneDark, M, 0.02);
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
        block(0, 8.96, 0, 1.6, 1.05, 1.6, C.stone, M, 0.03);
        for (const o of [-0.38, 0, 0.38]) {
          slab(o, 9.12, 0.81, 0.18, 0.7, 0.03, 0x3a3f4f);
          slab(0.81, 9.12, o, 0.03, 0.7, 0.18, 0x3a3f4f);
          slab(-0.81, 9.12, o, 0.03, 0.7, 0.18, 0x3a3f4f);
        }
        part(M, SHAPE.cone4, 0, 11.4, 0, 1.55, 2.9, 1.55, C.spire);
        for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pinnacle(cx * 0.78, 10.0, cz * 0.78, 1.1);
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
      const W = 0xefe8d8;
      block(0, 0, 0, 4.0, 1.7, 2.2, W, M, 0.05);
      part(M, SHAPE.prism, 0, 2.0, 0, 4.0, 0.6, 2.0, C.lead);
      // portico
      for (let i = 0; i < 6; i++) post(-0.9 + i * 0.36, 0, 1.25, 0.18, 1.5, W);
      slab(0, 1.5, 1.2, 2.2, 0.22, 0.5, W);
      part(M, SHAPE.prism, 0, 1.92, 1.2, 2.3, 0.45, 0.5, W);
      for (let i = 0; i < 5; i++) pane(-1.6 + i * 0.8, 0.5, 1.11, 0.24, 0.55);
      // twin bell towers
      for (const s of [-1, 1]) {
        block(s * 1.6, 1.7, 0.6, 0.7, 1.2, 0.7, W, M, 0.04);
        post(s * 1.6, 2.9, 0.6, 0.6, 0.35, W, M, SHAPE.cyl);
        part(M, SHAPE.dome, s * 1.6, 3.25, 0.6, 0.62, 0.5, 0.62, C.lead);
        ball(s * 1.6, 3.55, 0.6, 0.12, C.gold, S);
      }
      // drum, dome and lantern
      post(0, 2.2, -0.2, 2.2, 1.1, W, M, SHAPE.cyl);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        post(Math.cos(a) * 1.18, 2.2, -0.2 + Math.sin(a) * 1.18, 0.12, 1.0, 0xf7f2e6);
      }
      post(0, 3.25, -0.2, 2.45, 0.12, W, M, SHAPE.cyl);
      part(M, SHAPE.dome, 0, 3.35, -0.2, 2.3, 2.2, 2.3, C.lead);
      post(0, 4.4, -0.2, 0.42, 0.55, W);
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
    }
  }

  ambient(fx, dt, quality) {
    // plane-tree leaves drifting down
    this.leafT -= dt;
    if (this.leafT > 0 || quality === 'low') return;
    this.leafT = 0.7 + Math.random() * 1.1;
    const [x, y, z] = this.trees[(Math.random() * this.trees.length) | 0];
    const cols = [0xa9c94a, 0xd9b043, 0x8fbf4a, 0xc98f3a];
    fx.petal(x + (Math.random() - 0.5) * 2.2, y + Math.random() * 0.8, z + (Math.random() - 0.3) * 1.6, cols[(Math.random() * cols.length) | 0]);
  }
}
