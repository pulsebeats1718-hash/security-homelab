/** Rupert the corgi — big ears, short legs, a fluffy round rear and a very important bandana. */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const step = (a, b, x) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** 1 while idling, 0 while an action clip (or a fright) has taken over. */
const calm = (animator) => {
  const c = animator?.clip;
  let w = 1;
  if (c) w = 1 - Math.min(clamp01(c.t / 0.07), c.def.hold ? 1 : clamp01((c.dur - c.t) / 0.14));
  return w * (1 - clamp01((animator?._worry ?? 0) * 2.5));
};
/** A quick flick that settles: 0 → ±1 → 0 over `len` seconds starting at `t0` of a `period` loop. */
const flick = (t, period, t0, len) => {
  const u = (t % period - t0) / len;
  return u < 0 || u > 1 ? 0 : Math.sin(u * Math.PI * 3) * (1 - u);
};

export default {
  id: 'corgi',
  name: 'Rupert',
  title: 'The Corgi',
  blurb: 'Short legs, big heart, and a very important bark.',
  accent: 0xff9f43,
  shot: 'orb',

  build(k) {
    const fur = k.mat(0xf5a046, { rough: 0.72 });
    const white = k.mat(0xfff8ee, { rough: 0.75 });
    const blue = k.mat(0x2350c0, { rough: 0.65, rim: 0.18 });
    const nose = k.mat(0x2b1a1f, { rough: 0.22 });
    const pink = k.mat(0xff9fa4, { rough: 0.6 });

    const rig = k.biped({
      skin: fur, top: fur, bottom: white, shoe: white, hand: white, sleeve: fur,
      legLen: 0.2, legR: 0.13, legGap: 0.2, foot: [0.16, 0.09, 0.21],
      torso: [1.05, 0.95, 0.9], head: [0.6, 0.52, 0.54], armLen: 0.4, armR: 0.1, handR: 0.12,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // white chest
    torso.add(k.at(k.ball(white, 0.27, 0.3, 0.13), 0, 0.22, 0.27));

    // big upright ears with pink insides
    const ears = [];
    k.both((s) => {
      const ear = k.at(k.group(), s * 0.3, c.y + 0.37, -0.04, -0.1, 0, -s * 0.2);
      const outer = k.lathe(fur, [[0, 0], [0.24, 0.02], [0.215, 0.2], [0.13, 0.42], [0.035, 0.56], [0, 0.58]], 28);
      outer.scale.z = 0.5;
      const inner = k.at(k.lathe(pink, [[0, 0], [0.16, 0.02], [0.14, 0.17], [0.08, 0.34], [0.02, 0.44], [0, 0.45]], 24), 0, 0.03, 0.075);
      inner.scale.z = 0.32;
      ear.add(outer, inner);
      head.add(ear);
      rig.spring(ear, { axis: 'x', gain: 0.08, sway: 0.03, speed: 1.6, phase: s });
      ears.push([s, ear, ear.rotation.z]);
    });

    // white muzzle, cheeks and blaze up the forehead; button nose
    const muzzleC = new k.THREE.Vector3(0, c.y - 0.13, 0.41);
    const muzzleR = [0.23, 0.155, 0.2];
    head.add(k.at(k.ball(white, ...muzzleR), muzzleC.x, muzzleC.y, muzzleC.z));
    head.add(k.at(k.ball(nose, 0.07, 0.052, 0.055), 0, c.y - 0.06, 0.6));
    k.both((s) => head.add(k.at(k.ball(white, 0.2, 0.15, 0.15), s * 0.27, c.y - 0.19, 0.33)));
    const blaze = k.at(k.torus(white, 0.51, 0.05, 1.15), 0, c.y, 0, 0, -Math.PI / 2, -0.05);
    blaze.scale.z = 1.6;
    head.add(blaze);

    k.face({
      eye: { yaw: 25, pitch: 8, size: 0.09, tall: 1.25 },
      brow: { color: 0x6b3a1a, thick: 0.015, width: 0.062 },
      mouth: { center: muzzleC, radii: muzzleR, pitch: -34, width: 0.085, lift: 0.004 },
      cheeks: { yaw: 44, pitch: 1, color: 0xff8f7a, opacity: 0.55 },
    });
    // a lolling tongue for happy panting (shown whenever the mouth is open)
    const tongue = k.at(k.ball(pink, 0.045, 0.065, 0.025), 0, -0.058, 0.022, -0.6, 0, 0);
    rig.face.mouth.root.add(tongue);

    // fluffy round rear with white "trousers" and a stubby tuft (wiggles on the tail joint)
    const rear = rig.joint('tail', k.at(k.group(), 0, 0.16, 0));
    rear.add(
      k.at(k.ball(fur, 0.36, 0.3, 0.26), 0, 0, -0.24),
      k.at(k.ball(white, 0.16, 0.15, 0.13), 0.14, -0.08, -0.38),
      k.at(k.ball(white, 0.16, 0.15, 0.13), -0.14, -0.08, -0.38),
      k.at(k.ball(fur, 0.1, 0.09, 0.08), 0, 0.17, -0.45)
    );
    torso.add(rear);

    // royal-blue bandana: neck ring, triangle on the chest, knot at the back
    const ring = k.at(k.torus(blue, 0.27, 0.065), 0, 0.55, 0.01, Math.PI / 2 + 0.12, 0, 0);
    ring.scale.set(1.05, 0.95, 1);
    torso.add(ring, k.at(k.box(blue, 0.2, 0.2, 0.035, 0.03), 0, 0.43, 0.335, -0.3, 0, Math.PI / 4));
    const knot = k.at(k.group(), 0, 0.55, -0.32);
    knot.add(k.ball(blue, 0.075, 0.065, 0.055), k.at(k.ball(blue, 0.05, 0.09, 0.025), 0.05, -0.08, -0.01, 0, 0, 0.4), k.at(k.ball(blue, 0.05, 0.09, 0.025), -0.05, -0.08, -0.01, 0, 0, -0.4));
    torso.add(knot);
    rig.spring(knot, { axis: 'x', gain: 0.1, sway: 0.04, speed: 2.4 });

    // ear twitches and happy panting (open mouth + tongue) while idling
    let panting = false;
    rig.tickers.push((t, dt, r, animator) => {
      for (const [s, ear, rz] of ears) {
        const tw = s > 0 ? flick(t, 3.1, 1.0, 0.45) : flick(t, 3.7, 2.2, 0.45);
        ear.rotation.z = rz - s * 0.32 * tw;
      }
      const face = r.face;
      if (!face) return;
      const on = calm(animator) > 0.5;
      if (on) {
        panting = true;
        for (const [key, m] of Object.entries(face.mouth.shapes)) m.visible = key === 'open';
      } else if (panting) {
        panting = false;
        face.apply(face.current);
      }
      tongue.visible = face.mouth.shapes.open.visible;
      const pant = on ? Math.sin(t * 12) : 0;
      face.mouth.root.scale.y = 1 + 0.12 * pant;
      tongue.scale.y = 1 + 0.15 * pant;
    });

    return rig;
  },

  idle(P, t) {
    // happy panting: quick shallow breaths and a little head bob
    const pant = Math.sin(t * 12);
    P.breath += pant * 1.4;
    P.headX += pant * 0.012;
    P.headZ += Math.sin(t * 1.3) * 0.05;
    // gentle sway of the rear, and every few seconds an enthusiastic bottom wiggle
    const f = t % 5.2;
    const wig = step(2.6, 2.8, f) * (1 - step(4.2, 4.6, f));
    const w = Math.sin(t * 14);
    P.tailY += Math.sin(t * 2.4) * 0.1 + w * 0.38 * wig;
    P.tailZ += w * 0.14 * wig;
    P.torsoY += w * 0.06 * wig;
    P.roll += w * 0.025 * wig;
    P.hipsY += Math.abs(w) * 0.012 * wig;
    P.headZ += -w * 0.04 * wig;
  },
};
