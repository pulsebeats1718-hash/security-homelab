/** Captain Marlow — a swashbuckling captain with a tricorn, a cutlass and a hand on her hip. */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const step = (a, b, x) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** 1 while idling, 0 while an action clip (or a fright) has taken over the arms. */
const calm = (animator) => {
  const c = animator?.clip;
  let w = 1;
  if (c) w = 1 - Math.min(clamp01(c.t / 0.07), c.def.hold ? 1 : clamp01((c.dur - c.t) / 0.14));
  return w * (1 - clamp01((animator?._worry ?? 0) * 2.5));
};

export default {
  id: 'pirate',
  name: 'Captain Marlow',
  title: 'The Pirate',
  blurb: 'Sails the seven seas in search of buried phrasal verbs.',
  accent: 0xffc24a,
  shot: 'ball',

  build(k) {
    const coat = k.mat(0xa81c3a, { rough: 0.62 });
    const navy = k.mat(0x2a2d52, { rough: 0.6, rim: 0.14 });
    const gold = k.mat(0xffc93f, { metal: 0.55, rough: 0.32 });
    const cream = k.mat(0xfff1dc, { rough: 0.75 });
    const hair = k.mat(0xe4552b, { rough: 0.78 });
    const skin = k.mat(0xf6c9a4);
    const leather = k.mat(0x532e25, { rough: 0.55 });
    const teal = k.mat(0x1fae9f, { rough: 0.7, rim: 0.18 });
    const steel = k.metal(0xdde3ee, 0.22);

    const rig = k.biped({ skin, top: coat, bottom: leather, shoe: leather, hand: skin, sleeve: coat });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── coat: flared skirt, gold hem, belt + buckle, cream shirt, buttons, epaulettes
    const skirt = k.lathe(coat, [[0.47, -0.085], [0.48, -0.055], [0.44, 0.05], [0.4, 0.2]], 36);
    skirt.scale.z = 0.9;
    const hem = k.at(k.torus(gold, 0.473, 0.024), 0, -0.075, 0, Math.PI / 2, 0, 0);
    hem.scale.y = 0.9;
    const belt = k.at(k.torus(leather, 0.4, 0.045), 0, 0.2, 0, Math.PI / 2, 0, 0);
    belt.scale.set(1.01, 0.875, 1.5);
    torso.add(skirt, hem, belt);
    torso.add(k.at(k.box(gold, 0.15, 0.135, 0.05, 0.03), 0, 0.2, 0.362), k.at(k.box(leather, 0.075, 0.06, 0.03, 0.012), 0, 0.2, 0.38));
    torso.add(k.at(k.ball(cream, 0.115, 0.06, 0.07), 0, 0.5, 0.285), k.at(k.ball(cream, 0.095, 0.055, 0.06), 0, 0.42, 0.318), k.at(k.ball(cream, 0.07, 0.05, 0.05), 0, 0.345, 0.335));
    [0.45, 0.335].forEach((y) => k.both((s) => torso.add(k.onTorso(k.ball(gold, 0.03, 0.03, 0.02), s * (y > 0.4 ? 36 : 31), y, 0.004))));
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      rig[`arm${side}`].add(k.at(k.ball(gold, 0.135, 0.05, 0.135), 0, 0.075, 0, 0, 0, s * -0.12));
      rig[`leg${side}`].add(k.at(k.cyl(leather, 0.172, 0.142, 0.085, 18), 0, -0.235, 0));
    });

    // right arm: turned-back cuff
    rig.armR.add(k.at(k.cyl(coat, 0.112, 0.155, 0.12, 20), 0, -0.3, 0), k.at(k.torus(gold, 0.152, 0.02), 0, -0.36, 0, Math.PI / 2, 0, 0));

    // left arm gets a real elbow so the hand can rest on her hip
    rig.m.armL.scale.y = 0.836;
    rig.m.armL.position.y = -0.121;
    const fore = k.at(k.group(), 0, -0.2, 0);
    fore.add(k.at(k.cap(coat, 0.105, 0.285), 0, -0.0375, 0), k.at(k.cyl(coat, 0.112, 0.155, 0.12, 20), 0, -0.1, 0), k.at(k.torus(gold, 0.152, 0.02), 0, -0.16, 0, Math.PI / 2, 0, 0));
    fore.add(rig.m.handL);
    rig.m.handL.position.set(0, -0.23, 0);
    rig.armL.add(fore);

    // ── long, wavy red hair
    head.add(k.at(k.dome(hair, 0.592, 0.542, 0.556, 0.5, 36), 0, c.y, 0, -0.56, 0, 0));
    head.add(k.at(k.ball(hair, 0.55, 0.4, 0.33), 0, c.y - 0.13, -0.29));
    head.add(k.at(k.ball(hair, 0.25, 0.1, 0.12), 0.15, c.y + 0.325, 0.405, 0.25, 0, -0.3), k.at(k.ball(hair, 0.17, 0.085, 0.1), -0.2, c.y + 0.345, 0.385, 0.25, 0, 0.42));
    k.both((s) => head.add(k.at(k.ball(hair, 0.15, 0.3, 0.23), s * 0.52, c.y - 0.2, -0.03, 0, 0, s * 0.1)));
    const mane = k.at(k.group(), 0, 0.72, -0.3);
    const fall = k.lathe(hair, [[0, -0.77], [0.15, -0.74], [0.33, -0.56], [0.45, -0.33], [0.44, -0.1], [0.3, 0.05]], 28);
    fall.scale.z = 0.37;
    mane.add(
      fall,
      // staggered curls give the outline its waves
      k.at(k.ball(hair, 0.14, 0.15, 0.13), 0.42, -0.2, 0.01),
      k.at(k.ball(hair, 0.13, 0.14, 0.12), 0.35, -0.53, 0),
      k.at(k.ball(hair, 0.14, 0.15, 0.13), -0.43, -0.34, 0.01),
      k.at(k.ball(hair, 0.13, 0.13, 0.12), -0.27, -0.61, 0)
    );
    torso.add(mane);
    rig.spring(mane, { axis: 'x', gain: 0.07, sway: 0.025, speed: 1.5, k: 70, d: 7 });

    k.face({
      eye: { yaw: 21.5, pitch: 3, size: 0.084, tall: 1.3 },
      brow: { color: 0xa63c1c, thick: 0.015, width: 0.074 },
      mouth: { pitch: -18, width: 0.085 },
      cheeks: { yaw: 37, pitch: -9, color: 0xff8f8f, opacity: 0.55 },
    });

    // eye patch over her right eye: it sits proud of every eye shape, and the eye underneath is
    // switched off as well so no expression can ever poke through
    rig.face.eyes.find((e) => e.side < 0).root.visible = false;
    head.add(k.onSphere(k.ball(navy, 0.118, 0.125, 0.034), -21.5, 2.5, 0.018));
    const strap = k.at(k.group(), 0, c.y, 0);
    const ring = k.at(k.torus(navy, 0.5, 0.013, 2.0), 0, 0, 0, Math.PI / 2, 0, 0.72);
    ring.scale.set(1.156, 1.076, 1);
    strap.add(ring);
    strap.quaternion.setFromAxisAngle(new k.THREE.Vector3(Math.sin(-0.375), 0, Math.cos(-0.375)), 0.8);
    head.add(strap);
    // lashes on the other eye
    const lash = k.onSphere(k.group(), 21.5, 3, 0.014);
    lash.add(k.stroke(navy, 0.058, 0.082, 0.112, 0.118, 0.011), k.stroke(navy, 0.074, 0.05, 0.126, 0.066, 0.011));
    head.add(lash);

    // gold hoop earring
    const earring = k.at(k.group(), 0.6, c.y - 0.2, 0.17);
    earring.add(k.at(k.torus(gold, 0.062, 0.015), 0, -0.07, 0, 0, 0.5, 0));
    head.add(earring);
    rig.spring(earring, { axis: 'z', gain: 0.12, sway: 0.1, speed: 2.4, k: 60, d: 4 });

    // ── tricorn: triangular brim, three upturned flaps trimmed in gold, crown, plume
    const hat = k.at(k.group(), 0, c.y + 0.34, -0.015, -0.13, 0, 0.05);
    const brim = k.cyl(navy, 0.84, 0.84, 0.04, 3);
    brim.scale.set(1.1, 1, 1.05);
    hat.add(brim, k.at(k.dome(navy, 0.485, 0.37, 0.47, 0.5, 32), 0, 0, 0));
    const corners = [[0, 0.88], [0.8, -0.44], [-0.8, -0.44]];
    corners.forEach(([ax, az], i) => {
      const [bx, bz] = corners[(i + 1) % 3];
      const len = Math.hypot(bx - ax, bz - az) / 2;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const flap = k.at(k.group(), mx * 0.985, 0, mz * 0.985);
      flap.rotation.set(-0.32, Math.atan2(mx, mz), 0, 'YXZ');
      flap.add(k.dome(navy, len * 0.97, 0.31, 0.06, 0.5, 32), k.dome(gold, len * 0.97 + 0.022, 0.332, 0.038, 0.5, 32));
      hat.add(flap);
    });
    const plume = k.at(k.group(), 0.4, 0.05, -0.12, -0.22, 0.25, -0.5);
    plume.scale.setScalar(1.3);
    const p1 = k.at(k.ball(teal, 0.105, 0.2, 0.03), 0, 0.18, 0);
    const curl = k.at(k.group(), 0, 0.31, 0, -0.45, 0, -0.22);
    const curl2 = k.at(k.group(), 0, 0.27, 0, -0.7, 0, -0.28);
    curl2.add(k.at(k.ball(teal, 0.09, 0.14, 0.028), 0, 0.1, 0));
    curl.add(k.at(k.ball(teal, 0.12, 0.19, 0.03), 0, 0.13, 0), curl2);
    plume.add(p1, curl, k.at(k.stroke(cream, 0, 0.0, 0, 0.36, 0.012), 0, 0.18, 0.026));
    hat.add(plume);
    head.add(hat);
    rig.spring(plume, { axis: 'x', gain: 0.12, sway: 0.04, speed: 1.9, k: 60, d: 5 });
    rig.spring(curl, { axis: 'x', gain: 0.2, sway: 0.07, speed: 1.9, phase: -0.8, k: 45, d: 4 });
    rig.spring(curl2, { axis: 'x', gain: 0.26, sway: 0.1, speed: 1.9, phase: -1.6, k: 40, d: 4 });
    rig.spring(hat, { axis: 'x', gain: 0.04, k: 120, d: 10 });

    // ── cutlass: curved blade, basket guard
    const cutlass = k.group();
    const R = 0.62;
    const arc = 0.52;
    const blade = k.at(k.torus(steel, R, 0.055, arc), -R, -0.15, 0, Math.PI, 0, 0);
    blade.scale.z = 0.28;
    const tip = k.at(k.cone(steel, 0.055, 0.14, 16), -R + R * Math.cos(arc) - Math.sin(arc) * 0.07, -0.15 - R * Math.sin(arc) - Math.cos(arc) * 0.07, 0, 0, 0, Math.PI - arc);
    tip.scale.z = 0.28;
    cutlass.add(
      blade,
      tip,
      k.at(k.cyl(gold, 0.08, 0.08, 0.03, 18), 0, -0.14, 0),
      k.at(k.torus(gold, 0.142, 0.018, Math.PI), 0, 0, 0, 0, 0, Math.PI / 2),
      k.at(k.ball(gold, 0.045), 0, 0.15, 0)
    );
    rig.handR.add(cutlass);
    rig.props.cutlass = cutlass;

    // elbow: bent while idling, straight whenever a clip drives the arms
    rig.tickers.push((t, dt, r, animator) => {
      fore.rotation.z = -1.42 * calm(animator);
      // when the sword arm is thrown right up, angle the blade away from the hat
      const raised = -r.armR.rotation.z;
      cutlass.rotation.z = 0.5 * clamp01((raised - 2.25) / 0.5) + 0.45 * clamp01((raised - 2.75) / 0.4);
    });

    return rig;
  },

  idle(P, t, rig, animator) {
    const w = calm(animator);
    // rolling with the deck
    const roll = Math.sin(t * 0.95);
    P.roll += roll * 0.04;
    P.x += roll * 0.02;
    P.torsoZ += roll * -0.035;
    P.headZ += roll * -0.035;
    P.legLZ += roll * -0.03;
    P.legRZ += roll * -0.03;
    P.hipsY += Math.sin(t * 1.9 + 0.6) * 0.007;
    // left hand on her hip
    P.armLZ += 0.74 * w;
    P.armLX += -0.1 * w;
    // cutlass resting point-down, raised in a flourish every few seconds
    const f = t % 6.4;
    const up = step(0, 0.32, f) - step(1.35, 1.8, f);
    const shake = Math.sin(f * 15) * up * (1 - step(0.9, 1.35, f));
    P.armRZ += -0.3 - 1.72 * up + shake * 0.13;
    P.armRX += -0.08 + 0.3 * up;
    P.headZ += 0.07 * up;
    P.headX += -0.08 * up;
    P.torsoZ += 0.05 * up;
    P.y += Math.max(0, Math.sin((f - 0.12) * 9)) * 0.05 * step(0.1, 0.2, f) * (1 - step(0.44, 0.47, f));
  },
};
