/**
 * Over the moon: a big, smiling crescent moon sits on the dais among twinkling stars, and the
 * hero takes a run-up and leaps clean over it, cheering — then turns round and does it again.
 */
import * as THREE from 'three';
import { keys, clamp, ease, lerp } from '../../../core/utils.js';
import { walk } from '../actor.js';
import { twinkle } from '../props.js';

const LOOP = 6.4;
const HALF = LOOP / 2;
const LEAP = [0.75, 1.75]; // within each half: take-off and landing
const FROM = 1.7;

/** A plump crescent moon standing on its back, opening to the right, with a sleepy smiling face. */
function moon(s) {
  const { k } = s;
  const R = 0.95;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R, Math.PI * 0.5, Math.PI * 1.5, false);
  // the inner curve: a wider, shallower arc back to the top, which leaves a fat crescent
  shape.absarc(0.52, 0, Math.hypot(0.52, R), Math.PI + Math.atan2(R, 0.52), Math.PI - Math.atan2(R, 0.52), true);
  const geo = s.own(new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.13, bevelSegments: 5, curveSegments: 28 }));
  geo.translate(0, 0, -0.15);
  const gold = k.mat(0xffe27a, { emissive: 0xffc23d, emissiveIntensity: 0.32, rough: 0.5 });
  const g = k.group();
  const body = k.mesh(geo, gold);
  body.position.set(0.25, R + 0.15, 0);
  g.add(body);
  // craters, and the face on the fattest part, looking out at the audience
  const crater = k.mat(0xf2c54f, { rough: 0.7 });
  [[-0.62, 1.75, 0.07], [-0.45, 0.42, 0.06], [-0.75, 0.95, 0.05]].forEach(([x, y, r]) => g.add(k.at(k.ball(crater, r, r, r * 0.35), x + 0.25, y, 0.31)));
  const C = new THREE.Vector3(-0.45 + 0.25, R + 0.2, 0.05);
  const face = s.face({ parent: g, radii: [0.3, 0.3, 0.26], center: C, eye: { yaw: 24, pitch: 10, size: 0.055 }, mouth: { pitch: -18, width: 0.075 }, cheeks: { color: 0xff8f5c, opacity: 0.6 }, brow: { color: 0xc27a08, thick: 0.01 } });
  face.set('happy', 1e9);
  const glow = k.halo(0xffe7a0, 3.2, 0.32);
  glow.position.set(-0.1, R + 0.1, -0.3);
  g.add(glow);
  return g;
}

export default {
  id: 'over-the-moon',
  loop: LOOP,
  frame: { x: 0, y: 1.45, z: 0.1, w: 4.4, h: 3.5 },
  view: { yaw: 0.06, pitch: 0.12 },
  theme: 'twilight',

  build(s) {
    const hero = s.hero();
    hero.mood('happy');
    const m = s.add(moon(s));
    m.position.set(0.05, 0, -0.05);
    const stars = Array.from({ length: 7 }, (_, i) => {
      const st = s.add(twinkle(s, { size: 0.12 + (i % 3) * 0.04 }));
      st.position.set(Math.cos(i * 1.9) * 1.8, 1.4 + ((i * 0.37) % 1) * 1.7, -0.6 - (i % 2) * 0.4);
      return st;
    });

    // each half of the loop: run in, leap over, land and cheer; then the other way
    const phase = (t) => {
      const half = t < HALF ? 0 : 1;
      const u = t - half * HALF;
      const dir = half ? -1 : 1;
      return { u, dir };
    };
    const xAt = (t) => {
      const { u, dir } = phase(t);
      const x = keys(u, [[0, -FROM], [LEAP[0], -0.95], [LEAP[1], 0.95], [2.6, FROM], [HALF, FROM]], ease.linear);
      return x * dir;
    };
    const yAt = (t) => {
      const { u } = phase(t);
      const j = clamp((u - LEAP[0]) / (LEAP[1] - LEAP[0]));
      return Math.sin(j * Math.PI) * 2.0;
    };
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      const { u } = phase(t);
      const air = u > LEAP[0] && u < LEAP[1];
      const run = u < LEAP[0] ? 1 : u > LEAP[1] && u < 2.6 ? 0.6 : 0;
      walk(P, t, { speed: 1.6, amount: run });
      if (air) {
        const j = (u - LEAP[0]) / (LEAP[1] - LEAP[0]);
        // tucked, arms flung up, a little forward roll
        P.legLX += -0.9;
        P.legRX += 0.5;
        P.armLZ += 2.3;
        P.armRZ -= 2.3;
        P.pitch += Math.sin(j * Math.PI) * 0.25;
        P.sq += Math.sin(j * Math.PI) * 0.08;
      }
      // landing squash, then a cheer
      const land = u - LEAP[1];
      if (land > 0 && land < 0.18) P.sq += -Math.sin((land / 0.18) * Math.PI) * 0.2;
      hero.clip(P, 'cheer', clamp((u - 2.15) / 0.75), u > 2.15 && u < 2.95 ? 1 : 0);
      // turn round to face the next run
      const { dir } = phase(t);
      const turn = keys(u, [[2.95, 0], [HALF, 1]]);
      P.yaw += lerp(dir * 1.1, -dir * 1.1, turn) * (u < LEAP[0] || u > 2.95 ? 1 : 0.55);
    };

    return {
      update(t) {
        hero.root.position.set(xAt(t), yAt(t), 0.45);
        stars.forEach((st, i) => {
          st.rotation.z = t * 1.5 + i;
          st.scale.setScalar(0.65 + 0.35 * Math.sin(t * 4 + i * 1.3) ** 2);
        });
        if (s.cue(LEAP[0] + 0.5) || s.cue(HALF + LEAP[0] + 0.5)) {
          _v.set(xAt(t), yAt(t) + 1.2, 0.6);
          s.fx.burst(_v, { count: 16, color: 0xffe08a, color2: 0xffffff, speed: 3, size: 0.45, life: 0.6, gravity: 1, up: 0.5 });
        }
      },
    };
  },
};

const _v = new THREE.Vector3();
