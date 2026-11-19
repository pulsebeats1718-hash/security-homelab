/**
 * New York — an avenue behind the dais lined with a brownstone (stoop and cornice), a theatre with
 * its marquee and name in lights, a brick walk-up with a fire escape over a pizza place, and a
 * corner deli with a striped awning and a neon in the window; a yellow taxi (now and then it pulls
 * out, another cab passes, and it comes back), a hot-dog cart, a fire hydrant, a subway entrance
 * with green globe lamps, crook-necked street lamps, a traffic light with street blades and a
 * steaming manhole.
 *
 * Behind it a second floating block: a tall brick apartment house with fire escapes and a water
 * tower, a low row of brownstones, an office block with a rooftop billboard of the phrases the player
 * is learning and a corner block with a blue neon; a side street between them looks out to an Art
 * Deco tower. Further out:
 * glass towers, a suspension bridge, a skyline cluster, a little park and rooftops, and far blocks
 * of offices and flats. All shapes are generic.
 *
 * Low quality keeps the avenue and its signs but leaves out the back block, the far skyline and the
 * traffic.
 */
import { mulberry32 } from '../../core/utils.js';
import { Diorama, SHAPE, rbox, groundY, islandR, ribbon, pathX, addLand, tools } from './kit.js';
import { KIND } from '../seasons/shader.js';
import { SignSet, POSTER } from '../signs.js';
import { cityMaterials } from './city/materials.js';
import { cityParts } from './city/parts.js';
import { Traffic } from './city/traffic.js';

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
const MH = 3.75;
/** Where the taxi parks (x along the avenue); it faces west. */
const TAXI_X = 2.45;

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

/** A yellow cab, drawn into any Batch at the origin facing +x. */
function taxi(t) {
  const { part, block, slab, b } = t;
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
}

export class NewYork extends Diorama {
  constructor(island, quality) {
    super(island, quality);
    this.rng = mulberry32(1898);
    this.rng2 = mulberry32(18980);
    this.steamT = 0;
    Object.assign(this.mats, cityMaterials(this));
    this.signs = new SignSet(this, 'newyork');
    this.traffic = this.low ? null : new Traffic(this);
    this.build();
    this.far();
    this.finish();
  }

  finish() {
    super.finish();
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
    const at = (x, z) => groundY(x, z);
    const near = (x, z) => Math.min(0.62, Math.hypot(x, z) / 9);
    const P = cityParts(this, b, this.rng2);
    const k = P.k;
    const signs = this.signs;

    /** a tall window with a cream lintel and sill, on a wall facing +z (plane at z), bottom at y */
    const win = (x, y, z, w, h, trim = C.trim) => {
      slab(x, y - 0.05, z + 0.03, w + 0.12, 0.05, 0.08, trim);
      slab(x, y + h, z + 0.03, w + 0.14, 0.09, 0.08, trim);
      slab(x, y - 0.01, z + 0.01, w + 0.06, h + 0.02, 0.03, 0xf2ece0);
      b.lit(WINDOW, lit(), () => slab(x, y + 0.02, z + 0.025, w - 0.04, h - 0.04, 0.02, C.glass, k.glass));
      slab(x, y + h * 0.55, z + 0.04, w - 0.04, 0.03, 0.02, 0xf2ece0);
    };

    // ── brownstone with a stoop ─────────────────────────────────────────────
    const brownstone = (body, door) => {
      const w = 1.5;
      const d = 1.5;
      const z = d / 2;
      block(0, 0, 0, w, 3.2, d, body, k.stone, 0.03);
      block(0, 0, 0, w + 0.03, 0.55, d + 0.03, 0x6e4636, k.stone, 0.02);
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
      b.lit(WINDOW, lit(), () => slab(sx, 1.55, z + 0.025, 0.38, 0.1, 0.02, C.glass, k.glass));
      win(0.36, 0.85, z, 0.36, 0.72);
      for (const y of [1.8, 2.5]) for (const x of [-0.36, 0.36]) win(x, y, z, 0.36, 0.56);
      // a window box of geraniums
      slab(0.36, 1.68, z + 0.08, 0.42, 0.08, 0.12, 0x5b4130);
      b.kind(KIND.FOLIAGE, () => ball(0.36, 1.78, z + 0.1, 0.4, 0x4f9a48, M, 0.4));
      for (let i = 0; i < 5; i++) ball(0.2 + i * 0.08, 1.8, z + 0.15, 0.05, i % 2 ? 0xe2483a : 0xff7a8a);
      // a garden-level window under the stoop
      b.lit(WINDOW, lit(), () => slab(0.36, 0.12, z + 0.025, 0.34, 0.3, 0.02, C.glassDark, k.glass));
    };

    // ── the theatre: a marquee over the doors, its name in lights above ─────
    const theatre = () => {
      const w = 1.5;
      const d = 1.5;
      const z = d / 2;
      block(0, 0, 0, w, 3.35, d, 0xd9c7a6, k.stone, 0.03);
      block(0, 3.25, 0, w + 0.12, 0.16, d + 0.1, 0xc4ad85, M, 0.02);
      slab(0, 0, z + 0.01, w + 0.02, 0.1, 0.04, 0xb79f78);
      // pilasters
      for (const x of [-0.7, 0.7]) slab(x, 0.1, z + 0.02, 0.1, 3.1, 0.06, 0xe8dcc2);
      // doors under the marquee, poster cases either side
      for (const x of [-0.24, 0.24]) {
        slab(x, 0.08, z + 0.004, 0.42, 0.68, 0.02, 0x2a2420);
        b.lit(0xffd9a0, 0.2, () => slab(x, 0.12, z + 0.018, 0.36, 0.6, 0.01, 0x6b5a4a, k.glass));
      }
      for (const x of [-0.56, 0.56]) {
        slab(x, 0.18, z + 0.02, 0.22, 0.5, 0.03, 0x8a6a30, S);
        signs.add(x, 0.43, z + 0.037, 0.18, 0.44, { style: 'poster', id: x < 0 ? 'break-a-leg' : 'bring-the-house-down', text: x < 0 ? 'break a leg' : 'bring the house down', scheme: POSTER[x < 0 ? 0 : 4] });
      }
      // the marquee: a lightbox canopy on chains, bulbs underneath
      block(0, 0.86, z + 0.28, w + 0.1, 0.36, 0.5, 0x2a1e24, S, 0.03);
      for (const x of [-0.7, 0.7]) part(S, SHAPE.box, x, 1.34, z + 0.26, 0.02, 0.02, 0.56, C.iron, -0.85, 0, 0);
      signs.add(0, 1.04, z + 0.535, w + 0.04, 0.34, { style: 'marquee', lines: [{ id: 'bring-the-house-down', text: 'Bring the house down' }, { id: 'break-a-leg', text: 'Break a leg!' }] }, { glow: 0xfff3d6, lit: 0.1 });
      for (let i = 0; i < 9; i++) b.lit(0xffe2a8, 0.25, () => ball(-0.72 + i * 0.18, 0.84, z + 0.5, 0.06, 0xfff4d8, L));
      this.halo(0, 0.78, z + 0.55, 2.0, 0xffe2a8);
      // the theatre's name in lights across the front
      block(0, 1.42, z + 0.04, w - 0.08, 0.5, 0.1, 0x1f1a2a, S, 0.03);
      signs.add(0, 1.67, z + 0.095, w - 0.16, 0.42, { style: 'neon', lines: [{ id: 'the-talk-of-the-town', text: 'The Talk of' }, { id: 'the-talk-of-the-town', text: 'the Town' }], tube: '#ffd36b', tube2: '#ff6fae' }, { glow: 0xffffff, lit: -1 });
      // upper windows
      for (const y of [2.12, 2.7]) for (const x of [-0.42, 0, 0.42]) P.sash(x, y, z, 0.26, 0.42, { bars: [1, 1], lintel: 'flat', sill: 0xe8dcc2, lintelCol: 0xe8dcc2 });
    };

    // ── brick walk-up with a fire escape, a pizza place at street level ──────
    const walkUp = () => {
      const w = 1.5;
      const d = 1.5;
      const z = d / 2;
      block(0, 0, 0, w, 3.3, d, C.brick, k.brick, 0.03);
      block(0, 3.25, 0, w + 0.12, 0.16, d + 0.1, C.trim, M, 0.02);
      // shop front at street level
      const f = P.shopfront(0, 0, z, w, { color: 0x2f5d50, door: 'left', h: 1.05, fascia: 0.22, glow: 0xffd59a, lit: 0.12 });
      signs.add(0, f.y + f.h / 2, f.z, w - 0.3, f.h * 0.92, { style: 'fascia', id: 'spot-on', text: 'Spot On', sub: 'Pizza', bg: '#1f4a3f', ink: '#ffe6a8', font: 'display', upper: false });
      for (const y of [1.25, 1.95, 2.65]) for (const x of [-0.36, 0.36]) win(x, y, z, 0.34, 0.5);
      // the fire escape: landings, rails and ladders zig-zagging down the front
      for (const y of [1.18, 1.88, 2.58]) {
        slab(0, y - 0.04, z + 0.22, 1.25, 0.04, 0.4, C.iron, S);
        slab(0, y + 0.36, z + 0.41, 1.25, 0.03, 0.03, C.iron, S);
        for (let i = 0; i < 9; i++) slab(-0.6 + i * 0.15, y, z + 0.41, 0.02, 0.36, 0.02, C.iron, S);
        part(S, SHAPE.box, 0.15, y - 0.36, z + 0.26, 0.04, 0.82, 0.04, C.iron, 0, 0, 0.75);
      }
    };

    // ── corner deli with an awning and a neon in the window ─────────────────
    const deli = () => {
      const w = 1.5;
      const d = 1.4;
      const z = d / 2;
      block(0, 0, 0, w, 2.35, d, 0xd9cfbd, k.render, 0.03);
      block(0, 2.3, 0, w + 0.1, 0.14, d + 0.1, C.cornice, M, 0.02);
      b.lit(0xffe1a8, 0.1, () => slab(0.12, 0.12, z + 0.02, 1.0, 0.72, 0.02, 0xa9c6d8, k.glass));
      block(-0.55, 0.05, z + 0.02, 0.3, 0.86, 0.03, 0x3b2f2a, S, 0.02);
      // the neon in the window
      slab(0.2, 0.42, z + 0.032, 0.62, 0.3, 0.01, 0x140d18);
      signs.add(0.2, 0.57, z + 0.04, 0.6, 0.28, { style: 'neon', lines: [{ id: 'around-the-clock', text: 'Round the clock' }], tube: '#ff4fa3' }, { glow: 0xffffff, lit: -1 });
      // a striped awning
      for (let i = 0; i < 8; i++) part(M, SHAPE.box, -0.66 + i * 0.19, 1.14, z + 0.28, 0.19, 0.04, 0.6, i % 2 ? C.white : 0x2f8a52, 0.42, 0, 0);
      slab(0, 0.98, z + 0.53, 1.52, 0.14, 0.02, 0x2f8a52);
      signs.add(0, 1.05, z + 0.545, 1.42, 0.12, { style: 'awning', id: 'lovely-jubbly', text: 'lovely jubbly', bg: '#2f8a52' });
      // the shop's name over the awning
      block(0, 1.32, z + 0.02, 1.2, 0.34, 0.06, 0x8e1f1c, S, 0.03);
      signs.add(0, 1.49, z + 0.053, 1.12, 0.28, { style: 'fascia', id: 'bobs-your-uncle', text: "Bob's Your Uncle", sub: 'Deli', bg: '#b2261f', ink: '#fff3d6', upper: false, font: 'display', trim: 'rgba(255,243,214,0.8)' }, { glow: 0xff7a5a, lit: 0.25 });
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
      signs.add(0, 0.54, 0.367, 0.86, 0.32, { style: 'plate', id: 'nosh', text: 'NOSH', bg: '#ffc93a', ink: '#c8202d' }, { glow: 0xffd84a, lit: 0.25 });
      slab(-0.75, 0.62, 0, 0.3, 0.03, 0.04, C.chrome, S);
      // a striped umbrella
      post(0.1, 0.9, -0.05, 0.05, 1.25, C.chrome, S);
      for (let i = 0; i < 8; i++) part(M, SHAPE.wedge, 0.1, 2.06, -0.05, 0.9, 0.36, 0.9, i % 2 ? 0xffd23f : 0x2f6fd6, 0, (i * Math.PI) / 4, 0);
      ball(0.1, 2.44, -0.05, 0.09, 0x2f6fd6);
      // a couple of buns on top
      for (const x of [-0.3, -0.05]) part(M, SHAPE.ball, x, 0.93, 0.1, 0.22, 0.07, 0.08, 0xe0a15a);
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
      // street blades at the top of the pole, crossed
      post(0, 2.6, 0, 0.07, 0.56, 0x8b8f96, S);
      slab(0.42, 2.7, 0.0, 0.84, 0.2, 0.025, 0x1d6b45);
      signs.add(0.42, 2.8, 0.014, 0.82, 0.18, { style: 'blade', id: 'easy-peasy', text: 'Easy-Peasy St' });
      b.at(0, 2.94, 0, Math.PI / 2, 1, () => {
        slab(0.42, 0, 0.0, 0.84, 0.2, 0.025, 0x1d6b45);
        signs.add(0.42, 0.1, 0.014, 0.82, 0.18, { style: 'blade', id: 'hit-the-road', text: 'Hit the Road Ave' });
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
      // the entrance's plate over the back rail
      slab(0, 0.72, -0.78, 0.86, 0.2, 0.03, C.green, S);
      b.at(0, 0.82, -0.762, 0, 1, () => signs.add(0, 0, 0, 0.82, 0.17, { style: 'plate', text: 'SUBWAY', bg: '#1d5f3c', ink: '#ffffff', keyline: '#ffffff' }));
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
    b.pin(0, at(0, -2.95), -2.95, 0.0, () => b.kind(KIND.PAVED, () => {
      part(k.tarmac, ribbon(path, -HALF, HALF, 0.0, 0.1), 0, 0, 0, 1, 1, 1, C.asphalt);
      part(M, ribbon(path, HALF, HALF + 0.16, 0.06, 0.13), 0, 0, 0, 1, 1, 1, C.kerb);
      part(M, ribbon(path, -HALF - 0.16, -HALF, 0.06, 0.13), 0, 0, 0, 1, 1, 1, C.kerb);
      part(k.paving, ribbon(path, -HALF - 1.75, -HALF - 0.16, 0.04, 0.1), 0, 0, 0, 1, 1, 1, C.walk);
      part(k.paving, ribbon(path, HALF + 0.16, HALF + 0.55, 0.04, 0.1), 0, 0, 0, 1, 1, 1, C.walk);
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
    }));
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
    /** keep the season dressing away from the steaming manhole (a snowman beside the puffs looks doubled) */
    this.avoid = [{ x: MH, z: streetZ(MH) + 0.18, r: 1.5 }];

    // the block behind it
    const row = [
      [-2.2, 0.36, () => brownstone(C.brown, 0x2d4a3e)],
      [-0.74, 0.12, theatre],
      [0.74, -0.1, walkUp],
      [2.16, -0.32, deli],
    ];
    for (const [x, ry, fn] of row) {
      const z = streetZ(x) - HALF - 1.0;
      b.prop(x, at(x, z), z, ry, 0.72, near(x, z), fn);
    }

    // a yellow taxi on the avenue: parked (low), or now and then off and back again
    const lane = (x) => {
      const z = streetZ(x) + 0.12;
      return { x, y: at(x, z), z, ry: Math.PI - Math.atan(0.09 * x) };
    };
    if (this.traffic) {
      const tr = this.traffic;
      const cab = tr.vehicle({ build: (bb) => taxi({ ...tools(bb), b: bb }), park: TAXI_X, scale: 0.86, delay: near(TAXI_X, -2.6), street: lane });
      const passer = tr.vehicle({ build: (bb) => taxi({ ...tools(bb), b: bb }), park: null, scale: 0.86, street: (x) => ({ ...lane(x), z: lane(x).z - 0.02 }) });
      tr.route([
        { car: cab, kind: 'out', from: TAXI_X, to: -6.6, at: 0, dur: 5.2 },
        { car: passer, kind: 'through', from: 6.8, to: -6.6, at: 6.5, dur: 5.6 },
        { car: cab, kind: 'in', from: 6.8, to: TAXI_X, at: 14, dur: 3.4 },
      ]);
    } else {
      const p = lane(TAXI_X);
      b.prop(p.x, p.y, p.z, p.ry, 0.86, near(p.x, p.z), () => taxi({ ...tools(b), b }));
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
    /** open ground in front of the avenue (where season props may go) */
    this.free = (x, z) => z > streetZ(x) + HALF + 0.85;

    if (!this.low) this.backBlock(P);
  }

  // ── the block behind: apartments, a loft with a blue neon, an office with a rooftop billboard ──
  backBlock(P) {
    const b = this.b;
    const { part, block, slab, post } = P;
    const k = P.k;
    const signs = this.signs;
    const paved = (c, x, y, z, r) => c.setHex(Math.hypot(x, z / 0.36) / r > 0.9 || y < -0.06 ? 0x6fc15a : (Math.floor(x * 1.4) + Math.floor(z * 1.4)) % 2 ? 0xc9c6bf : 0xbdbab2);
    /** a block with storeys of plain windows; returns its height */
    const blockOf = (x, z, w, d, storeys, o) => {
      const sh = o.storey ?? 0.6;
      const h = storeys * sh + 0.25;
      block(x, 0, z, w, h, d, o.wall, o.key ?? k.brick, 0.03);
      slab(x, 0, z + d / 2 - 0.02, w + 0.02, 0.34, 0.06, o.base ?? 0x5b5048);
      const bays = o.bays ?? Math.max(2, Math.round(w / 0.4));
      for (let s = 0; s < storeys; s++) {
        const y = 0.4 + s * sh;
        for (let i = 0; i < bays; i++) {
          if (o.skip?.(s, i)) continue;
          P.pane(x - w / 2 + ((i + 0.5) * w) / bays, y, z + d / 2, Math.min(0.22, (w / bays) * 0.5), sh * 0.6, { frame: o.frame ?? 0xe9e2d4, sill: o.sill ?? 0xd8cfbf });
        }
      }
      block(x, h - 0.06, z, w + 0.1, 0.14, d + 0.08, o.cornice ?? C.cornice, M, 0.02);
      return h;
    };
    /** fire escapes zig-zagging down a front (wall face at z) */
    const fireEscape = (x, z, w, y0, storeys, sh) => {
      for (let s = 0; s < storeys; s++) {
        const y = y0 + s * sh;
        slab(x, y - 0.04, z + 0.16, w, 0.035, 0.3, C.iron, S);
        slab(x, y + 0.28, z + 0.3, w, 0.025, 0.025, C.iron, S);
        for (let i = 0; i < 6; i++) slab(x - w / 2 + (i * w) / 5, y, z + 0.3, 0.018, 0.28, 0.018, C.iron, S);
        if (s) part(S, SHAPE.box, x + (s % 2 ? 0.1 : -0.1), y - sh / 2, z + 0.2, 0.03, sh * 1.15, 0.03, C.iron, 0, 0, s % 2 ? 0.6 : -0.6);
      }
    };

    // (world x = local x + 1.6) the middle stays low, so in play it hides behind the avenue's
    // buildings and the sky above the falling card stays clear; the tall ones stand at the sides
    b.chunk(1.6, -0.45, -10.2, 0, 1, { delay: 0.7, phase: 1.9, amp: 0.05 }, () => {
      addLand(b, 5.6, { depthScale: 0.36, top: paved });
      // A ── a tall brick apartment house with fire escapes and a water tower (far left)
      const hA = blockOf(-4.45, 0.1, 1.4, 1.1, 7, { wall: 0x9c4b38, storey: 0.58 });
      fireEscape(-4.45, 0.65, 0.95, 0.98, 6, 0.58);
      waterTower(b, -4.2, hA, -0.1, 0.9);
      // a low row of brownstones and a narrow loft in the middle
      blockOf(-2.75, 0.2, 1.6, 1.1, 4, { wall: 0x85553f, key: k.stone, storey: 0.58, cornice: 0x4b3a33 });
      blockOf(-1.1, 0.2, 1.6, 1.1, 4, { wall: 0x7a4b39, key: k.stone, storey: 0.58, cornice: 0x4b3a33 });
      blockOf(0.35, 0.25, 0.85, 1.0, 3, { wall: 0xb7835e, storey: 0.6, bays: 2, cornice: 0x6b4a3a });
      // the side street: tarmac, a lamp, looking out to the Deco tower
      b.kind(KIND.PAVED, () => slab(1.0, 0.0, -0.3, 0.75, 0.03, 2.6, 0x4a4d55, k.tarmac));
      post(0.75, 0, 0.8, 0.06, 1.3, C.lamp, S);
      b.lit(WARM, -1, () => part(L, SHAPE.sphere, 0.75, 1.36, 0.8, 0.14, 0.15, 0.14, 0x5a4630));
      this.halo(0.75, 1.36, 0.8, 1.4);
      // B ── an office block with a billboard on its roof
      const hB = blockOf(2.2, 0.0, 1.6, 1.3, 5, { wall: 0xcfc6b4, key: k.stone, storey: 0.56, cornice: 0xb9ae98, frame: 0x3b3f46, base: 0x8a8274 });
      const bd = P.roofBoard(2.2, hB + 0.05, 0.35, 1.5, 0.78);
      signs.add(bd.x, bd.y, bd.z, 1.5, 0.78, { style: 'billboard', text: '' }, { live: { period: 9 }, res: 230, glow: 0xffffff, lit: 0.35 });
      // C ── a red-brick corner block with a blue neon high on its front and a water tower
      const hC = blockOf(3.85, 0.05, 1.55, 1.2, 6, { wall: 0xa9503a, storey: 0.6, skip: (st) => st === 4 });
      slab(3.85, hC - 1.12, 0.67, 1.4, 0.5, 0.04, 0x120c18);
      signs.add(3.85, hC - 0.87, 0.695, 1.36, 0.46, { style: 'neon', lines: [{ id: 'once-in-a-blue-moon', text: 'Once in a' }, { id: 'once-in-a-blue-moon', text: 'blue moon' }], tube: '#5fb4ff', tube2: '#9fd8ff' }, { glow: 0xffffff, lit: -1, res: 220 });
      waterTower(b, 4.15, hC, -0.15, 0.85);
      // street trees along the front
      for (const [x, z] of [[-3.6, 1.2], [-0.4, 1.25], [1.45, 1.2]]) {
        post(x, 0, z, 0.1, 0.85, 0x6b5848);
        b.kind(KIND.FOLIAGE, () => part(M, SHAPE.sphere, x, 1.1, z, 0.75, 0.62, 0.75, C.leaf[1]));
      }
    });
  }

  // ── distant chunks ────────────────────────────────────────────────────────
  far() {
    const b = this.b;
    const rng = this.rng;
    const { part, block, slab, post, ball } = tools(b);
    const k = cityParts(this, b, this.rng2).k;
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

    // A ── an Art Deco tower: setbacks, piers and a stepped steel crown with a spire (seen down the
    //      side street behind the avenue)
    b.chunk(7.3, -4.4, -30, -0.3, 0.72, { delay: 0.86, phase: 0.6, amp: 0.3 }, () => {
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

    // F ── rooftops with water towers, and the wider skyline (not on low quality)
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
      // far blocks either side of the Deco tower: offices and flats wearing window patterns
      const tower = (x, z, w, d, h, col, key, crown = null) => {
        block(x, 0, z, w, h, d, col, key, 0.03);
        slab(x, h, z, w + 0.06, 0.1, d + 0.06, 0xb9b4aa);
        if (crown) {
          block(x, h + 0.1, z, w * 0.6, 0.5, d * 0.6, crown, S, 0.03);
          part(S, SHAPE.cone8, x, h + 0.6 + 0.4, z, 0.12, 0.8, 0.12, crown);
        }
      };
      b.chunk(2.4, -3.4, -36, 0.15, 1, { delay: 0.88, phase: 2.2, amp: 0.25 }, () => {
        addLand(b, 3.6, { depthScale: 0.6 });
        tower(-2.0, 0.2, 1.2, 1.1, 6.2, 0xb46a4e, k.flats);
        tower(-0.6, -0.3, 1.3, 1.2, 8.6, 0xd9cdb4, k.office, 0xcfd6de);
        tower(0.9, 0.3, 1.1, 1.0, 7.0, 0x8faecd, k.office);
        tower(2.1, -0.4, 1.0, 1.0, 5.2, 0xa9503a, k.flats);
      });
      b.chunk(14.5, -3.0, -40, -0.4, 1, { delay: 0.95, phase: 3.9, amp: 0.3 }, () => {
        addLand(b, 3.8, { depthScale: 0.6 });
        tower(-2.2, 0.3, 1.2, 1.1, 7.5, 0x7fa6cf, k.office);
        tower(-0.7, -0.2, 1.4, 1.3, 11.0, 0xd4d9df, k.office, 0xe2e8ee);
        tower(0.9, 0.4, 1.2, 1.1, 8.4, 0x9fb7cc, k.office);
        tower(2.3, -0.3, 1.1, 1.0, 5.6, 0xc4a17a, k.flats);
        b.lit(0xff3b30, -1, () => ball(-0.7, 12.15, -0.2, 0.16, 0xff5a4a, L));
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
