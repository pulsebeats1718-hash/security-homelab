/** Archie the cricketer — cable-knit whites, a green cap and a willow bat that always plays straight. */
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

// idle timeline: taps the bat → forward defensive stroke → adjusts the cap
const PERIOD = 8;
const tapW = (f) => step(1.3, 1.5, f) * (1 - step(2.9, 3.1, f));
const defW = (f) => step(3.4, 3.8, f) * (1 - step(4.8, 5.2, f));
const capW = (f) => step(5.8, 6.1, f) * (1 - step(6.9, 7.3, f));

export default {
  id: 'cricketer',
  name: 'Archie',
  title: 'The Cricketer',
  blurb: 'Plays a straight bat and never stumbles over a tricky idiom.',
  accent: 0x2fbf71,
  shot: 'ball',

  build(k) {
    const skin = k.mat(0xa56a44);
    const cream = k.mat(0xf4ead2, { rough: 0.85 });
    const white = k.mat(0xfbfaf6, { rough: 0.7 });
    const green = k.mat(0x1e8a4a, { rough: 0.65, rim: 0.16 });
    const gold = k.mat(0xf2b632, { rough: 0.55 });
    const willow = k.mat(0xe8cb92, { rough: 0.55 });
    const red = k.mat(0xc4232f, { rough: 0.3 });
    const hair = k.mat(0x2a2024, { rough: 0.8 });

    const rig = k.biped({ skin, top: cream, bottom: cream, shoe: white, hand: white, sleeve: cream, legLen: 0.36 });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── cricket jumper: green-and-gold V-neck over a white shirt, striped hem and cuffs
    // nested diamonds whose upper halves tuck in behind the chin, leaving a striped V
    [[green, 0.26, 0.21], [gold, 0.21, 0.218], [white, 0.165, 0.226]].forEach(([m, size, z]) => {
      const v = k.at(k.group(k.at(k.box(m, size, size, 0.03, 0.02), 0, 0, 0, 0, 0, Math.PI / 4)), 0, 0.6, z, -0.57, 0, 0);
      v.scale.x = 0.72;
      torso.add(v);
    });
    const hem = k.at(k.torus(green, 0.352, 0.022), 0, 0.035, 0, Math.PI / 2, 0, 0);
    hem.scale.set(1, 0.86, 1);
    const hem2 = k.at(k.torus(gold, 0.364, 0.015), 0, 0.078, 0, Math.PI / 2, 0, 0);
    hem2.scale.set(1, 0.86, 1);
    torso.add(hem, hem2);
    k.both((s) => {
      const arm = s > 0 ? rig.armL : rig.armR;
      arm.add(k.at(k.cyl(green, 0.113, 0.116, 0.06, 20), 0, -0.3, 0), k.at(k.torus(gold, 0.111, 0.012), 0, -0.26, 0, Math.PI / 2, 0, 0));
    });

    // ── batting pads: wrap the shins, two raised ribs down the front
    k.both((s) => {
      const leg = s > 0 ? rig.legL : rig.legR;
      leg.add(k.at(k.cyl(white, 0.152, 0.158, 0.22, 20), 0, -0.215, 0.012));
      [-0.052, 0.052].forEach((x) => leg.add(k.at(k.cap(white, 0.022, 0.2), x, -0.215, 0.012 + Math.sqrt(0.155 ** 2 - x * x))));
    });

    // ── face, short dark hair at the nape and sideburns
    k.face({
      eye: { yaw: 21, pitch: 2, size: 0.082, tall: 1.3 },
      brow: { color: 0x2a2024, thick: 0.019, width: 0.07 },
      mouth: { pitch: -18, width: 0.09 },
      cheeks: { yaw: 37, pitch: -10, color: 0xd9706a, opacity: 0.35 },
    });
    head.add(k.at(k.dome(hair, 0.585, 0.535, 0.545, 0.38, 32), 0, c.y, -0.005, -1.823, 0, 0));
    k.both((s) => head.add(k.onSphere(k.ball(hair, 0.045, 0.085, 0.03), s * 76, -2, 0)));

    // ── green cricket cap: snug crown with a rolled edge, short peak, gold button
    const cap = k.at(k.group(), 0, c.y, 0);
    cap.add(k.at(k.dome(green, 0.6, 0.56, 0.58, 0.5, 36), 0, 0, -0.01, -0.55, 0, 0));
    const roll = k.at(k.torus(green, 0.592, 0.032), 0, 0, -0.01, Math.PI / 2 - 0.55, 0, 0);
    roll.scale.set(0.6 / 0.592, 0.58 / 0.592, 1);
    cap.add(roll, k.at(k.ball(green, 0.26, 0.022, 0.24), 0, 0.3, 0.45, 0.12, 0, 0), k.at(k.ball(gold, 0.04, 0.025, 0.04), 0, 0.582, 0));
    head.add(cap);
    rig.props.hat = cap;
    rig.spring(cap, { axis: 'x', gain: 0.03, k: 120, d: 10 });

    // ── willow bat in the right glove (face forward, spine behind, green grip); the ball launches off it
    const bat = k.group(
      k.cyl(green, 0.03, 0.03, 0.26, 14),
      k.at(k.box(willow, 0.16, 0.44, 0.045, 0.02), 0, -0.32, 0),
      k.at(k.cap(willow, 0.04, 0.38), 0, -0.32, -0.025)
    );
    rig.handR.add(bat);
    rig.props.bat = bat;
    rig.props.muzzle = k.at(k.group(), 0, -0.36, 0.05);
    bat.add(rig.props.muzzle);

    // red ball with a white seam in the left glove
    const ball = k.at(k.group(k.ball(red, 0.075), k.at(k.torus(white, 0.073, 0.009), 0, 0, 0, 0, Math.PI / 2, 0)), 0, -0.03, 0.115);
    rig.handL.add(ball);
    rig.props.ball = ball;

    // keep the bat hanging plumb while idling (with a little forward angle in the defensive stroke);
    // when the arm is thrown up, angle the blade away from the head. The cap wobbles as it is adjusted.
    rig.tickers.push((t, dt, r, animator) => {
      const w = calm(animator);
      const f = t % PERIOD;
      const raised = -r.armR.rotation.z;
      bat.rotation.x = (-r.armR.rotation.x + 0.15 * defW(f)) * w;
      bat.rotation.z = 0.85 * clamp01((raised - 1.4) / 0.9);
      const cw = capW(f) * w;
      cap.position.y = c.y + 0.035 * cw;
      cap.rotation.z = (0.07 + 0.05 * Math.sin(f * 14)) * cw;
    });

    return rig;
  },

  idle(P, t) {
    const f = t % PERIOD;
    // batting stance: feet apart, bat grounded beside the back foot
    P.legLZ += 0.05;
    P.legRZ += -0.05;
    P.armRZ += 0.12;
    // taps the bat on the crease
    const tw = tapW(f);
    P.armRX += -0.13 * Math.max(0, Math.sin((f - 1.3) * 9)) * tw;
    P.headX += 0.05 * tw;
    // forward defensive: lunge onto the front foot, lean over it, bat in front, eyes on the ball
    const d = defW(f);
    P.legLX += -0.4 * d;
    P.legRX += 0.35 * d;
    P.hipsY += -0.03 * d;
    P.torsoX += 0.18 * d;
    P.armRX += -0.78 * d;
    P.armRZ += 0.18 * d;
    P.armLX += -0.55 * d;
    P.armLZ += -0.2 * d;
    P.headX += 0.12 * d;
    // adjusts the cap
    const cw = capW(f);
    P.armLZ += 2.0 * cw;
    P.armLX += 0.3 * cw;
    P.headZ += -0.1 * cw;
  },
};
