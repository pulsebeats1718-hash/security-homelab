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

/** A plump crescent moon standing on its back, opening to the right, its face on the inside curve. */
function moon(s) {
  const { k } = s;
  const gold = k.mat(0xffd23f, { emissive: 0xffb300, emissiveIntensity: 0.28, rough: 0.45 });
  const g = k.group();
  const R = 0.62;
  const n = 15;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const a = THREE.MathUtils.lerp(-2.25, 2.25, u);
    const r = 0.06 + Math.sin(u * Math.PI) * 0.3;
    g.add(k.at(k.ball(gold, r, r, r * 0.85), -Math.cos(a) * R * 0.85, Math.sin(a) * R + R + 0.05, 0));
  }
  // a few darker craters
  const crater = k.mat(0xf0b52a, { rough: 0.6 });
  [[-0.72, 0.85, 0.2, 0.07], [-0.6, 1.25, 0.21, 0.05], [-0.62, 0.45, 0.2, 0.05]].forEach(([x, y, z, r]) => g.add(k.at(k.ball(crater, r, r, r * 0.4), x, y, z)));
  const body = s.baked(g, { rough: 0.45 });
  const out = k.group(body);
  // the face, on the fattest part of the crescent, looking out at the audience
  const C = new THREE.Vector3(-0.62 * 0.85, 0.67, 0);
  const face = s.face({ parent: out, radii: [0.36, 0.36, 0.31], center: C, eye: { yaw: 26, pitch: 8, size: 0.05 }, mouth: { pitch: -16, width: 0.07 }, cheeks: { color: 0xff8f5c, opacity: 0.55 }, brow: { color: 0xc27a08, thick: 0.009 } });
  face.set('happy', 1e9);
  out.add(k.halo(0xffe7a0, 2.6, 0.35));
  out.children[out.children.length - 1].position.set(-0.2, 0.7, -0.2);
  return out;
}

export default {
  id: 'over-the-moon',
  loop: LOOP,
  frame: { x: 0, y: 1.45, z: 0.1, w: 4.4, h: 3.5 },
  view: { yaw: 0.06, pitch: 0.12 },

  build(s) {
    const hero = s.hero();
    hero.mood('happy');
    const m = s.add(moon(s));
    m.position.set(0.12, 0, -0.05);
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
        const { u } = phase(t);
        if (s.cue(LEAP[0] + 0.5) || s.cue(HALF + LEAP[0] + 0.5)) {
          _v.set(xAt(t), yAt(t) + 1.2, 0.6);
          s.fx.burst(_v, { count: 16, color: 0xffe08a, color2: 0xffffff, speed: 3, size: 0.45, life: 0.6, gravity: 1, up: 0.5 });
        }
        void u;
      },
    };
  },
};

const _v = new THREE.Vector3();
