/**
 * Sydney — the island turns into a beach: golden sand around the dais and down the right side,
 * a lagoon with rock-pool boulders, surfboards stuck in the sand, red-and-yellow lifesaver flags,
 * a lifeguard tower, a beach umbrella and towel, a sandcastle, gum trees (with a koala) on the
 * grassy back and a yellow kangaroo road sign. Distant chunks: a steel arch bridge over the harbour
 * with sailing boats, a lighthouse on a cliff, a surf beach with rolling waves and Norfolk pines,
 * a suburb of terracotta roofs and a cluster of towers. All shapes are generic.
 */
import * as THREE from 'three';
import { mulberry32 } from '../../core/utils.js';
import { Diorama, SHAPE, groundY, addLand, tools, faceted, UNIT } from './kit.js';

const M = 'matte';
const S = 'satin';
const L = 'glow';

const C = {
  sand: 0xf1d6a0,
  sandWet: 0xdcb87f,
  sea: 0x2ec4c9,
  deep: 0x1f92c2,
  foam: 0xf4fbff,
  red: 0xe8262c,
  yellow: 0xffd21f,
  white: 0xf7f5ef,
  trunk: 0xebe5d8,
  trunk2: 0xc9c2b4,
  gum: [0x8fb39a, 0x7aa68a, 0xa3c4a8, 0x86ad92],
  rock: 0x9a8f86,
  steel: 0x8d96a3,
  sandstone: 0xdcc49a,
  terracotta: 0xd0623f,
  wall: 0xf3e6cc,
  pine: [0x3f8a5a, 0x357a4e, 0x4a9a63],
  glass: 0x86a9c4,
};
const WARM = 0xffc46b;
const WINDOW = 0xe0a85c;

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** 0 on the grass in the back-left corner … 1 on the beach */
const sandiness = (x, z) => smooth(-0.3, 0.3, (x - 0.6) * 0.62 + (z + 5.2) * 0.785 + 0.22 * Math.sin(x * 1.9 - z * 1.3) - 0.55);
/** the lagoon at the front right */
const LAGOON = { x: 3.75, z: 2.05, rx: 1.35, rz: 0.78 };

export class Sydney extends Diorama {
  constructor(island, quality) {
    super(island, quality);
    this.rng = mulberry32(1788);
    this.glintT = 0;
    this.build();
    this.far();
    this.finish();
  }

  build() {
    const b = this.b;
    const rng = this.rng;
    const { part, block, slab, post, ball } = tools(b);
    const at = (x, z) => groundY(x, z);
    const near = (x, z) => Math.min(0.62, Math.hypot(x, z) / 9);

    // ── the beach: turf repainted as sand, grass only at the back left ───────
    const sandA = new THREE.Color(C.sand);
    const sandB = new THREE.Color(C.sandWet);
    const sandC = new THREE.Color(0xf7e2b2);
    const tmp = new THREE.Color();
    this.ground = {
      keep: (x, z) => sandiness(x, z) < 0.2,
      tint: (c, x, y, z) => {
        const s = sandiness(x, z);
        if (s <= 0) return;
        const n = 0.5 + 0.5 * Math.sin(x * 2.3 + z * 1.1) * Math.sin(x * 0.7 - z * 2.9);
        tmp.copy(sandA).lerp(sandC, n * 0.6).lerp(sandB, Math.min(1, Math.max(0, -y * 1.4)));
        c.lerp(tmp, s);
      },
    };

    // ── props ───────────────────────────────────────────────────────────────
    const gumTree = (seed, koala = false) => {
      const r = mulberry32(seed);
      // a pale, slightly twisting trunk that forks into two leaders
      part(M, SHAPE.cyl8, 0, 0.8, 0, 0.3, 1.6, 0.3, C.trunk, 0, 0, 0.06);
      for (let i = 0; i < 6; i++) part(M, SHAPE.ball, (r() - 0.5) * 0.24, 0.3 + r() * 1.3, 0.13, 0.14, 0.3, 0.04, i % 2 ? C.trunk2 : 0xd9c8b6);
      part(M, SHAPE.cyl8, -0.32, 2.05, 0, 0.18, 1.2, 0.18, C.trunk, 0, 0, 0.55);
      part(M, SHAPE.cyl8, 0.3, 2.2, 0.05, 0.17, 1.4, 0.17, C.trunk, 0.15, 0, -0.42);
      part(M, SHAPE.cyl6, 0.62, 2.85, 0.05, 0.08, 0.7, 0.08, C.trunk, 0, 0, -1.0);
      // loose, drooping clumps of grey-green leaves around the branch tips
      const clumps = [[-0.8, 2.7, 0.1, 0.95], [0.8, 3.15, 0, 1.0], [0.1, 3.5, -0.2, 0.9], [1.2, 2.8, 0.25, 0.7], [-0.3, 2.55, 0.55, 0.65], [0.35, 2.7, -0.6, 0.7], [-1.15, 2.35, -0.25, 0.55], [0.55, 3.75, 0.25, 0.6], [-0.45, 3.2, -0.45, 0.6]];
      clumps.forEach(([x, y, z, d], i) => {
        part(M, SHAPE.sphere, x, y, z, d * 1.2, d * 0.55, d * 0.95, C.gum[i % 4], (r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4);
        part(M, SHAPE.sphere, x + (r() - 0.5) * 0.3, y - d * 0.22, z + (r() - 0.5) * 0.3, d * 0.75, d * 0.4, d * 0.7, C.gum[(i + 2) % 4]);
      });
      if (koala) {
        // a koala hugging the trunk
        b.at(0.02, 1.55, 0.2, 0.25, 1, () => {
          part(M, SHAPE.sphere, 0, 0, 0, 0.36, 0.42, 0.3, 0x9a9ca3);
          part(M, SHAPE.sphere, 0, 0.3, 0.04, 0.32, 0.28, 0.28, 0x9fa1a8);
          for (const s of [-1, 1]) {
            part(M, SHAPE.sphere, s * 0.16, 0.42, 0.0, 0.17, 0.17, 0.08, 0xdedfe2);
            part(M, SHAPE.sphere, s * 0.16, 0.42, 0.01, 0.11, 0.11, 0.06, 0xb7b9bf);
            part(M, SHAPE.sphere, s * 0.15, 0.02, 0.12, 0.08, 0.2, 0.08, 0x8f9198, 0, 0, s * 0.7);
            ball(s * 0.07, 0.33, 0.17, 0.04, 0x1d1d22);
          }
          part(M, SHAPE.sphere, 0, 0.27, 0.18, 0.1, 0.12, 0.07, 0x2a2a30);
          part(M, SHAPE.sphere, 0, 0.12, 0.13, 0.16, 0.16, 0.06, 0xe6e6e8);
        });
      }
    };

    const surfboard = (col, stripe) => {
      // stuck nose-up in the sand
      part(S, SHAPE.sphere, 0, 0.8, 0, 0.5, 1.9, 0.09, col);
      part(M, SHAPE.box, 0, 0.82, 0.046, 0.03, 1.5, 0.01, stripe);
      part(M, SHAPE.box, 0, 0.55, 0.045, 0.42, 0.06, 0.01, stripe);
    };

    const flag = () => {
      post(0, 0, 0, 0.06, 2.0, 0xe8e8e8, S);
      ball(0, 2.02, 0, 0.08, 0xe8e8e8, S);
      b.at(0.03, 1.95, 0, 0, 1, () =>
        b.wave({ dir: [0, 0, 1], along: [1, 0, 0], len: 0.62, freq: 3.4, phase: rng() * 6 }, () => {
          part(M, SHAPE.quad, 0.31, -0.13, 0, 0.62, 0.26, 1, C.red);
          part(M, SHAPE.quad, 0.31, -0.39, 0, 0.62, 0.26, 1, C.yellow);
          part(M, SHAPE.quad, 0.31, -0.13, -0.002, 0.62, 0.26, 1, C.red, 0, Math.PI, 0);
          part(M, SHAPE.quad, 0.31, -0.39, -0.002, 0.62, 0.26, 1, C.yellow, 0, Math.PI, 0);
        })
      );
    };

    const lifeguardTower = () => {
      // four stilts, a deck with a rail, a hut striped red and yellow, a ladder
      for (const [x, z] of [[-0.55, -0.45], [0.55, -0.45], [0.55, 0.45], [-0.55, 0.45]]) part(M, SHAPE.cyl8, x * 0.9, 0.85, z * 0.9, 0.12, 1.7, 0.12, C.white, z * 0.08, 0, -x * 0.1);
      block(0, 1.6, 0, 1.5, 0.1, 1.3, 0xd9c6a2, M, 0.02);
      block(0, 1.7, -0.12, 1.2, 0.95, 0.95, C.red, M, 0.04);
      for (let i = 0; i < 3; i++) slab(0, 1.78 + i * 0.3, 0.36, 1.21, 0.12, 0.02, C.yellow);
      b.lit(WINDOW, 0.3, () => slab(0, 2.0, 0.37, 0.8, 0.42, 0.02, C.glass, L));
      // a lamp over the deck
      slab(-0.62, 2.55, 0.42, 0.04, 0.04, 0.3, 0x3a3530);
      b.lit(0xfff0c8, -1, () => ball(-0.62, 2.5, 0.58, 0.14, 0xfff6e0, L));
      this.halo(-0.62, 2.5, 0.58, 1.8, 0xffd9a0);
      part(M, SHAPE.prism, 0, 2.86, -0.12, 1.5, 0.45, 1.3, C.yellow);
      for (const s of [-1, 1]) slab(s * 0.74, 1.7, 0.6, 0.04, 0.45, 0.04, C.white);
      slab(0, 2.12, 0.6, 1.5, 0.04, 0.04, C.white);
      slab(0, 1.92, 0.6, 1.5, 0.03, 0.03, C.white);
      for (let i = 0; i < 6; i++) slab(0.95, 0.2 + i * 0.25, 0.75 + i * 0.0, 0.3, 0.04, 0.12, C.white);
      for (const s of [-1, 1]) part(M, SHAPE.box, 0.95 + s * 0.15, 0.85, 0.75, 0.04, 1.75, 0.04, C.white);
      // a red-and-yellow flag on the roof
      post(0.55, 3.0, -0.12, 0.04, 0.7, C.white);
      b.at(0.57, 3.66, -0.12, 0, 1, () => b.wave({ dir: [0, 0, 1], along: [1, 0, 0], len: 0.4, freq: 3.8, phase: 1 }, () => {
        part(M, SHAPE.quad, 0.2, -0.08, 0, 0.4, 0.16, 1, C.red);
        part(M, SHAPE.quad, 0.2, -0.24, 0, 0.4, 0.16, 1, C.yellow);
      }));
      // a seagull on the rail
      b.at(-0.45, 2.15, 0.6, 0.6, 1, () => {
        part(M, SHAPE.sphere, 0, 0.1, 0, 0.26, 0.17, 0.16, C.white);
        part(M, SHAPE.sphere, 0.13, 0.2, 0, 0.13, 0.13, 0.12, C.white);
        part(M, SHAPE.cone, 0.23, 0.2, 0, 0.05, 0.1, 0.05, 0xffb02e, 0, 0, -Math.PI / 2);
        part(M, SHAPE.sphere, -0.04, 0.12, 0, 0.24, 0.08, 0.17, 0xa9b0ba);
        ball(0.17, 0.23, 0.05, 0.025, 0x1d1d22);
        for (const z of [-0.03, 0.03]) slab(0.0, -0.02, z, 0.015, 0.06, 0.015, 0xffb02e);
      });
    };

    const umbrella = () => {
      part(M, SHAPE.cyl6, 0, 1.05, 0, 0.05, 2.1, 0.05, C.white, 0, 0, 0.18);
      b.at(-0.19, 1.98, 0, 0, 1, () => {
        for (let i = 0; i < 8; i++) part(M, SHAPE.wedge, 0, 0, 0, 0.95, 0.38, 0.95, i % 2 ? C.white : 0xff6b6b, 0, (i * Math.PI) / 4, 0);
        ball(0, 0.4, 0, 0.09, C.white);
      });
    };
    const towel = () => {
      for (let i = 0; i < 6; i++) slab(-0.55 + i * 0.22, 0, 0, 0.22, 0.025, 0.85, i % 2 ? C.white : 0x2f8fd6);
      // an esky (cooler)
      block(0.95, 0, -0.15, 0.5, 0.36, 0.34, 0x2f8fd6, S, 0.06);
      block(0.95, 0.34, -0.15, 0.54, 0.08, 0.38, C.white, S, 0.03);
      slab(0.95, 0.43, -0.15, 0.24, 0.03, 0.05, C.white);
    };
    const sandcastle = () => {
      const s = C.sandWet;
      block(0, 0, 0, 0.9, 0.22, 0.7, s, M, 0.06);
      for (const [x, z] of [[-0.38, -0.28], [0.38, -0.28], [0.38, 0.28], [-0.38, 0.28]]) {
        post(x, 0.0, z, 0.26, 0.42, s, M, SHAPE.cyl);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          slab(x + Math.cos(a) * 0.1, 0.42, z + Math.sin(a) * 0.1, 0.06, 0.06, 0.06, s);
        }
      }
      post(0, 0.22, 0, 0.36, 0.38, s, M, SHAPE.cyl);
      part(M, SHAPE.cone, 0, 0.72, 0, 0.36, 0.3, 0.36, s);
      post(0, 0.85, 0, 0.015, 0.3, 0x8a6a4a);
      part(M, SHAPE.quad, 0.08, 1.08, 0, 0.14, 0.09, 1, C.red);
      // a bucket and spade
      post(0.7, 0, 0.35, 0.2, 0.18, 0x2ec4b6, S, SHAPE.cyl);
      part(M, SHAPE.box, 0.95, 0.12, 0.0, 0.04, 0.3, 0.02, 0xffd21f, 0.3, 0, 0.5);
    };
    const roadSign = () => {
      post(0, 0, 0, 0.08, 1.4, 0xb9bec7, S);
      b.at(0, 1.6, 0.05, 0, 1, () => {
        part(M, SHAPE.box, 0, 0, -0.01, 0.74, 0.74, 0.03, 0x1d1d22, 0, 0, Math.PI / 4);
        part(S, SHAPE.box, 0, 0, 0.005, 0.66, 0.66, 0.03, 0xffc81a, 0, 0, Math.PI / 4);
        // a kangaroo, mid-hop
        const k = 0x1d1d22;
        b.at(0, -0.03, 0.025, 0, 0.82, () => {
          part(M, SHAPE.ball, 0.02, 0.0, 0, 0.36, 0.2, 0.01, k, 0, 0, 0.55);
          part(M, SHAPE.ball, 0.17, 0.15, 0, 0.13, 0.09, 0.01, k, 0, 0, 0.3);
          part(M, SHAPE.ball, 0.15, 0.24, 0, 0.04, 0.1, 0.01, k, 0, 0, -0.2);
          part(M, SHAPE.ball, -0.24, -0.15, 0, 0.36, 0.05, 0.01, k, 0, 0, 0.55);
          part(M, SHAPE.ball, -0.02, -0.15, 0, 0.1, 0.22, 0.01, k, 0, 0, -0.6);
          part(M, SHAPE.ball, 0.06, -0.24, 0, 0.2, 0.04, 0.01, k, 0, 0, 0.05);
          part(M, SHAPE.ball, 0.14, 0.03, 0, 0.11, 0.03, 0.01, k, 0, 0, -0.7);
        });
      });
    };
    const rockPool = () => {
      const { rx, rz } = LAGOON;
      // water, a lighter shallow rim and foam
      part(M, SHAPE.cyl, 0, -0.03, 0, rx * 2 + 0.3, 0.05, rz * 2 + 0.3, C.sandWet);
      part(S, SHAPE.cyl, 0, -0.005, 0, rx * 2 + 0.08, 0.05, rz * 2 + 0.08, 0x7fdcd6);
      part(S, SHAPE.cyl, 0, 0.002, 0, rx * 1.7, 0.05, rz * 1.7, C.sea);
      part(M, SHAPE.cyl, 0, 0.006, 0, rx * 1.05, 0.05, rz * 1.05, 0x22a6cf);
      part(M, new THREE.TorusGeometry(1, 0.035, 4, 40), 0, 0.03, 0, rx * 0.93, rz * 0.93, 1, C.foam, Math.PI / 2, 0, 0);
      // boulders around the edge
      const rocks = [[-1.15, 0.45, 0.32], [-1.3, -0.15, 0.24], [1.05, -0.55, 0.36], [1.4, 0.1, 0.28], [0.3, 0.86, 0.22], [-0.5, -0.82, 0.2]];
      for (const [x, z, s] of rocks) {
        part(M, faceted(UNIT.ico1), x, s * 0.25, z, s, s * 0.7, s * 0.85, 0x9c9189, rng(), rng() * 6, rng());
      }
      // a little red crab on a rock
      b.at(1.05, 0.25, -0.55, -0.6, 1, () => {
        part(M, SHAPE.sphere, 0, 0, 0, 0.18, 0.08, 0.13, 0xe2483a);
        for (const s of [-1, 1]) {
          ball(s * 0.12, 0.03, 0.06, 0.07, 0xe2483a);
          slab(s * 0.04, 0.05, 0.05, 0.015, 0.06, 0.015, 0xe2483a);
          ball(s * 0.04, 0.09, 0.05, 0.035, 0x1d1d22);
        }
      });
    };
    const lifebuoy = () => {
      post(0, 0, 0, 0.1, 1.5, C.white);
      slab(0, 1.42, 0, 0.36, 0.06, 0.08, C.white);
      part(S, new THREE.TorusGeometry(0.3, 0.1, 8, 20), 0, 1.05, 0.09, 1, 1, 1, C.red);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        part(S, SHAPE.box, Math.cos(a) * 0.3, 1.05 + Math.sin(a) * 0.3, 0.09, 0.08, 0.22, 0.22, C.white, 0, 0, a);
      }
    };
    const beachBall = () => {
      const cols = [C.red, C.white, 0x2f8fd6, C.white, C.yellow, C.white];
      for (let i = 0; i < 6; i++) part(S, SHAPE.ballPanel, 0, 0.22, 0, 0.44, 0.44, 0.44, cols[i], 0, (i * Math.PI) / 3, 0);
      for (const y of [0.0, 0.44]) ball(0, y, 0, 0.1, C.white, S, 0.4);
    };
    const shells = () => {
      // a starfish and a few shells
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        part(M, SHAPE.sphere, Math.cos(a) * 0.12, 0.02, Math.sin(a) * 0.12, 0.26, 0.05, 0.08, 0xff8a4c, 0, -a, 0);
      }
      ball(0, 0.03, 0, 0.1, 0xff8a4c, M, 0.5);
      for (const [x, z, c] of [[0.55, 0.2, 0xfff3e6], [0.75, -0.25, 0xffd8c8], [-0.45, 0.45, 0xf7e7ff]]) {
        b.add(M, SHAPE.dome, x, 0, z, 0.16, 0.08, 0.13, 0, rng() * 3, 0, c);
      }
    };
    /** a sagging string of warm bulbs between two points (current frame), lit after dusk */
    const festoon = (x0, y0, z0, x1, y1, z1, n, sag = 0.3) => {
      const cols = [0xffd27a, 0xffb36b, 0xfff0c2, 0xff9e8a];
      const pt = (u) => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - sag * 4 * u * (1 - u), z0 + (z1 - z0) * u];
      for (let i = 0; i < n; i++) {
        const a = pt(i / n);
        const c = pt((i + 1) / n);
        const len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
        const ry = -Math.atan2(c[2] - a[2], c[0] - a[0]);
        const rz = Math.atan2(c[1] - a[1], Math.hypot(c[0] - a[0], c[2] - a[2])) - Math.PI / 2;
        part(M, SHAPE.cyl6, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2, 0.015, len, 0.015, 0x3a3530, 0, ry, rz);
        if (i > 0) {
          b.lit(cols[i % 4], 0.3, () => ball(a[0], a[1] - 0.07, a[2], 0.1, 0xf3ead8, L));
          if (i % 3 === 1) this.halo(a[0], a[1] - 0.07, a[2], 0.9, cols[i % 4]);
        }
      }
    };
    const beachGrass = (n = 5) => {
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2;
        part(M, SHAPE.cone, Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12, 0.05, 0.45, 0.05, i % 2 ? 0x8fb35a : 0xa7c46a, Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
      }
    };

    // ── place them ──────────────────────────────────────────────────────────
    const P = (x, z, ry, s, fn) => b.prop(x, at(x, z), z, ry, s, near(x, z), fn);
    b.pin(LAGOON.x, at(LAGOON.x, LAGOON.z), LAGOON.z, 0.1, () => b.at(LAGOON.x, at(LAGOON.x, LAGOON.z), LAGOON.z, 0, 1, rockPool));
    P(-4.55, -1.55, 0.3, 1.05, () => gumTree(11));
    P(-1.95, -3.95, -0.2, 0.78, () => gumTree(23, true));
    P(3.35, -2.55, -0.42, 0.95, lifeguardTower);
    // surfboards planted in the sand right behind the dais (they stay below the falling cards)
    P(-1.15, -3.35, 0.25, 0.95, () => surfboard(0x2ec4b6, C.white));
    P(1.45, -3.25, -0.1, 0.92, () => surfboard(0xff6b6b, C.white));
    P(2.05, -3.0, -0.3, 0.86, () => surfboard(0xffd21f, 0xff6b6b));
    P(4.75, -0.75, -0.6, 1, lifebuoy);
    P(-4.1, 1.85, 0.4, 1, flag);
    P(2.55, 3.15, -0.3, 1, flag);
    P(3.15, 0.55, -0.35, 1, umbrella);
    P(2.65, 1.0, -0.25, 1, towel);
    P(-2.55, 2.75, 0.3, 1, sandcastle);
    P(-2.05, -2.6, 0.32, 0.95, roadSign);
    for (const [x, z] of [[-0.9, -3.4], [-3.1, -1.25], [-4.6, 0.35], [2.4, -3.3], [-1.3, -2.5]]) P(x, z, rng() * 3, 0.9 + rng() * 0.4, () => beachGrass());
    P(-1.75, 1.9, 0, 1, shells);
    // festoon lights strung from the lifeguard tower to the lifebuoy post, and between the flags' corner and a gum
    b.pin(4.2, at(4.2, -1.5), -1.5, 0.45, () => festoon(3.75, 2.2, -2.05, 4.68, 1.5, -0.72, 7, 0.22));
    b.pin(-3.3, at(-3.3, -2.1), -2.1, 0.45, () => {
      post(-2.6, at(-2.6, -1.25), -1.25, 0.06, 1.9, 0xe8e8e8, S);
      festoon(-2.6, 1.85, -1.25, -4.2, 2.35, -1.75, 7, 0.25);
    });
    P(1.55, 2.6, 0.5, 1, beachBall);

    this.lagoon = [LAGOON.x, at(LAGOON.x, LAGOON.z) + 0.06, LAGOON.z];
  }

  // ── distant chunks ────────────────────────────────────────────────────────
  far() {
    const b = this.b;
    const rng = this.rng;
    const { part, block, slab, post, ball } = tools(b);
    const beachTop = (water) => (c, x, y, z, r) => {
      if (y < -0.06) return c.setHex(0xdcb87f);
      const w = water(x, z, r);
      return c.setHex(w > 0.5 ? (Math.sin(x * 3 + z * 2) > 0.75 ? 0x55d0d4 : C.sea) : w > 0.35 ? C.foam : Math.sin(x * 1.3 + z * 2.1) > 0.3 ? 0xf7e2b2 : C.sand);
    };
    const sailboat = (hull = C.white, sail = C.white) => {
      block(0, -0.12, 0, 1.1, 0.26, 0.38, hull, S, 0.1);
      post(0.05, 0.1, 0, 0.04, 1.35, 0xd6d6d6);
      part(M, SHAPE.sail, 0.08, 0.2, 0, 0.5, 1.2, 1, sail);
      part(M, SHAPE.sail, 0.02, 0.2, 0, 0.45, 1.05, 1, sail, 0, Math.PI, 0);
    };

    // A ── a big steel arch bridge over the harbour, boats sailing underneath
    b.chunk(14, -0.6, -31, -0.3, 1, { delay: 0.86, phase: 0.6, amp: 0.3 }, () => {
      addLand(b, 3.9, { depthScale: 0.72, top: beachTop((x) => (Math.abs(x) < 2.6 ? 1 : 0)) });
      const span = 2.6;
      // sandstone pylons at each end
      for (const s of [-1, 1]) {
        b.at(s * (span + 0.15), 0, 0, 0, 1, () => {
          for (const z of [-0.45, 0.45]) block(0, 0, z, 0.55, 2.9, 0.42, C.sandstone, M, 0.03);
          block(0, 2.85, 0, 0.6, 0.18, 1.35, 0xc9b086, M, 0.02);
          block(0, 1.05, 0, 0.62, 0.3, 1.3, 0xc9b086, M, 0.02);
        });
      }
      // the arch: upper and lower chords with a lattice between them, on both sides of the deck
      const deckY = 1.15;
      const arch = (u) => [u * span, 0.25 + 3.3 * (1 - u * u)];
      for (const z of [-0.42, 0.42]) {
        let prev = null;
        for (let i = 0; i <= 16; i++) {
          const u = -1 + (i / 16) * 2;
          const [x, y] = arch(u);
          const top = [x, y + 0.42 * (0.35 + 0.65 * (1 - u * u))];
          if (prev) {
            for (const [a, c2] of [[prev.low, [x, y]], [prev.top, top]]) part(S, SHAPE.cyl6, (a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2, z, 0.09, Math.hypot(c2[0] - a[0], c2[1] - a[1]) + 0.03, 0.09, C.steel, 0, 0, Math.atan2(-(c2[0] - a[0]), c2[1] - a[1]));
            part(M, SHAPE.cyl6, (prev.low[0] + top[0]) / 2, (prev.low[1] + top[1]) / 2, z, 0.035, Math.hypot(top[0] - prev.low[0], top[1] - prev.low[1]), 0.035, C.steel, 0, 0, Math.atan2(-(top[0] - prev.low[0]), top[1] - prev.low[1]));
          }
          if (Math.abs(u) < 0.95 && y > deckY && i % 2 === 0) part(M, SHAPE.cyl6, x, (y + deckY) / 2, z, 0.03, y - deckY, 0.03, C.steel);
          prev = { low: [x, y], top };
        }
      }
      for (let i = 1; i < 8; i++) {
        const [x, y] = arch(-1 + (i / 8) * 2);
        part(M, SHAPE.box, x, y + 0.3, 0, 0.05, 0.05, 0.9, C.steel);
      }
      block(0, deckY - 0.1, 0, span * 2 + 0.6, 0.16, 1.0, 0x6f7783, M, 0.03);
      slab(0, deckY + 0.06, 0.47, span * 2 + 0.6, 0.1, 0.03, 0xb0b8c4);
      for (let i = 0; i < 9; i++) b.lit(WARM, 0.35, () => ball(-span + (i * span) / 4, deckY + 0.22, 0.48, 0.07, 0xfff0c0, L));
      this.halo(0, 3.9, 0, 3.0, 0xffd28a);
      // sailing boats drifting across the water
      b.slide(0, 0, 0.8, 0.2, 0, () => b.at(-1.2, 0.05, -0.1, 0.2, 0.55, () => sailboat()));
      b.slide(0.9, 0, 0, 0.14, 1.7, () => b.at(0.9, 0.05, 0.9, -0.3, 0.45, () => sailboat(0x2f6fd6)));
    });

    // B ── a lighthouse on a cliff
    b.chunk(25, 2.4, -45, -0.2, 0.9, { delay: 0.93, phase: 2.4, amp: 0.35 }, () => {
      addLand(b, 3.2, { depth: 4.6 });
      for (const [x, z, s] of [[-1.2, 0.8, 0.9], [1.3, 0.5, 0.7], [0.4, -1.2, 0.8], [-0.4, 1.6, 0.6]]) part(M, faceted(UNIT.ico1), x, 0.1, z, s, s * 0.6, s, 0xa79a8c, rng(), rng(), rng());
      b.at(0.1, 0, -0.1, 0, 1, () => {
        block(0, 0, 0, 1.6, 0.9, 1.1, C.white, M, 0.04);
        part(M, SHAPE.prism, 0, 1.15, 0, 1.6, 0.5, 1.1, C.terracotta);
        b.lit(WINDOW, 0.4, () => slab(-0.4, 0.3, 0.56, 0.3, 0.3, 0.02, C.glass, L));
        post(0.55, 0, 0.15, 0.95, 4.2, C.white, M, SHAPE.cyl);
        post(0.55, 2.0, 0.15, 0.98, 0.35, 0xd9342b, M, SHAPE.cyl);
        post(0.55, 4.2, 0.15, 1.2, 0.14, 0x2d3140, M, SHAPE.cyl);
        b.lit(0xfff2b0, -1, () => post(0.55, 4.34, 0.15, 0.6, 0.55, 0xfff6d8, L, SHAPE.cyl8));
        part(M, SHAPE.cone8, 0.55, 5.1, 0.15, 0.8, 0.5, 0.8, 0xd9342b);
        ball(0.55, 5.4, 0.15, 0.12, 0x2d3140);
        this.halo(0.55, 4.6, 0.15, 5.0, 0xfff0b0);
        // the lamp's beam sweeping round after dark
        b.spin(0.55, 4.6, 0.15, 'y', 0.9, 0, () => b.lit(0xfff3c0, 'night', () => part(L, SHAPE.cone8, 0.55 + 1.7, 4.6, 0.15, 0.5, 3.0, 0.22, 0xfff6d8, 0, 0, Math.PI / 2)));
      });
    });

    // C ── a surf beach: waves rolling in, Norfolk pines, a little surf club
    b.chunk(-15, -1.3, -27, 0.15, 1, { delay: 0.8, phase: 4.1, amp: 0.28 }, () => {
      addLand(b, 3.6, { depthScale: 0.72, top: beachTop((x, z) => (z > 0.9 ? 1 : z > 0.65 ? 0.4 : 0)) });
      for (let i = 0; i < 3; i++) {
        b.slide(0, 0, -0.35, 0.7, i * 2.1, () => part(M, SHAPE.box, -0.4 + i * 0.5, 0.04, 1.35 + i * 0.25, 4.2 - i * 0.8, 0.05, 0.12, C.foam));
      }
      const pine = (x, z, s) => b.at(x, 0, z, 0, s, () => {
        post(0, 0, 0, 0.14, 3.0, 0x7a5a40);
        for (let i = 0; i < 5; i++) part(M, SHAPE.cone8, 0, 0.9 + i * 0.5, 0, 1.3 - i * 0.22, 0.45, 1.3 - i * 0.22, C.pine[i % 3]);
      });
      pine(-1.8, -0.9, 1);
      pine(-0.9, -1.6, 0.85);
      pine(1.9, -1.2, 0.9);
      block(0.4, 0, -1.0, 1.6, 0.8, 0.9, C.wall, M, 0.04);
      part(M, SHAPE.prism, 0.4, 1.05, -1.0, 1.7, 0.45, 1.0, C.terracotta);
      for (const x of [-0.1, 0.4, 0.9]) b.lit(WINDOW, 0.2 + rng() * 0.8, () => slab(x, 0.3, -0.53, 0.28, 0.3, 0.02, C.glass, L));
      // a few surfboards and a beach umbrella
      for (let i = 0; i < 3; i++) part(S, SHAPE.sphere, 1.4 + i * 0.25, 0.45, -0.3, 0.26, 0.95, 0.06, [0x2ec4b6, 0xff6b6b, 0xffd21f][i]);
      post(-0.6, 0, 0.3, 0.04, 0.9, C.white);
      part(M, SHAPE.cone8, -0.6, 0.95, 0.3, 0.9, 0.25, 0.9, 0xff6b6b);
    });

    // D ── a suburb of terracotta roofs and gum trees
    b.chunk(-26, 4.8, -50, 0.35, 1, { delay: 0.96, phase: 1.3, amp: 0.4 }, () => {
      addLand(b, 3.8);
      const walls = [C.wall, 0xf7f1e6, 0xe9d7b6, 0xf3e6cc, 0xefe2c8];
      const spots = [[-1.9, 0.6], [-0.6, 1.1], [0.8, 0.8], [2.0, 0.2], [-1.2, -0.8], [0.4, -0.7], [1.6, -1.4]];
      spots.forEach(([x, z], i) => {
        b.at(x, 0, z, (i % 3) * 0.3 - 0.3, 1, () => {
          block(0, 0, 0, 1.0, 0.7, 0.8, walls[i % walls.length], M, 0.04);
          part(M, SHAPE.cone4, 0, 0.95, 0, 1.2, 0.5, 1.0, C.terracotta);
          b.lit(WINDOW, 0.2 + rng() * 0.9, () => slab(0.2, 0.25, 0.41, 0.26, 0.24, 0.02, C.glass, L));
        });
      });
      for (const [x, z] of [[-2.4, -0.6], [2.6, 1.0], [-0.1, 0.1]]) {
        post(x, 0, z, 0.14, 1.1, C.trunk);
        for (let i = 0; i < 3; i++) part(M, SHAPE.sphere, x + (i - 1) * 0.3, 1.2 + (i % 2) * 0.25, z, 0.8, 0.5, 0.7, C.gum[i]);
      }
    });

    // E ── a little harbour cove with sailing boats
    b.chunk(-9, -0.9, -19, 0.2, 1, { delay: 0.74, phase: 3.0, amp: 0.25 }, () => {
      addLand(b, 2.6, { top: beachTop((x, z, r) => (Math.hypot(x - 0.3, z - 0.2) < r * 0.62 ? 1 : Math.hypot(x - 0.3, z - 0.2) < r * 0.7 ? 0.4 : 0)) });
      b.slide(0.5, 0, 0.2, 0.17, 0.4, () => b.at(-0.2, 0.05, 0.2, 0.3, 0.6, () => sailboat()));
      b.slide(-0.4, 0, 0.3, 0.13, 2.2, () => b.at(0.9, 0.05, -0.3, -0.5, 0.5, () => sailboat(0xff6b6b)));
      // a jetty
      for (let i = 0; i < 4; i++) slab(-1.55 + i * 0.32, 0.0, 0.9, 0.3, 0.06, 0.4, 0xb0895e);
      for (let i = 0; i < 3; i++) post(-1.6 + i * 0.45, -0.3, 1.1, 0.07, 0.42, 0x8a6a48);
    });

    // F ── a distant cluster of towers (not on low quality)
    if (!this.low) {
      b.chunk(-4, 13, -68, 0.2, 1, { delay: 1, phase: 5.1, amp: 0.4 }, () => {
        addLand(b, 3.0);
        const towers = [[-1.2, 0.2, 0.9, 4.2, 0x8fb7d6], [-0.1, -0.4, 1.1, 5.6, 0xd9d2c3], [1.0, 0.3, 0.9, 3.4, 0x7aa6c8], [0.4, 0.9, 0.8, 2.4, 0xe8dcc0]];
        for (const [x, z, w, h, col] of towers) {
          block(x, 0, z, w, h, w, col, M, 0.03);
          for (let y = 0.4; y < h - 0.3; y += 0.45) b.lit(WINDOW, 0.2 + rng() * 0.9, () => slab(x, y, z + w / 2 + 0.01, w * 0.7, 0.18, 0.02, 0x5f7591, L));
        }
      });
    }
  }

  ambient(fx, dt, quality) {
    // sunlight glinting on the lagoon
    this.glintT -= dt;
    if (this.glintT > 0) return;
    this.glintT = quality === 'low' ? 0.3 : 0.12;
    const [x, y, z] = this.lagoon;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.85;
    fx.spark(x + Math.cos(a) * r * 1.3, y, z + Math.sin(a) * r * 0.75, 0, 0.05, 0, Math.random() < 0.5 ? 0xffffff : 0xbff6ff, 1.0 + Math.random() * 0.8, 0.45 + Math.random() * 0.4, 0, 1);
  }
}
