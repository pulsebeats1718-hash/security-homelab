/**
 * Bite off more than you can chew: the hero heaves up an enormous sandwich, a tower taller than
 * itself, opens wide and takes a gigantic bite — then can't cope: cheeks ballooning, chewing and
 * chewing, eyes screwed up, until one huge gulp.
 */
import * as THREE from 'three';
import { keys, ease } from '../../../core/utils.js';

const LOOP = 6.6;
const BITE = 1.6;
const GULP = 4.8;

/** A towering club sandwich, centred on its base; userData.height is its height. */
function sandwich(s) {
  const { k } = s;
  const bread = k.mat(0xf3d29a, { rough: 0.8 });
  const crust = k.mat(0xc98a45, { rough: 0.8 });
  const lettuce = k.mat(0x7ed957, { rough: 0.6 });
  const tomato = k.mat(0xff5a4a, { rough: 0.4 });
  const cheese = k.mat(0xffd23f, { rough: 0.5 });
  const ham = k.mat(0xff9db3, { rough: 0.55 });
  const g = k.group();
  let y = 0;
  const slice = () => {
    g.add(k.at(k.box(crust, 0.8, 0.16, 0.6, 0.07), 0, y + 0.08, 0));
    g.add(k.at(k.box(bread, 0.74, 0.162, 0.54, 0.06), 0, y + 0.081, 0.008));
    y += 0.16;
  };
  const layer = (m, h, w = 0.86, d = 0.64, r = 0.03) => {
    g.add(k.at(k.box(m, w, h, d, r), 0, y + h / 2, 0));
    y += h;
  };
  const leaves = () => {
    for (let i = 0; i < 7; i++) g.add(k.at(k.ball(lettuce, 0.15, 0.04, 0.11), -0.36 + (i % 4) * 0.24, y + 0.03, i < 4 ? 0.25 : -0.2, 0, i * 0.9, 0.2));
    y += 0.06;
  };
  const tomatoes = () => {
    for (const [x, z] of [[-0.2, 0.12], [0.2, 0.14], [0, -0.14]]) g.add(k.at(k.cyl(tomato, 0.16, 0.16, 0.06, 18), x, y + 0.03, z));
    y += 0.06;
  };
  slice();
  leaves();
  layer(ham, 0.07);
  layer(cheese, 0.05, 0.9, 0.68, 0.01);
  slice();
  tomatoes();
  leaves();
  slice();
  layer(ham, 0.07);
  tomatoes();
  layer(cheese, 0.05, 0.9, 0.68, 0.01);
  slice();
  leaves();
  slice();
  // a cocktail stick with an olive on top
  g.add(k.at(k.cyl(k.mat(0xfff6e3), 0.012, 0.012, 0.32, 6), 0.05, y + 0.1, 0.02));
  g.add(k.at(k.ball(k.mat(0x6a8f2a, { rough: 0.4 }), 0.06), 0.05, y + 0.26, 0.02));
  const mesh = s.baked(g);
  mesh.userData.height = y;
  return mesh;
}

export default {
  id: 'bite-off-more-than-you-can-chew',
  loop: LOOP,
  frame: { x: 0.2, y: 1.35, z: 0.3, w: 3.2, h: 3.0 },
  view: { yaw: 0.22, pitch: 0.1 },
  avoid: ['a-piece-of-cake'],

  build(s) {
    const { k } = s;
    const hero = s.hero();
    hero.place(-0.2, 0.15, 0.2);
    const sand = s.add(sandwich(s));
    const H = sand.userData.height;
    // the bite out of its corner, once taken
    const bitten = k.ball(k.mat(0xb8875a, { rough: 0.9 }), 0.2, 0.16, 0.08);
    sand.add(bitten);
    bitten.position.set(-0.36, H * 0.62, 0.3);

    // cheeks that balloon out (the colour of the head)
    const skinHex = (hero.rig.m.head ?? hero.rig.m.torso)?.material?.color?.getHex?.() ?? hero.def.accent ?? 0xf2c6a0;
    const skin = k.mat(skinHex, { rough: 0.55 });
    const radii = hero.rig.headRadii ?? [0.57, 0.52, 0.53];
    const cheeks = [1, -1].map((sd) => {
      const holder = k.onSphere(k.group(), sd * 50, -16, 0.02, radii, hero.rig.headCenter);
      const c = k.ball(skin, 1, 1, 1);
      holder.add(c);
      hero.attach('head', holder, { asIs: true });
      return c;
    });

    const toMouth = (t) => keys(t, [[BITE - 0.45, 0], [BITE, 1], [BITE + 0.35, 0]], ease.inOutQuad);
    const stuffed = (t) => keys(t, [[BITE, 0], [BITE + 0.15, 1], [GULP, 1], [GULP + 0.25, 0]]);
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false, own: false });
      const st = stuffed(t);
      // hugging the tower of a sandwich at its side
      P.armLZ += 0.25;
      P.armLX += -0.75;
      P.armRZ += -0.45;
      P.armRX += -1.15;
      P.headY += 0.25;
      // lunge for the bite
      const m = toMouth(t);
      P.headX += m * 0.2;
      P.torsoY += m * 0.25;
      // chewing and chewing
      const chew = Math.sin(t * 15) * st;
      P.headX += chew * 0.05;
      P.sq += chew * 0.035;
      P.x += Math.sin(t * 27) * 0.012 * st;
      // the gulp
      const gulp = keys(t, [[GULP - 0.05, 0], [GULP + 0.12, 1], [GULP + 0.45, 0]]);
      P.sq += gulp * 0.12;
      P.headX += -gulp * 0.25;
    };

    return {
      update(t) {
        // the sandwich stands at the hero's side, its top far above the hero's head; it swings
        // to the mouth for the bite
        hero.root.getWorldPosition(_a);
        const m = toMouth(t);
        sand.position.set(_a.x + 0.82 - m * 0.45, 0.3 - m * 0.85, _a.z + 0.35 + m * 0.25);
        sand.rotation.set(0, -0.35, -m * 0.25 + Math.sin(t * 2) * 0.02);
        const squish = 1 - keys(t, [[BITE, 0], [BITE + 0.08, 0.1], [BITE + 0.35, 0]]);
        sand.scale.set(1, squish, 1);
        bitten.visible = t > BITE && t < LOOP - 0.3;
        const st = stuffed(t);
        const puff = st * (0.27 + Math.sin(t * 15) * 0.025);
        for (const c of cheeks) c.scale.setScalar(Math.max(0.001, puff));
        hero.mood(t < BITE - 0.5 ? 'happy' : t < BITE ? 'surprised' : t < GULP ? (Math.sin(t * 3) > 0.3 ? 'hurt' : 'worried') : t < GULP + 0.5 ? 'surprised' : 'worried');
        if (s.cue(BITE + 0.02)) {
          hero.rig.head.getWorldPosition(_b);
          _b.y += hero.rig.headCenter.y;
          _b.z += 0.5;
          s.fx.burst(_b, { count: 22, color: 0xf3d29a, color2: 0x7ed957, speed: 3.2, size: 0.45, life: 0.6, gravity: 7, up: 1.2 });
          s.sound('kick');
        }
        // beads of effort
        if (st > 0.5 && Math.random() < 0.1) {
          hero.rig.head.getWorldPosition(_b);
          s.fx.spark(_b.x + (Math.random() - 0.5) * 0.9, _b.y + 0.75, _b.z + 0.2, (Math.random() - 0.5) * 1.2, 1.4, 0, 0x9fd8ff, 0.4, 0.5, 5, 1);
        }
      },
    };
  },
};

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
