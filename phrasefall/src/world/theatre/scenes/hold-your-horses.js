/**
 * Hold your horses: two eager toy horses prance and strain to gallop off, and the hero, heels dug
 * in and leaning right back, hangs on to their reins. They rear up — whoa! — and settle again.
 */
import * as THREE from 'three';
import { keys } from '../../../core/utils.js';
import { rope } from '../props.js';

const LOOP = 6;
const REAR = [2.4, 3.6];

/** A toy horse facing +Z: { group, body, legs: [front L, front R, back L, back R], bridle } */
function horse(s, { coat, mane, muzzle }) {
  const { k } = s;
  const c = k.mat(coat, { rough: 0.55 });
  const m = k.mat(mane, { rough: 0.8 });
  const nose = k.mat(muzzle, { rough: 0.5 });
  const dark = k.mat(0x2a2233, { rough: 0.3 });
  const white = k.mat(0xffffff);
  const strap = k.mat(0xe8323c, { rough: 0.5 });
  const b = k.group();
  b.add(k.at(k.cap(c, 0.34, 1.2), 0, 0.84, 0, Math.PI / 2, 0, 0));
  b.add(k.at(k.cap(c, 0.17, 0.62), 0, 1.15, 0.46, 0.55, 0, 0));
  b.add(k.at(k.ball(c, 0.23, 0.25, 0.33), 0, 1.45, 0.7, 0.55, 0, 0));
  b.add(k.at(k.ball(nose, 0.16, 0.14, 0.15), 0, 1.31, 0.9));
  k.both((sd) => {
    b.add(k.at(k.ball(dark, 0.022, 0.03, 0.02), sd * 0.06, 1.33, 1.03));
    b.add(k.at(k.ball(dark, 0.045, 0.055, 0.03), sd * 0.15, 1.5, 0.78, 0, sd * 0.6, 0));
    b.add(k.at(k.ball(white, 0.016), sd * 0.165, 1.52, 0.8));
    b.add(k.at(k.cone(c, 0.065, 0.17, 10), sd * 0.1, 1.68, 0.6, -0.2, 0, -sd * 0.25));
  });
  // mane down the neck, a forelock, and a swishy tail
  for (let i = 0; i < 6; i++) b.add(k.at(k.ball(m, 0.09 - i * 0.004, 0.11, 0.07), 0, 1.6 - i * 0.12, 0.56 - i * 0.12, 0.5, 0, 0));
  b.add(k.at(k.ball(m, 0.08, 0.06, 0.1), 0, 1.66, 0.74, 0.8, 0, 0));
  b.add(k.at(k.cap(m, 0.07, 0.55), 0, 0.68, -0.68, -0.35, 0, 0));
  b.add(k.at(k.cap(m, 0.06, 0.45), 0.03, 0.55, -0.74, -0.15, 0, 0.1));
  // a red bridle round the nose
  b.add(k.at(k.torus(strap, 0.16, 0.022), 0, 1.33, 0.88, 0.25, 0, 0));
  b.add(k.at(k.torus(strap, 0.2, 0.02), 0, 1.47, 0.7, 0.55 + Math.PI / 2, 0, 0));
  const body = s.baked(b);
  const group = k.group();
  const pitch = k.group(body); // rears up about the hind hips
  pitch.position.set(0, 0.66, -0.38);
  body.position.set(0, -0.66, 0.38);
  group.add(pitch);
  // legs: a pivot at the hip / shoulder each, swinging
  const legGeo = (() => {
    const l = k.group();
    l.add(k.at(k.cap(c, 0.09, 0.66), 0, -0.3, 0));
    l.add(k.at(k.cyl(dark, 0.1, 0.11, 0.09, 12), 0, -0.6, 0.01));
    return s.bake(l);
  })();
  const vm = s.vc();
  const legs = [[0.15, 0.36], [-0.15, 0.36], [0.15, -0.38], [-0.15, -0.38]].map(([x, z], i) => {
    const pivot = k.at(k.group(), x, 0.66, z);
    pivot.add(k.mesh(legGeo, vm));
    (i < 2 ? body : group).add(pivot); // the front legs ride on the body as it rears
    return pivot;
  });
  const bridle = new THREE.Object3D();
  bridle.position.set(0.17, 1.3, 0.86);
  body.add(bridle);
  return { group, pitch, legs, bridle };
}

export default {
  id: 'hold-your-horses',
  loop: LOOP,
  frame: { x: 0.1, y: 1.2, z: 0.15, w: 4.5, h: 3.0 },
  view: { yaw: -0.08, pitch: 0.14 },

  build(s) {
    const hero = s.hero();
    hero.place(-1.35, 0.45, 0.8);
    hero.mood('focus');
    const horses = [
      horse(s, { coat: 0xb9774a, mane: 0x4a2a1e, muzzle: 0xf1d2b0 }),
      horse(s, { coat: 0xf3ece2, mane: 0x8a6a5a, muzzle: 0xffd9e0 }),
    ];
    const spots = [
      [0.4, 0.6, 0.8, 1.1],
      [1.35, -0.3, 0.65, 1.06],
    ];
    horses.forEach((h, i) => {
      h.group.position.set(spots[i][0], 0, spots[i][1]);
      h.group.rotation.y = spots[i][2];
      h.group.scale.setScalar(spots[i][3]);
      s.add(h.group);
    });
    const reins = horses.map(() => s.add(rope(s, { r: 0.02, color: 0x8a5a3c })));

    const rear = (t) => keys(t, [[REAR[0], 0], [REAR[0] + 0.35, 1], [REAR[1] - 0.3, 1], [REAR[1], 0]]);
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false, own: false });
      const r = rear(t);
      // leaning back with heels dug in, arms out front gripping the reins
      P.pitch += -0.22 + r * 0.3;
      P.legLX += -0.45 + Math.sin(t * 9) * 0.06;
      P.legRX += -0.15 - Math.sin(t * 9) * 0.06;
      P.armLX += -1.15 - r * 0.25 + Math.sin(t * 11) * 0.05;
      P.armRX += -1.05 - r * 0.25 + Math.sin(t * 11 + 1) * 0.05;
      P.armLZ += -0.1;
      P.armRZ += 0.1;
      P.headX += 0.1 - r * 0.15;
      P.y += r * 0.1 + Math.abs(Math.sin(t * 9)) * 0.02;
      P.x += Math.sin(t * 23) * 0.012;
    };
    hero.yaw = 1.2;

    return {
      update(t) {
        const r = rear(t);
        horses.forEach((h, i) => {
          const ph = i * 1.3;
          // prancing: legs high-stepping in turn; rearing up on the hind legs
          const trot = 1 - r;
          h.legs[0].rotation.x = -Math.max(0, Math.sin(t * 9 + ph)) * 0.9 * trot - r * 1.3 + Math.sin(t * 14) * 0.3 * r;
          h.legs[1].rotation.x = -Math.max(0, Math.sin(t * 9 + ph + Math.PI)) * 0.9 * trot - r * 1.1 - Math.sin(t * 14) * 0.3 * r;
          h.legs[2].rotation.x = Math.max(0, Math.sin(t * 9 + ph + 1)) * 0.35 * trot + r * 0.25;
          h.legs[3].rotation.x = Math.max(0, Math.sin(t * 9 + ph + 1 + Math.PI)) * 0.35 * trot + r * 0.25;
          h.pitch.rotation.x = -r * (0.62 + i * 0.08) + Math.sin(t * 9 + ph) * 0.03 * trot;
          h.group.position.y = Math.abs(Math.sin(t * 9 + ph)) * 0.05 * trot;
          h.group.position.x = spots[i][0] + Math.sin(t * 2.3 + i) * 0.04;
          // the rein from the hero's hand to the bridle
          h.bridle.getWorldPosition(_b);
          hero.handPos(i === 0 ? 'L' : 'R', _a);
          reins[i].userData.span(_a, _b, 0.05);
        });
        hero.mood(r > 0.3 ? 'surprised' : 'focus');
        if (s.cue(REAR[0] + 0.3)) {
          for (const h of horses) {
            h.group.getWorldPosition(_a);
            s.fx.burst(_a.setY(0.1), { count: 10, color: 0xe8d8b8, speed: 2.2, size: 0.5, life: 0.6, gravity: -0.5, up: 0.4 });
          }
        }
        // dust kicked up by the hero's skidding heels
        if (Math.random() < 0.08) {
          hero.root.getWorldPosition(_a);
          s.fx.spark(_a.x + 0.25, 0.08, _a.z + 0.1, (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.4, 0, 0xe8d8b8, 0.5, 0.6, -0.2, 1.5);
        }
      },
    };
  },
};

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
