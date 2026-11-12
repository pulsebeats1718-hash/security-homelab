/** Maple the fox — the friendly face of the starting roster. */
export default {
  id: 'fox',
  name: 'Maple',
  title: 'The Fox',
  blurb: 'Quick, curious and always one step ahead of the conversation.',
  accent: 0xff8a3c,
  shot: 'orb',

  build(k) {
    const fur = k.mat(0xf2823a);
    const cream = k.mat(0xfff1dc, { rough: 0.7 });
    const dark = k.mat(0x4d2c28);
    const nose = k.mat(0x2b1a1f, { rough: 0.22 });
    const scarf = k.mat(0x26b3a6, { rough: 0.75 });
    const scarfDark = k.mat(0x1c8f86, { rough: 0.75 });

    const rig = k.biped({ skin: fur, top: fur, bottom: dark, shoe: dark, hand: dark, sleeve: fur });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // cream belly
    torso.add(k.at(k.ball(cream, 0.25, 0.27, 0.12), 0, 0.2, 0.245));

    // ears
    k.both((s) => {
      const ear = k.at(k.group(), s * 0.31, c.y + 0.36, -0.02, 0, 0, -s * 0.32);
      const outer = k.at(k.cone(fur, 0.2, 0.44, 24), 0, 0.17, 0);
      outer.scale.z = 0.55;
      const inner = k.at(k.cone(cream, 0.125, 0.3, 20), 0, 0.14, 0.055);
      inner.scale.z = 0.4;
      const tip = k.at(k.cone(dark, 0.092, 0.2, 20), 0, 0.292, 0);
      tip.scale.z = 0.58;
      ear.add(outer, inner, tip);
      head.add(ear);
      rig.spring(ear, { axis: 'x', gain: 0.07, sway: 0.03, speed: 1.7, phase: s });
    });

    // white lower face, muzzle, nose, cheek tufts
    const muzzleC = new k.THREE.Vector3(0, c.y - 0.15, 0.4);
    const muzzleR = [0.21, 0.15, 0.19];
    head.add(k.at(k.ball(cream, ...muzzleR), muzzleC.x, muzzleC.y, muzzleC.z));
    head.add(k.at(k.ball(nose, 0.062, 0.048, 0.05), 0, c.y - 0.085, 0.585));
    k.both((s) => {
      head.add(k.at(k.ball(cream, 0.2, 0.16, 0.15), s * 0.27, c.y - 0.17, 0.33));
      const tuft = k.at(k.cone(cream, 0.13, 0.2, 18), s * 0.47, c.y - 0.2, 0.2, 0, 0, -s * 2.05);
      tuft.scale.z = 0.7;
      head.add(tuft);
    });

    k.face({
      eye: { yaw: 22, pitch: 7, size: 0.086 },
      brow: { color: 0x7a3a1c },
      mouth: { center: muzzleC, radii: muzzleR, pitch: -38, width: 0.075, lift: 0.004 },
      cheeks: { yaw: 40, pitch: -4, color: 0xff9b7a },
    });

    // bushy tail
    const tail = rig.joint('tail', k.at(k.group(), 0, 0.08, -0.27, -1.05, 0, 0));
    tail.add(
      k.lathe(fur, [[0, 0], [0.1, 0.04], [0.21, 0.24], [0.235, 0.44], [0.17, 0.66], [0, 0.8]]),
      k.at(k.ball(cream, 0.185, 0.2, 0.185), 0, 0.63, 0)
    );
    torso.add(tail);

    // scarf
    const knot = k.at(k.group(), 0.17, 0.5, 0.26, 0, 0, -0.2);
    knot.add(k.at(k.box(scarf, 0.14, 0.32, 0.06, 0.03), 0, -0.14, 0), k.at(k.box(scarfDark, 0.13, 0.26, 0.06, 0.03), 0.1, -0.1, -0.02, 0, 0, 0.35));
    const ring = k.at(k.torus(scarf, 0.25, 0.09), 0, 0.575, 0.01, Math.PI / 2 + 0.1, 0, 0);
    ring.scale.set(1.05, 0.95, 1);
    torso.add(ring, knot);
    rig.spring(knot, { axis: 'x', gain: 0.1, sway: 0.04, speed: 2.2 });

    return rig;
  },

  idle(P, t) {
    // curious head tilts and a lively tail
    P.headZ += Math.sin(t * 0.55) * 0.07;
    P.tailZ += Math.sin(t * 3.1) * 0.22;
    P.tailX += Math.sin(t * 1.3) * 0.1;
    P.hipsY += Math.abs(Math.sin(t * 1.55)) * 0.012;
  },
};
