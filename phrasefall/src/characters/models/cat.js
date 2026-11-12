/** Biscuit the cat — sleek, curious and always immaculately groomed. */

const smooth = (a, b, v) => {
  const u = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

const GROOM_PERIOD = 9;
/** 0…1 "paw at the cheek" amount. */
const groomAt = (t) => {
  const c = t % GROOM_PERIOD;
  return smooth(0.4, 1.0, c) * (1 - smooth(3.2, 3.8, c));
};

export default {
  id: 'cat',
  name: 'Biscuit',
  title: 'The Cat',
  blurb: 'Curiosity never hurt this cat. It only improved her vocabulary.',
  accent: 0xb48cff,
  shot: 'star',

  build(k) {
    const slate = k.mat(0x6f7c98);
    const white = k.mat(0xfbf8f2, { rough: 0.7 });
    const pink = k.mat(0xff9db3, { rough: 0.5 });
    const nose = k.mat(0xff8aa6, { rough: 0.25 });
    const lilac = k.mat(0xb48cff, { rough: 0.6 });
    const gold = k.mat(0xffcf4a, { metal: 0.55, rough: 0.3 });
    const dark = k.mat(0x2a2233, { rough: 0.4 });
    const iris = k.mat(0xf3b83c, { rough: 0.25, rim: 0.2 });
    const whisker = k.mat(0xffffff, { rough: 0.6, rim: 0 });

    const TS = [0.9, 1, 0.86];
    const armR = 0.095;
    const legR = 0.118;
    const rig = k.biped({
      skin: slate,
      top: slate,
      bottom: slate,
      shoe: white,
      hand: white,
      sleeve: slate,
      torso: TS,
      head: [0.56, 0.5, 0.52],
      armR,
      legR,
      legGap: 0.165,
      handR: 0.115,
      foot: [0.14, 0.098, 0.215],
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // white socks and chest bib
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      rig[`arm${side}`].add(k.at(k.cap(white, armR + 0.004, 0.2), 0, -0.345, 0));
      rig[`leg${side}`].add(k.at(k.cap(white, legR + 0.004, 0.25), 0, -0.345, 0));
    });
    torso.add(k.at(k.ball(white, 0.2, 0.25, 0.115), 0, 0.33, 0.2));

    // tall pointed ears, pink inside; the outer group twitches, the inner one springs
    const ears = [];
    k.both((s) => {
      const twitch = k.at(k.group(), s * 0.29, c.y + 0.33, -0.02, 0, 0, -s * 0.24);
      const ear = k.group();
      const outer = k.at(k.cone(slate, 0.175, 0.48, 24), 0, 0.19, 0);
      outer.scale.z = 0.55;
      const inner = k.at(k.cone(pink, 0.105, 0.31, 20), 0, 0.15, 0.052);
      inner.scale.z = 0.4;
      ear.add(outer, inner);
      twitch.add(ear);
      head.add(twitch);
      rig.spring(ear, { axis: 'x', gain: 0.09, sway: 0.03, speed: 1.6, phase: s, k: 70, d: 7 });
      ears.push({ s, twitch, rest: twitch.rotation.z });
    });

    // white blaze, muzzle, pink nose
    head.add(k.onSphere(k.ball(white, 0.06, 0.2, 0.032), 0, 9, -0.014));
    const muzzleC = new k.THREE.Vector3(0, c.y - 0.165, 0.395);
    const muzzleR = [0.175, 0.125, 0.155];
    head.add(k.at(k.ball(white, ...muzzleR), muzzleC.x, muzzleC.y, muzzleC.z));
    head.add(k.at(k.ball(nose, 0.042, 0.03, 0.03), 0, c.y - 0.112, 0.54));

    // whiskers lie back along the cheeks
    k.both((s) => {
      const g = k.onSphere(k.group(), s * 31, -19, 0.004);
      g.rotateY(-s * 0.22);
      [[0.21, 0.06], [0.23, 0.0], [0.2, -0.06]].forEach(([x, y]) => g.add(k.stroke(whisker, 0, y * 0.25, s * x, y, 0.0075)));
      head.add(g);
    });

    const E = { yaw: 21.5, pitch: 5, size: 0.082, tall: 1.36, tilt: 0.2 };
    k.face({
      eye: E,
      brow: { color: 0x3d4560, thick: 0.014 },
      mouth: { center: muzzleC, radii: muzzleR, pitch: -42, width: 0.066, lift: 0.004 },
      cheeks: { yaw: 42, pitch: -6, color: 0xff9db3 },
    });
    // amber irises behind the pupils
    for (const eye of rig.face.eyes) {
      const ring = k.mesh(k.G.sphere(20), iris, false);
      ring.scale.set(E.size * 1.19, E.size * E.tall * 1.15, E.size * 0.3);
      eye.shapes.open.add(ring);
    }

    // lilac collar with a little gold bell
    const collar = k.at(k.torus(lilac, 0.235, 0.048), 0, 0.565, 0.005, Math.PI / 2 + 0.1, 0, 0);
    collar.scale.set(1, 0.88, 1.25);
    const bell = k.at(k.group(), 0, 0.53, 0.27);
    bell.add(k.at(k.ball(gold, 0.058), 0, -0.06, 0.035), k.at(k.box(dark, 0.066, 0.014, 0.02, 0.006), 0, -0.083, 0.083, 0.42, 0, 0), k.at(k.torus(gold, 0.022, 0.009), 0, -0.004, 0.02));
    torso.add(collar, bell);
    rig.spring(bell, { axis: 'z', gain: 0.0, yawGain: 0.06, sway: 0.1, speed: 3.1, k: 60, d: 4 });
    rig.spring(bell, { axis: 'x', gain: 0.2, sway: 0.03, speed: 2.2, k: 60, d: 4 });

    // long curling tail: a chain of short capsules sprung at every other joint (four springy
    // sections), sweeping out, up and over into a hook, white at the tip
    const LEN = [0.165, 0.165, 0.165, 0.165, 0.165, 0.165, 0.14, 0.13, 0.12];
    const bends = [0, -6, -14, -28, -30, -14, 20, 40, 42];
    const tail = rig.joint('tail', k.at(k.group(), -0.04, 0.08, -0.25, -0.12, -0.2, Math.PI / 2 - 0.052));
    torso.add(tail);
    let parent = tail;
    bends.forEach((bend, i) => {
      let seg = parent;
      if (i > 0) {
        seg = k.at(k.group(), 0, LEN[i - 1], 0, 0, 0, (bend * Math.PI) / 180);
        parent.add(seg);
        if (i % 2 === 0) {
          rig.spring(seg, { axis: 'z', gain: 0.1, sway: 0.04 + i * 0.022, speed: 1.25, phase: -i * 0.55, k: 55, d: 6 });
          rig.spring(seg, { axis: 'x', gain: 0.05, yawGain: 0.03, sway: 0.035, speed: 0.9, phase: i * 0.7, k: 55, d: 6 });
        }
      }
      const r = 0.06 - i * 0.0012;
      seg.add(k.at(k.cap(i === bends.length - 1 ? white : slate, r, LEN[i] + 2 * r), 0, LEN[i] / 2, 0));
      parent = seg;
    });

    // quick ear flicks, one ear at a time
    rig.tickers.push((t) => {
      for (const e of ears) {
        const cyc = (t + (e.s > 0 ? 0 : 2.6)) % 5.3;
        const flick = cyc < 0.36 ? Math.sin((cyc / 0.36) * Math.PI * 2) * (1 - cyc / 0.36) : 0;
        e.twitch.rotation.z = e.rest - e.s * flick * 0.38;
      }
    });

    return rig;
  },

  idle(P, t) {
    // poised and curious, tail curling lazily
    P.headZ += Math.sin(t * 0.6) * 0.05;
    P.tailZ += Math.sin(t * 0.8) * 0.1;
    P.tailY += Math.sin(t * 0.65 + 1) * 0.12;
    P.hipsY += Math.sin(t * 1.7) * 0.006;
    P.armLZ += -0.06;

    // every few seconds: lift a paw and groom her cheek
    const g = groomAt(t);
    const rub = Math.sin(t * 7.5);
    P.armRX += g * (-2.12 + rub * 0.13);
    P.armRZ += g * (0.26 + rub * 0.04);
    P.headZ += g * (0.17 + rub * 0.035);
    P.headX += g * 0.1;
    P.headY += g * -0.1;
    P.torsoZ += g * 0.04;
    P.torsoY += g * -0.06;
  },
};
