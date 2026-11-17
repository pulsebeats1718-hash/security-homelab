/**
 * The early bird catches the worm: dawn, an alarm clock ringing, the sun just up. A bright-eyed
 * bird is already at work, tugging a long, stretchy (and cheerful) worm out of the ground, and
 * holds it up in triumph — while the hero, still in its nightcap, dozes, wakes, yawns… too late.
 */
import * as THREE from 'three';
import { keys, clamp, lerp, ease } from '../../../core/utils.js';
import { sun } from '../props.js';

const LOOP = 7;
const PULL = [0.7, 2.5];
const WAKE = 4.4;
const HOLE = new THREE.Vector3(0.62, 0, 0.62);
const SEGS = 10;

function alarmClock(s) {
  const { k } = s;
  const red = k.mat(0xff5d73, { rough: 0.4 });
  const gold = k.metal(0xffc83d, 0.3);
  const g = k.group();
  g.add(k.at(k.cyl(red, 0.32, 0.32, 0.2, 28), 0, 0.42, 0, Math.PI / 2, 0, 0));
  g.add(k.at(k.cyl(k.mat(0xfff6e3, { rough: 0.4 }), 0.26, 0.26, 0.02, 28), 0, 0.42, 0.105, Math.PI / 2, 0, 0));
  const ink = k.mat(0x2a2233);
  g.add(k.at(k.box(ink, 0.03, 0.17, 0.01, 0.01), 0, 0.49, 0.12), k.at(k.box(ink, 0.13, 0.03, 0.01, 0.01), 0.055, 0.42, 0.12));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.add(k.at(k.ball(ink, 0.014), Math.sin(a) * 0.21, 0.42 + Math.cos(a) * 0.21, 0.12));
  }
  k.both((sd) => {
    g.add(k.at(k.dome(gold, 0.13, 0.11, 0.13), sd * 0.2, 0.68, 0, 0, 0, -sd * 0.5));
    g.add(k.at(k.cap(gold, 0.03, 0.2), sd * 0.18, 0.12, 0, 0, 0, sd * 0.4));
  });
  g.add(k.at(k.cap(gold, 0.02, 0.18), 0, 0.78, 0));
  return s.baked(g);
}

export default {
  id: 'the-early-bird-catches-the-worm',
  loop: LOOP,
  frame: { x: 0, y: 1.3, z: 0.2, w: 4.3, h: 3.2 },
  view: { yaw: 0.1, pitch: 0.14 },
  theme: 'sunrise',
  avoid: ['an-early-bird'],

  build(s) {
    const { k } = s;
    const birds = ['duck', 'owl', 'penguin', 'phoenix'];
    const heroIsBird = birds.includes(s.heroId);
    const hero = s.hero();
    const bird = heroIsBird ? hero : s.cast(s.other(birds), { scale: 0.85 });
    const sleepy = heroIsBird ? s.cast(s.other(['bear', 'panda', 'bunny']), { scale: 0.95 }) : hero;
    bird.place(HOLE.x + 0.55, HOLE.z - 0.25, -0.75);
    // the duck's brolly stays at home today: its hands are full
    const brolly = bird.rig.props.brolly;
    if (brolly) {
      bird.keep(brolly, 'visible');
      brolly.visible = false;
    }
    sleepy.place(-1.05, -0.05, 0.3);

    // the dawn sun, the alarm clock, and a little mound of earth with a hole
    const dawn = s.add(sun(s, { r: 0.55 }));
    dawn.userData.face.set('happy', 1e9);
    const clock = s.add(alarmClock(s));
    clock.position.set(-0.15, 0, 0.95);
    const earth = k.mat(0x8a5a3c, { rough: 0.95 });
    s.add(k.at(k.dome(earth, 0.36, 0.12, 0.3), HOLE.x, 0, HOLE.z));
    s.add(k.at(k.disc(k.mat(0x3b2416, { rough: 1 }), 0.11, 16), HOLE.x, 0.125, HOLE.z, -Math.PI / 2, 0, 0));

    // the worm: a chain of pink beads with a smiley head
    const pink = k.mat(0xff8fb1, { rough: 0.45 });
    const band = k.mat(0xff6f9a, { rough: 0.45 });
    const segs = Array.from({ length: SEGS }, (_, i) => {
      const r = i === 0 ? 0.13 : 0.12 - i * 0.004;
      const m = k.ball(i === 3 ? band : pink, r, r, r);
      return s.add(m);
    });
    const face = k.group();
    k.both((sd) => {
      face.add(k.at(k.ball(k.mat(0x2a2233, { rough: 0.3 }), 0.026, 0.034, 0.016), sd * 0.05, 0.03, 0.118));
      face.add(k.at(k.ball(k.mat(0xffffff), 0.01), sd * 0.05 + 0.008, 0.043, 0.128));
    });
    face.add(k.at(k.torus(k.mat(0x8a2a4a), 0.03, 0.008, Math.PI * 0.8), 0, -0.018, 0.122, 0, 0, Math.PI * 1.1));
    s.add(face);

    // a nightcap and floating Zzzs for the sleepyhead
    const cap = k.group();
    const blue = k.mat(0x5c7cff, { rough: 0.8 });
    cap.add(k.at(k.cone(blue, 0.32, 0.75, 20), 0, 0.3, 0, 0, 0, -0.45));
    cap.add(k.at(k.torus(k.mat(0xfff6e3, { rough: 0.9 }), 0.3, 0.06), 0, 0, 0, Math.PI / 2, 0, 0));
    cap.add(k.at(k.ball(k.mat(0xfff6e3, { rough: 0.9 }), 0.09), 0.36, 0.6, 0));
    const capRoot = k.onSphere(k.group(cap), 0, 62, -0.06, sleepy.rig.headRadii, sleepy.rig.headCenter);
    cap.rotation.x = Math.PI / 2; // the cap's up (+Y) along the head's outward normal (+Z)
    sleepy.attach('head', capRoot, { asIs: true });
    const zs = [0, 1, 2].map((i) => s.add(s.label('z', { size: 0.26 + i * 0.06, color: '#fff6e3', stroke: '#3b3088' })));

    const out = (t) => keys(t, [[PULL[0], 0], [PULL[1], 1]], ease.inQuad);
    bird.pose = (P, t) => {
      bird.idle(P, { arms: false });
      const pulling = t > PULL[0] - 0.2 && t < PULL[1] + 0.1 ? 1 : 0;
      const tug = Math.max(0, Math.sin(t * 9)) * pulling;
      // bent over the hole, tugging; then the worm held high
      P.torsoX += pulling * 0.3 - tug * 0.12;
      P.armLX += -pulling * (1.2 - tug * 0.3);
      P.armRX += -pulling * (1.2 - tug * 0.3);
      P.pitch += -tug * 0.06;
      const proud = keys(t, [[PULL[1], 0], [PULL[1] + 0.3, 1], [6.3, 1], [6.8, 0]]);
      P.armRZ += -proud * 2.25;
      P.armLZ += proud * 0.6;
      P.y += Math.max(0, Math.sin((t - PULL[1]) * 6)) * 0.08 * proud;
      bird.clip(P, 'cheer', clamp((t - PULL[1]) / 0.8), t > PULL[1] && t < PULL[1] + 0.8 ? 0.6 : 0);
    };
    sleepy.pose = (P, t) => {
      sleepy.idle(P, { arms: false, own: false });
      const awake = keys(t, [[WAKE, 0], [WAKE + 0.3, 1], [6.6, 1], [7, 0]]);
      // nodding off: head drooping, a slow sway
      P.headX += (1 - awake) * (0.25 + Math.sin(t * 1.4) * 0.08);
      P.roll += (1 - awake) * Math.sin(t * 0.9) * 0.05;
      // waking: a big stretch and a yawn
      const stretch = keys(t, [[WAKE + 0.2, 0], [WAKE + 0.6, 1], [WAKE + 1.4, 1], [WAKE + 1.8, 0]]);
      P.armLZ += stretch * 2.3;
      P.armRZ -= stretch * 2.3;
      P.headX += -stretch * 0.25;
      P.sq += stretch * 0.08;
      P.headY += awake * (1 - stretch) * 0.55;
    };

    return {
      update(t) {
        dawn.position.set(1.7, lerp(1.2, 3.0, ease.outQuad(clamp(t / 2.5))), -1.7);
        dawn.userData.rays.rotation.z = t * 0.3;
        // the alarm clock rattles and rings
        const ring = (t < 1.4 ? 1 : 0) + (t > WAKE - 0.6 && t < WAKE + 0.2 ? 1 : 0);
        clock.rotation.z = ring ? Math.sin(t * 60) * 0.08 : 0;
        clock.position.y = ring ? Math.abs(Math.sin(t * 50)) * 0.03 : 0;
        if (ring && Math.random() < 0.3) s.fx.spark(clock.position.x + (Math.random() - 0.5) * 0.6, 0.85, clock.position.z, (Math.random() - 0.5) * 2, 1.5, 0, 0xffe08a, 0.4, 0.35, 0, 1);
        // the worm: peeking, stretching out of the hole, then dangling from the bird's hand
        const o = out(t);
        bird.handPos('R', _a);
        const tip = bird.handPos('L', _b).add(_a).multiplyScalar(0.5);
        const held = t >= PULL[1];
        if (held) tip.copy(_a);
        _f.set(Math.sin(bird.yaw), 0, Math.cos(bird.yaw)); // in front of the bird
        const free = keys(t, [[6.4, 0], [6.9, 1]]);
        for (let i = 0; i < SEGS; i++) {
          const seg = segs[i];
          const f = i / (SEGS - 1);
          if (t < PULL[0] - 0.1 || free > 0) {
            // head peeking out of the hole, the rest below ground
            const peek = free > 0 ? free : 1;
            seg.position.set(HOLE.x, 0.15 + (i === 0 ? 0.08 + Math.sin(t * 3) * 0.03 : -0.4 - i * 0.12) * peek, HOLE.z);
          } else if (!held) {
            // stretching between the hole and the bird's hands
            const shown = lerp(0.25, 1, o);
            if (f > shown) seg.position.set(HOLE.x, -0.2, HOLE.z);
            else {
              const u = f / shown;
              seg.position.lerpVectors(tip, _c.set(HOLE.x, 0.12, HOLE.z), u);
              seg.position.y += Math.sin(u * Math.PI) * 0.1;
            }
          } else {
            // held up high in front, dangling and swinging a little
            seg.position.set(tip.x + _f.x * 0.3 + Math.sin(t * 3 + i * 0.6) * 0.025 * i, tip.y + 0.05 - i * 0.1, tip.z + _f.z * 0.3);
          }
        }
        // the face rides on the head bead, looking out
        face.position.copy(segs[0].position);
        face.rotation.set(0, -0.2, 0);
        bird.mood(t > PULL[1] ? 'happy' : 'focus');
        sleepy.mood(t < WAKE ? 'happy' : t < WAKE + 1.6 ? 'surprised' : 'worried');
        zs.forEach((z, i) => {
          const u = (t * 0.5 + i / 3) % 1;
          sleepy.rig.head.getWorldPosition(_c);
          z.position.set(_c.x + 0.35 + u * 0.4, _c.y + 0.9 + u * 0.8, _c.z + 0.2);
          z.scale.setScalar(t < WAKE ? Math.sin(u * Math.PI) + 0.001 : 0.001);
        });
        if (s.cue(PULL[1])) {
          _c.set(HOLE.x, 0.3, HOLE.z);
          s.fx.burst(_c, { count: 16, color: 0x8a5a3c, color2: 0xffe08a, speed: 2.6, size: 0.4, life: 0.5, gravity: 6, up: 1.2 });
          s.sound('pop');
        }
      },
    };
  },
};

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _f = new THREE.Vector3();
