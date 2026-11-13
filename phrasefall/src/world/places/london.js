/**
 * London — a cobbled crescent with pastel terraces, a red double-decker and a black cab,
 * Victorian lamps, a phone box, a pillar box and London plane trees. Distant chunks: a Gothic
 * clock tower, an observation wheel, a twin-towered bascule bridge over the river, a domed
 * cathedral and chimney-pot rooftops.
 */
import { mulberry32 } from '../../core/utils.js';
import { Diorama, SHAPE, rbox, groundY, islandR, ribbon, pathX, addLand } from './kit.js';

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
  stock: 0xd9b98a,
  stone: 0xe6d3a3,
  stoneDark: 0xc9b07a,
  kerb: 0xd9d3c7,
  grout: 0x6c6862,
  paving: 0xcdc7bb,
  tyre: 0x24252b,
  chrome: 0xc4cad3,
  bark: 0xcfc6a2,
  barkDark: 0x8d8a5c,
  leaf: [0x74c25a, 0x5aae4e, 0x93d36a, 0x63b955],
  water: 0x4f93bf,
  lead: 0x8a98a8,
  blue: 0x6fa9d8,
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
    this.build();
    this.finish();
  }

  build() {
    const b = this.b;
    const rng = this.rng;
    // ── little helpers (local coordinates of the current prop) ──────────────
    const part = (key, geo, x, y, z, sx, sy, sz, col, rx = 0, ry = 0, rz = 0) => b.add(key, geo, x, y, z, sx, sy, sz, rx, ry, rz, col);
    /** soft box resting on y */
    const block = (x, y, z, w, h, d, col, key = M, r = 0.05) => b.add(key, rbox(w, h, d, r), x, y + h / 2, z, 1, 1, 1, 0, 0, 0, col);
    /** hard box resting on y */
    const slab = (x, y, z, w, h, d, col, key = M, ry = 0) => b.add(key, SHAPE.box, x, y + h / 2, z, w, h, d, 0, ry, 0, col);
    /** cylinder resting on y */
    const post = (x, y, z, dia, h, col, key = M, geo = SHAPE.cyl8) => b.add(key, geo, x, y + h / 2, z, dia, h, dia, 0, 0, 0, col);
    const ball = (x, y, z, d, col, key = M, sy = 1) => b.add(key, SHAPE.ball, x, y, z, d, d * sy, d, 0, 0, 0, col);
    const lit = () => 0.12 + rng() * 0.95;

    /** a white sash window on a wall facing +z (plane at z), bottom at y */
    const sash = (x, y, z, w, h, frame = C.white) => {
      slab(x, y - 0.06, z + 0.04, w + 0.16, 0.06, 0.1, frame);
      slab(x, y - 0.02, z + 0.015, w + 0.1, h + 0.06, 0.04, frame);
      b.lit(WINDOW, lit(), () => slab(x, y + 0.01, z + 0.03, w, h, 0.02, C.glass, L));
      slab(x, y + h * 0.5 - 0.01, z + 0.045, w, 0.035, 0.02, frame);
      slab(x, y, z + 0.045, 0.03, h, 0.02, frame);
    };

    // ── Victorian street lamp ───────────────────────────────────────────────
    const lamp = () => {
      post(0, 0, 0, 0.3, 0.16, C.iron, S);
      post(0, 0.16, 0, 0.2, 0.22, C.iron, S);
      b.add(S, SHAPE.cyl8, 0, 1.2, 0, 0.1, 1.8, 0.1, 0, 0, 0, C.iron);
      post(0, 0.38, 0, 0.16, 0.06, C.gold, S);
      post(0, 1.62, 0, 0.13, 0.05, C.gold, S);
      slab(0, 2.0, 0, 0.56, 0.035, 0.04, C.iron, S);
      ball(-0.28, 2.02, 0, 0.06, C.iron, S);
      ball(0.28, 2.02, 0, 0.06, C.iron, S);
      post(0, 2.06, 0, 0.16, 0.08, C.iron, S);
      // lantern: tapered glass box, corner posts, pyramid roof
      slab(0, 2.13, 0, 0.3, 0.05, 0.3, C.iron, S);
      b.lit(WARM, -1, () => b.add(L, SHAPE.cone4, 0, 2.36, 0, 0.3, -0.42, 0.3, 0, 0, 0, 0x5a4630));
      for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) part(S, SHAPE.box, cx * 0.13, 2.37, cz * 0.13, 0.03, 0.42, 0.03, C.iron, cz * 0.12, 0, -cx * 0.12);
      b.add(S, SHAPE.cone4, 0, 2.69, 0, 0.44, 0.22, 0.44, 0, 0, 0, C.iron);
      ball(0, 2.82, 0, 0.08, C.gold, S);
      this.halo(0, 2.38, 0, 2.3);
    };

    // ── red telephone kiosk (generic) ───────────────────────────────────────
    const phoneBox = () => {
      block(0, 0, 0, 1.0, 0.12, 1.0, C.redDark, S, 0.03);
      block(0, 0.12, 0, 0.88, 1.92, 0.88, C.red, S, 0.06);
      for (const [fx, fz, ry] of [[0, 1, 0], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
        b.at(fx * 0.44, 0, fz * 0.44, ry, 1, () => {
          // glazing: a pale glass panel crossed by red bars
          b.lit(0xfff0c8, 0.55, () => slab(0, 0.42, 0.005, 0.58, 1.22, 0.02, 0xcfe0ea, L));
          for (let i = 1; i < 3; i++) slab(-0.29 + i * 0.193, 0.42, 0.02, 0.035, 1.22, 0.02, C.red, S);
          for (let i = 1; i < 6; i++) slab(0, 0.42 + i * 0.203, 0.02, 0.58, 0.035, 0.02, C.red, S);
          // sign panel under the roof, lit at night
          b.lit(0xfff3d6, 0.3, () => slab(0, 1.74, 0.01, 0.56, 0.14, 0.02, C.white, L));
        });
      }
      slab(0.3, 1.0, 0.455, 0.05, 0.16, 0.03, C.iron, S);
      block(0, 2.04, 0, 1.02, 0.12, 1.02, C.red, S, 0.04);
      b.add(S, SHAPE.dome, 0, 2.15, 0, 0.98, 0.32, 0.98, 0, 0, 0, C.red);
      ball(0, 2.33, 0, 0.12, C.red, S);
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

    // ── black cab ───────────────────────────────────────────────────────────
    const wheel = (x, z, d = 0.42, w = 0.17) => {
      b.add(M, SHAPE.cyl, x, d / 2, z, d, w, d, Math.PI / 2, 0, 0, C.tyre);
      b.add(S, SHAPE.cyl8, x, d / 2, z + Math.sign(z) * (w / 2 + 0.005), d * 0.5, 0.02, d * 0.5, Math.PI / 2, 0, 0, C.chrome);
    };
    const cab = () => {
      for (const x of [-0.62, 0.66]) for (const z of [-0.43, 0.43]) wheel(x, z);
      block(0, 0.16, 0, 1.95, 0.5, 0.96, 0x1d1f26, S, 0.16);
      block(-0.12, 0.6, 0, 1.36, 0.56, 0.9, 0x1d1f26, S, 0.14);
      // glass
      for (const z of [-1, 1]) {
        block(0.2, 0.74, z * 0.452, 0.42, 0.3, 0.02, C.glassDark, S, 0.01);
        block(-0.34, 0.74, z * 0.452, 0.48, 0.3, 0.02, C.glassDark, S, 0.01);
      }
      b.add(S, rbox(0.03, 0.32, 0.72, 0.01), 0.55, 0.89, 0, 1, 1, 1, 0, 0, -0.22, C.glassDark);
      block(-0.79, 0.74, 0, 0.02, 0.28, 0.66, C.glassDark, S, 0.01);
      // grille, bumpers, lights, roof sign
      slab(0.97, 0.3, 0, 0.04, 0.26, 0.4, C.chrome, S);
      slab(0.98, 0.17, 0, 0.06, 0.07, 0.94, C.chrome, S);
      slab(-0.98, 0.17, 0, 0.06, 0.07, 0.94, C.chrome, S);
      for (const z of [-0.32, 0.32]) {
        b.lit(0xfff4dc, 0.35, () => b.add(L, SHAPE.cyl, 0.97, 0.42, z, 0.16, 0.05, 0.16, 0, 0, Math.PI / 2, 0xf4f1e6));
        b.lit(0xff3b30, 0.35, () => slab(-0.98, 0.42, z, 0.03, 0.1, 0.12, 0xb3202a, L));
      }
      b.lit(0xffb52e, -1, () => block(0.02, 1.15, 0, 0.36, 0.12, 0.16, 0xffc23d, L, 0.03));
    };

    // ── red double-decker bus ───────────────────────────────────────────────
    const bus = () => {
      const len = 3.9;
      for (const x of [-1.15, 1.25]) for (const z of [-0.54, 0.54]) wheel(x, z, 0.56, 0.2);
      block(0, 0.2, 0, len - 0.08, 0.32, 1.16, 0x2a2b31, M, 0.08);
      block(0, 0.3, 0, len, 2.06, 1.22, C.red, S, 0.2);
      // a cream band between the decks
      block(0, 1.38, 0, len + 0.02, 0.1, 1.24, C.cream, S, 0.03);
      // window bands both sides, lit at night
      for (const z of [-1, 1]) {
        b.lit(0xffd590, 0.25, () => {
          block(-0.25, 0.86, z * 0.612, 2.9, 0.42, 0.02, 0x41536b, L, 0.01);
          block(0.02, 1.62, z * 0.612, 3.5, 0.44, 0.02, 0x41536b, L, 0.01);
        });
        for (let i = 0; i < 6; i++) slab(-1.6 + i * 0.6, 0.86, z * 0.622, 0.06, 0.42, 0.02, C.red, S);
        for (let i = 0; i < 7; i++) slab(-1.73 + i * 0.585, 1.62, z * 0.622, 0.06, 0.44, 0.02, C.red, S);
        slab(1.62, 0.5, z * 0.616, 0.36, 0.78, 0.02, 0x41536b, S);
      }
      // front: windscreen, destination blind, lights
      b.lit(0xffd590, 0.25, () => {
        block(len / 2 + 0.005, 0.86, 0, 0.02, 0.44, 0.96, 0x41536b, L, 0.01);
        block(len / 2 + 0.005, 1.62, 0, 0.02, 0.44, 0.96, 0x41536b, L, 0.01);
      });
      b.lit(0xfff3c4, 0.15, () => slab(len / 2 + 0.01, 1.42, 0, 0.02, 0.16, 0.7, 0xf6f0d8, L));
      for (const z of [-0.42, 0.42]) b.lit(0xfff4dc, 0.35, () => b.add(L, SHAPE.cyl, len / 2 + 0.01, 0.48, z, 0.16, 0.04, 0.16, 0, 0, Math.PI / 2, 0xf4f1e6));
      slab(len / 2 + 0.02, 0.24, 0, 0.06, 0.08, 1.18, 0x2a2b31, M);
    };

    // ── terrace house ───────────────────────────────────────────────────────
    const house = (body, door, chimneySide = 1) => {
      const w = 1.5;
      const d = 1.4;
      const z = d / 2;
      block(0, 0, 0, w, 2.7, d, body, M, 0.04);
      // stucco plinth and white trims
      block(0, 0, 0, w + 0.02, 0.22, d + 0.02, C.white, M, 0.02);
      slab(0, 1.28, z, w + 0.02, 0.08, 0.06, C.white);
      block(0, 2.62, 0, w + 0.1, 0.14, d + 0.1, C.white, M, 0.03);
      // door with fanlight, frame and steps
      const dx = -0.36;
      slab(dx, 0.22, z + 0.005, 0.54, 1.02, 0.04, C.white);
      block(dx, 0.24, z + 0.02, 0.4, 0.84, 0.04, door, S, 0.02);
      b.lit(WINDOW, lit(), () => b.add(L, SHAPE.cyl, dx, 1.1, z + 0.03, 0.4, 0.02, 0.4, Math.PI / 2, 0, 0, C.glass));
      slab(dx, 1.08, z + 0.04, 0.44, 0.03, 0.03, C.white);
      ball(dx + 0.12, 0.66, z + 0.06, 0.05, C.gold, S);
      slab(dx, 0, z + 0.14, 0.62, 0.12, 0.3, C.white);
      slab(dx, 0, z + 0.28, 0.72, 0.06, 0.3, C.white);
      // windows: one beside the door, two upstairs with a little iron balcony
      sash(0.34, 0.5, z, 0.44, 0.64);
      sash(-0.36, 1.56, z, 0.4, 0.74);
      sash(0.36, 1.56, z, 0.4, 0.74);
      slab(0, 1.46, z + 0.1, 1.26, 0.04, 0.12, C.iron, S);
      for (let i = 0; i < 9; i++) slab(-0.6 + i * 0.15, 1.46, z + 0.15, 0.022, 0.24, 0.022, C.iron, S);
      slab(0, 1.7, z + 0.15, 1.26, 0.03, 0.03, C.iron, S);
      // slate roof and a chimney stack with pots
      b.add(M, SHAPE.prism, 0, 2.98, 0, w + 0.06, 0.52, d - 0.1, 0, 0, 0, C.slate);
      const cx = chimneySide * (w / 2 - 0.2);
      block(cx, 2.6, -0.1, 0.34, 0.92, 0.5, C.brick, M, 0.03);
      slab(cx, 3.5, -0.1, 0.4, 0.06, 0.56, C.white);
      for (const pz of [-0.25, -0.1, 0.05]) post(cx, 3.56, pz, 0.1, 0.2, C.pot, M, SHAPE.cyl8);
    };

    // ── London plane tree ───────────────────────────────────────────────────
    const planeTree = (s = 1, seed = 0) => {
      const r = mulberry32(seed + 7);
      b.add(M, SHAPE.cyl8, 0, 1.1, 0, 0.36, 2.2, 0.36, 0, 0, 0, C.bark);
      for (let i = 0; i < 9; i++) {
        const a = r() * Math.PI * 2;
        const y = 0.25 + r() * 1.8;
        b.add(M, SHAPE.ball, Math.cos(a) * 0.15, y, Math.sin(a) * 0.15, 0.16, 0.26, 0.16, 0, a, 0, i % 2 ? C.barkDark : 0xa79e72);
      }
      b.add(M, SHAPE.cyl8, -0.32, 2.35, 0.05, 0.16, 1.0, 0.16, 0, 0, 0.75, C.bark);
      b.add(M, SHAPE.cyl8, 0.3, 2.45, -0.05, 0.15, 1.0, 0.15, 0.2, 0, -0.65, C.bark);
      const blobs = [[0, 3.05, 0, 1.55], [-0.95, 2.75, 0.2, 1.15], [0.95, 2.8, -0.1, 1.2], [0.3, 3.65, -0.15, 1.1], [-0.45, 3.5, 0.35, 1.0], [0.2, 2.55, 0.65, 1.0], [-0.2, 2.65, -0.7, 1.05]];
      blobs.forEach(([x, y, z, d], i) => b.add(M, SHAPE.sphere, x, y, z, d, d * 0.84, d, 0, 0, 0, C.leaf[i % 4]));
      for (const [x, y, z] of [[0.75, 2.2, 0.45], [-0.55, 2.15, 0.5], [0.1, 2.05, 0.75]]) {
        slab(x, y, z, 0.01, 0.2, 0.01, 0x6b5a3a);
        ball(x, y - 0.03, z, 0.09, 0x8a6a40);
      }
      if (s) return;
    };

    // ── bench and railings ──────────────────────────────────────────────────
    const bench = () => {
      for (const x of [-0.62, 0.62]) {
        slab(x, 0, 0, 0.07, 0.42, 0.5, C.iron, S);
        slab(x, 0.4, -0.2, 0.07, 0.5, 0.08, C.iron, S, 0);
      }
      for (let i = 0; i < 3; i++) slab(0, 0.42, -0.14 + i * 0.15, 1.42, 0.05, 0.12, 0xb07444);
      for (let i = 0; i < 3; i++) b.add(M, SHAPE.box, 0, 0.62 + i * 0.13, -0.24, 1.42, 0.09, 0.04, -0.15, 0, 0, 0xb07444);
    };
    const railings = (len) => {
      const n = Math.round(len / 0.15);
      slab(0, 0.12, 0, len, 0.04, 0.04, C.iron, S);
      slab(0, 0.62, 0, len, 0.04, 0.04, C.iron, S);
      for (let i = 0; i <= n; i++) {
        const x = -len / 2 + (i * len) / n;
        slab(x, 0, 0, 0.03, 0.72, 0.03, C.iron, S);
        b.add(S, SHAPE.cone4, x, 0.76, 0, 0.06, 0.1, 0.06, 0, 0, 0, C.gold);
      }
    };

    // ── bunting (waving) ────────────────────────────────────────────────────
    const tri = SHAPE.cone4;
    const bunting = (len, sag, n) => {
      slab(0, 0, 0, len, 0.015, 0.015, 0xeeeeee);
      const cols = [C.red, C.white, 0x2f5fb3];
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const x = -len / 2 + u * len;
        const y = -sag * 4 * u * (1 - u);
        b.wave(0, 0, 1, 2.2 + (i % 3) * 0.3, i * 0.9, 0.0001, () => b.add(M, tri, x, y - 0.12, 0, 0.18, -0.24, 0.02, 0, 0, 0, cols[i % 3]));
      }
    };

    // ── the island ───────────────────────────────────────────────────────────
    const near = (x, z) => Math.min(0.62, Math.hypot(x, z) / 9);

    // cobbled crescent
    const path = pathX(streetZ, -6.4, 7.0, 0.2);
    b.pin(0, 0, -2.86, 0.02, () => {
      b.add(M, ribbon(path, -HALF, HALF, 0.0, 0.1), 0, 0, 0, 1, 1, 1, 0, 0, 0, C.grout);
      b.add(M, ribbon(path, HALF, HALF + 0.14, 0.05, 0.12), 0, 0, 0, 1, 1, 1, 0, 0, 0, C.kerb);
      b.add(M, ribbon(path, -HALF - 0.14, -HALF, 0.05, 0.12), 0, 0, 0, 1, 1, 1, 0, 0, 0, C.kerb);
      b.add(M, ribbon(path, -HALF - 1.6, -HALF - 0.14, 0.02, 0.1), 0, 0, 0, 1, 1, 1, 0, 0, 0, C.paving);
      const cob = [0x8f8a84, 0x9e978d, 0x7f7c7b, 0xa8a095, 0x8b8379];
      for (const d of [-0.42, -0.14, 0.14, 0.42]) {
        let s = d * 0.5;
        for (let x = -6.4; x < 7; ) {
          const z = streetZ(x);
          const dz = 0.148 * x;
          const l = Math.hypot(1, dz);
          const px = x - (dz / l) * d;
          const pz = z + (1 / l) * d;
          if (islandR(px, pz) < 0.95) {
            const y = groundY(px, pz);
            b.add(M, SHAPE.box, px, y + 0.02, pz, 0.25, 0.07, 0.22, 0, -Math.atan(dz) + (rng() - 0.5) * 0.12, 0, cob[(rng() * cob.length) | 0]);
          }
          s += 0.29;
          x += 0.29 / l;
        }
      }
      // paving joints on the pavement
      for (let x = -3.4; x < 3.6; x += 0.62) {
        const z = streetZ(x) - HALF - 0.85;
        const dz = 0.148 * x;
        if (islandR(x, z) < 0.93) b.add(M, SHAPE.box, x, groundY(x, z) + 0.02, z, 0.025, 0.012, 1.4, 0, -Math.atan(dz), 0, 0xb4ae a2);
      }
    });
  }
}
