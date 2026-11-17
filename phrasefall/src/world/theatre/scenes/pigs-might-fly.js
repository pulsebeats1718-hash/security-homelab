/**
 * Pigs might fly: three pink pigs with little white wings flap round and round the sky above the
 * island, banking through the clouds, while the hero points up, astonished.
 */
import * as THREE from 'three';
import { cloud } from '../props.js';

const LOOP = 6;
const PIGS = 3;

function pigBody(s) {
  const { k } = s;
  const pink = k.mat(0xffa8c4, { rough: 0.6 });
  const deep = k.mat(0xff86ad, { rough: 0.5 });
  const dark = k.mat(0x3a2333, { rough: 0.3 });
  const white = k.mat(0xffffff);
  const g = k.group();
  g.add(k.ball(pink, 0.42, 0.37, 0.52));
  g.add(k.at(k.ball(pink, 0.33, 0.31, 0.3), 0, 0.1, 0.44));
  g.add(k.at(k.cyl(deep, 0.13, 0.15, 0.12, 20), 0, 0.04, 0.74, Math.PI / 2, 0, 0));
  k.both((sd) => {
    g.add(k.at(k.ball(dark, 0.024, 0.036, 0.02), sd * 0.048, 0.045, 0.802));
    g.add(k.at(k.ball(dark, 0.048, 0.06, 0.03), sd * 0.135, 0.21, 0.68));
    g.add(k.at(k.ball(white, 0.017), sd * 0.135 + 0.016, 0.232, 0.705));
    g.add(k.at(k.ball(k.mat(0xff6f9a, { rough: 0.9 }), 0.06, 0.035, 0.02), sd * 0.22, 0.06, 0.66, 0, sd * 0.5, 0));
    g.add(k.at(k.cone(pink, 0.11, 0.2, 12), sd * 0.2, 0.39, 0.38, 0.65, 0, -sd * 0.55));
  });
  for (const [x, z] of [[0.22, 0.26], [-0.22, 0.26], [0.22, -0.28], [-0.22, -0.28]]) {
    g.add(k.at(k.cap(pink, 0.085, 0.3), x, -0.3, z, 0.25, 0, 0));
    g.add(k.at(k.cyl(dark, 0.07, 0.08, 0.06, 12), x, -0.45, z + 0.04, 0.25, 0, 0));
  }
  g.add(k.at(k.torus(deep, 0.07, 0.024, Math.PI * 1.6), 0, 0.12, -0.53, 0, Math.PI / 2, 0));
  return s.bake(g);
}

/** A feathery wing reaching out along +X from its hinge at the origin. */
function wing(s) {
  const { k } = s;
  const white = k.mat(0xffffff, { rough: 0.7 });
  const tip = k.mat(0xe8f1ff, { rough: 0.7 });
  const g = k.group();
  g.add(k.at(k.ball(white, 0.3, 0.05, 0.18), 0.26, 0.02, 0, 0, 0, 0.12));
  g.add(k.at(k.ball(tip, 0.26, 0.04, 0.13), 0.38, 0.05, -0.12, 0, -0.35, 0.18));
  g.add(k.at(k.ball(tip, 0.22, 0.04, 0.11), 0.36, 0.06, 0.12, 0, 0.3, 0.18));
  return s.bake(g);
}

export default {
  id: 'pigs-might-fly',
  loop: LOOP,
  frame: { x: 0, y: 2.25, z: 0, w: 4.4, h: 4.7 },
  view: { yaw: 0.1, pitch: 0.08 },

  build(s) {
    const hero = s.hero();
    hero.place(0, 0.35, 0);
    hero.mood('surprised');
    const sky = [s.add(cloud(s, { w: 1.8, h: 0.75 })), s.add(cloud(s, { w: 1.3, h: 0.6 })), s.add(cloud(s, { w: 1.1, h: 0.5 }))];
    sky[0].position.set(-1.5, 4.1, -1.4);
    sky[1].position.set(1.7, 3.1, -1.6);
    sky[2].position.set(0.6, 4.6, -2.0);

    const pigs = Array.from({ length: PIGS }, (_, i) => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), flap: 0, i }));
    const e = new THREE.Euler(0, 0, 0, 'YXZ');
    const fly = (t) => {
      for (const pig of pigs) {
        const i = pig.i;
        const th = (t / LOOP + i / PIGS) * Math.PI * 2;
        const rx = 1.75 - i * 0.12;
        const rz = 0.95;
        pig.p.set(Math.cos(th) * rx, 3.0 + Math.sin(th * 2 + i * 1.7) * 0.45 + (i === 1 ? 0.35 : 0), -0.15 + Math.sin(th) * rz);
        const vx = -Math.sin(th) * rx;
        const vz = Math.cos(th) * rz;
        const vy = Math.cos(th * 2 + i * 1.7) * 0.9;
        e.set(-Math.atan2(vy, Math.hypot(vx, vz)) * 0.6, Math.atan2(vx, vz), -0.38);
        pig.q.setFromEuler(e);
        pig.flap = Math.sin(t * 13 + i * 2) * 0.75;
      }
    };
    fly(0);
    const SCALE = 0.78;
    const vmat = s.vc();
    s.swarm(pigBody(s), vmat, PIGS, (d, i) => {
      d.position.copy(pigs[i].p);
      d.quaternion.copy(pigs[i].q);
      d.scale.setScalar(SCALE);
    });
    const w = wing(s);
    const wmat = s.vc({ side: THREE.DoubleSide });
    for (const side of [1, -1]) {
      s.swarm(w, wmat, PIGS, (d, i) => {
        d.position.copy(pigs[i].p);
        d.quaternion.copy(pigs[i].q);
        d.scale.set(SCALE * side, SCALE, SCALE);
        d.translateY(0.26 * SCALE);
        d.translateX(0.2 * SCALE * side);
        d.rotateZ(pigs[i].flap * side);
      });
    }

    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      // watching the first pig go round, pointing up at it
      const th = (t / LOOP) * Math.PI * 2;
      P.headX += -0.5;
      P.headY += Math.max(-0.7, Math.min(0.7, Math.cos(th) * 0.7));
      P.armRZ += -2.25 + Math.sin(t * 3) * 0.08;
      P.armRX += 0.3;
      P.armLZ += 1.1;
      P.armLX += -0.95;
      P.torsoX += -0.06;
    };

    return {
      update(t) {
        fly(t);
        for (const c of sky) c.position.x += Math.sin(t * 0.5 + c.position.y) * 0.001;
      },
    };
  },
};
