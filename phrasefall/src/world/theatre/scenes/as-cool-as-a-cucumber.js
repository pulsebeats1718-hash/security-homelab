/**
 * As cool as a cucumber: under a blazing sun the hero is melting — fanning itself, sweating,
 * flustered — while beside it a cucumber in dark glasses lounges in a deckchair with an iced drink,
 * perfectly calm, frosty sparkles drifting round it.
 */
import * as THREE from 'three';
import { sun, twinkle } from '../props.js';

const LOOP = 6;

function deckchair(s) {
  const { k } = s;
  const wood = k.mat(0xc98a45, { rough: 0.7 });
  const stripes = [k.mat(0x3a7bd5, { rough: 0.85 }), k.mat(0xfff6e3, { rough: 0.85 })];
  const g = k.group();
  const W = 0.86;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const m = stripes[i % 2];
    const x = -W / 2 + (i + 0.5) * (W / n);
    g.add(k.at(k.box(m, W / n + 0.002, 0.03, 0.62, 0.01), x, 0.36, 0.22, 0.12, 0, 0)); // seat
    g.add(k.at(k.box(m, W / n + 0.002, 0.03, 1.0, 0.01), x, 0.72, -0.38, 1.0, 0, 0)); // back
  }
  k.both((sd) => {
    g.add(k.at(k.box(wood, 0.05, 0.05, 1.15, 0.02), sd * (W / 2 + 0.03), 0.72, -0.38, 1.0, 0, 0));
    g.add(k.at(k.box(wood, 0.05, 0.05, 0.7, 0.02), sd * (W / 2 + 0.03), 0.36, 0.22, 0.12, 0, 0));
    g.add(k.at(k.box(wood, 0.05, 0.42, 0.05, 0.02), sd * (W / 2 + 0.03), 0.2, 0.5));
    g.add(k.at(k.box(wood, 0.05, 0.9, 0.05, 0.02), sd * (W / 2 + 0.03), 0.42, -0.62, -0.35, 0, 0));
  });
  return s.baked(g);
}

/** The cucumber (its own axis is Y, length ~1.55), with a face, dark glasses and a drink. */
function cucumber(s) {
  const { k } = s;
  const green = k.mat(0x4fae3f, { rough: 0.45 });
  const dark = k.mat(0x2f7d2a, { rough: 0.5 });
  const pale = k.mat(0xa8dc7a, { rough: 0.5 });
  const g = k.group();
  const body = k.group();
  body.add(k.cap(green, 0.3, 1.55));
  body.add(k.at(k.ball(pale, 0.12, 0.05, 0.12), 0, 0.76, 0));
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4;
    const y = -0.55 + ((i * 0.37) % 1) * 1.0;
    body.add(k.at(k.ball(dark, 0.04, 0.05, 0.03), Math.sin(a) * 0.3, y, Math.cos(a) * 0.3, 0, a, 0));
  }
  // little arms and legs
  k.both((sd) => {
    body.add(k.at(k.cap(green, 0.06, 0.4), sd * 0.34, -0.05, 0.08, 0.4, 0, sd * 0.6));
    body.add(k.at(k.cap(green, 0.07, 0.3), sd * 0.15, -0.8, 0.16, 1.5, 0, 0));
  });
  g.add(s.baked(body));
  const C = new THREE.Vector3(0, 0.38, 0);
  const radii = [0.3, 0.42, 0.3];
  const face = s.face({ parent: g, radii, center: C, eye: { yaw: 20, pitch: 12, size: 0.05 }, mouth: { pitch: -14, width: 0.09 }, cheeks: { color: 0xff8f8f, opacity: 0.45, yaw: 38, pitch: -2 }, brow: false });
  face.set('happy', 1e9);
  // cool dark glasses over the eyes
  const shades = k.onSphere(k.group(), 0, 14, 0.035, radii, C);
  const lens = k.mat(0x1e2433, { rough: 0.12, metal: 0.3, rim: 0.8 });
  k.both((sd) => shades.add(k.at(k.box(lens, 0.17, 0.12, 0.035, 0.04), sd * 0.105, 0, 0, 0, sd * 0.25, 0)));
  shades.add(k.at(k.box(lens, 0.08, 0.025, 0.02, 0.01), 0, 0.03, 0.01));
  g.add(shades);
  // an iced drink: a glass of orange with ice, a straw and a slice of lemon
  const drink = k.group();
  drink.add(k.cyl(k.glass(0xeaf6ff, 0.3), 0.09, 0.08, 0.26, 18));
  drink.add(k.at(k.cyl(k.mat(0xffa23d, { rough: 0.2, transparent: true, opacity: 0.85 }), 0.08, 0.07, 0.2, 18), 0, -0.02, 0));
  drink.add(k.at(k.box(k.glass(0xffffff, 0.6), 0.06, 0.06, 0.06, 0.012), 0.02, 0.08, 0.01, 0.4, 0.3, 0));
  drink.add(k.at(k.cyl(k.mat(0xff5d73), 0.012, 0.012, 0.36, 6), -0.03, 0.14, 0, 0, 0, 0.25));
  drink.add(k.at(k.torus(k.mat(0xffe25a), 0.06, 0.02, Math.PI), 0.07, 0.12, 0.04, 0, 0.6, 0));
  drink.position.set(0.42, -0.02, 0.22);
  g.add(drink);
  return { group: g, face };
}

export default {
  id: 'as-cool-as-a-cucumber',
  loop: LOOP,
  frame: { x: 0, y: 1.25, z: 0.1, w: 3.9, h: 3.3 },
  view: { yaw: 0.12, pitch: 0.13 },
  avoid: ['break-the-ice'],

  build(s) {
    const { k } = s;
    const chair = s.add(deckchair(s));
    chair.position.set(0.62, 0, -0.05);
    chair.scale.setScalar(1.25);
    chair.rotation.y = -0.35;
    const cuke = cucumber(s);
    cuke.group.position.set(0.66, 1.18, -0.28);
    cuke.group.scale.setScalar(1.25);
    cuke.group.rotation.set(-1.0, -0.35, 0, 'YXZ');
    s.add(cuke.group);

    const hot = s.add(sun(s, { r: 0.45 }));
    hot.position.set(-1.35, 3.25, -0.9);
    hot.userData.face.set('focus', 1e9);
    const flakes = [0, 1, 2, 3].map(() => s.add(twinkle(s, { color: 0xbfe9ff, size: 0.11 })));

    const hero = s.hero();
    hero.place(-1.0, 0.4, 0.35);
    hero.mood('worried');
    // a paper fan
    const fan = k.group();
    const paper = [k.mat(0xff5d73, { rough: 0.7, side: THREE.DoubleSide }), k.mat(0xfff6e3, { rough: 0.7, side: THREE.DoubleSide })];
    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Mesh(s.own(new THREE.CircleGeometry(0.34, 3, (i / 8) * Math.PI, Math.PI / 8)), paper[i % 2]);
      fan.add(seg);
    }
    fan.add(k.at(k.cap(k.mat(0x8a5a3c), 0.02, 0.2), 0, -0.06, 0));
    const fanHolder = k.group(k.at(fan, 0, 0.05, 0, 0, 0, 0));
    hero.hold('R', fanHolder, { rx: -1.1 });

    hero.pose = (P, t) => {
      hero.idle(P, { arms: false, own: false });
      // fanning furiously at its face, wilting in the heat
      const f = Math.sin(t * 22);
      P.armRX += -1.75 + f * 0.18;
      P.armRZ += 0.25 + f * 0.12;
      P.armLZ += 0.35;
      P.armLX += -0.15;
      P.headX += 0.12 + Math.sin(t * 1.3) * 0.05;
      P.headZ += Math.sin(t * 0.9) * 0.1;
      P.sq += -0.04 + Math.sin(t * 2.2) * 0.02;
      P.y += Math.sin(t * 3.1) * 0.01;
    };

    return {
      update(t, dt) {
        fan.rotation.y = Math.sin(t * 22) * 0.35;
        hot.userData.rays.rotation.z = t * 0.6;
        hot.scale.setScalar(1 + Math.sin(t * 4) * 0.04);
        // the cucumber: a slow, contented sip and a lazy wiggle of the toes
        cuke.group.position.y = 1.18 + Math.sin(t * 1.2) * 0.01;
        flakes.forEach((f, i) => {
          const a = t * 0.7 + (i / 4) * Math.PI * 2;
          f.position.set(0.65 + Math.cos(a) * 0.75, 1.35 + Math.sin(t * 1.3 + i) * 0.25, -0.15 + Math.sin(a) * 0.45);
          f.rotation.z = t + i;
          f.scale.setScalar(0.7 + 0.3 * Math.sin(t * 3 + i));
        });
        // frosty sparkles round the cucumber; heat and sweat round the hero
        if (Math.random() < dt * 14) s.fx.spark(0.65 + (Math.random() - 0.5) * 1.1, 0.5 + Math.random() * 1.2, -0.1 + (Math.random() - 0.5) * 0.6, 0, -0.15, 0, Math.random() < 0.5 ? 0xbfe9ff : 0xffffff, 0.45, 1.2, -0.1, 0.5);
        if (Math.random() < dt * 10) {
          hero.rig.head.getWorldPosition(_v);
          s.fx.spark(_v.x + (Math.random() - 0.5) * 0.8, _v.y + 0.75, _v.z + 0.25, (Math.random() - 0.5) * 1.5, 1.2, 0.3, 0x7ec8ff, 0.4, 0.55, 5, 0.8);
        }
        if (Math.random() < dt * 12) s.fx.spark(-0.95 + (Math.random() - 0.5) * 1.0, 0.1, 0.3 + (Math.random() - 0.5) * 0.5, 0, 1 + Math.random(), 0, 0xffa64d, 0.45, 0.9, -0.3, 0.6);
      },
    };
  },
};

const _v = new THREE.Vector3();
