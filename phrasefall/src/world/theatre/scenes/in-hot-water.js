/**
 * In hot water: the hero has got into a bath that is far, far too hot — clouds of steam, bubbles
 * popping, the giant thermometer beside it right up in the red. Flushed and flustered, it flaps
 * at the steam and hops about: ooh, ah, ow!
 */
import * as THREE from 'three';
import { keys } from '../../../core/utils.js';

const LOOP = 6;
const TUB = new THREE.Vector3(-0.05, 0, 0.2);

function bathtub(s) {
  const { k } = s;
  const enamel = k.mat(0xfdfbf6, { rough: 0.25 });
  const gold = k.metal(0xffc83d, 0.3);
  const g = k.group();
  g.add(k.at(k.box(enamel, 2.05, 0.66, 1.05, 0.3), 0, 0.5, 0));
  g.add(k.at(k.box(k.mat(0x8f7bff, { rough: 0.4 }), 2.0, 0.05, 1.0, 0.02), 0, 0.3, 0));
  for (const [x, z] of [[0.8, 0.38], [-0.8, 0.38], [0.8, -0.38], [-0.8, -0.38]]) g.add(k.at(k.ball(gold, 0.1, 0.12, 0.1), x, 0.1, z));
  // the tap
  g.add(k.at(k.cyl(gold, 0.05, 0.05, 0.35, 10), -0.88, 0.95, -0.35));
  g.add(k.at(k.torus(gold, 0.13, 0.045, Math.PI), -0.75, 1.12, -0.35, 0, 0, 0));
  k.both((sd) => g.add(k.at(k.cyl(k.mat(sd > 0 ? 0xff5d73 : 0x5cc8ff), 0.06, 0.06, 0.05, 12), -0.88 + sd * 0.12, 0.92, -0.42)));
  return s.baked(g);
}

function thermometer(s) {
  const { k } = s;
  const g = k.group();
  g.add(k.at(k.box(k.mat(0xfff6e3, { rough: 0.5 }), 0.36, 1.7, 0.1, 0.12), 0, 0.95, -0.03));
  g.add(k.at(k.cap(k.glass(0xeaf6ff, 0.3), 0.075, 1.4), 0, 1.0, 0.04));
  g.add(k.at(k.ball(k.mat(0xff3b4f, { emissive: 0xff2040, emissiveIntensity: 0.3 }), 0.13), 0, 0.3, 0.04));
  for (let i = 0; i < 6; i++) g.add(k.at(k.box(k.mat(0x3b3088), 0.08, 0.018, 0.02, 0.005), 0.12, 0.55 + i * 0.2, 0.03));
  const base = s.baked(g);
  const red = k.at(k.cap(k.mat(0xff3b4f, { emissive: 0xff2040, emissiveIntensity: 0.5 }), 0.05, 1), 0, 0.35, 0.07);
  const out = k.group(base, red);
  return { group: out, red };
}

export default {
  id: 'in-hot-water',
  loop: LOOP,
  frame: { x: 0.2, y: 1.15, z: 0.2, w: 3.6, h: 2.8 },
  view: { yaw: 0.16, pitch: 0.2 },
  avoid: ['be-on-thin-ice', 'skate-on-thin-ice'],

  build(s) {
    const { k } = s;
    s.add(bathtub(s)).position.copy(TUB);
    const water = s.add(k.at(k.box(k.mat(0x7fd0ff, { rough: 0.1, transparent: true, opacity: 0.85 }), 1.82, 0.04, 0.82, 0.02), TUB.x, 0.86, TUB.z));
    const thermo = thermometer(s);
    s.add(thermo.group).position.set(1.45, 0, -0.25);

    const hero = s.hero();
    hero.place(TUB.x + 0.15, TUB.z, 0.15, 0.02);
    hero.mood('worried');

    // steam: soft puffs rising and swelling; bubbles popping at the surface
    const steamMat = k.mat(0xffffff, { rough: 1, transparent: true, opacity: 0.55, depthWrite: false });
    const puff = s.own(new THREE.SphereGeometry(1, 12, 9));
    const steam = s.swarm(puff, steamMat, 14, (d, i, t) => {
      const u = (t * 0.45 + i / 14) % 1;
      const x = TUB.x + (((i * 0.618) % 1) - 0.5) * 1.6 + Math.sin(t + i) * 0.1;
      const z = TUB.z + (((i * 0.382) % 1) - 0.5) * 0.6;
      d.position.set(x + u * 0.2, 0.9 + u * 1.9, z);
      d.scale.setScalar((0.12 + u * 0.32) * Math.sin(u * Math.PI));
    }, { shadow: false });
    steam.renderOrder = 4;
    s.swarm(puff, k.mat(0xffffff, { rough: 0.2, transparent: true, opacity: 0.8 }), 12, (d, i, t) => {
      const u = (t * 1.3 + i / 12) % 1;
      const x = TUB.x + (((i * 0.7548) % 1) - 0.5) * 1.6;
      const z = TUB.z + (((i * 0.5698) % 1) - 0.5) * 0.65;
      d.position.set(x, 0.88, z);
      d.scale.setScalar(0.05 + u * 0.05 + (u > 0.9 ? (u - 0.9) * 0.6 : 0));
      return u < 0.97;
    }, { shadow: false });

    hero.pose = (P, t) => {
      hero.idle(P, { arms: false, own: false });
      // hopping from foot to foot in the hot water, flapping at the steam
      const hop = Math.abs(Math.sin(t * 5.5));
      P.y += hop * 0.1;
      P.roll += Math.sin(t * 5.5) * 0.06;
      const flap = Math.sin(t * 16);
      P.armLZ += 1.3 + flap * 0.35;
      P.armRZ -= 1.3 - flap * 0.35;
      P.armLX += -0.4;
      P.armRX += -0.4;
      P.headX += 0.05 + Math.sin(t * 2) * 0.06;
      // and every so often an OW! jump
      const ow = keys(t, [[2.7, 0], [2.9, 1], [3.3, 0]]);
      P.y += ow * 0.3;
      P.sq += ow * 0.12;
    };

    return {
      update(t) {
        thermo.red.scale.y = 1.25 + Math.sin(t * 2) * 0.05;
        thermo.red.position.y = 0.35 + 0.5 * thermo.red.scale.y * 0.5;
        water.position.y = 0.86 + Math.sin(t * 7) * 0.008;
        hero.mood(t > 2.7 && t < 3.4 ? 'hurt' : 'worried');
        if (Math.random() < 0.12) {
          hero.rig.head.getWorldPosition(_v);
          s.fx.spark(_v.x + (Math.random() - 0.5) * 0.8, _v.y + 0.7, _v.z + 0.2, (Math.random() - 0.5) * 1.4, 1.2, 0.2, 0x7ec8ff, 0.4, 0.5, 5, 0.8);
        }
        if (s.cue(2.8)) {
          hero.rig.head.getWorldPosition(_v);
          _v.y += 1.0;
          s.fx.burst(_v, { count: 16, color: 0xff7a5c, color2: 0xffe08a, speed: 3, size: 0.5, life: 0.5, gravity: 1, up: 1 });
        }
      },
    };
  },
};

const _v = new THREE.Vector3();
