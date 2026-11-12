/** Pebble the penguin — a waddling little optimist in a bobble hat. */

const smooth = (a, b, v) => {
  const u = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

const FLAP_PERIOD = 4.6;
/** 0…1 envelope of the happy flipper-flap burst. */
const flapAt = (t) => {
  const c = t % FLAP_PERIOD;
  return smooth(0, 0.18, c) * (1 - smooth(0.85, 1.15, c));
};

export default {
  id: 'penguin',
  name: 'Pebble',
  title: 'The Penguin',
  blurb: 'World champion at breaking the ice.',
  accent: 0x6cc9ff,
  shot: 'ball',

  build(k) {
    const navy = k.mat(0x2c3c6e);
    const navyDark = k.mat(0x23305a);
    const white = k.mat(0xfbf7ee, { rough: 0.7 });
    const orange = k.mat(0xffa22e, { rough: 0.45 });
    const orangeDark = k.mat(0xef7f1e, { rough: 0.5 });
    const wool = k.mat(0xef5361, { rough: 0.92, rim: 0.3 });
    const woolDark = k.mat(0xcf3b4e, { rough: 0.92, rim: 0.3 });
    const cream = k.mat(0xfff1da, { rough: 0.92, rim: 0.3 });

    const TS = [1.08, 1, 0.95];
    const legLen = 0.13;
    const foot = [0.19, 0.05, 0.22];
    const rig = k.biped({
      skin: navy,
      top: navy,
      noArms: true,
      noLegs: true,
      torso: TS,
      legLen,
      legGap: 0.2,
      foot,
      armLen: 0.42,
      shoulderW: 0.35,
      shoulderY: 0.47,
      armRest: 0.42,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;
    const H = rig.headRadii;

    // big white belly
    torso.add(k.at(k.ball(white, 0.34, 0.345, 0.2), 0, 0.2, 0.238));

    // stubby legs and wide webbed feet
    const footY = -(rig.metrics.hipY + 0.05) + foot[1];
    k.both((s) => {
      const leg = rig[s > 0 ? 'legL' : 'legR'];
      leg.add(k.at(k.cyl(orangeDark, 0.07, 0.08, 0.16, 14), 0, footY + 0.1, 0));
      const web = k.at(k.group(), 0, footY, 0.02, 0, s * 0.3, 0);
      web.add(k.at(k.ball(orange, foot[0] * 0.86, foot[1], foot[2] * 0.9), 0, 0, 0.09));
      [-1, 0, 1].forEach((i) => web.add(k.at(k.ball(orange, 0.062, foot[1] * 0.92, 0.1), i * 0.105, 0, 0.26 - Math.abs(i) * 0.035, 0, i * 0.3, 0)));
      leg.add(web);
    });

    // flippers ride on the arm joints
    k.both((s) => {
      const arm = rig[s > 0 ? 'armL' : 'armR'];
      arm.add(k.at(k.ball(navy, 0.075, 0.26, 0.155), s * 0.012, -0.2, 0));
      arm.add(k.at(k.ball(white, 0.05, 0.215, 0.118), -s * 0.022, -0.205, 0.004));
    });

    // little tail
    const tail = rig.joint('tail', k.at(k.group(), 0, 0.04, -0.33, -2.0, 0, 0));
    const tailCone = k.at(k.cone(navyDark, 0.11, 0.2, 18), 0, 0.07, 0);
    tailCone.scale.z = 0.6;
    tail.add(tailCone);
    torso.add(tail);

    // heart-shaped face mask: three white spheres breaking through the navy head
    k.both((s) => head.add(k.at(k.ball(white, 0.355, 0.365, 0.36), s * 0.081, c.y + 0.025, 0.186)));
    head.add(k.at(k.ball(white, 0.36, 0.36, 0.36), 0, c.y - 0.082, 0.178));

    // beak
    head.add(k.at(k.ball(orange, 0.105, 0.062, 0.13), 0, c.y - 0.1, 0.545));
    head.add(k.at(k.ball(orangeDark, 0.082, 0.04, 0.1), 0, c.y - 0.137, 0.535));

    k.face({
      radii: [H[0] + 0.026, H[1] + 0.026, H[2] + 0.028],
      eye: { yaw: 21, pitch: 6.5, size: 0.084 },
      brow: { color: 0x2c3c6e, pitch: 22.5, width: 0.058, thick: 0.013 },
      mouth: false,
      cheeks: { yaw: 37, pitch: -8, color: 0xff97a6 },
    });

    // knitted bobble hat
    const hat = k.at(k.group(), 0, c.y, 0, -0.1, 0, 0.08);
    const crown = k.dome(wool, 0.6, 0.68, 0.57, 0.33, 36);
    const brim = k.at(k.torus(cream, 0.47, 0.055), 0, 0.35, 0, Math.PI / 2, 0, 0);
    brim.scale.set(1, 0.95, 1.15);
    const stripe = k.at(k.torus(cream, 0.426, 0.022), 0, 0.47, 0, Math.PI / 2, 0, 0);
    stripe.scale.set(1, 0.95, 1.7);
    const bobble = k.at(k.group(), 0, 0.665, -0.01);
    bobble.add(k.at(k.ball(cream, 0.14), 0, 0.085, 0));
    hat.add(crown, brim, stripe, bobble);
    head.add(hat);
    rig.spring(bobble, { axis: 'x', gain: 0.25, sway: 0.05, speed: 2.3, k: 45, d: 4 });
    rig.spring(bobble, { axis: 'z', gain: 0.1, yawGain: 0.06, sway: 0.07, speed: 3.4, k: 45, d: 4 });

    // matching scarf with a striped, tasselled end
    const ring = k.at(k.torus(wool, 0.275, 0.09), 0, 0.565, 0.01, Math.PI / 2 + 0.08, 0, 0);
    ring.scale.set(1.08, 0.98, 1);
    const end = k.at(k.group(), -0.17, 0.525, 0.3, -0.48, 0, 0.14);
    end.add(k.at(k.box(wool, 0.16, 0.34, 0.06, 0.03), 0, -0.15, 0));
    end.add(k.at(k.box(cream, 0.166, 0.045, 0.066, 0.02), 0, -0.2, 0), k.at(k.box(cream, 0.166, 0.045, 0.066, 0.02), 0, -0.27, 0));
    [-1, 0, 1].forEach((i) => end.add(k.at(k.cap(woolDark, 0.02, 0.08), i * 0.05, -0.335, 0)));
    const wrap = k.at(k.ball(woolDark, 0.105, 0.085, 0.07), -0.165, 0.54, 0.285, 0, 0, 0.2);
    torso.add(ring, end, wrap);
    rig.spring(end, { axis: 'x', gain: 0.12, sway: 0.04, speed: 2.1 });
    rig.spring(end, { axis: 'z', gain: 0.0, yawGain: 0.04, sway: 0.03, speed: 3.4 });

    return rig;
  },

  idle(P, t) {
    // side-to-side waddle: roll over one foot while the other lifts
    const w = Math.sin(t * 3.3);
    const roll = w * 0.085;
    P.roll += roll;
    P.legLZ -= roll;
    P.legRZ -= roll;
    P.y += Math.abs(w) * 0.014;
    P.legLX += -Math.max(0, w) * 0.26;
    P.legRX += -Math.max(0, -w) * 0.26;
    P.headZ += -roll * 0.55;
    P.torsoY += Math.cos(t * 3.3) * 0.05;
    P.tailZ += w * 0.25;

    // flippers swing with the waddle, then burst into a happy flap
    const f = flapAt(t);
    const beat = Math.sin(t * 22);
    P.armLZ += 0.06 + w * 0.09 + f * (0.62 + beat * 0.42);
    P.armRZ -= 0.06 - w * 0.09 + f * (0.62 + beat * 0.42);
    P.sq += f * (0.025 + beat * 0.012);
    P.headX += -f * 0.1;
  },
};
