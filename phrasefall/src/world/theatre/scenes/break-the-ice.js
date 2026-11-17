/**
 * Break the ice: a big block of ice stands between the hero and a shy newcomer, who looks away,
 * scuffing a foot. The hero taps the ice with a little hammer — tap, tap, CRACK — and it shatters
 * into sparkling pieces; the two turn to each other, smile and wave. (The ice grows back, frosty.)
 */
import * as THREE from 'three';
import { keys, ease } from '../../../core/utils.js';

const LOOP = 6.6;
const TAPS = [1.0, 1.6, 2.2];
const BREAK = 2.25;
const REFORM = [5.6, 6.4];
const ICE = new THREE.Vector3(0.1, 0, 0.05);

export default {
  id: 'break-the-ice',
  loop: LOOP,
  frame: { x: 0.1, y: 1.1, z: 0.15, w: 4.2, h: 2.7 },
  view: { yaw: 0.06, pitch: 0.14 },
  avoid: ['the-tip-of-the-iceberg', 'get-cold-feet', 'as-cool-as-a-cucumber'],

  build(s) {
    const { k } = s;
    const hero = s.hero();
    hero.place(-0.95, 0.65, 0.65);
    const shy = s.cast(s.other(['penguin', 'panda', 'bear']), { x: 1.25, z: 0.1 });

    // the block of ice: clear blue with a frosty cap and white highlights
    const block = k.group();
    block.add(k.at(k.box(k.mat(0xbfe6ff, { rough: 0.15, transparent: true, opacity: 0.82, rim: 1.2 }), 1.1, 1.4, 0.9, 0.12), 0, 0.7, 0));
    block.add(k.at(k.box(k.mat(0xf4fbff, { rough: 0.9 }), 1.14, 0.12, 0.94, 0.05), 0, 1.4, 0));
    const shine = k.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4, rough: 0.2 });
    block.add(k.at(k.box(shine, 0.06, 0.6, 0.02, 0.02), -0.32, 0.75, 0.43, 0, 0, 0.3), k.at(k.box(shine, 0.04, 0.3, 0.02, 0.02), -0.2, 0.62, 0.43, 0, 0, 0.3));
    // cracks that spread with each tap
    const crackMat = k.mat(0xffffff, { emissive: 0xe6f6ff, emissiveIntensity: 0.9, rough: 0.3 });
    const cracks = [
      [k.at(k.box(crackMat, 0.03, 0.32, 0.02, 0.01), 0.05, 0.65, 0.44, 0, 0, 0.5)],
      [k.at(k.box(crackMat, 0.03, 0.3, 0.02, 0.01), 0.18, 0.86, 0.44, 0, 0, -0.6), k.at(k.box(crackMat, 0.03, 0.26, 0.02, 0.01), -0.1, 0.45, 0.44, 0, 0, -0.4)],
      [k.at(k.box(crackMat, 0.03, 0.34, 0.02, 0.01), 0.3, 0.52, 0.44, 0, 0, 0.9), k.at(k.box(crackMat, 0.03, 0.3, 0.02, 0.01), -0.2, 0.9, 0.44, 0, 0, 0.8)],
    ];
    for (const set of cracks) for (const c of set) block.add(c);
    block.position.copy(ICE);
    s.add(block);

    // a little toy hammer
    const hammer = k.group();
    hammer.add(k.at(k.cap(k.mat(0xa8744a, { rough: 0.6 }), 0.03, 0.42), 0, -0.15, 0));
    hammer.add(k.at(k.box(k.mat(0x8f7bff, { rough: 0.4 }), 0.12, 0.12, 0.26, 0.04), 0, -0.38, 0.05));
    hero.hold('R', hammer, { rx: -0.3 });

    const broken = (t) => t > BREAK && t < REFORM[0];
    const friendly = (t) => keys(t, [[BREAK + 0.3, 0], [BREAK + 0.8, 1], [REFORM[0] - 0.2, 1], [REFORM[0] + 0.3, 0]]);
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      let tap = 0;
      for (const tt of TAPS) tap = Math.max(tap, keys(t, [[tt - 0.3, 0], [tt - 0.1, 1], [tt, -0.3], [tt + 0.2, 0]]));
      P.armRX += -1.1 - Math.max(0, tap) * 0.9 + Math.max(0, -tap) * 0.4;
      P.armRZ += 0.15;
      P.torsoX += 0.08;
      P.headX += 0.15;
      const f = friendly(t);
      P.armLZ += f * 1.6;
      P.headX -= f * 0.1;
    };
    hero.yaw = 0.75;
    shy.pose = (P, t) => {
      shy.idle(P, { arms: false });
      const f = friendly(t);
      // shy: turned away, arms behind, scuffing a foot; then a big friendly wave
      P.yaw += (1 - f) * 0.9 - f * 0.5;
      P.armLX += (1 - f) * 0.5;
      P.armRX += (1 - f) * 0.5;
      P.headX += (1 - f) * 0.2;
      P.legRX += (1 - f) * Math.sin(t * 3) * 0.15;
      P.armRZ += -f * (2.2 + Math.sin(t * 10) * 0.25);
    };

    return {
      update(t) {
        // the block: cracking, gone, then growing back
        const regrow = keys(t, [[REFORM[0], 0], [REFORM[1], 1]], ease.outBack);
        block.visible = !broken(t);
        block.scale.set(1, t >= REFORM[0] ? Math.max(0.001, regrow) : 1, 1);
        const shake = TAPS.reduce((m, tt) => (t > tt && t < tt + 0.15 ? 1 : m), 0);
        block.position.x = ICE.x + shake * Math.sin(t * 90) * 0.02;
        cracks.forEach((set, i) => set.forEach((c) => (c.visible = t > TAPS[i] && t < REFORM[0])));
        TAPS.forEach((tt, i) => {
          if (!s.cue(tt)) return;
          _v.set(ICE.x - 0.45, 0.75, ICE.z + 0.4);
          s.fx.burst(_v, { count: 8, color: 0xe6f6ff, color2: 0xffffff, speed: 2, size: 0.35, life: 0.35, gravity: 3, up: 0.5 });
          if (i < 2) s.sound('tap');
        });
        if (s.cue(BREAK)) {
          _v.set(ICE.x, 0.65, ICE.z);
          s.fx.shatter(_v, 0.5, 0.6, { count: 34, colors: [0xbfe9ff, 0xe6f6ff, 0x9fd8ff, 0xffffff], speed: 5, size: 0.28 });
          s.fx.burst(_v, { count: 30, color: 0xe6f6ff, color2: 0xffe08a, speed: 4.5, size: 0.55, life: 0.7, gravity: 2, up: 1.2 });
          s.director.stage.shake(5, 0.2);
          s.sound('pop');
        }
        if (t > REFORM[0] && t < REFORM[1] && Math.random() < 0.3) {
          s.fx.spark(ICE.x + (Math.random() - 0.5) * 1, Math.random() * 1.2, ICE.z + 0.3, 0, 0.5, 0, 0xe6f6ff, 0.4, 0.6, 0, 1);
        }
        const f = friendly(t);
        hero.mood(f > 0.5 ? 'happy' : 'focus');
        shy.mood(f > 0.5 ? 'happy' : 'worried');
      },
    };
  },
};

const _v = new THREE.Vector3();
