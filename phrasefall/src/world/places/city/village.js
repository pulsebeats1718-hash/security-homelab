/**
 * The village — Home Island's little high street, on a floating islet just behind the island so
 * the island itself keeps its trees, lanterns and garden exactly as they were. A cobbled lane runs
 * past a row of cottage shops: a tea room (its chalkboard on the cobbles), a bakery and the village
 * shop, under slate and thatch, with a street-name plate on the corner. At the end of the lane, a
 * small green with an oak, a bench and the village noticeboard; one of its notes is a poster of what
 * the player is learning (the phrase signs start here, at level 1).
 *
 * Built like the cities (a Diorama: one merged Batch, pop and season materials, a SignSet), and
 * driven by Home: setPop, apply and update are passed on.
 */
import { mulberry32 } from '../../../core/utils.js';
import { Diorama, SHAPE, addLand } from '../kit.js';
import { KIND } from '../../seasons/shader.js';
import { SignSet } from '../../signs.js';
import { cityMaterials } from './materials.js';
import { cityParts } from './parts.js';

const WARM = 0xffc46b;

export class Village extends Diorama {
  constructor(island, quality) {
    super(island, quality);
    this.rng2 = mulberry32(4242);
    Object.assign(this.mats, cityMaterials(this));
    this.signs = new SignSet(this, 'home');
    this.build();
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
  }

  build() {
    const b = this.b;
    const P = cityParts(this, b, this.rng2);
    const { part, block, slab, post, ball } = P;
    const k = P.k;
    const signs = this.signs;
    const top = (c, x, y, z, r) => {
      if (y < -0.06) return c.setHex(0x5fb455);
      const e = Math.hypot(x, z / 0.42) / r;
      // the cobbled lane along the front, lawn behind
      return c.setHex(e > 0.92 ? 0x6fc15a : z > 0.62 && z < 1.25 ? (Math.sin(x * 9) * Math.sin(z * 11) > 0 ? 0xb9b2a5 : 0xa8a195) : Math.sin(x * 2.1 + z * 1.3) > 0.5 ? 0x86d06a : 0x7ac65e);
    };

    /** a cottage shop on the lane: walls, a roof, a shopfront and its fascia (returns the fascia) */
    const cottage = (x, w, o) => {
      b.at(x, 0, 0.0, o.ry ?? 0, 1, () => {
        const d = 0.95;
        const h = o.h ?? 1.25;
        block(0, 0, 0, w, h, d, o.wall, o.key ?? k.render, 0.04);
        if (o.thatch) {
          part('matte', SHAPE.prism, 0, h + 0.3, 0, w + 0.16, 0.62, d + 0.2, 0xc9a35a);
          slab(0, h + 0.55, 0, w + 0.18, 0.08, 0.22, 0xb08a48);
        } else P.roofSlope(0, h - 0.02, 0, w + 0.1, 0.5, d + 0.12, 0x58606e);
        P.chimney(w / 2 - 0.18, h + 0.05, -0.12, 0.2, 0.55, 0.26, 2, 0xa9583f);
        // upstairs: a small cottage window or two
        for (const wx of o.upper ?? [-w / 4, w / 4]) P.sash(wx, h - 0.42, d / 2, 0.24, 0.26, { bars: [2, 1], curtain: 0xd98a8a, lintel: null, frame: 0xffffff });
        const f = P.shopfront(0, 0, d / 2, w - 0.08, { color: o.joinery, door: o.door ?? 'right', h: 0.8, fascia: 0.16, glow: 0xffd59a, lit: 0.1 });
        signs.add(0, f.y + f.h / 2, f.z, w - 0.32, f.h * 0.92, { style: 'fascia', ...o.sign });
        o.extra?.(d / 2, h);
      });
    };

    b.chunk(0.7, -0.55, -9.3, 0.05, 1, { delay: 0.66, phase: 0.9, amp: 0.05 }, () => {
      addLand(b, 3.9, { depthScale: 0.42, top });
      // the cottages, left to right: the tea room, the bakery, the village shop
      cottage(-2.1, 1.25, {
        wall: 0xf6eedf,
        joinery: 0x2f6b5a,
        thatch: true,
        door: 'right',
        sign: { id: 'fancy-a-cuppa', text: 'Fancy a Cuppa?', sub: 'Tea room', bg: '#2f6b5a', ink: '#fff6e0', font: 'display', upper: false },
      });
      cottage(-0.78, 1.2, {
        wall: 0xf3d9c2,
        joinery: 0x7a3b4a,
        door: 'left',
        upper: [0.2],
        sign: { id: 'sell-like-hot-cakes', text: 'Sell Like Hot Cakes', sub: 'Bakery', bg: '#7a3b4a', ink: '#ffe8c8', font: 'display', upper: false },
        extra: (z, h) => {
          // the street-name plate on the corner, beside the upstairs window
          slab(-0.28, h - 0.46, z + 0.005, 0.56, 0.18, 0.015, 0x151515);
          signs.add(-0.28, h - 0.37, z + 0.016, 0.54, 0.16, { style: 'street', id: 'a-piece-of-cake', text: 'Piece of Cake Lane', district: '' });
          // loaves in the window
          for (let i = 0; i < 3; i++) ball(0.0 + i * 0.16, 0.24, z + 0.05, 0.13, 0xd9a35a, 'matte', 0.6);
        },
      });
      cottage(0.52, 1.25, {
        wall: 0xd9d0c0,
        key: k.stone,
        joinery: 0x24496b,
        door: 'mid',
        sign: { id: 'bits-and-bobs', text: 'Bits and Bobs', sub: 'Village shop', bg: '#24496b', ink: '#fff3d6', upper: false, font: 'display' },
        extra: (z) => {
          // a crate of apples and a basket of flowers out front
          block(0.38, 0, z + 0.16, 0.26, 0.12, 0.18, 0x9a6a45, 'matte', 0.01);
          for (let i = 0; i < 6; i++) ball(0.3 + (i % 3) * 0.08, 0.14, z + 0.12 + Math.floor(i / 3) * 0.08, 0.07, i % 2 ? 0xe2483a : 0x8ad35a);
        },
      });
      // the tea room's chalkboard on the cobbles
      b.at(-1.5, 0, 0.88, 0.2, 1, () => {
        const a = P.aboard(0.28, 0.38, 0x6b4a32);
        signs.add(0, a.y, a.z, 0.28, 0.38, { style: 'chalk', head: 'Today', lines: [{ id: 'put-the-kettle-on', text: 'Put the kettle on' }, { id: 'elevenses', text: 'Elevenses' }] }, { rx: a.rx });
      });
      // a lantern on a post at the corner of the lane
      post(1.35, 0, 0.75, 0.05, 1.05, 0x3a3d44, 'satin');
      b.lit(WARM, -1, () => part('glow', SHAPE.lantern, 1.35, 1.12, 0.75, 0.12, 0.18, 0.12, 0, 0, 0, 0x5a4630));
      this.halo(1.35, 1.12, 0.75, 1.3);
      // the green: an oak, a bench and the village noticeboard
      b.at(2.3, 0, 0.05, -0.2, 1, () => {
        post(0.55, 0, -0.35, 0.18, 0.9, 0x7a5a40);
        b.kind(KIND.FOLIAGE, () => {
          for (const [x, y, z, d] of [[0.55, 1.25, -0.35, 1.0], [0.2, 1.05, -0.2, 0.7], [0.9, 1.1, -0.45, 0.72], [0.55, 1.55, -0.4, 0.66]]) part('matte', SHAPE.sphere, x, y, z, d, d * 0.85, d, 0x5aae4e);
        });
        for (const x of [-0.3, 0.3]) post(x - 0.2, 0, 0.35, 0.05, 0.86, 0x6b4a32);
        slab(-0.2, 0.36, 0.33, 0.7, 0.52, 0.04, 0x6b4a32);
        part('matte', SHAPE.prism, -0.2, 0.96, 0.33, 0.78, 0.14, 0.16, 0x58606e);
        signs.add(-0.2, 0.62, 0.356, 0.64, 0.46, { style: 'notice', lines: [{ id: 'lend-a-hand', text: 'Lend a hand' }, { id: 'count-me-in', text: 'Count me in' }, { id: 'the-more-the-merrier', text: 'The more the merrier' }, { id: 'give-it-a-go', text: 'Give it a go' }] });
        // a poster beside it of what the player is learning
        post(0.35, 0, 0.42, 0.04, 0.82, 0x6b4a32);
        slab(0.35, 0.42, 0.42, 0.3, 0.4, 0.03, 0x6b4a32);
        signs.add(0.35, 0.62, 0.437, 0.27, 0.36, { style: 'poster', text: '' }, { live: { period: 10 } });
        // a bench
        for (const x of [-0.95, -0.45]) slab(x, 0, 0.55, 0.04, 0.2, 0.2, 0x3a3d44, 'satin');
        slab(-0.7, 0.2, 0.55, 0.6, 0.03, 0.2, 0xb07444);
        part('matte', SHAPE.box, -0.7, 0.32, 0.46, 0.6, 0.12, 0.02, 0xb07444, -0.15, 0, 0);
      });
    });
    this.ground = null;
  }
}
