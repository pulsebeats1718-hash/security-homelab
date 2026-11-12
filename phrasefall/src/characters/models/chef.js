/** Pippa — a pastry chef who flips pancakes as easily as she flips a bad mood. */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (x) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};

// ── pancake-flip choreography, shared by the idle pose and the pancake ticker ──
const FLIP = 3.4; // seconds per flip
const LAUNCH = 0.3;
const AIR = 0.86;
const ARM = { x: -0.78, z: -0.34 }; // resting pose of the pan arm
const F = { dip: 0, flick: 0, u: 0, lift: 0, land: 0 };
function flip(t) {
  const f = t % FLIP;
  const u = clamp01((f - LAUNCH) / AIR);
  // wrist: dip, flick up, settle; then a soft give when the pancake lands
  F.dip = smooth(f / 0.16) * (1 - smooth((f - 0.16) / 0.1));
  F.flick = smooth((f - 0.18) / 0.12) * (1 - smooth((f - 0.36) / 0.3));
  F.u = u;
  F.lift = 4 * u * (1 - u);
  F.land = smooth((f - LAUNCH - AIR) / 0.05) * (1 - smooth((f - LAUNCH - AIR - 0.05) / 0.3));
  return F;
}

export default {
  id: 'chef',
  name: 'Pippa',
  title: 'The Chef',
  blurb: 'Thinks every problem is a piece of cake. Usually bakes one to prove it.',
  accent: 0xff8fa3,
  shot: 'orb',

  build(k) {
    const THREE = k.THREE;
    const white = k.mat(0xfaf7f0, { rough: 0.78 });
    const shade = k.mat(0xe4ded3, { rough: 0.8 });
    const pink = k.mat(0xff8fa3, { rough: 0.7, side: THREE.DoubleSide });
    const red = k.mat(0xe23d4b, { rough: 0.6 });
    const slate = k.mat(0x414d72, { rough: 0.65 });
    const skin = k.mat(0xf7c9a8);
    const hair = k.mat(0x8f4f2c, { rough: 0.8 });
    const iron = k.mat(0x3d4356, { metal: 0.6, rough: 0.38 });
    const golden = k.mat(0xf6b84c, { rough: 0.6 });
    const wood = k.mat(0xc98e58, { rough: 0.8 });

    const rig = k.biped({ skin, top: white, bottom: slate, shoe: slate, hand: skin, sleeve: white });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── jacket: two rows of buttons, a wrap seam, turned-back cuffs
    [0.47, 0.37, 0.27].forEach((y) => k.both((s) => torso.add(k.onTorso(k.ball(red, 0.03, 0.03, 0.02), s * 17, y, 0.004))));
    k.both((s) => {
      const arm = rig[s > 0 ? 'armL' : 'armR'];
      arm.add(k.at(k.cyl(white, 0.115, 0.128, 0.1, 20), 0, -0.31, 0), k.at(k.torus(shade, 0.126, 0.016), 0, -0.36, 0, Math.PI / 2, 0, 0));
    });

    // ── red neckerchief
    const scarf = k.at(k.torus(red, 0.235, 0.075), 0, 0.585, 0.01, Math.PI / 2 + 0.1, 0, 0);
    scarf.scale.set(1.05, 0.95, 1);
    const knot = k.at(k.group(), 0, 0.535, 0.275);
    knot.add(k.ball(red, 0.06, 0.055, 0.05));
    const tails = k.at(k.group(), 0, -0.01, 0);
    k.both((s) => {
      const tail = k.at(k.cone(red, 0.075, 0.17, 12), s * 0.07, -0.075, 0.005, 0, 0, Math.PI + s * 0.5);
      tail.scale.z = 0.4;
      tails.add(tail);
    });
    knot.add(tails);
    torso.add(scarf, knot);
    rig.spring(tails, { axis: 'x', gain: 0.12, sway: 0.03, speed: 2.3, k: 70, d: 6 });

    // ── long apron: waistband, wrap-around front panel, pocket, bow at the back
    const waist = k.at(k.torus(red, 0.405, 0.034), 0, 0.2, 0, Math.PI / 2, 0, 0);
    waist.scale.set(1, 0.87, 1.5);
    const panel = k.at(k.lathe(pink, [[0.345, -0.215], [0.34, -0.17], [0.3, 0.2]], 28), 0, 0, 0.19);
    panel.scale.z = 0.5;
    torso.add(waist, panel, k.at(k.box(white, 0.2, 0.13, 0.03, 0.025), 0.02, -0.02, 0.352, -0.07, 0, 0));
    const bow = k.at(k.group(), 0, 0.2, -0.365);
    bow.add(k.ball(red, 0.05, 0.05, 0.045));
    k.both((s) => {
      bow.add(k.at(k.ball(pink, 0.105, 0.07, 0.04), s * 0.11, 0.02, 0, 0, 0, s * 0.3));
      const end = k.at(k.group(), s * 0.02, -0.02, 0, 0.15, 0, s * 0.3);
      end.add(k.at(k.box(pink, 0.07, 0.2, 0.025, 0.012), 0, -0.1, 0));
      bow.add(end);
      rig.spring(end, { axis: 'x', gain: -0.16, sway: 0.05, speed: 2.4, phase: s, k: 60, d: 5 });
    });
    torso.add(bow);

    // ── hair: bun at the back, soft fringe under the hat
    head.add(k.at(k.dome(hair, 0.59, 0.54, 0.555, 0.5, 36), 0, c.y, 0, -0.52, 0, 0));
    head.add(k.at(k.ball(hair, 0.25, 0.1, 0.12), -0.13, c.y + 0.31, 0.41, 0.25, 0, 0.3), k.at(k.ball(hair, 0.18, 0.09, 0.1), 0.2, c.y + 0.33, 0.385, 0.25, 0, -0.42));
    k.both((s) => head.add(k.at(k.ball(hair, 0.075, 0.17, 0.11), s * 0.535, c.y - 0.02, 0.1, 0, 0, s * 0.08)));
    const bun = k.at(k.group(), 0, c.y + 0.02, -0.5);
    bun.add(k.at(k.ball(hair, 0.2, 0.19, 0.18), 0, 0, -0.11), k.at(k.torus(red, 0.183, 0.034), 0, 0, -0.045));
    head.add(bun);
    rig.spring(bun, { axis: 'x', gain: 0.06, sway: 0.015, speed: 2, k: 100, d: 8 });

    k.face({
      eye: { yaw: 21.5, pitch: 2, size: 0.084, tall: 1.32 },
      brow: { color: 0x7a4024, thick: 0.014, width: 0.07 },
      mouth: { pitch: -18, width: 0.088 },
      cheeks: { color: 0xff8094, opacity: 0.72, size: 0.088, yaw: 37, pitch: -10 },
    });

    // ── tall puffy toque
    const hat = k.at(k.group(), 0, c.y + 0.3, -0.02, -0.1, 0, 0.07);
    hat.add(k.at(k.cyl(shade, 0.475, 0.468, 0.22, 36), 0, 0.11, 0));
    const puff = k.at(k.group(), 0, 0.2, 0);
    puff.add(k.at(k.ball(white, 0.55, 0.36, 0.55, 32), 0, 0.27, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      puff.add(k.at(k.ball(white, 0.27, 0.28, 0.27), Math.sin(a) * 0.35, 0.23 + (i % 2) * 0.05, Math.cos(a) * 0.35));
    }
    hat.add(puff);
    head.add(hat);
    rig.spring(puff, { axis: 'x', gain: 0.1, sway: 0.02, speed: 1.7, k: 55, d: 5 });
    rig.spring(puff, { axis: 'z', gain: 0, yawGain: 0.03, sway: 0.025, speed: 1.3, k: 55, d: 5 });

    // ── frying pan in her right hand, levelled for the resting arm pose
    const pan = k.group();
    pan.quaternion.setFromEuler(new THREE.Euler(ARM.x, 0, -0.32 + ARM.z)).invert();
    const bowl = k.at(k.group(), -0.04, 0.03, 0.4);
    bowl.add(k.cyl(iron, 0.215, 0.18, 0.07, 28), k.at(k.torus(iron, 0.215, 0.018), 0, 0.035, 0, Math.PI / 2, 0, 0));
    pan.add(k.at(k.cap(iron, 0.032, 0.34, 10), -0.02, 0.03, 0.06, Math.PI / 2, 0, 0), bowl);
    const cake = k.at(k.group(), 0, 0.06, 0);
    cake.add(k.cyl(wood, 0.155, 0.155, 0.03, 24), k.at(k.ball(golden, 0.15, 0.024, 0.15), 0, 0.012, 0), k.at(k.ball(golden, 0.15, 0.024, 0.15), 0, -0.012, 0));
    bowl.add(cake);
    rig.handR.add(pan);
    rig.props.pan = pan;
    rig.props.muzzle = bowl;

    // ── wooden spoon in her left hand
    const spoon = k.group();
    spoon.quaternion.setFromEuler(new THREE.Euler(-0.4, 0, 0.32 + 0.18)).invert();
    spoon.add(k.at(k.cap(wood, 0.024, 0.46, 8), 0, 0.14, 0), k.at(k.ball(wood, 0.07, 0.09, 0.035), 0, 0.41, 0));
    spoon.rotateZ(-0.25);
    spoon.rotateX(0.25);
    rig.handL.add(spoon);

    rig.tickers.push((t, dt, r, animator) => {
      // the pancake only flies while she is idling; during clips it stays put in the pan
      const s = animator?.clip ? null : flip(t);
      const u = s ? s.u : 0;
      const lift = s ? s.lift : 0;
      cake.position.set(0, 0.06 + lift * 0.41, -lift * 0.03);
      cake.rotation.x = -smooth(u) * Math.PI * 2;
      cake.scale.y = 1 + (s ? s.land * -0.35 : 0);
    });

    return rig;
  },

  // keep her toes behind the apron
  constrain(P) {
    P.legLX *= 0.42;
    P.legRX *= 0.42;
  },

  idle(P, t) {
    const s = flip(t);
    // pan held out in front, wrist flick sends the pancake up
    P.armRX += ARM.x + s.dip * 0.16 - s.flick * 0.34 + s.land * 0.1;
    P.armRZ += ARM.z;
    P.sq += s.dip * -0.035 + s.flick * 0.04 - s.land * 0.03;
    P.torsoX += s.dip * 0.05 - s.flick * 0.05;
    // she watches it all the way up and back down
    P.headX += -0.2 * s.lift;
    P.headY += -0.14;
    P.headZ += 0.05;
    // spoon keeps time; a little flourish when the pancake lands
    P.armLX += -0.4 + Math.sin(t * 3.7) * 0.05;
    P.armLZ += 0.18 + s.land * 0.5 + Math.sin(t * 1.85) * 0.04;
    P.hipsY += Math.sin(t * 1.85) * 0.006;
    P.torsoZ += Math.sin(t * 0.92) * 0.02;
  },
};
