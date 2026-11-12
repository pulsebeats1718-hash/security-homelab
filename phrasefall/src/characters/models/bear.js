/** Bramble the bear — a big-hearted explorer in a hand-knitted jumper. */

const smooth = (a, b, v) => {
  const u = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

const PERIOD = 9.5;

export default {
  id: 'bear',
  name: 'Bramble',
  title: 'The Bear',
  blurb: 'Gives the best bear hugs in the business.',
  accent: 0xc9814a,
  shot: 'orb',

  build(k) {
    const fur = k.mat(0xa5613a);
    const tan = k.mat(0xf2d2a4, { rough: 0.7 });
    const nose = k.mat(0x3a2320, { rough: 0.22 });
    const knit = k.mat(0x2f8556, { rough: 0.9, rim: 0.3 });
    const knitDark = k.mat(0x236a45, { rough: 0.9, rim: 0.3 });
    const cream = k.mat(0xfbf0d6, { rough: 0.9, rim: 0.3 });
    const canvas = k.mat(0xe9a83c, { rough: 0.8 });
    const canvasDark = k.mat(0xcf8a2a, { rough: 0.8 });
    const leather = k.mat(0x6a3d27, { rough: 0.6 });
    const brass = k.metal(0xf4cf62, 0.35);

    const TS = [1.14, 1.05, 0.93];
    const SV = [TS[0], TS[1], TS[0] * TS[2]];
    const armR = 0.128;
    const rig = k.biped({
      skin: fur,
      top: fur,
      bottom: fur,
      shoe: fur,
      hand: fur,
      sleeve: knit,
      torso: TS,
      head: [0.6, 0.54, 0.55],
      legR: 0.155,
      legGap: 0.21,
      armR,
      handR: 0.145,
      foot: [0.18, 0.115, 0.25],
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // tan tummy peeking out below the jumper, tan soles
    torso.add(k.at(k.ball(tan, 0.3, 0.19, 0.11), 0, 0.07, 0.315));

    // chunky jumper: body shell, ribbed hem, roll collar, cream band with a diamond pattern
    const jumper = k.lathe(knit, [[0.395, 0.135], [0.431, 0.155], [0.433, 0.2], [0.411, 0.36], [0.339, 0.51], [0.233, 0.62], [0.11, 0.678], [0, 0.69]]);
    jumper.scale.set(...SV);
    const hem = k.at(k.torus(knitDark, 0.428, 0.036), 0, 0.165 * SV[1], 0, Math.PI / 2, 0, 0);
    hem.scale.set(SV[0], SV[2], 1.35);
    const stripe = k.lathe(cream, [[0.405, 0.287], [0.43, 0.302], [0.424, 0.36], [0.39, 0.44], [0.362, 0.455]]);
    stripe.scale.set(...SV);
    const collar = k.at(k.torus(knitDark, 0.27, 0.07), 0, 0.608, 0.01, Math.PI / 2 + 0.08, 0, 0);
    collar.scale.set(1.14, 1, 0.95);
    torso.add(jumper, hem, stripe, collar);
    [0, 12.5, -12.5, 47, -47, 61, -61].forEach((yaw) => {
      const d = k.onTorso(k.box(knit, 0.052, 0.052, 0.02, 0.008), yaw, 0.392, 0.043);
      d.rotateZ(Math.PI / 4);
      torso.add(d);
    });
    k.both((s) => {
      const arm = rig[s > 0 ? 'armL' : 'armR'];
      const armStripe = k.at(k.torus(cream, armR + 0.002, 0.026), 0, -0.1, 0, Math.PI / 2, 0, 0);
      armStripe.scale.z = 1.7;
      const cuff = k.at(k.torus(knitDark, armR - 0.004, 0.036), 0, -0.325, 0, Math.PI / 2, 0, 0);
      cuff.scale.z = 1.2;
      arm.add(armStripe, cuff);
    });

    // small round ears
    k.both((s) => {
      const ear = k.at(k.group(), s * 0.39, c.y + 0.37, -0.03, 0, 0, -s * 0.55);
      ear.add(k.at(k.ball(fur, 0.155, 0.15, 0.09), 0, 0.075, 0), k.at(k.ball(tan, 0.09, 0.088, 0.05), 0, 0.072, 0.052));
      head.add(ear);
      rig.spring(ear, { axis: 'x', gain: 0.06, sway: 0.02, speed: 1.4, phase: s });
    });

    // muzzle and nose
    const muzzleC = new k.THREE.Vector3(0, c.y - 0.155, 0.425);
    const muzzleR = [0.225, 0.165, 0.185];
    head.add(k.at(k.ball(tan, ...muzzleR), muzzleC.x, muzzleC.y, muzzleC.z));
    head.add(k.at(k.ball(nose, 0.078, 0.056, 0.052), 0, c.y - 0.08, 0.6));

    k.face({
      eye: { yaw: 21, pitch: 5, size: 0.08 },
      brow: { color: 0x5c3418, thick: 0.015 },
      mouth: { center: muzzleC, radii: muzzleR, pitch: -40, width: 0.078, lift: 0.004 },
      cheeks: { yaw: 41, pitch: -7, color: 0xff8f7a, opacity: 0.45 },
    });

    // tiny tail
    const tail = rig.joint('tail', k.at(k.group(), 0, 0.03, -0.37));
    tail.add(k.at(k.ball(fur, 0.09, 0.085, 0.08), 0, 0.01, -0.03));
    torso.add(tail);

    // explorer's backpack with a bedroll, and straps over the shoulders
    const pack = k.at(k.group(), 0, 0.315, -0.515);
    pack.add(
      k.box(canvas, 0.46, 0.4, 0.24, 0.09),
      k.at(k.box(canvasDark, 0.48, 0.2, 0.26, 0.08), 0, 0.11, -0.005),
      k.at(k.box(canvasDark, 0.26, 0.15, 0.06, 0.03), 0, -0.1, -0.12),
      k.at(k.box(leather, 0.05, 0.2, 0.03, 0.012), 0, 0.08, -0.133),
      k.at(k.box(brass, 0.085, 0.06, 0.03, 0.012), 0, 0.01, -0.14)
    );
    const roll = k.at(k.group(), 0, 0.262, -0.075);
    roll.add(k.at(k.cyl(cream, 0.076, 0.076, 0.48, 18), 0, 0, 0, 0, 0, Math.PI / 2));
    k.both((s) => {
      roll.add(k.at(k.ball(cream, 0.03, 0.072, 0.072), s * 0.24, 0, 0));
      roll.add(k.at(k.torus(leather, 0.079, 0.015), s * 0.14, 0, 0, 0, Math.PI / 2, 0));
    });
    pack.add(roll);
    torso.add(pack);
    k.both((s) => {
      const strap = k.at(k.torus(leather, 0.42, 0.021, Math.PI), s * 0.215, 0.215, 0, 0, Math.PI / 2, 0);
      strap.scale.set(1.02, 1.2, 2.3);
      torso.add(strap);
      torso.add(k.at(k.box(brass, 0.115, 0.05, 0.035, 0.012), s * 0.215, 0.255, 0.428, -0.05, 0, 0));
      torso.add(k.at(k.ball(leather, 0.05, 0.035, 0.024), s * 0.215, 0.212, 0.43));
    });

    return rig;
  },

  idle(P, t) {
    const c = t % PERIOD;

    // slow, friendly sway
    const s = Math.sin(t * 1.15);
    P.roll += s * 0.028;
    P.torsoZ += s * 0.03;
    P.headZ += Math.sin(t * 1.15 - 0.6) * 0.05;
    P.hipsY += Math.sin(t * 2.3) * 0.006;
    P.tailZ += Math.sin(t * 3.5) * 0.2;

    // pats his tummy with the left paw
    const pat = smooth(1.0, 1.5, c) * (1 - smooth(3.5, 4.0, c));
    const tap = Math.max(0, Math.sin(t * 8.5));
    P.armLX += pat * (-1.1 - tap * 0.24);
    P.armLZ += pat * -0.4;
    P.headX += pat * 0.09;
    P.headY += pat * 0.08;
    P.sq += pat * tap * -0.008;

    // a big open-armed wave
    const wave = smooth(5.6, 6.1, c) * (1 - smooth(8.0, 8.6, c));
    const wag = Math.sin(t * 9);
    P.armLZ += wave * (1.85 + wag * 0.16);
    P.armRZ -= wave * (1.85 - wag * 0.16);
    P.armLX += wave * 0.25;
    P.armRX += wave * 0.25;
    P.torsoX += wave * -0.06;
    P.headX += wave * -0.08;
    P.sq += wave * 0.02;
    P.roll += wave * wag * 0.012;
  },
};
