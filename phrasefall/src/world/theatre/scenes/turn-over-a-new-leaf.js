/**
 * Turn over a new leaf: a big, tired brown leaf drifts down onto the dais — spotty, nibbled and
 * dull. The hero bends down, takes hold of its edge and flips it right over: the other side is
 * fresh, bright, shiny green, and the hero cheers among the sparkles.
 */
import * as THREE from 'three';
import { keys, clamp, ease, lerp } from '../../../core/utils.js';

const LOOP = 6.6;
const LANDED = 0.9;
const FLIP = [1.85, 2.75];
const LEAF = new THREE.Vector3(0.45, 0, 0.35);

/** A giant two-sided leaf lying flat (old side up), its long axis along X; its pivot is its spine. */
function leaf(s) {
  const { k } = s;
  const old = k.mat(0xa8763a, { rough: 0.9 });
  const oldVein = k.mat(0x7a5226, { rough: 0.9 });
  const spot = k.mat(0x6b4a2a, { rough: 0.95 });
  const fresh = k.mat(0x47c24f, { rough: 0.3, rim: 0.7 });
  const freshVein = k.mat(0x9be36a, { rough: 0.35 });
  const top = k.group();
  const under = k.group();
  const L = 0.95;
  const W = 0.55;
  // each face is a flat half-ellipsoid with a pointed tip and a fan of veins
  const half = (g, m, vein, up) => {
    const sgn = up ? 1 : -1;
    g.add(k.at(k.dome(m, L, 0.05, W, 0.5), 0, 0, 0, up ? 0 : Math.PI, 0, 0));
    g.add(k.at(k.cone(m, 0.16, 0.36, 12), L + 0.1, 0, 0, 0, 0, -Math.PI / 2));
    g.children[g.children.length - 1].scale.set(0.14, 1, 1); // flatten the tip (its local x is the leaf's thickness)
    g.add(k.at(k.box(vein, L * 1.9, 0.02, 0.035, 0.01), 0, sgn * 0.035, 0));
    for (let i = -3; i <= 3; i++) {
      if (!i) continue;
      const x = i * 0.24;
      g.add(k.at(k.box(vein, 0.4, 0.016, 0.026, 0.008), x + 0.1, sgn * 0.03, 0.18, 0, -0.75, 0));
      g.add(k.at(k.box(vein, 0.4, 0.016, 0.026, 0.008), x + 0.1, sgn * 0.03, -0.18, 0, 0.75, 0));
    }
  };
  half(top, old, oldVein, true);
  half(under, fresh, freshVein, false);
  // the old side has seen better days: spots and a nibble
  [[-0.4, 0.2, 0.09], [0.25, -0.22, 0.07], [0.5, 0.15, 0.06], [-0.1, -0.3, 0.05]].forEach(([x, z, r]) => top.add(k.at(k.ball(spot, r, 0.012, r), x, 0.045, z)));
  const g = k.group(s.baked(top), s.baked(under));
  // the stalk
  g.add(k.at(k.cap(k.mat(0x7a5226), 0.04, 0.42), -L - 0.12, 0, 0, 0, 0, Math.PI / 2));
  return g;
}

export default {
  id: 'turn-over-a-new-leaf',
  loop: LOOP,
  frame: { x: 0.1, y: 1.0, z: 0.3, w: 3.5, h: 2.7 },
  view: { yaw: 0.1, pitch: 0.24 },

  build(s) {
    const hero = s.hero();
    hero.place(-0.85, 0.25, 0.45);
    hero.yaw = 0.55;
    const lf = s.add(leaf(s));
    lf.scale.setScalar(1.05);

    const flip = (t) => keys(t, [[FLIP[0], 0], [FLIP[1], 1], [LOOP - 0.75, 1], [LOOP - 0.15, 1]], ease.inOutCubic);
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      // bend down, grab the edge, heave it over, then cheer
      const bend = keys(t, [[LANDED, 0], [FLIP[0] - 0.3, 1], [FLIP[0] + 0.25, 0.6], [FLIP[1], 0]]);
      P.torsoX += bend * 0.5;
      P.headX += bend * 0.25;
      P.y += -bend * 0.2;
      P.legLX += -bend * 0.5;
      P.legRX += bend * 0.3;
      P.armLX += -bend * 1.5;
      P.armRX += -bend * 1.5;
      const heave = keys(t, [[FLIP[0], 0], [FLIP[0] + 0.35, 1], [FLIP[1], 0]]);
      P.armLZ += heave * 1.6;
      P.armRZ -= heave * 1.6;
      hero.clip(P, 'cheer', clamp((t - FLIP[1] - 0.1) / 0.8), t > FLIP[1] + 0.1 && t < FLIP[1] + 0.9 ? 1 : 0);
    };

    return {
      update(t) {
        const f = flip(t);
        if (t < LANDED) {
          // drifting down, rocking like a falling leaf
          const u = t / LANDED;
          lf.position.set(LEAF.x + Math.sin(u * 7) * 0.25 * (1 - u), lerp(2.6, 0.06, ease.outQuad(u)), LEAF.z);
          lf.rotation.set(Math.sin(u * 9) * 0.35 * (1 - u), 0.2, Math.sin(u * 7 + 1) * 0.25 * (1 - u));
        } else if (t > LOOP - 0.75) {
          // the fresh leaf floats off with a sparkle, ready for the next
          const u = clamp((t - (LOOP - 0.75)) / 0.7);
          lf.position.set(LEAF.x + u * 0.3, 0.06 + u * 1.2, LEAF.z);
          lf.rotation.set(Math.PI * f, 0.2, 0);
          lf.scale.setScalar(1.05 * (1 - u) + 0.001);
        } else {
          lf.scale.setScalar(1.05);
          // flipping over its long axis, lifted in an arc
          lf.position.set(LEAF.x, 0.06 + Math.sin(f * Math.PI) * 1.0, LEAF.z);
          lf.rotation.set(Math.PI * f, 0.2, Math.sin(f * Math.PI) * 0.15);
        }
        hero.mood(t > FLIP[1] ? 'happy' : t > LANDED ? 'focus' : null);
        if (s.cue(FLIP[1])) {
          _v.set(LEAF.x, 0.3, LEAF.z);
          s.fx.burst(_v, { count: 30, color: 0x9be36a, color2: 0xffe08a, speed: 4, size: 0.55, life: 0.8, gravity: 2, spread: 1.2, up: 1.5 });
          s.fx.ring(_v.setY(0.05), { color: 0x9be36a, from: 0.3, to: 2.2, life: 0.5, flat: true, opacity: 0.7 });
          s.sound('star');
        }
        if (t > FLIP[1] && t < LOOP - 0.8 && Math.random() < 0.15) {
          s.fx.spark(LEAF.x + (Math.random() - 0.5) * 1.6, 0.1, LEAF.z + (Math.random() - 0.5) * 0.9, 0, 0.6, 0, 0xffffff, 0.45, 0.7, -0.2, 1);
        }
      },
    };
  },
};

const _v = new THREE.Vector3();
