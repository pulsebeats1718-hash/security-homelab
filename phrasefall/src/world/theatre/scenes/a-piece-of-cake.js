/**
 * A piece of cake: a splendid layered cake sits on its stand with one slice cut out. The hero has
 * that piece on a plate — and polishes it off in three happy forkfuls, easy as anything, then
 * gives a cheer. (Another slice appears, of course.)
 */
import * as THREE from 'three';
import { keys, clamp, ease } from '../../../core/utils.js';

const LOOP = 6;
const BITES = [1.3, 2.3, 3.3];
const R = 0.72;
const HGT = 0.62;
const GAP = 0.9; // the cut-out wedge, radians
const START = -Math.PI / 4 - GAP / 2; // the cut faces the audience and the hero, on the left

/** The cake's layers, painted on the cut faces: sponge, cream, jam, sponge, cream, icing. */
function layersTexture(s) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 128;
  const g = c.getContext('2d');
  const bands = [['#f6d38c', 30], ['#fff6e3', 10], ['#e8455b', 8], ['#f6d38c', 30], ['#fff6e3', 10], ['#ff9db3', 40]];
  let y = 128;
  for (const [col, h] of bands) {
    g.fillStyle = col;
    g.fillRect(0, y - h, 16, h);
    y -= h;
  }
  const tex = s.own(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A wedge of cake (the part from angle a0 to a1) with its cut faces showing the layers. */
function cakePart(s, a0, a1, side, top) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(s.own(new THREE.CylinderGeometry(R, R, HGT, 40, 1, true, a0, a1 - a0)), side);
  outer.position.y = HGT / 2;
  const lid = new THREE.Mesh(s.own(new THREE.CircleGeometry(R, 40, a0 - Math.PI / 2, a1 - a0)), top);
  lid.rotation.x = -Math.PI / 2; // circle angle φ lands on cylinder angle φ + π/2
  lid.position.y = HGT;
  g.add(outer, lid);
  return g;
}

export default {
  id: 'a-piece-of-cake',
  loop: LOOP,
  frame: { x: 0.15, y: 1.05, z: 0.25, w: 3.3, h: 2.7 },
  view: { yaw: 0.2, pitch: 0.2 },
  avoid: ['the-icing-on-the-cake', 'bite-off-more-than-you-can-chew'],

  build(s) {
    const { k } = s;
    const side = k.mat(0xff9db3, { rough: 0.5, side: THREE.DoubleSide });
    const icing = k.mat(0xffc2d4, { rough: 0.4, side: THREE.DoubleSide });
    const inside = new THREE.MeshStandardMaterial({ map: layersTexture(s), roughness: 0.7, side: THREE.DoubleSide });
    s.own(inside);
    const cut = () => new THREE.Mesh(s.own(new THREE.PlaneGeometry(R, HGT)), inside);

    // the stand
    const stand = k.group();
    const china = k.mat(0xfff6e3, { rough: 0.3 });
    stand.add(k.at(k.cyl(china, 0.92, 0.88, 0.05, 40), 0, 0.5, 0), k.at(k.cyl(china, 0.1, 0.16, 0.48, 16), 0, 0.25, 0), k.at(k.cyl(china, 0.38, 0.42, 0.04, 24), 0, 0.02, 0));
    const cakeAt = new THREE.Vector3(0.62, 0.53, -0.05);
    s.add(s.baked(stand)).position.set(cakeAt.x, 0, cakeAt.z);

    // the cake with a wedge cut out, the cut faces showing the layers
    const cake = cakePart(s, START + GAP, START + Math.PI * 2, side, icing);
    for (const a of [START, START + GAP]) {
      const face = cut();
      face.position.set(Math.sin(a) * R * 0.5, HGT / 2, Math.cos(a) * R * 0.5);
      face.rotation.y = a - Math.PI / 2;
      cake.add(face);
    }
    // icing blobs round the top edge, strawberries and a candle
    const deco = k.group();
    for (let i = 0; i < 16; i++) {
      const a = START + GAP + 0.12 + (i / 16) * (Math.PI * 2 - GAP - 0.24);
      deco.add(k.at(k.ball(k.mat(0xfff6e3, { rough: 0.5 }), 0.07), Math.sin(a) * (R - 0.04), HGT + 0.02, Math.cos(a) * (R - 0.04)));
    }
    [[0.2, -0.25], [-0.25, -0.15], [0.05, 0.1]].forEach(([x, z]) => deco.add(k.at(k.ball(k.mat(0xff3b4f, { rough: 0.35 }), 0.09, 0.11, 0.09), x, HGT + 0.09, z)));
    deco.add(k.at(k.cyl(k.mat(0x5cc8ff), 0.03, 0.03, 0.26, 10), -0.05, HGT + 0.13, -0.3));
    cake.add(s.baked(deco));
    const flame = k.halo(0xffb84d, 0.35, 0.9);
    flame.position.set(-0.05, HGT + 0.32, -0.3);
    cake.add(flame);
    cake.position.copy(cakeAt);
    s.add(cake);

    // the slice on the hero's plate
    const slice = cakePart(s, START, START + GAP, side, icing);
    for (const a of [START, START + GAP]) {
      const face = cut();
      face.position.set(Math.sin(a) * R * 0.5, HGT / 2, Math.cos(a) * R * 0.5);
      face.rotation.y = a - Math.PI / 2;
      slice.add(face);
    }
    slice.add(k.at(k.ball(k.mat(0xff3b4f, { rough: 0.35 }), 0.08, 0.1, 0.08), Math.sin(START + GAP / 2) * R * 0.6, HGT + 0.08, Math.cos(START + GAP / 2) * R * 0.6));
    // centre the slice on its own middle so it sits on the plate
    const mid = new THREE.Vector3(Math.sin(START + GAP / 2) * R * 0.45, 0, Math.cos(START + GAP / 2) * R * 0.45);
    for (const c of slice.children) c.position.sub(mid);
    const plate = k.group();
    plate.add(k.cyl(k.mat(0xfff6e3, { rough: 0.3 }), 0.34, 0.3, 0.03, 24));
    plate.add(k.at(k.torus(k.mat(0x5cc8ff), 0.31, 0.012), 0, 0.016, 0, Math.PI / 2, 0, 0));
    slice.scale.setScalar(0.55);
    slice.position.y = 0.02;
    plate.add(slice);

    const hero = s.hero();
    hero.place(-0.55, 0.3, 0.55);
    hero.hold('L', plate, { upright: true, x: 0.05, y: -0.05, z: 0.18, ry: -0.6 });
    const fork = k.group();
    const silver = k.metal(0xe3e7ef, 0.25);
    fork.add(k.at(k.cap(silver, 0.022, 0.42), 0, 0.15, 0));
    for (const x of [-0.03, 0, 0.03]) fork.add(k.at(k.cap(silver, 0.009, 0.1), x, 0.4, 0));
    hero.hold('R', fork, { rx: 0.4 });

    const left = (t) => {
      let n = 0;
      for (const b of BITES) if (t > b) n++;
      return t > LOOP - 0.4 ? 3 : n;
    };
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      P.armLX += -1.0;
      P.armLZ += -0.2;
      // forkfuls: down to the plate, up to the mouth
      let lift = 0;
      for (const b of BITES) lift = Math.max(lift, keys(t, [[b - 0.55, 0], [b - 0.3, -0.4], [b, 1], [b + 0.3, 0]]));
      P.armRX += -0.9 - lift * 0.9;
      P.armRZ += 0.35 + lift * 0.25;
      P.headX += 0.12 - lift * 0.08;
      // a big happy cheer when it is all gone
      hero.clip(P, 'cheer', clamp((t - 3.9) / 0.8), t > 3.9 && t < 4.7 ? 1 : 0);
      P.headZ += Math.sin(t * 2) * 0.05;
    };

    return {
      update(t) {
        const n = left(t);
        const grow = keys(t, [[LOOP - 0.45, 0], [LOOP - 0.1, 1]], ease.outBack);
        const size = n >= 3 ? grow : 1 - n / 3.4;
        slice.scale.setScalar(0.55 * Math.max(0.001, size));
        flame.scale.setScalar(0.35 + Math.sin(t * 17) * 0.04);
        hero.mood(t > 3.8 && t < 5.4 ? 'happy' : t % 1 < 0.5 ? 'happy' : 'neutral');
        BITES.forEach((b) => {
          if (!s.cue(b)) return;
          hero.rig.head.getWorldPosition(_v);
          _v.y += hero.rig.headCenter.y * 0.7;
          _v.z += 0.45;
          s.fx.burst(_v, { count: 10, color: 0xffc2d4, color2: 0xf6d38c, speed: 1.6, size: 0.35, life: 0.45, gravity: 5, up: 0.6 });
        });
        if (s.cue(3.95)) {
          hero.rig.head.getWorldPosition(_v);
          _v.y += 1.2;
          s.fx.burst(_v, { count: 18, color: 0xffe08a, color2: 0xffffff, speed: 3, size: 0.45, life: 0.6, gravity: 1, up: 1 });
          s.sound('star');
        }
      },
    };
  },
};

const _v = new THREE.Vector3();
