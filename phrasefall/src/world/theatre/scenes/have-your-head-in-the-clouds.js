/**
 * Have your head in the clouds: the clouds have come down to the island, and the hero wanders
 * dreamily through them — body below, head right up among them, eyes closed in a happy daydream,
 * with little birds and twinkles circling.
 */
import * as THREE from 'three';
import { walk } from '../actor.js';
import { cloud, twinkle } from '../props.js';

const LOOP = 8;

/** A ring of cloud round the neck, so the head pokes up out of it; wider at the sides. */
function collar(s, r) {
  const { k } = s;
  const white = k.mat(0xffffff, { rough: 0.95 });
  const g = k.group();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rr = (0.3 + (i % 3) * 0.05) * r * 1.6;
    g.add(k.at(k.ball(white, rr, rr * 0.82, rr), Math.sin(a) * r * 1.05, (i % 2) * 0.06, Math.cos(a) * r * 0.95));
  }
  k.both((sd) => {
    g.add(k.at(k.ball(white, 0.42, 0.34, 0.4), sd * r * 1.75, -0.05, -0.05));
    g.add(k.at(k.ball(white, 0.3, 0.26, 0.3), sd * r * 2.35, -0.1, 0.02));
  });
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
  frame: { x: 0, y: 1.55, z: 0.1, w: 3.8, h: 3.3 },
  view: { yaw: 0.08, pitch: 0.1 },

  build(s) {
    const hero = s.hero();
    hero.mood('happy');
    const r = Math.max(...(hero.rig.headRadii ?? [0.57, 0.52, 0.53]));
    const neckY = hero.rig.metrics.hipY + (hero.rig.metrics.torsoTop ?? 0.68) + 0.12;
    const ring = s.add(collar(s, r));
    // more cloud drifting by at the same height: the sky has come down to head level
    const drift = [s.add(cloud(s, { w: 1.5, h: 0.62 })), s.add(cloud(s, { w: 1.2, h: 0.5 })), s.add(cloud(s, { w: 1.0, h: 0.45 }))];

    const birds = [0x5cc8ff, 0xffc83d].map((c) => birdie(s, c));
    const vmat = s.vc();
    const head = new THREE.Vector3();
    birds.forEach((geo, b) => {
      s.swarm(geo, vmat, 1, (d, i, t) => {
        const a = t * 2.1 + b * Math.PI;
        d.position.set(head.x + Math.cos(a) * 0.95, head.y + 0.55 + Math.sin(t * 3 + b) * 0.12, head.z + Math.sin(a) * 0.65);
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
        ring.position.set(head.x, neckY + Math.sin(t * 1.4) * 0.03, head.z);
        ring.rotation.y = hero.yaw * 0.5;
        drift[0].position.set(-1.45 + Math.sin(t * 0.4) * 0.15, neckY + 0.15, -0.6);
        drift[1].position.set(1.5 + Math.sin(t * 0.5 + 1) * 0.15, neckY - 0.05, -0.3);
        drift[2].position.set(1.15 + Math.sin(t * 0.45 + 2) * 0.1, neckY + 0.65, -1.2);
        stars.forEach((st, i) => {
          const a = -t * 1.6 + (i / 3) * Math.PI * 2;
          st.position.set(head.x + Math.cos(a) * 0.8, head.y + 0.75 + Math.sin(t * 2 + i) * 0.1, head.z + Math.sin(a) * 0.55);
          st.rotation.z = t * 2 + i;
          st.scale.setScalar(0.7 + 0.3 * Math.sin(t * 5 + i * 2));
        });
      },
    };
  },
};
