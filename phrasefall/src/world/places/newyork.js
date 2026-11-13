/**
 * New York — an avenue behind the dais lined with brownstones (stoops and cornices), a brick
 * walk-up with a fire escape and a corner deli; a yellow taxi, a hot-dog cart, a fire hydrant,
 * a subway entrance with green globe lamps, crook-necked street lamps, a traffic light and a
 * steaming manhole. Distant chunks: an Art Deco tower, glass towers, a suspension bridge with
 * arched stone towers, a little park and rooftop water towers. All shapes are generic.
 */
import { mulberry32 } from '../../core/utils.js';
import { Diorama, SHAPE, rbox, groundY, islandR, ribbon, pathX, addLand, tools } from './kit.js';
import { KIND } from '../seasons/shader.js';

const M = 'matte';
const S = 'satin';
const L = 'glow';

const C = {
  brown: 0x8b5a43,
  brown2: 0x7a4b39,
  brick: 0xa9503a,
  brickDark: 0x8c4231,
  cornice: 0x4b3a33,
  trim: 0xeee3cf,
  iron: 0x26292f,
  green: 0x2f7d4a,
  asphalt: 0x4a4d55,
  line: 0xf2c230,
  white: 0xf4f2ec,
  walk: 0xcfccc4,
  kerb: 0xb8b6ae,
  yellow: 0xffc21a,
  tyre: 0x232429,
  chrome: 0xc9ced6,
  glass: 0x7d93ad,
  glassDark: 0x34445a,
  steel: 0xd6dce4,
  stone: 0xe9dcc0,
  stoneDark: 0xcdbb98,
  wood: 0x9a6a45,
  woodDark: 0x5b4130,
  leaf: [0x9ccc5a, 0x86bf4d, 0xb2d968, 0x79b247],
  water: 0x3f86b8,
  lamp: 0x3b4a44,
};
const WARM = 0xffc46b;
const WINDOW = 0xe0a85c;
const COOL = 0xbfe0ff;

/** The avenue's centre line behind the dais, and its half width; the steaming manhole's x. */
const streetZ = (x) => -2.95 + 0.045 * x * x;
const HALF = 0.62;
const MH = -2.0;

/** A rooftop wooden water tower on stilts (local frame, base at y). */
function waterTower(b, x, y, z, s = 1) {
  const { part, slab, post, ball } = tools(b);
  b.at(x, y, z, 0, s, () => {
    for (const [lx, lz] of [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]) post(lx, 0, lz, 0.06, 0.55, 0x3a3d44);
    slab(0, 0.5, 0, 0.8, 0.05, 0.8, 0x3a3d44);
    post(0, 0.55, 0, 0.78, 0.75, C.wood, M, SHAPE.cyl);
    for (const y of [0.68, 0.95, 1.2]) post(0, y, 0, 0.8, 0.03, 0x4a3a30, M, SHAPE.cyl);
    part(M, SHAPE.cone, 0, 1.48, 0, 0.86, 0.42, 0.86, C.woodDark);
    ball(0, 1.7, 0, 0.07, C.woodDark);
  });
}

export class NewYork extends Diorama {
  constructor(island, quality) {
    super(island, quality);
    this.rng = mulberry32(1898);
    this.steamT = 0;
    this.build();
    this.far();
    this.finish();
  }

  build() {
    const b = this.b;
    const rng = this.rng;
    const { part, block, slab, post, ball } = tools(b);
    const lit = () => 0.12 + rng() * 0.95;
    const at = (x, z) => groundY(x, z);
    const near = (x, z) => Math.min(0.62, Math.hypot(x, z) / 9);

    /** a tall window with a cream lintel and sill, on a wall facing +z (plane at z), bottom at y */
    const win = (x, y, z, w, h, trim = C.trim) => {
      slab(x, y - 0.05, z + 0.03, w + 0.12, 0.05, 0.08, trim);
      slab(x, y + h, z + 0.03, w + 0.14, 0.09, 0.08, trim);
      slab(x, y - 0.01, z + 0.01, w + 0.06, h + 0.02, 0.03, 0xf2ece0);
      b.lit(WINDOW, lit(), () => slab(x, y + 0.02, z + 0.025, w - 0.04, h - 0.04, 0.02, C.glass, L));
      slab(x, y + h * 0.55, z + 0.04, w - 0.04, 0.03, 0.02, 0xf2ece0);
    };

    // ── brownstone with a stoop ─────────────────────────────────────────────
    const brownstone = (body, door) => {
      const w = 1.5;
      const d = 1.5;
      const z = d / 2;
      block(0, 0, 0, w, 3.2, d, body, M, 0.03);
      block(0, 0, 0, w + 0.03, 0.55, d + 0.03, 0x6e4636, M, 0.02);
      // heavy cornice
      block(0, 3.15, 0, w + 0.16, 0.22, d + 0.14, C.cornice, M, 0.03);
      for (let i = 0; i < 6; i++) slab(-0.62 + i * 0.25, 3.02, z + 0.04, 0.07, 0.14, 0.08, C.cornice);
      // stoop: steps up to the parlour door, with iron railings
      const sx = -0.36;
      for (let i = 0; i < 6; i++) slab(sx, 0, z + 0.62 - i * 0.1, 0.56, 0.12 + i * 0.1, 0.12, 0x7a5040);
      slab(sx, 0, z + 0.06, 0.6, 0.7, 0.14, 0x7a5040);
      for (const s of [-1, 1]) {
        part(M, SHAPE.box, sx + s * 0.31, 0.62, z + 0.38, 0.04, 0.04, 0.78, C.iron, -0.62, 0, 0);
        post(sx + s * 0.31, 0, z + 0.7, 0.07, 0.42, C.iron);
        ball(sx + s * 0.31, 0.45, z + 0.7, 0.09, C.iron);
      }
      slab(sx, 0.7, z + 0.005, 0.5, 0.95, 0.04, C.trim);
      block(sx, 0.72, z + 0.02, 0.38, 0.8, 0.04, door, S, 0.02);
      b.lit(WINDOW, lit(), () => slab(sx, 1.55, z + 0.025, 0.38, 0.1, 0.02, C.glass, L));
      win(0.36, 0.85, z, 0.36, 0.72);
      for (const y of [1.8, 2.5]) for (const x of [-0.36, 0.36]) win(x, y, z, 0.36, 0.56);
      // a garden-level window under the stoop
      b.lit(WINDOW, lit(), () => slab(0.36, 0.12, z + 0.025, 0.34, 0.3, 0.02, C.glassDark, L));
    };

    // ── brick walk-up with a fire escape ────────────────────────────────────
    const walkUp = () => {
      const w = 1.5;
      const d = 1.5;
      const z = d / 2;
      block(0, 0, 0, w, 3.3, d, C.brick, M, 0.03);
      for (let i = 0; i < 6; i++) slab(0, 0.5 + i * 0.5, z + 0.005, w + 0.01, 0.03, 0.02, C.brickDark);
      block(0, 3.25, 0, w + 0.12, 0.16, d + 0.1, C.trim, M, 0.02);
      // shop front at street level
      block(0, 0, z - 0.02, w, 0.95, 0.1, 0x2f5d50, S, 0.02);
      b.lit(0xffd59a, 0.15, () => slab(0.2, 0.18, z + 0.04, 0.8, 0.62, 0.02, 0xa6c4d6, L));
      block(-0.52, 0.06, z + 0.04, 0.32, 0.8, 0.03, 0x1f3a33, S, 0.02);
      for (const y of [1.25, 1.95, 2.65]) for (const x of [-0.36, 0.36]) win(x, y, z, 0.34, 0.5);
      // the fire escape: landings, rails and ladders zig-zagging down the front
      for (const y of [1.18, 1.88, 2.58]) {
        slab(0, y - 0.04, z + 0.22, 1.25, 0.04, 0.4, C.iron, S);
        slab(0, y + 0.36, z + 0.41, 1.25, 0.03, 0.03, C.iron, S);
        for (let i = 0; i < 9; i++) slab(-0.6 + i * 0.15, y, z + 0.41, 0.02, 0.36, 0.02, C.iron, S);
        part(S, SHAPE.box, 0.15, y - 0.36, z + 0.26, 0.04, 0.82, 0.04, C.iron, 0, 0, 0.75);
      }
    };

    // ── corner deli with an awning ──────────────────────────────────────────
    const deli = () => {
      const w = 1.5;
      const d = 1.4;
      const z = d / 2;
      block(0, 0, 0, w, 2.35, d, 0xd9cfbd, M, 0.03);
      block(0, 2.3, 0, w + 0.1, 0.14, d + 0.1, C.cornice, M, 0.02);
      b.lit(0xffe1a8, 0.1, () => slab(0.12, 0.12, z + 0.02, 1.0, 0.72, 0.02, 0xa9c6d8, L));
      block(-0.55, 0.05, z + 0.02, 0.3, 0.86, 0.03, 0x3b2f2a, S, 0.02);
      // a striped awning
      for (let i = 0; i < 8; i++) part(M, SHAPE.box, -0.66 + i * 0.19, 1.14, z + 0.28, 0.19, 0.04, 0.6, i % 2 ? C.white : 0x2f8a52, 0.42, 0, 0);
      slab(0, 1.0, z + 0.53, 1.52, 0.12, 0.02, 0x2f8a52);
      // a lit sign panel (no words — just colour)
      b.lit(0xff5a4a, 0.2, () => block(0, 1.42, z + 0.02, 1.1, 0.3, 0.04, 0xd8342e, L, 0.03));
      for (const x of [-0.36, 0.36]) win(x, 1.82, z, 0.34, 0.36);
      waterTower(b, 0.25, 2.44, -0.2, 0.95);
    };

    // ── street furniture ────────────────────────────────────────────────────
    const nyLamp = (dir = 1) => {
      post(0, 0, 0, 0.26, 0.3, C.lamp, S);
      post(0, 0.3, 0, 0.12, 2.0, C.lamp, S);
      post(0, 0.55, 0, 0.18, 0.08, C.lamp, S);
      // the crook: a short arc of segments
      for (let i = 0; i < 5; i++) {
        const a = (i / 4) * Math.PI * 0.85;
        part(S, SHAPE.cyl6, dir * (0.25 - Math.cos(a) * 0.25), 2.3 + Math.sin(a) * 0.25, 0, 0.07, 0.17, 0.07, C.lamp, 0, 0, -dir * a);
      }
      b.add(S, SHAPE.cone8, dir * 0.48, 2.36, 0, 0.32, 0.18, 0.32, 0, 0, 0, C.lamp);
      b.lit(WARM, -1, () => part(L, SHAPE.sphere, dir * 0.48, 2.2, 0, 0.24, 0.26, 0.24, 0x5a4630));
      this.halo(dir * 0.48, 2.2, 0, 2.5);
    };
    const hydrant = () => {
      post(0, 0, 0, 0.36, 0.08, 0xb22a26, S, SHAPE.cyl);
      post(0, 0.08, 0, 0.28, 0.5, 0xd8342e, S, SHAPE.cyl);
      post(0, 0.55, 0, 0.36, 0.07, 0xd8342e, S, SHAPE.cyl);
      b.add(S, SHAPE.dome, 0, 0.62, 0, 0.3, 0.26, 0.3, 0, 0, 0, C.chrome);
      post(0, 0.74, 0, 0.08, 0.08, C.chrome, S);
      for (const s of [-1, 1]) part(S, SHAPE.cyl8, s * 0.2, 0.38, 0, 0.13, 0.14, 0.13, C.chrome, 0, 0, Math.PI / 2);
      part(S, SHAPE.cyl8, 0, 0.36, 0.18, 0.16, 0.1, 0.16, C.chrome, Math.PI / 2, 0, 0);
    };
    const hotDogCart = () => {
      for (const x of [-0.42, 0.42]) part(M, SHAPE.cyl, x, 0.2, 0.36, 0.4, 0.08, 0.4, C.tyre, Math.PI / 2, 0, 0);
      block(0, 0.24, 0, 1.2, 0.62, 0.7, C.steel, S, 0.06);
      block(0, 0.86, 0, 1.24, 0.06, 0.74, 0xbfc5ce, S, 0.02);
      b.lit(0xffd84a, 0.25, () => slab(0, 0.36, 0.355, 0.9, 0.36, 0.02, 0xffc93a, L));
      slab(0, 0.45, 0.37, 0.5, 0.14, 0.02, 0xd8342e);
      slab(-0.75, 0.62, 0, 0.3, 0.03, 0.04, C.chrome, S);
      // a striped umbrella
      post(0.1, 0.9, -0.05, 0.05, 1.25, C.chrome, S);
      for (let i = 0; i < 8; i++) part(M, SHAPE.wedge, 0.1, 2.06, -0.05, 0.9, 0.36, 0.9, i % 2 ? 0xffd23f : 0x2f6fd6, 0, (i * Math.PI) / 4, 0);
      ball(0.1, 2.44, -0.05, 0.09, 0x2f6fd6);
      // a couple of buns on top
      for (const x of [-0.3, -0.05]) part(M, SHAPE.ball, x, 0.93, 0.1, 0.22, 0.07, 0.08, 0xe0a15a);
    };
    const taxi = () => {
      const w = (x, z) => {
        part(M, SHAPE.cyl, x, 0.2, z, 0.4, 0.16, 0.4, C.tyre, Math.PI / 2, 0, 0);
        part(S, SHAPE.cyl8, x, 0.2, z + Math.sign(z) * 0.085, 0.2, 0.02, 0.2, C.chrome, Math.PI / 2, 0, 0);
      };
      for (const x of [-0.66, 0.68]) for (const z of [-0.43, 0.43]) w(x, z);
      block(0, 0.16, 0, 2.05, 0.46, 0.94, C.yellow, S, 0.14);
      block(-0.08, 0.58, 0, 1.15, 0.44, 0.86, C.yellow, S, 0.13);
      for (const z of [-1, 1]) {
        block(0.2, 0.68, z * 0.432, 0.42, 0.26, 0.02, C.glassDark, S, 0.01);
        block(-0.34, 0.68, z * 0.432, 0.42, 0.26, 0.02, C.glassDark, S, 0.01);
        // the checker band
        for (let i = 0; i < 10; i++) slab(-0.9 + i * 0.2, 0.42, z * 0.475, 0.1, 0.05, 0.02, i % 2 ? C.white : 0x1e1f24);
      }
      part(S, rbox(0.03, 0.3, 0.72, 0.01), 0.48, 0.76, 0, 1, 1, 1, C.glassDark, 0, 0, -0.5);
      part(S, rbox(0.03, 0.3, 0.72, 0.01), -0.65, 0.76, 0, 1, 1, 1, C.glassDark, 0, 0, 0.5);
      slab(1.02, 0.14, 0, 0.06, 0.08, 0.92, C.chrome, S);
      slab(-1.02, 0.14, 0, 0.06, 0.08, 0.92, C.chrome, S);
      for (const z of [-0.3, 0.3]) {
        b.lit(0xfff4dc, 0.35, () => part(L, SHAPE.cyl, 1.02, 0.4, z, 0.14, 0.04, 0.14, 0xf4f1e6, 0, 0, Math.PI / 2));
        b.lit(0xff3b30, 0.35, () => slab(-1.03, 0.38, z, 0.03, 0.09, 0.12, 0xb3202a, L));
      }
      b.lit(0xfff1c2, -1, () => block(-0.08, 1.02, 0, 0.42, 0.14, 0.18, 0xfff8e0, L, 0.03));
    };
    const trafficLight = () => {
      post(0, 0, 0, 0.16, 2.6, 0x8b8f96, S);
      part(S, SHAPE.cyl8, 0.55, 2.45, 0, 0.08, 1.1, 0.08, 0x8b8f96, 0, 0, Math.PI / 2);
      block(1.0, 1.7, 0, 0.26, 0.74, 0.24, 0xf2c230, S, 0.04);
      const cols = [0xff3b30, 0xffc21a, 0x3ddc84];
      cols.forEach((c, i) => {
        b.lit(c, i === 2 ? -1 : 0.6, () => part(L, SHAPE.cyl, 1.0, 2.25 - i * 0.22, 0.125, 0.15, 0.03, 0.15, i === 2 ? 0x3ddc84 : 0x3a3a3a, Math.PI / 2, 0, 0));
        slab(1.0, 2.31 - i * 0.22, 0.17, 0.18, 0.03, 0.08, 0x2a2b30);
      });
    };
    const subway = () => {
      // a stairwell going down into the island: a dark opening with steps, open green railings
      // on three sides and a green globe lamp on each front post
      block(0, -0.03, 0, 1.24, 0.06, 1.62, 0xbab7ae, M, 0.02);
      slab(0, -0.01, 0.02, 0.92, 0.03, 1.4, 0x22242a);
      for (let i = 0; i < 5; i++) slab(0, 0.01, 0.58 - i * 0.26, 0.88, 0.012, 0.07, 0x8d8b85);
      const rail = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const ry = -Math.atan2(z1 - z0, x1 - x0);
        b.at((x0 + x1) / 2, 0, (z0 + z1) / 2, ry, 1, () => {
          slab(0, 0.66, 0, len, 0.05, 0.05, C.green, S);
          slab(0, 0.3, 0, len, 0.03, 0.03, C.green, S);
          const n = Math.round(len / 0.17);
          for (let i = 1; i < n; i++) slab(-len / 2 + (i * len) / n, 0, 0, 0.025, 0.66, 0.025, C.green, S);
        });
      };
      rail(-0.58, 0.75, -0.58, -0.78);
      rail(0.58, 0.75, 0.58, -0.78);
      rail(-0.58, -0.78, 0.58, -0.78);
      for (const s of [-1, 1]) {
        post(s * 0.58, 0, 0.75, 0.09, 1.25, C.green, S);
        post(s * 0.58, 1.2, 0.75, 0.16, 0.06, C.green, S);
        b.lit(0x7dff9a, -1, () => ball(s * 0.58, 1.42, 0.75, 0.32, 0x5fd17d, L));
        this.halo(s * 0.58, 1.42, 0.75, 1.5, 0x7dff9a);
      }
      for (const [x, z] of [[-0.58, -0.78], [0.58, -0.78]]) post(x, 0, z, 0.07, 0.72, C.green, S);
    };
    const manhole = (x, z) => {
      post(x, at(x, z) + 0.035, z, 0.56, 0.02, 0x3a3c41, M, SHAPE.cyl);
      for (let i = 0; i < 4; i++) slab(x, at(x, z) + 0.05, z - 0.18 + i * 0.12, 0.4, 0.008, 0.03, 0x2c2e33);
    };
    const locust = (seed) => {
      const r = mulberry32(seed);
      // tree pit with a low guard rail
      slab(0, -0.02, 0, 0.92, 0.06, 0.92, 0x7a5c44);
      for (const [x, z, ry] of [[0, 0.46, 0], [0, -0.46, 0], [0.46, 0, Math.PI / 2], [-0.46, 0, Math.PI / 2]]) slab(x, 0.2, z, 0.92, 0.025, 0.025, C.iron, S, ry);
      for (const [x, z] of [[-0.46, -0.46], [0.46, -0.46], [0.46, 0.46], [-0.46, 0.46]]) slab(x, 0, z, 0.03, 0.24, 0.03, C.iron, S);
      post(0, 0, 0, 0.18, 2.0, 0x6b5848);
      part(M, SHAPE.cyl6, 0.25, 1.9, 0, 0.08, 0.8, 0.08, 0x6b5848, 0, 0, -0.6);
      part(M, SHAPE.cyl6, -0.22, 2.0, 0.05, 0.08, 0.7, 0.08, 0x6b5848, 0, 0, 0.6);
      for (let i = 0; i < 9; i++) {
        const a = r() * Math.PI * 2;
        const rr = 0.3 + r() * 0.55;
        b.kind(KIND.FOLIAGE, () => part(M, SHAPE.sphere, Math.cos(a) * rr, 2.3 + r() * 0.8, Math.sin(a) * rr * 0.8, 0.75 + r() * 0.35, 0.6, 0.75, C.leaf[i % 4]));
      }
    };

    // ── the avenue ──────────────────────────────────────────────────────────
    const path = pathX(streetZ, -6.4, 7.0, 0.2);
    b.pin(0, at(0, -2.95), -2.95, 0.0, () => {
      part(M, ribbon(path, -HALF, HALF, 0.0, 0.1), 0, 0, 0, 1, 1, 1, C.asphalt);
      part(M, ribbon(path, HALF, HALF + 0.16, 0.06, 0.13), 0, 0, 0, 1, 1, 1, C.kerb);
      part(M, ribbon(path, -HALF - 0.16, -HALF, 0.06, 0.13), 0, 0, 0, 1, 1, 1, C.kerb);
      part(M, ribbon(path, -HALF - 1.75, -HALF - 0.16, 0.04, 0.1), 0, 0, 0, 1, 1, 1, C.walk);
      part(M, ribbon(path, HALF + 0.16, HALF + 0.55, 0.04, 0.1), 0, 0, 0, 1, 1, 1, C.walk);
      // double yellow centre line, dashed lane lines and a crosswalk
      for (const d of [-0.035, 0.035]) part(M, ribbon(path, d - 0.018, d + 0.018, 0.012, 0.02, 0.96), 0, 0, 0, 1, 1, 1, C.line);
      for (let x = -3.75; x < -2.75; x += 0.18) {
        const z = streetZ(x);
        const dz = 0.09 * x;
        if (islandR(x, z) < 0.93) part(M, SHAPE.box, x, at(x, z) + 0.012, z, 0.09, 0.012, HALF * 1.85, C.white, 0, -Math.atan(dz), 0);
      }
      // sidewalk joints
      for (let x = -3.4; x < 3.6; x += 0.58) {
        const dz = 0.09 * x;
        const l = Math.hypot(1, dz);
        const d = -HALF - 0.95;
        const px = x - (dz / l) * d;
        const pz = streetZ(x) + d / l;
        if (islandR(px, pz) < 0.93) part(M, SHAPE.box, px, at(px, pz) + 0.045, pz, 0.02, 0.012, 1.55, 0xb2afa7, 0, -Math.atan(dz), 0);
      }
      manhole(MH, streetZ(MH) + 0.18);
    });
    // steam puffing out of the manhole (kept low: it stays under the falling cards)
    {
      const x = MH;
      const z = streetZ(MH) + 0.18;
      const y = at(x, z) + 0.12;
      b.pin(x, y, z, 0.2, () => {
        for (let i = 0; i < 4; i++) {
          const ox = (rng() - 0.5) * 0.18;
          b.rise(x + ox, y, z, 0.34, i / 4, 1.25, () => part(M, SHAPE.sphere, x + ox, y, z, 0.5, 0.42, 0.5, 0xf2f2f0));
        }
      });
    }
    this.steam = [MH, at(MH, streetZ(MH) + 0.18) + 0.08, streetZ(MH) + 0.18];

    // the block behind it
    const row = [
      [-2.2, 0.36, () => brownstone(C.brown, 0x2d4a3e)],
      [-0.74, 0.12, () => brownstone(C.brown2, 0x6b2a2a)],
      [0.74, -0.1, walkUp],
      [2.16, -0.32, deli],
    ];
    for (const [x, ry, fn] of row) {
      const z = streetZ(x) - HALF - 1.0;
      b.prop(x, at(x, z), z, ry, 0.72, near(x, z), fn);
    }

    // a yellow taxi on the avenue
    {
      const x = 2.45;
      const z = streetZ(x) + 0.12;
      b.prop(x, at(x, z), z, Math.PI - Math.atan(0.09 * x), 0.86, near(x, z), taxi);
    }

    // street furniture
    b.prop(-2.95, at(-2.95, -1.0), -1.0, 0, 1, near(-2.95, -1), () => nyLamp(1));
    b.prop(2.95, at(2.95, -1.0), -1.0, 0, 1, near(2.95, -1), () => nyLamp(-1));
    b.prop(-4.25, at(-4.25, 1.25), 1.25, 0.5, 0.95, near(-4.25, 1.25), subway);
    b.prop(4.3, at(4.3, -0.45), -0.45, -0.5, 0.95, near(4.3, -0.45), hotDogCart);
    b.prop(3.15, at(3.15, 1.15), 1.15, -0.4, 0.95, near(3.15, 1.15), hydrant);
    b.prop(-3.9, at(-3.9, -1.65), -1.65, 0.25, 0.95, near(-3.9, -1.65), trafficLight);
    for (const [x, z, s, seed] of [[-5.0, -0.5, 1.0, 4], [5.05, 1.05, 0.95, 9]]) b.prop(x, at(x, z), z, 0, s, near(x, z), () => locust(seed));

    // the turf: no grass on the avenue, the sidewalks or under the buildings
    this.ground = {
      keep: (x, z) => z > streetZ(x) + HALF + 0.75,
    };
  }

  // ── distant chunks ────────────────────────────────────────────────────────
  far() {
    const b = this.b;
    const rng = this.rng;
    const { part, block, slab, post, ball } = tools(b);
    const paved = (c, x, y, z, r) => c.setHex(Math.hypot(x, z) / r > 0.86 || y < -0.06 ? 0x6fc15a : (Math.floor(x * 1.4) + Math.floor(z * 1.4)) % 2 ? 0xc9c6bf : 0xbdbab2);

    /** windows on the four sides of a tower: cols × rows on each face, from y0 to y1 */
    const windows = (w, d, y0, y1, cols, rows0, col = C.glass, glow = WINDOW, faces = [0, 1, 3]) => {
      const rows = this.low ? Math.ceil(rows0 / 2) : rows0;
      const ww = (w / cols) * 0.55;
      const hh = ((y1 - y0) / rows) * 0.55;
      for (const f of faces) {
        const ry = (f * Math.PI) / 2;
        const span = f % 2 ? d : w;
        const n = f % 2 ? Math.max(1, Math.round((cols * d) / w)) : cols;
        b.at(0, 0, 0, ry, 1, () => {
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < n; c++) {
              const x = -span / 2 + ((c + 0.5) * span) / n;
              const y = y0 + ((r + 0.5) * (y1 - y0)) / rows;
              b.lit(glow, 0.1 + rng() * 1.05, () => part(L, SHAPE.quad, x, y, (f % 2 ? w : d) / 2 + 0.012, ww, hh, 1, col));
            }
          }
        });
      }
    };

    // A ── an Art Deco tower: setbacks, piers and a stepped steel crown with a spire
    b.chunk(14, 0.2, -31, -0.3, 0.72, { delay: 0.86, phase: 0.6, amp: 0.3 }, () => {
      addLand(b, 3.6, { top: paved });
      const tiers = [
        [2.6, 2.6, 0, 6.0],
        [2.0, 2.0, 6.0, 9.2],
        [1.5, 1.5, 9.2, 11.6],
        [1.05, 1.05, 11.6, 13.2],
      ];
      for (const [w, d, y0, y1] of tiers) {
        block(0, y0, 0, w, y1 - y0, d, C.stone, M, 0.04);
        for (const s of [-1, 1]) {
          slab(s * (w / 2 - 0.03), y0, d / 2 + 0.01, 0.12, y1 - y0, 0.05, C.stoneDark);
          slab(0, y0, d / 2 + 0.01, 0.1, y1 - y0, 0.05, C.stoneDark);
        }
        block(0, y1 - 0.12, 0, w + 0.12, 0.14, d + 0.12, C.stoneDark, M, 0.02);
        windows(w, d, y0 + 0.3, y1 - 0.3, Math.round(w * 2.2), Math.round((y1 - y0) * 1.6), 0x7a8fa8);
      }
      // stepped crown in steel, lit at night, and the spire
      for (let i = 0; i < 4; i++) block(0, 13.2 + i * 0.42, 0, 0.9 - i * 0.2, 0.42, 0.9 - i * 0.2, C.steel, S, 0.04);
      for (let i = 0; i < 4; i++) b.lit(COOL, 0.3, () => slab(0, 13.3 + i * 0.42, 0.46 - i * 0.1, 0.5 - i * 0.12, 0.2, 0.02, 0xd8e6f2, L));
      part(S, SHAPE.cone8, 0, 15.9, 0, 0.18, 1.7, 0.18, C.steel);
      this.halo(0, 14.2, 0.6, 4.0, 0xcfe6ff);
      // a lower neighbour with a water tower
      block(-2.1, 0, 0.6, 1.3, 2.6, 1.2, C.brick, M, 0.03);
      b.at(-2.1, 0, 0.6, 0, 1, () => windows(1.3, 1.2, 0.3, 2.3, 3, 3, C.glassDark, WINDOW, [0, 3]));
      waterTower(b, -2.1, 2.6, 0.6, 1.1);
    });

    // B ── glass towers
    b.chunk(25, 2.2, -46, -0.2, 0.75, { delay: 0.93, phase: 2.4, amp: 0.35 }, () => {
      addLand(b, 3.6, { top: paved });
      const towers = [
        [-1.2, 0.2, 1.6, 1.6, 12.5, 0x6fa3d6],
        [0.7, -0.6, 1.8, 1.4, 9.5, 0x5a8cc2],
        [1.6, 1.0, 1.2, 1.2, 7.0, 0x83b7e0],
      ];
      for (const [x, z, w, d, h, col] of towers) {
        b.at(x, 0, z, 0, 1, () => {
          block(0, 0, 0, w, h, d, col, S, 0.04);
          for (let y = 0.6; y < h - 0.2; y += 0.6) slab(0, y, 0, w + 0.02, 0.05, d + 0.02, 0xe6eef6, S);
          windows(w, d, 0.3, h - 0.3, Math.round(w * 2.4), Math.round(h * 1.6), 0x9cc0e0, COOL);
          block(0, h, 0, w * 0.6, 0.35, d * 0.6, 0x9aa8b6, M, 0.03);
        });
      }
      this.halo(-1.2, 12.9, 0.2, 2.2, 0xff6a5a);
      b.lit(0xff3b30, -1, () => ball(-1.2, 12.95, 0.2, 0.18, 0xff5a4a, L));
    });

    // C ── suspension bridge with arched stone towers over the river; a taxi rolls across
    b.chunk(-15, -1.5, -27, 0.1, 1, { delay: 0.8, phase: 4.1, amp: 0.28 }, () => {
      addLand(b, 3.8, {
        depthScale: 0.7,
        top: (c, x, y, z) => c.setHex(y < -0.05 ? 0x6fc15a : Math.abs(z) < 1.5 && Math.abs(x) < 3.0 ? (Math.sin(x * 2 + z * 5) > 0.7 ? 0x63a6cf : C.water) : 0x7ed06a),
      });
      const deckY = 1.15;
      block(0, deckY - 0.12, 0, 6.6, 0.16, 0.8, 0x6b6f78, M, 0.03);
      slab(0, deckY + 0.04, 0.38, 6.6, 0.12, 0.03, 0x8a8f99);
      slab(0, deckY + 0.04, -0.38, 6.6, 0.12, 0.03, 0x8a8f99);
      for (const s of [-1, 1]) {
        b.at(s * 1.9, 0, 0, 0, 1, () => {
          block(0, -0.3, 0, 0.8, 0.5, 1.1, 0xbfae8c, M, 0.03);
          // two legs and pointed double arches
          for (const z of [-0.36, 0.36]) block(0, 0.2, z, 0.62, 3.6, 0.3, 0xc9b896, M, 0.03);
          block(0, 2.6, 0, 0.62, 1.2, 1.02, 0xc9b896, M, 0.03);
          block(0, 3.75, 0, 0.7, 0.12, 1.1, 0xb5a37f, M, 0.02);
          for (const z of [-0.18, 0.18]) part(M, SHAPE.cone4, 0, 2.6, z, 0.64, 0.5, 0.2, 0xc9b896, Math.PI, 0, 0);
          b.lit(WARM, 0.5, () => ball(0, 3.95, 0, 0.12, 0xfff0c0, L));
        });
      }
      // main cables (sagging between the towers) and hangers
      for (const z of [-0.42, 0.42]) {
        const pts = [];
        for (let i = 0; i <= 16; i++) {
          const x = -3.3 + (i / 16) * 6.6;
          const ax = Math.abs(x);
          const y = ax > 1.9 ? 3.8 - (ax - 1.9) * 1.7 : 1.7 + ((3.8 - 1.7) * x * x) / (1.9 * 1.9);
          pts.push([x, Math.max(deckY + 0.1, y)]);
        }
        for (let i = 0; i < 16; i++) {
          const [x0, y0] = pts[i];
          const [x1, y1] = pts[i + 1];
          part(M, SHAPE.cyl6, (x0 + x1) / 2, (y0 + y1) / 2, z, 0.05, Math.hypot(x1 - x0, y1 - y0) + 0.02, 0.05, 0x8a8f99, 0, 0, Math.atan2(-(x1 - x0), y1 - y0));
          if (i % 2 === 0 && Math.abs(x0) < 3) part(M, SHAPE.cyl6, x0, (y0 + deckY) / 2, z, 0.02, Math.max(0.02, y0 - deckY), 0.02, 0x8a8f99);
        }
      }
      // the taxi rolling across
      b.slide(2.2, 0, 0, 0.18, 0, () => b.at(0, deckY + 0.05, 0.16, 0, 0.32, () => {
        block(0, 0.1, 0, 2.0, 0.5, 0.9, C.yellow, S, 0.14);
        block(-0.08, 0.55, 0, 1.1, 0.42, 0.84, C.yellow, S, 0.12);
      }));
      // a ferry on the river
      b.slide(0, 0, 0.9, 0.12, 1.5, () => b.at(0.9, 0.02, 0, Math.PI / 2, 0.5, () => {
        block(0, -0.1, 0, 1.6, 0.36, 0.6, 0xf2a33a, S, 0.14);
        block(0, 0.24, 0, 1.0, 0.32, 0.5, C.white, M, 0.05);
      }));
    });

    // D ── a skyline cluster far to the left, with a second Deco crown
    b.chunk(-26, 4, -50, 0.35, 0.8, { delay: 0.96, phase: 1.3, amp: 0.4 }, () => {
      addLand(b, 3.8, { top: paved });
      const t = [
        [-1.4, 0.4, 1.4, 1.4, 8.0, 0xd9c7a6],
        [0.4, -0.5, 1.6, 1.6, 11.0, 0x7aa6d4],
        [1.7, 0.8, 1.2, 1.2, 6.0, 0xb4644c],
        [-0.3, 1.4, 1.1, 1.0, 4.2, 0xe4d5b8],
      ];
      for (const [x, z, w, d, h, col] of t) {
        b.at(x, 0, z, 0, 1, () => {
          block(0, 0, 0, w, h, d, col, M, 0.04);
          windows(w, d, 0.3, h - 0.3, Math.round(w * 2.2), Math.round(h * 1.5), 0x7f93ab);
        });
      }
      b.at(-1.4, 8.0, 0.4, 0, 1, () => {
        for (let i = 0; i < 3; i++) block(0, i * 0.4, 0, 1.1 - i * 0.3, 0.4, 1.1 - i * 0.3, C.steel, S, 0.03);
        part(S, SHAPE.cone8, 0, 2.0, 0, 0.16, 1.2, 0.16, C.steel);
      });
      waterTower(b, 1.7, 6.0, 0.8, 0.9);
    });

    // E ── a little park: trees, a pond, a lamp
    b.chunk(-9, -0.8, -19, 0.2, 1, { delay: 0.74, phase: 3.0, amp: 0.25 }, () => {
      addLand(b, 2.6, { top: (c, x, y, z) => c.setHex(Math.hypot(x - 0.5, z + 0.2) < 0.8 ? (y > -0.02 ? 0x5ea9d6 : 0x6fc15a) : y < -0.06 ? 0x5fb455 : 0x7ed06a) });
      for (const [x, z, s] of [[-1.2, -0.5, 1], [-0.4, 0.9, 0.8], [1.5, -0.9, 0.9]]) {
        post(x, 0, z, 0.16 * s, 1.2 * s, 0x6b5848);
        b.kind(KIND.FOLIAGE, () => {
          for (let i = 0; i < 4; i++) part(M, SHAPE.sphere, x + (i - 1.5) * 0.25 * s, (1.4 + (i % 2) * 0.3) * s, z + ((i % 3) - 1) * 0.15, 0.85 * s, 0.75 * s, 0.85 * s, C.leaf[i]);
        });
      }
      post(1.3, 0, 0.7, 0.06, 1.0, C.lamp, S);
      b.lit(WARM, -1, () => ball(1.3, 1.05, 0.7, 0.16, 0xfff0c0, L));
      // a flag that waves
      post(-1.9, 0, 0.5, 0.05, 1.9, 0xd6dce4, S);
      b.at(-1.9, 1.88, 0.5, 0, 1, () =>
        b.wave({ dir: [0, 0, 1], along: [1, 0, 0], len: 0.7, freq: 3.2, phase: 0 }, () => {
          for (let i = 0; i < 5; i++) part(M, SHAPE.quad, 0.35, -0.04 - i * 0.07, 0, 0.7, 0.07, 1, i % 2 ? C.white : 0xd23b3b);
          part(M, SHAPE.quad, 0.15, -0.1, 0.002, 0.3, 0.2, 1, 0x2b4a8a);
        })
      );
    });

    // F ── rooftops with water towers (not on low quality)
    if (!this.low) {
      b.chunk(-4, 13, -68, 0.2, 1, { delay: 1, phase: 5.1, amp: 0.4 }, () => {
        addLand(b, 3.0, { top: paved });
        const bodies = [C.brick, 0xc98a5e, C.brown, 0xb4644c];
        for (let i = 0; i < 4; i++) {
          const x = -1.5 + i * 0.95;
          const h = 1.6 + (i % 2) * 0.6;
          block(x, 0, -0.4, 0.92, h, 1.2, bodies[i], M, 0.03);
          windows(0.92, 1.2, 0.3, h - 0.25, 2, 2, C.glassDark, WINDOW, [0]);
          if (i % 2 === 0) waterTower(b, x, h, -0.5, 0.8);
        }
      });
    }
  }

  ambient(fx, dt, quality) {
    // wisps of steam drifting up from the manhole, between the puffs
    this.steamT -= dt;
    if (this.steamT > 0 || quality === 'low') return;
    this.steamT = 0.22 + Math.random() * 0.2;
    const [x, y, z] = this.steam;
    fx.spark(x + (Math.random() - 0.5) * 0.3, y + 0.3, z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.3, 0.45 + Math.random() * 0.3, (Math.random() - 0.5) * 0.15, 0xc9ccd2, 1.6 + Math.random() * 1.2, 1.4 + Math.random() * 0.5, 0, 0.3);
  }
}
