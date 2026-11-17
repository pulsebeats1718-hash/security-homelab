/**
 * A couch potato: a big, happy potato sinks into the sofa cushions, remote in hand and a bag of
 * crisps by its side, glued to the flickering telly, flicking channels and chuckling — and the
 * hero has flopped down beside it with a bucket of popcorn.
 */
import * as THREE from 'three';
import { keys } from '../../../core/utils.js';
import { sit } from '../actor.js';
import { sofa } from '../props.js';

const LOOP = 6;
const CHANNELS = [0x5cc8ff, 0x7ed957, 0xff9a3d, 0xb48cff, 0xff5d73];
const ZAPS = [1.4, 3.4, 5.1];

function telly(s) {
  const { k } = s;
  const g = k.group();
  const shell = k.mat(0x3ddbb4, { rough: 0.45 });
  const trim = k.mat(0x2a2233, { rough: 0.4 });
  g.add(k.at(k.box(shell, 0.95, 0.72, 0.55, 0.12), 0, 0.82, 0));
  g.add(k.at(k.box(trim, 0.72, 0.56, 0.04, 0.06), -0.06, 0.82, 0.27));
  k.both((sd) => g.add(k.at(k.ball(k.mat(0xffc83d), 0.035), 0.37, 0.82 + sd * 0.12, 0.28)));
  k.both((sd) => g.add(k.at(k.cyl(trim, 0.012, 0.012, 0.5, 6), sd * 0.12, 1.35, -0.05, 0, 0, sd * 0.45)));
  k.both((sd) => g.add(k.at(k.ball(trim, 0.03), sd * 0.23, 1.58, -0.05)));
  // a little table to stand on
  const wood = k.mat(0xa8744a, { rough: 0.7 });
  g.add(k.at(k.box(wood, 1.05, 0.06, 0.62, 0.02), 0, 0.43, 0));
  for (const [x, z] of [[0.45, 0.25], [-0.45, 0.25], [0.45, -0.25], [-0.45, -0.25]]) g.add(k.at(k.cyl(wood, 0.03, 0.03, 0.42, 8), x, 0.21, z));
  return s.baked(g);
}

function potato(s) {
  const { k } = s;
  const skin = k.mat(0xc9a066, { rough: 0.8 });
  const dark = k.mat(0x8a6a3c, { rough: 0.9 });
  const g = k.group();
  const body = k.group();
  body.add(k.ball(skin, 0.48, 0.6, 0.42));
  body.add(k.at(k.ball(skin, 0.3, 0.32, 0.3), 0.18, 0.28, -0.05));
  [[0.3, -0.2, 0.3], [-0.32, 0.05, 0.28], [-0.12, -0.42, 0.32], [0.38, 0.25, 0.18], [-0.25, 0.4, 0.2], [0.05, -0.1, 0.42]].forEach(([x, y, z]) => body.add(k.at(k.ball(dark, 0.035, 0.03, 0.02), x, y, z)));
  // stubby arms and legs
  k.both((sd) => {
    body.add(k.at(k.cap(skin, 0.07, 0.36), sd * 0.45, -0.05, 0.12, 0.6, 0, sd * 0.6));
    body.add(k.at(k.cap(skin, 0.08, 0.36), sd * 0.18, -0.6, 0.25, 1.35, 0, 0));
  });
  g.add(s.baked(body));
  const face = s.face({ parent: g, radii: [0.48, 0.6, 0.42], eye: { yaw: 22, pitch: 16, size: 0.065 }, mouth: { pitch: -2, width: 0.1 }, cheeks: { color: 0xff8f6b, opacity: 0.5, yaw: 40, pitch: 4 }, brow: { color: 0x6b4a2a, thick: 0.012 } });
  // the remote control, pointing at the telly
  const remote = k.group();
  remote.add(k.box(k.mat(0x2a2233, { rough: 0.4 }), 0.1, 0.05, 0.26, 0.02));
  [0xff5d73, 0x5cc8ff, 0xffc83d].forEach((c, i) => remote.add(k.at(k.ball(k.mat(c), 0.016, 0.01, 0.016), 0, 0.028, 0.07 - i * 0.05)));
  remote.position.set(0.55, -0.15, 0.32);
  remote.rotation.set(0.3, 0.6, 0);
  g.add(remote);
  return { group: g, face, remote };
}

export default {
  id: 'a-couch-potato',
  loop: LOOP,
  frame: { x: 0.2, y: 1.0, z: 0.1, w: 3.8, h: 2.4 },
  view: { yaw: 0.05, pitch: 0.16 },
  avoid: ['a-hot-potato'],

  build(s) {
    const { k } = s;
    const couch = s.add(sofa(s, { w: 2.3, color: 0xff8f5c, cushion: 0xffb38a }));
    couch.position.set(-0.55, 0, -0.35);
    couch.rotation.y = 0.42;
    const tv = s.add(telly(s));
    tv.position.set(1.45, 0, 0.62);
    tv.rotation.y = -0.72;
    const screen = k.at(k.box(k.glow(0x5cc8ff, 1.8), 0.66, 0.5, 0.02, 0.05), -0.06, 0.82, 0.3);
    tv.add(screen);
    const shine = k.halo(0x5cc8ff, 1.6, 0.4);
    shine.position.set(-0.06, 0.82, 0.5);
    tv.add(shine);

    // seats in world space (the sofa is turned towards the telly)
    const seat = (x) => new THREE.Vector3(x, 0, 0.05).applyAxisAngle(_y, 0.42).add(couch.position);
    const left = seat(-0.58);
    const right = seat(0.58);

    const p = potato(s);
    p.group.position.set(left.x, 1.05, left.z);
    p.group.rotation.set(-0.28, 0.62, 0, 'YXZ');
    s.add(p.group);
    p.face.set('happy', 1e9);
    // a bag of crisps beside it
    const bag = k.group();
    bag.add(k.at(k.box(k.mat(0xffc83d, { rough: 0.5 }), 0.32, 0.4, 0.14, 0.06), 0, 0.2, 0));
    bag.add(k.at(k.box(k.mat(0xff5d73, { rough: 0.5 }), 0.33, 0.1, 0.15, 0.03), 0, 0.26, 0));
    bag.add(k.at(k.ball(k.mat(0xf3d29a), 0.06, 0.015, 0.05), 0.02, 0.43, 0));
    s.add(s.baked(bag)).position.set(left.x - 0.62, 0.52, left.z + 0.05);

    const hero = s.hero();
    hero.place(right.x, right.z, 0.42 + 0.35, 0.52);
    // a striped bucket of popcorn
    const bucket = k.group();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      bucket.add(k.at(k.box(k.mat(i % 2 ? 0xff5d73 : 0xfff6e3, { rough: 0.6 }), 0.1, 0.32, 0.03, 0.01), Math.sin(a) * 0.14, 0, Math.cos(a) * 0.14, 0.08 * Math.cos(a), a, 0));
    }
    for (let i = 0; i < 9; i++) bucket.add(k.at(k.ball(k.mat(0xfff3c4, { rough: 0.8 }), 0.05), Math.sin(i * 2.4) * 0.09, 0.18 + (i % 3) * 0.03, Math.cos(i * 2.4) * 0.09));
    hero.hold('L', bucket, { upright: true, y: -0.02, z: 0.1 });

    hero.pose = (P, t) => {
      hero.idle(P, { arms: false, own: false });
      sit(P, { drop: 0.4, legs: 1.3 });
      // slumped back, eyes on the telly, popcorn now and then
      P.pitch += -0.2;
      P.headY += 0.35;
      P.headX += 0.05;
      P.armLX += -0.75;
      P.armLZ += -0.1;
      const munch = keys(t % 2, [[0.4, 0], [0.7, 1], [1.1, 1], [1.4, 0]]);
      P.armRX += -0.8 - munch * 0.9;
      P.armRZ += 0.1 + munch * 0.35;
      P.headX += munch * 0.05;
    };

    let channel = 0;
    return {
      update(t) {
        // munching crisps and chuckling at the telly
        const laugh = Math.max(0, Math.sin(t * 2.2)) ** 3;
        p.group.position.y = 1.05 + Math.abs(Math.sin(t * 14)) * 0.02 * laugh;
        p.group.scale.set(1 + laugh * 0.03, 1 - laugh * 0.03, 1);
        const want = laugh > 0.4 ? 'happy' : 'neutral';
        if (p.face.current !== want) p.face.set(want, 1e9);
        // flick… flick… the channels change
        const n = ZAPS.filter((z) => t >= z).length;
        if (n !== channel) {
          channel = n;
          const c = CHANNELS[n % CHANNELS.length];
          screen.material.emissive.set(c);
          shine.material.color.set(c);
        }
        p.remote.rotation.x = 0.3 + ZAPS.reduce((m, z) => (t > z - 0.2 && t < z + 0.1 ? 0.25 : m), 0);
        screen.material.emissiveIntensity = 1.5 + Math.sin(t * 23) * 0.15 + Math.sin(t * 7) * 0.2;
        for (const z of ZAPS) {
          if (s.cue(z)) {
            tv.localToWorld(_v.set(-0.06, 0.82, 0.35));
            s.fx.burst(_v, { count: 10, color: 0xffffff, color2: CHANNELS[(channel + 1) % CHANNELS.length], speed: 1.8, size: 0.4, life: 0.35, gravity: 0, up: 0 });
          }
        }
        hero.mood(laugh > 0.5 ? 'happy' : null);
      },
    };
  },
};

const _y = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
