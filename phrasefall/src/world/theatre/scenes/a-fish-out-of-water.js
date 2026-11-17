/**
 * A fish out of water: a goldfish leaps out of its bowl and lands on the dry dais, where it
 * flops about, gasping and bewildered, while the hero looks on in alarm — until, with one big
 * hop, it splashes safely home again.
 */
import * as THREE from 'three';
import { keys, clamp, lerp, ease } from '../../../core/utils.js';
import { gasp } from '../actor.js';

const LOOP = 7;
const OUT = 1.25; // leaps out
const LAND = 1.8;
const BACK = 5.05; // hops home
const HOME = 5.6;
const BOWL = new THREE.Vector3(-0.95, 0, -0.05);
const SPOT = new THREE.Vector3(0.3, 0, 0.55);

function goldfish(s) {
  const { k } = s;
  const orange = k.mat(0xff8a2a, { rough: 0.35 });
  const fin = k.mat(0xffb35c, { rough: 0.4, transparent: true, opacity: 0.92 });
  const belly = k.mat(0xffd08a, { rough: 0.4 });
  const fish = k.group();
  const body = k.group();
  body.add(k.ball(orange, 0.2, 0.25, 0.33));
  body.add(k.at(k.ball(belly, 0.14, 0.12, 0.24), 0, -0.11, 0.04));
  // tail fan, dorsal and side fins (thin in x)
  const tail = k.group();
  tail.add(k.at(k.ball(fin, 0.03, 0.2, 0.17), 0, 0.12, -0.12, 0.7, 0, 0), k.at(k.ball(fin, 0.03, 0.2, 0.17), 0, -0.12, -0.12, -0.7, 0, 0));
  tail.position.z = -0.3;
  body.add(tail);
  body.add(k.at(k.ball(fin, 0.025, 0.14, 0.2), 0, 0.26, -0.04, -0.3, 0, 0));
  k.both((sd) => body.add(k.at(k.ball(fin, 0.12, 0.03, 0.08), sd * 0.2, -0.06, 0.08, 0, sd * 0.5, sd * -0.5)));
  // little scales
  const scale = k.mat(0xff7417, { rough: 0.35 });
  [[0.12, 0.08, -0.08], [-0.12, 0.08, -0.08], [0.15, -0.02, -0.16], [-0.15, -0.02, -0.16]].forEach(([x, y, z]) => body.add(k.at(k.ball(scale, 0.04, 0.05, 0.03), x, y, z, 0, Math.sign(x) * 1.2, 0)));
  fish.add(body);
  const face = s.face({ parent: body, radii: [0.2, 0.25, 0.33], eye: { yaw: 30, pitch: 14, size: 0.06, tall: 1.2 }, mouth: { pitch: -12, width: 0.05 }, cheeks: { color: 0xff5a5a, yaw: 52, pitch: -6, size: 0.045 }, brow: { color: 0x7a3a12, thick: 0.009 } });
  return { fish, body, tail, face };
}

export default {
  id: 'a-fish-out-of-water',
  loop: LOOP,
  frame: { x: 0, y: 1.0, z: 0.15, w: 3.9, h: 2.6 },
  view: { yaw: 0.18, pitch: 0.2 },
  avoid: ['a-red-herring'],

  build(s) {
    const { k } = s;
    const hero = s.hero();
    hero.place(1.25, 0.1, -0.45);

    // the bowl on its little table, with water in it
    const table = k.group();
    const wood = k.mat(0xa8744a, { rough: 0.7 });
    table.add(k.at(k.cyl(wood, 0.5, 0.5, 0.06, 28), 0, 0.5, 0));
    table.add(k.at(k.cyl(wood, 0.07, 0.1, 0.48, 12), 0, 0.24, 0));
    table.add(k.at(k.cyl(wood, 0.28, 0.3, 0.04, 24), 0, 0.02, 0));
    s.add(s.baked(table)).position.copy(BOWL);
    const R = 0.74;
    const C = BOWL.clone().setY(0.53 + R * 0.92);
    const glass = new THREE.Mesh(s.own(new THREE.SphereGeometry(R, 32, 20, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.8)), k.glass(0xd4ecff, 0.22));
    glass.position.copy(C);
    const water = new THREE.Mesh(s.own(new THREE.SphereGeometry(R * 0.96, 32, 16, 0, Math.PI * 2, Math.PI * 0.36, Math.PI * 0.64)), k.mat(0x4fb6ff, { transparent: true, opacity: 0.38, rough: 0.05, depthWrite: false }));
    water.position.copy(C);
    const surface = k.at(k.disc(k.mat(0x8fd4ff, { transparent: true, opacity: 0.55, rough: 0.05, depthWrite: false }), R * 0.83, 32), C.x, C.y + R * 0.42, C.z, -Math.PI / 2, 0, 0);
    const pebbles = k.group();
    [[0.15, 0.1, 0.12, 0xff8fa3], [-0.18, 0.05, 0.1, 0x8fd16a], [0.02, -0.18, 0.11, 0xffc83d], [-0.05, 0.16, 0.09, 0xb7a8ff]].forEach(([x, z, r, c]) => pebbles.add(k.at(k.ball(k.mat(c), r, r * 0.6, r), x, 0, z)));
    s.add(glass, water, surface);
    s.add(s.baked(pebbles)).position.set(C.x, C.y - R * 0.86, C.z);
    glass.renderOrder = 3;
    water.renderOrder = 2;
    surface.renderOrder = 2;

    const { fish, body, tail, face } = goldfish(s);
    fish.scale.setScalar(1.25);
    s.add(fish);
    const inBowl = (t, out) => {
      const a = t * 2.1;
      out.set(C.x + Math.cos(a) * 0.14, C.y - 0.12 + Math.sin(t * 3) * 0.03, C.z + Math.sin(a) * 0.12);
      return Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI;
    };
    const lip = C.clone().setY(C.y + R * 0.5);

    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      const alarm = keys(t, [[LAND - 0.2, 0], [LAND + 0.1, 1], [BACK, 1], [BACK + 0.3, 0]]);
      gasp(P, alarm);
      P.headX += alarm * 0.12;
      P.x += Math.sin(t * 30) * 0.01 * alarm;
      // relief: a little cheer when it is home
      hero.clip(P, 'cheer', clamp((t - HOME) / 0.8), t > HOME ? 1 : 0);
    };
    hero.yaw = -0.75;

    return {
      update(t) {
        let yaw = 0;
        let roll = 0;
        let flop = 0;
        if (t < OUT || t >= HOME) {
          yaw = inBowl(t, fish.position);
        } else if (t < LAND) {
          // the leap out
          const u = (t - OUT) / (LAND - OUT);
          inBowl(OUT, _a);
          fish.position.lerpVectors(_a, SPOT, u);
          fish.position.y = lerp(_a.y, SPOT.y + 0.34, u) + Math.sin(u * Math.PI) * 1.0;
          yaw = lerp(0.9, 0.5, u);
          roll = u * Math.PI * 2;
        } else if (t < BACK) {
          // flopping about on the dry dais
          const f = t - LAND;
          const hop = Math.abs(Math.sin(f * 5.2)) * 0.22 * (0.6 + 0.4 * Math.sin(f * 1.7));
          fish.position.set(SPOT.x + Math.sin(f * 1.3) * 0.12, SPOT.y + 0.34 + hop, SPOT.z);
          roll = Math.sin(f * 5.2) * 0.6;
          yaw = 0.45 + Math.sin(f * 2.1) * 0.35;
          flop = 1;
        } else {
          // one big hop home
          const u = ease.inOutQuad((t - BACK) / (HOME - BACK));
          fish.position.lerpVectors(SPOT, lip, u);
          fish.position.y = lerp(SPOT.y + 0.34, C.y - 0.12, u) + Math.sin(u * Math.PI) * 1.1;
          yaw = lerp(0.4, -1.2, u);
          roll = -u * Math.PI * 2;
        }
        fish.rotation.set(0, yaw, 0);
        body.rotation.set(0, 0, roll);
        tail.rotation.y = Math.sin(t * (flop ? 22 : 9)) * (flop ? 0.6 : 0.35);
        const squash = flop ? Math.abs(Math.cos((t - LAND) * 5.2)) : 0;
        body.scale.set(1 + squash * 0.08, 1 - squash * 0.1, 1 + squash * 0.05);
        const dry = t > LAND - 0.1 && t < BACK + 0.1;
        const want = dry ? (Math.sin(t * 7) > 0 ? 'worried' : 'surprised') : t >= HOME ? 'happy' : 'neutral';
        if (face.current !== want) face.set(want, 1e9);
        surface.position.y = C.y + R * 0.42 + Math.sin(t * 2.5) * 0.008;
        hero.mood(t > OUT && t < HOME ? 'worried' : t >= HOME ? 'happy' : null);
        for (const at of [OUT + 0.05, HOME - 0.02]) {
          if (s.cue(at)) {
            _a.copy(lip).setY(lip.y + 0.05);
            s.fx.burst(_a, { count: 22, color: 0x8fd4ff, color2: 0xffffff, speed: 3, size: 0.45, life: 0.6, gravity: 6, up: 2.2 });
          }
        }
        if (s.cue(LAND)) {
          s.fx.burst(SPOT, { count: 10, color: 0x8fd4ff, color2: 0xffffff, speed: 2, size: 0.35, life: 0.5, gravity: 5, up: 1.4 });
          s.sound('pop');
        }
        // drops of sweat (it is so dry out here)
        if (dry && Math.random() < 0.12) {
          s.fx.spark(fish.position.x + (Math.random() - 0.5) * 0.3, fish.position.y + 0.3, fish.position.z, (Math.random() - 0.5) * 0.8, 1.2, 0.2, 0x9fd8ff, 0.35, 0.5, 4, 1);
        }
      },
    };
  },
};

const _a = new THREE.Vector3();
