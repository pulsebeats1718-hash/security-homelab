/**
 * All ears: a little songbird on its post starts to sing, and the hero, leaning in to listen,
 * sprouts a pair of enormous ears — pop! — that swivel and twitch towards every note.
 */
import * as THREE from 'three';
import { keys, clamp, ease } from '../../../core/utils.js';

const LOOP = 6.5;
const SPROUT = [0.9, 1.35];
const SHRINK = [5.6, 6.1];
const NOTE_COLOURS = ['#ffc83d', '#ff8fb8', '#5cc8ff', '#7ed957'];

function songbird(s) {
  const { k } = s;
  const g = k.group();
  const wood = k.mat(0x9a6740, { rough: 0.8 });
  g.add(k.at(k.cyl(wood, 0.07, 0.09, 1.25, 10), 0, 0.62, 0));
  g.add(k.at(k.cyl(wood, 0.04, 0.04, 0.6, 8), 0, 1.25, 0, 0, 0, Math.PI / 2));
  const post = s.baked(g);
  const bird = k.group();
  const blue = k.mat(0x5cc8ff, { rough: 0.45 });
  const belly = k.mat(0xfff1c4, { rough: 0.5 });
  bird.add(k.ball(blue, 0.17, 0.16, 0.16));
  bird.add(k.at(k.ball(belly, 0.11, 0.11, 0.06), 0, -0.02, 0.12));
  bird.add(k.at(k.ball(blue, 0.13), 0, 0.17, 0.05));
  k.both((sd) => {
    bird.add(k.at(k.ball(k.mat(0x2a2233, { rough: 0.3 }), 0.022, 0.028, 0.016), sd * 0.065, 0.2, 0.16));
    bird.add(k.at(k.ball(k.mat(0xffffff), 0.008), sd * 0.065 + 0.008, 0.21, 0.173));
    bird.add(k.at(k.ball(blue, 0.15, 0.04, 0.09), sd * 0.16, 0.0, -0.02, 0, 0, sd * 0.4));
  });
  bird.add(k.at(k.ball(blue, 0.06, 0.03, 0.14), 0, 0.02, -0.2, 0.5, 0, 0));
  const beakTop = k.at(k.cone(k.mat(0xffa23d), 0.04, 0.1, 10), 0, 0.17, 0.2, Math.PI / 2 - 0.15, 0, 0);
  const beakLow = k.at(k.cone(k.mat(0xff8a2a), 0.032, 0.08, 10), 0, 0.15, 0.19, Math.PI / 2 + 0.25, 0, 0);
  bird.add(beakTop, beakLow);
  bird.position.set(0.12, 1.42, 0);
  return { post, bird, beakLow };
}

export default {
  id: 'all-ears',
  loop: LOOP,
  frame: { x: 0.2, y: 1.45, z: 0.15, w: 3.5, h: 3.3 },
  view: { yaw: 0.14, pitch: 0.12 },
  avoid: ['i-m-all-ears'],

  build(s) {
    const { k } = s;
    const hero = s.hero();
    hero.place(-0.45, 0.3, 0.45);

    const perch = songbird(s);
    s.add(perch.post).position.set(1.3, 0, -0.05);
    s.add(perch.bird);
    perch.bird.position.add(new THREE.Vector3(1.3, 0, -0.05));
    perch.bird.rotation.y = -1.0;

    // the giant ears: peach outside, pink inside, standing up from the top of the head
    const outer = k.mat(0xffc9a8, { rough: 0.6 });
    const inner = k.mat(0xff9db3, { rough: 0.6 });
    const r = hero.rig.headRadii ?? [0.57, 0.52, 0.53];
    const top = hero.rig.headCenter.y + r[1] * 0.55;
    const ears = [1, -1].map((sd) => {
      const pivot = k.group();
      const ear = k.group();
      ear.add(k.at(k.ball(outer, 0.36, 0.62, 0.09), 0, 0.55, 0));
      ear.add(k.at(k.ball(inner, 0.25, 0.48, 0.05), 0, 0.53, 0.06));
      pivot.add(ear);
      hero.attach('head', pivot, { x: sd * r[0] * 0.62, y: top, z: -0.05, rz: -sd * 0.4 });
      return { pivot, ear, sd };
    });

    const notes = [0, 1, 2, 3].map((i) => s.add(s.label(i % 2 ? '♫' : '♪', { size: 0.38, color: NOTE_COLOURS[i], stroke: '#3b3088' })));

    const grow = (t) => keys(t, [[SPROUT[0], 0], [SPROUT[1], 1], [SHRINK[0], 1], [SHRINK[1], 0]], ease.outBack);
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      const listen = keys(t, [[0.3, 0], [0.8, 1], [SHRINK[1], 1], [LOOP, 0]]);
      // leaning towards the song, one hand cupped behind an ear
      P.torsoZ += -listen * 0.08;
      P.headZ += -listen * 0.22;
      P.headY += listen * 0.45;
      P.armLZ += listen * 2.0;
      P.armLX += -listen * 0.35;
      P.armRZ += -0.15;
      P.x += listen * 0.05;
      const pop = Math.sin(clamp((t - SPROUT[0]) / 0.4) * Math.PI);
      P.sq += -pop * 0.08;
    };

    return {
      update(t) {
        const g = grow(t);
        for (const { pivot, ear, sd } of ears) {
          pivot.scale.setScalar(Math.max(0.001, g));
          // swivelling towards the bird and twitching at each note
          ear.rotation.y = sd > 0 ? -0.6 : -0.9;
          ear.rotation.x = -0.15 + Math.sin(t * 6 + sd) * 0.06;
          ear.rotation.z = Math.sin(t * 9 + sd * 2) * 0.05 * g;
        }
        // the bird sings: beak open and shut, bobbing
        const sing = Math.max(0, Math.sin(t * 11));
        perch.beakLow.rotation.x = Math.PI / 2 + 0.25 + sing * 0.45;
        perch.bird.position.y = 1.42 + sing * 0.03;
        perch.bird.rotation.z = Math.sin(t * 3) * 0.1;
        notes.forEach((n, i) => {
          const u = (t * 0.42 + i / 4) % 1;
          n.position.set(1.3 - u * 1.55, 1.75 + Math.sin(u * Math.PI * 2 + i) * 0.22 + u * 0.4, 0.1 + u * 0.3);
          n.rotation.z = Math.sin(t * 4 + i) * 0.3;
          n.scale.setScalar(Math.min(1, u * 5, (1 - u) * 5) + 0.001);
        });
        hero.mood(t > SPROUT[0] && t < SHRINK[0] ? 'happy' : 'surprised');
        if (s.cue(SPROUT[0] + 0.15)) {
          hero.rig.head.getWorldPosition(_v);
          _v.y += 0.9;
          s.fx.burst(_v, { count: 24, color: 0xffe08a, color2: 0xff9db3, speed: 3.5, size: 0.5, life: 0.6, gravity: 2, up: 1 });
          s.sound('pop');
        }
      },
    };
  },
};

const _v = new THREE.Vector3();
