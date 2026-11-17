/**
 * Have your head in the clouds: the hero wanders dreamily about with its head right inside a big
 * fluffy cloud — only its blissful face peeking out — while more clouds drift by at head height and
 * little birds and twinkles circle overhead.
 */
import * as THREE from 'three';
import { walk } from '../actor.js';
import { cloud, twinkle } from '../props.js';

const LOOP = 8;

/**
 * A big cloud swallowing a head of radius r (centred on the head): puffs above, behind and out to
 * the sides like any cloud in the sky, open at the front so the dreaming face peeks out.
 */
function headCloud(s, r) {
  const { k } = s;
  const white = k.mat(0xffffff, { rough: 0.95 });
  const g = k.group();
  const puffs = [
    [0, 0.8, -0.15, 0.62],
    [-0.62, 0.62, -0.1, 0.5],
    [0.62, 0.66, -0.05, 0.5],
    [-0.3, 0.72, 0.42, 0.34],
    [0.32, 0.74, 0.4, 0.32],
    [0, 0.1, -0.72, 0.72],
    [-1.12, 0.05, -0.05, 0.56],
    [1.14, 0.08, -0.05, 0.56],
    [-1.7, -0.1, 0, 0.4],
    [1.72, -0.06, 0, 0.42],
    [-0.92, -0.5, 0.12, 0.42],
    [0.92, -0.5, 0.12, 0.42],
    [0, -0.6, -0.35, 0.5],
  ];
  for (const [x, y, z, rr] of puffs) g.add(k.at(k.ball(white, rr * r, rr * r * 0.88, rr * r), x * r, y * r, z * r));
  return s.baked(g, { rough: 0.95 });
}

function birdie(s, color) {
  const { k } = s;
  const g = k.group();
  const body = k.mat(color, { rough: 0.5 });
  g.add(k.ball(body, 0.12, 0.11, 0.15));
  g.add(k.at(k.ball(body, 0.09), 0, 0.09, 0.11));
  g.add(k.at(k.cone(k.mat(0xffa23d), 0.03, 0.08, 8), 0, 0.08, 0.22, Math.PI / 2, 0, 0));
  k.both((sd) => {
    g.add(k.at(k.ball(k.mat(0x2a2233), 0.018), sd * 0.05, 0.12, 0.18));
    g.add(k.at(k.ball(body, 0.12, 0.02, 0.07), sd * 0.13, 0.04, 0, 0, 0, sd * 0.5));
  });
  g.add(k.at(k.ball(body, 0.05, 0.02, 0.08), 0, 0.03, -0.17, 0.4, 0, 0));
  return s.bake(g);
}

export default {
  id: 'have-your-head-in-the-clouds',
  loop: LOOP,
  frame: { x: 0, y: 1.6, z: 0.1, w: 3.9, h: 3.4 },
  view: { yaw: 0.08, pitch: 0.1 },

  build(s) {
    const hero = s.hero();
    hero.mood('happy');
    const r = Math.max(...(hero.rig.headRadii ?? [0.57, 0.52, 0.53]));
    const neckY = hero.headY;
    hero.attach('head', headCloud(s, r), { y: hero.rig.headCenter.y + 0.04 });
    // more cloud drifting by at the same height: the sky has come down to head level
    const drift = [s.add(cloud(s, { w: 1.5, h: 0.62 })), s.add(cloud(s, { w: 1.2, h: 0.5 })), s.add(cloud(s, { w: 1.0, h: 0.45 }))];

    const birds = [0x5cc8ff, 0xffc83d].map((c) => birdie(s, c));
    const vmat = s.vc();
    const head = new THREE.Vector3();
    birds.forEach((geo, b) => {
      s.swarm(geo, vmat, 1, (d, i, t) => {
        const a = t * 2.1 + b * Math.PI;
        d.position.set(head.x + Math.cos(a) * 1.25, head.y + 0.85 + Math.sin(t * 3 + b) * 0.12, head.z + Math.sin(a) * 0.8);
        d.rotation.y = -a;
        d.rotation.z = Math.sin(t * 20 + b) * 0.15;
      });
    });
    const stars = [0, 1, 2].map(() => s.add(twinkle(s, { size: 0.13 })));

    const xAt = (t) => Math.sin((t / LOOP) * Math.PI * 2) * 0.5;
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      const speed = Math.abs(Math.cos((t / LOOP) * Math.PI * 2));
      walk(P, t, { speed: 0.5, amount: 0.8 * speed + 0.2 });
      // arms drifting, a lazy sway, head tipped back in a daydream
      P.armLZ += 0.55 + Math.sin(t * 1.3) * 0.15;
      P.armRZ -= 0.55 + Math.sin(t * 1.3 + 1) * 0.15;
      P.headX += -0.2;
      P.headZ += Math.sin(t * 0.9) * 0.14;
      P.roll += Math.sin(t * 0.9) * 0.05;
    };

    return {
      update(t) {
        const x = xAt(t);
        hero.root.position.set(x, 0, 0.25);
        hero.yaw = Math.cos((t / LOOP) * Math.PI * 2) * 0.45;
        hero.rig.head.getWorldPosition(head);
        head.y += hero.rig.headCenter.y;
        drift[0].position.set(-1.6 + Math.sin(t * 0.4) * 0.15, neckY + 0.35, -1.0);
        drift[1].position.set(1.65 + Math.sin(t * 0.5 + 1) * 0.15, neckY + 0.1, -0.8);
        drift[2].position.set(1.2 + Math.sin(t * 0.45 + 2) * 0.1, neckY + 0.95, -1.5);
        stars.forEach((st, i) => {
          const a = -t * 1.6 + (i / 3) * Math.PI * 2;
          st.position.set(head.x + Math.cos(a) * 1.1, head.y + 1.0 + Math.sin(t * 2 + i) * 0.1, head.z + Math.sin(a) * 0.6);
          st.rotation.z = t * 2 + i;
          st.scale.setScalar(0.7 + 0.3 * Math.sin(t * 5 + i * 2));
        });
      },
    };
  },
};
