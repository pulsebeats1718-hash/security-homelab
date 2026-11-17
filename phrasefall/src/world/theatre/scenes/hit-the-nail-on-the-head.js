/**
 * Hit the nail on the head: a giant nail stands in a block of wood; the hero swings a big toy
 * mallet and — TONK! TONK! TONK! — hits it square on the head every time, sparkles flying, until
 * it is driven right in. A proud cheer, and the nail pops back up for another go.
 */
import * as THREE from 'three';
import { keys, clamp, ease } from '../../../core/utils.js';

const LOOP = 6;
const HITS = [1.0, 2.05, 3.1];

export default {
  id: 'hit-the-nail-on-the-head',
  loop: LOOP,
  frame: { x: 0.1, y: 1.05, z: 0.3, w: 3.3, h: 2.7 },
  view: { yaw: 0.22, pitch: 0.16 },

  build(s) {
    const { k } = s;
    const hero = s.hero();
    hero.place(-0.55, -0.15, 0.95);

    // the block of wood with its grain
    const block = k.group();
    const wood = k.mat(0xd9a35f, { rough: 0.75 });
    const grain = k.mat(0xb9803f, { rough: 0.8 });
    block.add(k.at(k.box(wood, 1.05, 0.55, 0.75, 0.06), 0, 0.275, 0));
    for (let i = 0; i < 4; i++) block.add(k.at(k.box(grain, 0.95, 0.02, 0.012, 0.005), 0, 0.12 + i * 0.1, 0.376));
    const bench = s.add(s.baked(block));

    // the nail: a shiny shaft with a broad flat head
    const nail = k.group();
    const steel = k.metal(0xcfd6e2, 0.22);
    nail.add(k.at(k.cyl(steel, 0.055, 0.04, 0.9, 16), 0, -0.45, 0));
    nail.add(k.at(k.cyl(steel, 0.17, 0.17, 0.06, 24), 0, 0.03, 0));
    nail.add(k.at(k.cone(steel, 0.04, 0.1, 12), 0, -0.93, 0, Math.PI, 0, 0));
    s.add(nail);

    // the mallet: a long handle and a fat barrel head, held in the right hand
    const mallet = k.group();
    mallet.add(k.at(k.cap(k.mat(0xa8744a, { rough: 0.6 }), 0.045, 0.78), 0, -0.3, 0));
    const head = k.group();
    head.add(k.cyl(k.mat(0xff5d73, { rough: 0.45 }), 0.17, 0.17, 0.42, 22));
    head.add(k.at(k.cyl(k.mat(0xffc83d, { rough: 0.45 }), 0.175, 0.175, 0.07, 22), 0, 0.17, 0), k.at(k.cyl(k.mat(0xffc83d, { rough: 0.45 }), 0.175, 0.175, 0.07, 22), 0, -0.17, 0));
    head.position.y = -0.7;
    head.rotation.x = Math.PI / 2;
    mallet.add(head);
    hero.hold('R', mallet, { rx: -0.25 });

    const depth = (t) => {
      let d = 0;
      for (const h of HITS) if (t > h) d += 0.1;
      const pop = keys(t, [[5.0, 0], [5.35, 1]], ease.outBack);
      return d * (1 - pop);
    };
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false, own: false });
      // raise, swing down onto the nail (a touch lower each time, as it goes in), bounce back
      let swing = 0;
      let deeper = 0;
      HITS.forEach((h, i) => {
        const w = keys(t, [[h - 0.55, 0], [h - 0.18, 1], [h, -1], [h + 0.12, -1], [h + 0.3, 0.1], [h + 0.45, 0]]);
        if (Math.abs(w) > Math.abs(swing)) {
          swing = w;
          deeper = i * 0.1;
        }
      });
      const up = Math.max(0, swing);
      const down = Math.max(0, -swing);
      P.armRX += -1.0 - up * 1.8 - down * (0.3 - deeper);
      P.armRZ += -0.25 - up * 0.2;
      P.torsoX += -up * 0.1 + down * (0.12 + deeper * 0.3);
      P.torsoY += up * 0.15;
      P.armLZ += 0.35;
      P.armLX += -0.3;
      P.headX += 0.22;
      // the cheer once it is in
      hero.clip(P, 'cheer', clamp((t - 3.7) / 0.8), t > 3.7 && t < 4.5 ? 1 : 0);
    };
    hero.yaw = 0.95;

    // the nail goes exactly where the mallet comes down: measure the first blow in advance
    const NAIL = hero.at(HITS[0], () => head.getWorldPosition(new THREE.Vector3()));
    const top = NAIL.y - 0.17; // the mallet's barrel rests on the nail's head
    NAIL.y = 0;
    // the block stands so that three blows drive the nail flush
    bench.position.set(NAIL.x, 0, NAIL.z);
    bench.scale.y = Math.max(0.2, top - 0.3) / 0.55;
    bench.rotation.y = 0.95;

    return {
      update(t) {
        nail.position.set(NAIL.x, top - 0.03 - depth(t), NAIL.z);
        hero.mood(t > 3.6 && t < 5 ? 'happy' : 'focus');
        HITS.forEach((h, i) => {
          if (!s.cue(h)) return;
          _v.set(NAIL.x, nail.position.y + 0.06, NAIL.z);
          s.fx.burst(_v, { count: 20, color: 0xffe08a, color2: 0xffffff, speed: 4, size: 0.5, life: 0.5, gravity: 4, up: 1 });
          s.fx.ring(_v, { color: 0xffe08a, from: 0.2, to: 1.1, life: 0.35, flat: true, opacity: 0.8 });
          s.director.stage.shake(4, 0.15);
          if (i === HITS.length - 1) s.sound('star');
        });
        if (s.cue(5.05)) s.sound('pop');
      },
    };
  },
};

const _v = new THREE.Vector3();
