/**
 * The tip of the iceberg: a big glass tank of sea water on the dais. Above the waves, just a small
 * white tip of ice with a little flag on it; below, seen through the glass, an enormous iceberg
 * filling the tank. The hero peers at the tip through a magnifying glass… then looks down and gasps.
 */
import * as THREE from 'three';
import { keys, clamp } from '../../../core/utils.js';
import { gasp } from '../actor.js';

const LOOP = 7;
const LOOK_DOWN = 3.0;
const TANK = new THREE.Vector3(0.45, 0, -0.1);
const W = 2.3;
const D = 1.25;
const H = 1.55;
const WATER = 1.15;

function iceberg(s) {
  const { k } = s;
  const ice = k.mat(0xffffff, { rough: 0.3, flat: true, rim: 0.8 });
  const blue = k.mat(0xd8f0ff, { rough: 0.3, flat: true, rim: 0.6 });
  const g = k.group();
  const chunk = (m, x, y, z, sx, sy, sz, ry = 0) => {
    const c = k.mesh(s.own(new THREE.IcosahedronGeometry(1, 1)), m);
    c.position.set(x, y, z);
    c.scale.set(sx, sy, sz);
    c.rotation.set(0.3, ry, 0.2);
    g.add(c);
  };
  // the hidden mass: big, under the waterline
  chunk(blue, 0, 0.62, 0, 0.92, 0.55, 0.48, 0.2);
  chunk(ice, -0.38, 0.5, 0.08, 0.55, 0.42, 0.38, 1.1);
  chunk(blue, 0.42, 0.55, -0.05, 0.55, 0.48, 0.4, 2.0);
  chunk(ice, 0.05, 0.3, 0.05, 0.75, 0.3, 0.42, 0.7);
  // the little tip that shows
  chunk(ice, 0.08, 1.1, 0.02, 0.27, 0.34, 0.22, 0.4);
  chunk(ice, 0.2, 1.16, 0.0, 0.16, 0.26, 0.14, 1.4);
  return s.baked(g, { rough: 0.35 });
}

export default {
  id: 'the-tip-of-the-iceberg',
  loop: LOOP,
  frame: { x: 0.15, y: 1.0, z: 0.0, w: 3.8, h: 2.6 },
  view: { yaw: 0.12, pitch: 0.12 },
  avoid: ['the-elephant-in-the-room', 'break-the-ice'],

  build(s) {
    const { k } = s;
    // the tank: water, the glass round it, a dark rim along the top
    const water = new THREE.Mesh(s.own(new THREE.BoxGeometry(W - 0.06, WATER - 0.08, D - 0.06)), k.mat(0x4fb2ff, { rough: 0.1, transparent: true, opacity: 0.3, depthWrite: false }));
    water.position.set(TANK.x, 0.06 + (WATER - 0.08) / 2, TANK.z);
    water.renderOrder = 2;
    const glass = k.mesh(s.own(new THREE.BoxGeometry(W, H, D)), k.glass(0xd4ecff, 0.14));
    glass.position.set(TANK.x, H / 2 + 0.02, TANK.z);
    glass.renderOrder = 3;
    const frame = k.group();
    const navy = k.mat(0x3b3088, { rough: 0.5 });
    frame.add(k.at(k.box(navy, W + 0.1, 0.08, D + 0.1, 0.03), 0, 0.04, 0));
    for (const [x, z] of [[W / 2, D / 2], [-W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]]) frame.add(k.at(k.box(navy, 0.06, H, 0.06, 0.02), x, H / 2, z));
    frame.add(k.at(k.box(navy, W + 0.06, 0.05, 0.06, 0.02), 0, H, D / 2), k.at(k.box(navy, W + 0.06, 0.05, 0.06, 0.02), 0, H, -D / 2));
    s.add(s.baked(frame)).position.copy(TANK);
    const surface = k.at(k.box(k.mat(0x7fd0ff, { rough: 0.05, transparent: true, opacity: 0.5, depthWrite: false }), W - 0.06, 0.02, D - 0.06, 0.01), TANK.x, WATER - 0.01, TANK.z);
    surface.renderOrder = 2;
    // the waterline drawn on the glass, and a ring of foam round the tip
    const line = k.mat(0x2f8fe8, { rough: 0.3 });
    s.add(k.at(k.box(line, W - 0.04, 0.03, 0.012, 0.01), TANK.x, WATER, TANK.z + D / 2 + 0.01), k.at(k.box(line, 0.012, 0.03, D - 0.04, 0.01), TANK.x + W / 2 + 0.01, WATER, TANK.z));
    const foam = k.group();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      foam.add(k.at(k.ball(k.mat(0xffffff, { rough: 0.6 }), 0.07, 0.035, 0.07), Math.cos(a) * 0.33, 0, Math.sin(a) * 0.24));
    }
    s.add(s.baked(foam)).position.set(TANK.x + 0.08, WATER + 0.01, TANK.z);
    const berg = iceberg(s);
    berg.position.set(TANK.x - 0.05, 0.02, TANK.z);
    s.add(berg, water, surface, glass);
    // a little flag on the tip
    const flag = k.group();
    flag.add(k.at(k.cyl(k.mat(0x8a5a3c), 0.012, 0.012, 0.42, 6), 0, 0.21, 0));
    flag.add(k.at(k.box(k.mat(0xff5d73, { rough: 0.6 }), 0.2, 0.12, 0.012, 0.01), 0.1, 0.36, 0));
    flag.position.set(TANK.x + 0.12, 1.42, TANK.z);
    s.add(flag);
    // fish swimming round the berg
    const fishGeo = (() => {
      const f = k.group();
      f.add(k.ball(k.mat(0xffa23d), 0.09, 0.07, 0.05));
      f.add(k.at(k.cone(k.mat(0xff8a2a), 0.06, 0.08, 8), -0.12, 0, 0, 0, 0, Math.PI / 2));
      return s.bake(f);
    })();
    s.swarm(fishGeo, s.vc(), 3, (d, i, t) => {
      const a = t * (0.8 + i * 0.2) + i * 2;
      d.position.set(TANK.x + Math.cos(a) * 0.95, 0.25 + i * 0.28, TANK.z + Math.sin(a) * 0.45);
      d.rotation.y = -a + Math.PI;
    }, { shadow: false });

    const hero = s.hero();
    hero.place(-1.25, 0.55, 0.45);
    // a magnifying glass
    const lens = k.group();
    lens.add(k.at(k.cap(k.mat(0x8a5a3c), 0.03, 0.3), 0, -0.1, 0));
    lens.add(k.at(k.torus(k.metal(0xffc83d, 0.3), 0.14, 0.025), 0, 0.12, 0));
    lens.add(k.at(k.disc(k.glass(0xe8f6ff, 0.4), 0.13, 20), 0, 0.12, 0));
    hero.hold('R', lens, { rx: -1.3, y: -0.02 });

    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      const peer = keys(t, [[0.3, 0], [0.8, 1], [LOOK_DOWN - 0.2, 1], [LOOK_DOWN, 0]]);
      const down = keys(t, [[LOOK_DOWN - 0.1, 0], [LOOK_DOWN + 0.3, 1], [6.3, 1], [6.8, 0]]);
      // peering at the little tip through the magnifying glass…
      P.armRX += -peer * 1.75;
      P.armRZ += peer * 0.45;
      P.headY += peer * 0.3;
      P.headX += -peer * 0.12;
      // …then down at what lies below: gasp!
      P.headX += down * 0.35;
      P.headY += down * 0.45;
      gasp(P, keys(t, [[LOOK_DOWN + 0.2, 0], [LOOK_DOWN + 0.5, 1], [6.0, 1], [6.5, 0]]));
      P.y += Math.sin(clamp((t - LOOK_DOWN - 0.15) / 0.3) * Math.PI) * 0.12;
      P.pitch += -down * 0.05;
    };

    return {
      update(t) {
        surface.position.y = WATER - 0.01 + Math.sin(t * 2.2) * 0.012;
        berg.position.y = 0.02 + Math.sin(t * 1.1) * 0.015;
        flag.position.y = 1.42 + Math.sin(t * 1.1) * 0.015;
        flag.children[1].rotation.y = Math.sin(t * 5) * 0.4;
        hero.mood(t < LOOK_DOWN ? 'focus' : t < 6.3 ? 'surprised' : null);
        if (s.cue(LOOK_DOWN + 0.3)) s.sound('whoosh');
      },
    };
  },
};
