/**
 * Raining cats and dogs: little cats and dogs drift down from a grey cloud on their brollies,
 * swaying like parachutes, and land with a hop all round the hero, who shelters under a big
 * umbrella and looks up in delight. Real rain falls too (and stops on the umbrella).
 */
import * as THREE from 'three';
import { mulberry32, lerp, clamp } from '../../../core/utils.js';
import { cloud, brolly, dropGeometry } from '../props.js';

const LOOP = 6;
const PETS = 16;
const FALL = 0.74; // share of each pet's cycle spent in the air

/** A tiny cat or dog hanging from a brolly by one raised paw; the brolly's tip is at y ≈ 1.05. */
function pet(s, kind, c) {
  const { k } = s;
  const fur = k.mat(c.fur);
  const pale = k.mat(c.pale);
  const dark = k.mat(0x2a2233, { rough: 0.3 });
  const white = k.mat(0xffffff);
  const g = k.group();
  g.add(k.at(k.ball(fur, 0.15, 0.16, 0.14), 0, 0.18, 0));
  g.add(k.at(k.ball(pale, 0.09, 0.1, 0.05), 0, 0.16, 0.11));
  g.add(k.at(k.ball(fur, 0.17, 0.15, 0.155), 0, 0.42, 0.01));
  k.both((sd) => {
    g.add(k.at(k.ball(dark, 0.026, 0.034, 0.02), sd * 0.062, 0.445, 0.142));
    g.add(k.at(k.ball(white, 0.01), sd * 0.062 + 0.009, 0.458, 0.158));
    g.add(k.at(k.cap(fur, 0.04, 0.14), sd * 0.075, 0.03, 0.03, -0.2, 0, 0)); // dangling legs
  });
  if (kind === 'cat') {
    const pink = k.mat(0xff9db3);
    k.both((sd) => {
      g.add(k.at(k.cone(fur, 0.06, 0.13, 12), sd * 0.095, 0.57, 0, 0, 0, -sd * 0.32));
      g.add(k.at(k.cone(pink, 0.033, 0.08, 10), sd * 0.093, 0.56, 0.025, 0, 0, -sd * 0.32));
    });
    g.add(k.at(k.ball(pink, 0.02, 0.016, 0.014), 0, 0.41, 0.162));
    g.add(k.at(k.torus(fur, 0.11, 0.028, Math.PI * 1.1), -0.13, 0.2, -0.08, 0, 0.5, -0.4));
  } else {
    g.add(k.at(k.ball(pale, 0.075, 0.058, 0.065), 0, 0.385, 0.135));
    g.add(k.at(k.ball(dark, 0.028, 0.022, 0.02), 0, 0.41, 0.2));
    const ear = k.mat(c.ear ?? c.fur);
    k.both((sd) => g.add(k.at(k.ball(ear, 0.05, 0.11, 0.035), sd * 0.16, 0.42, 0, 0, 0, sd * 0.35)));
    g.add(k.at(k.cap(fur, 0.03, 0.14), -0.02, 0.2, -0.15, -0.9, 0, 0));
  }
  // the right paw stays down, the left reaches up to the brolly's handle
  g.add(k.at(k.cap(fur, 0.04, 0.16), -0.14, 0.18, 0.03, 0, 0, -0.5));
  g.add(k.at(k.cap(fur, 0.04, 0.26), 0.17, 0.4, 0.02, 0, 0, 0.18));
  const b = brolly(s, { color: c.canopy, trim: 0xfff6e3, r: 0.32, len: 0.5, bake: false });
  b.position.set(0.19, 0.5, 0.02);
  b.rotation.z = 0.12;
  g.add(b);
  return s.bake(g);
}

export default {
  id: 'rain-cats-and-dogs',
  loop: LOOP,
  frame: { x: 0, y: 2.55, z: 0.2, w: 4.7, h: 5.5 },
  view: { yaw: 0.14, pitch: 0.1 },
  avoid: ['under-the-weather'],

  build(s) {
    const { k } = s;
    const hero = s.hero();
    hero.place(0, 0.05, 0);
    hero.mood('happy');
    const umbrella = brolly(s, { color: 0x3a7bd5, trim: 0xfff6e3, r: 0.86, len: 1.55 });
    hero.hold('R', umbrella, { upright: true, rz: -0.18 });
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      P.armRZ += -1.25;
      P.armRX += -0.2;
      // the free hand held out, palm up, feeling for rain
      P.armLZ += 0.75 + Math.sin(t * 2.2) * 0.08;
      P.armLX += -0.55;
      P.headX += -0.42;
      P.headY += Math.sin((t / LOOP) * Math.PI * 4) * 0.4;
    };

    // the cloud they come from
    const sky = s.add(cloud(s, { w: 4.8, h: 1.2, dark: true }));
    sky.position.set(0, 5.35, -0.5);
    const sky2 = s.add(cloud(s, { w: 2.4, h: 0.8, dark: true }));
    sky2.position.set(-1.6, 5.0, -0.1);

    // the pets: two kinds of cat and two of dog, four of each, each on its own drifting cycle
    const looks = [
      ['cat', { fur: 0xffa64d, pale: 0xfff1de, canopy: 0xff5d73 }],
      ['dog', { fur: 0xd9a066, pale: 0xfff3e2, ear: 0x8a5a3c, canopy: 0xffc83d }],
      ['cat', { fur: 0x6f7c98, pale: 0xfbf8f2, canopy: 0x3ddbb4 }],
      ['dog', { fur: 0xf6efe4, pale: 0xffffff, ear: 0x3b2a26, canopy: 0x8f7bff }],
    ];
    const rng = mulberry32(7);
    const spots = [];
    for (let i = 0; i < PETS; i++) {
      const a = (i / PETS) * Math.PI * 2 + rng() * 0.3;
      const r = 1.15 + rng() * 0.95;
      let x = Math.cos(a) * r;
      const z = 0.25 + Math.sin(a) * r * 0.62;
      if (z > 0.4 && Math.abs(x) < 0.75) x = (x < 0 ? -1 : 1) * (0.75 + rng() * 0.3); // keep the hero's face clear
      spots.push({ x, z, phase: ((i * 5) % PETS) / PETS + rng() * 0.03, wob: rng() * 6, landed: false });
    }
    const vmat = s.vc();
    looks.forEach(([kind, c], v) => {
      const geo = pet(s, kind, c);
      s.swarm(geo, vmat, PETS / 4, (d, i, t) => {
        const sp = spots[v + i * 4];
        const u = (t / LOOP + sp.phase) % 1;
        const ground = s.ground(sp.x, sp.z);
        if (u < FALL) {
          const f = u / FALL;
          d.position.set(sp.x + Math.sin(t * 1.3 + sp.wob) * 0.22 * (1 - f * 0.6), lerp(5.0, ground, f), sp.z);
          d.rotation.z = Math.sin(t * 2.3 + sp.wob) * 0.24 * (1 - f * 0.5);
          d.rotation.y = Math.sin(t * 0.7 + sp.wob) * 0.5;
          d.scale.setScalar(clamp(f * 6, 0.2, 1));
        } else {
          const f = (u - FALL) / (1 - FALL);
          const hop = f < 0.4 ? Math.sin((f / 0.4) * Math.PI) * 0.16 : 0;
          d.position.set(sp.x, ground + hop, sp.z);
          d.rotation.y = Math.sin(sp.wob) * 0.5;
          d.scale.setScalar(f > 0.8 ? Math.max(0.001, 1 - (f - 0.8) / 0.2) : 1);
        }
        d.scale.multiplyScalar(1.08);
      });
    });

    // rain: it stops on the umbrella
    const canopy = { x: 0, y: 2.6, z: 0 };
    const drops = s.swarm(dropGeometry(s, 0.032), k.mat(0x7ec8ff, { rough: 0.1, transparent: true, opacity: 0.7, depthWrite: false }), 70, (d, i, t) => {
      const r1 = ((i * 0.6180339) % 1) * 2 - 1;
      const r2 = ((i * 0.7548776) % 1) * 2 - 1;
      const x = r1 * 2.4;
      const z = 0.2 + r2 * 1.3;
      const u = (t * 1.25 + ((i * 0.3819) % 1)) % 1;
      const covered = Math.hypot(x - canopy.x, z - canopy.z) < 0.85;
      const floor = covered ? canopy.y : s.ground(x, z);
      const y = lerp(4.9, floor, u);
      d.position.set(x, y, z);
      return y > floor + 0.02;
    });
    drops.castShadow = false;

    return {
      update(t) {
        // where the umbrella's canopy is, so the rain stops on it
        umbrella.getWorldPosition(_p);
        canopy.x = _p.x + 0.25;
        canopy.z = _p.z;
        canopy.y = _p.y + 1.45;
        // a soft puff each time a pet lands
        spots.forEach((sp, j) => {
          const u = (t / LOOP + sp.phase) % 1;
          const down = u >= FALL && u < FALL + 0.05;
          if (down && !sp.landed) {
            _p.set(sp.x, s.ground(sp.x, sp.z) + 0.15, sp.z);
            s.fx.burst(_p, { count: 6, color: 0xffffff, color2: 0xbfe4ff, speed: 1.6, size: 0.35, life: 0.45, gravity: 1, up: 0.6 });
          }
          sp.landed = down;
        });
      },
    };
  },
};

const _p = new THREE.Vector3();
