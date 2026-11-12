/** Kage — a midnight-indigo ninja whose crimson headband never stops fluttering. */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
/** Smooth 0 → 1 step between a and b. */
const step = (a, b, x) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

export default {
  id: 'ninja',
  name: 'Kage',
  title: 'The Ninja',
  blurb: 'Silent, swift, and secretly terrified of pop quizzes.',
  accent: 0xff4d6d,
  shot: 'star',

  build(k) {
    const suit = k.mat(0x333b7d, { rough: 0.72 });
    const suitDark = k.mat(0x222750, { rough: 0.72 });
    const crimson = k.mat(0xea3352, { rough: 0.62 });
    const crimsonDark = k.mat(0xb51f3f, { rough: 0.62 });
    const wrap = k.mat(0xe2deea, { rough: 0.85 });
    const skin = k.mat(0xf0bf98);
    const steel = k.metal(0xd3dae8, 0.26);

    const rig = k.biped({ skin, top: suit, bottom: suit, shoe: suitDark, hand: suitDark, sleeve: suit });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── hood + mask: two tilted shells that leave an almond of skin around the eyes
    const HOOD = [0.6, 0.557, 0.562];
    const hoodTilt = -0.61;
    const maskTilt = Math.PI + 0.44;
    const hood = k.at(k.dome(suit, HOOD[0], HOOD[1], HOOD[2], 0.528, 40), 0, c.y, 0, hoodTilt, 0, 0);
    const mask = k.at(k.dome(suit, HOOD[0] - 0.008, HOOD[1] - 0.008, HOOD[2] - 0.008, 0.556, 40), 0, c.y, 0, maskTilt, 0, 0);
    // rolled hems along the two openings
    const hoodHem = k.at(k.group(), 0, c.y, 0, hoodTilt, 0, 0);
    const hh = k.at(k.torus(suitDark, 0.5, 0.021), 0, HOOD[1] * Math.cos(0.528 * Math.PI), 0, Math.PI / 2, 0, 0);
    const hs = Math.sin(0.528 * Math.PI) / 0.5;
    hh.scale.set(HOOD[0] * hs, HOOD[2] * hs, 1);
    hoodHem.add(hh);
    const maskHem = k.at(k.group(), 0, c.y, 0, maskTilt, 0, 0);
    const arc = 2.75;
    const mh = k.at(k.torus(suitDark, 0.5, 0.021, arc), 0, (HOOD[1] - 0.008) * Math.cos(0.556 * Math.PI), 0, Math.PI / 2, 0, -Math.PI / 2 - arc / 2);
    const ms = Math.sin(0.556 * Math.PI) / 0.5;
    mh.scale.set((HOOD[0] - 0.008) * ms, (HOOD[2] - 0.008) * ms, 1);
    maskHem.add(mh);
    // a hint of a nose under the cloth
    const nose = k.at(k.ball(suit, 0.07, 0.06, 0.05), 0, c.y - 0.19, 0.497);
    head.add(hood, mask, hoodHem, maskHem, nose);

    k.face({
      eye: { yaw: 21.5, pitch: 1, size: 0.08, tall: 1.2, tilt: 0.1 },
      brow: { color: 0x1f1b33, thick: 0.02, width: 0.078, pitch: 17.5 },
      mouth: false,
      cheeks: { yaw: 39, pitch: -5.5, size: 0.058, opacity: 0.42, color: 0xff8a7a },
    });

    // ── crimson headband with a knot and two fluttering tails
    const bandY = c.y + 0.302;
    const band = k.at(k.torus(crimson, 0.5, 0.03), 0, bandY, 0, Math.PI / 2 - 0.03, 0, 0);
    band.scale.set(1.04, 0.977, 2.4);
    head.add(band);
    const knotPos = [-0.3, bandY - 0.01, -0.405];
    head.add(k.at(k.ball(crimsonDark, 0.085, 0.075, 0.07), ...knotPos));
    const makeTail = (segs, len, width, rz, ry, phase, sway, bend) => {
      const root = k.at(k.group(), knotPos[0] - 0.02, knotPos[1], knotPos[2] - 0.02, 0, ry, rz);
      let parent = root;
      for (let i = 0; i < segs; i++) {
        // a built-in S-curve so the ribbon reads as cloth even when it is still
        const seg = k.at(k.group(), 0, i === 0 ? 0 : -len, 0, 0, 0, Math.sin(i * 1.25 + 0.4) * 0.24 * bend);
        const w = width * (1 - i * 0.035);
        // flattened capsules overlap into round joints, so the bends stay soft
        const link = k.at(k.cap(crimson, w / 2, len + w * 0.86, 12), 0, -len / 2, 0);
        link.scale.z = 0.024 / w;
        seg.add(link);
        parent.add(seg);
        // negative gain: the tails trail behind when he jumps
        rig.spring(seg, { axis: 'z', gain: -0.07 - i * 0.03, sway: sway * (0.45 + i * 0.3), speed: 5.2, phase: phase - i * 0.9, k: 55, d: 5 });
        rig.spring(seg, { axis: 'x', gain: 0, yawGain: 0.02, sway: 0.07 + i * 0.03, speed: 3.7, phase: phase * 1.7 - i * 0.7, k: 50, d: 5 });
        parent = seg;
      }
      head.add(root);
      return root;
    };
    makeTail(6, 0.15, 0.165, -1.92, -0.3, 0, 0.15, -1);
    makeTail(5, 0.15, 0.15, -1.5, -0.16, 1.9, 0.17, 1);

    // ── gi: cowl, sword strap, sash with a knot and a throwing star
    const cowl = k.at(k.torus(suitDark, 0.24, 0.085), 0, 0.565, 0.005, Math.PI / 2 + 0.08, 0, 0);
    cowl.scale.set(1.05, 0.95, 1);
    torso.add(cowl);

    // sword strap, slung from the left shoulder to the right hip
    const strap = k.at(k.group(), 0, 0.25, 0, 0, 0, 0.8);
    const strapRing = k.at(k.torus(suitDark, 0.4, 0.024), 0, 0, 0, Math.PI / 2, 0, 0);
    strapRing.scale.set(1.04, 0.885, 1.9);
    strap.add(strapRing);
    torso.add(strap);

    const sash = k.at(k.torus(crimson, 0.4, 0.05), 0, 0.2, 0, Math.PI / 2, 0, 0);
    sash.scale.set(1, 0.865, 1.55);
    torso.add(sash);
    const sashKnot = k.onTorso(k.group(), 52, 0.2, 0.05);
    sashKnot.add(k.ball(crimsonDark, 0.07, 0.065, 0.05));
    const ends = k.at(k.group(), 0, -0.02, 0);
    ends.add(k.at(k.box(crimson, 0.075, 0.2, 0.03, 0.014), -0.03, -0.1, 0, 0, 0, -0.14), k.at(k.box(crimsonDark, 0.07, 0.16, 0.03, 0.014), 0.045, -0.08, -0.012, 0, 0, 0.22));
    sashKnot.add(ends);
    torso.add(sashKnot);
    rig.spring(ends, { axis: 'x', gain: 0.14, sway: 0.05, speed: 2.6, k: 60, d: 6 });

    const star = k.onTorso(k.group(), -36, 0.2, 0.062);
    star.add(k.at(k.star(steel, 0.082, 0.03, 4, 0.018), 0, 0, 0, 0, 0, 0.4), k.at(k.cyl(suitDark, 0.018, 0.018, 0.024, 10), 0, 0, 0, Math.PI / 2, 0, 0));
    torso.add(star);

    // ── sword across the back, hilt over the left shoulder
    const sword = k.at(k.group(), 0.2, 0.475, -0.385, 0, 0, -0.96);
    sword.scale.setScalar(1.18);
    const sheath = k.at(k.cap(suitDark, 0.043, 0.86), 0, -0.07, 0);
    sheath.scale.z = 0.7;
    const hilt = k.at(k.cyl(crimson, 0.034, 0.036, 0.27, 12), 0, 0.535, 0);
    sword.add(
      sheath,
      k.at(k.torus(crimson, 0.046, 0.016), 0, 0.2, 0, Math.PI / 2, 0, 0),
      k.at(k.torus(crimson, 0.046, 0.016), 0, -0.3, 0, Math.PI / 2, 0, 0),
      k.at(k.box(steel, 0.15, 0.036, 0.1, 0.016), 0, 0.385, 0),
      hilt,
      k.at(k.torus(suitDark, 0.036, 0.012), 0, 0.48, 0, Math.PI / 2, 0, 0),
      k.at(k.torus(suitDark, 0.036, 0.012), 0, 0.56, 0, Math.PI / 2, 0, 0),
      k.at(k.ball(steel, 0.045, 0.035, 0.045), 0, 0.68, 0)
    );
    torso.add(sword);

    // ── wrapped forearms and shins
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      [-0.215, -0.27, -0.325].forEach((y) => rig[`arm${side}`].add(k.at(k.torus(wrap, 0.098, 0.031), 0, y, 0, Math.PI / 2, 0, 0)));
      [-0.13, -0.19].forEach((y) => rig[`leg${side}`].add(k.at(k.torus(wrap, 0.122, 0.034), 0, y, 0, Math.PI / 2, 0, 0)));
    });

    return rig;
  },

  idle(P, t, rig, animator) {
    // low ready stance, weight rolling from foot to foot
    const shift = Math.sin(t * 1.3);
    P.yaw += -0.2;
    P.headY += 0.2;
    P.legLZ += 0.2;
    P.legRZ += -0.2;
    P.legLX += -0.2 + shift * 0.03;
    P.legRX += 0.16 - shift * 0.03;
    P.hipsY += -0.014 + Math.abs(shift) * 0.01;
    P.x += shift * 0.03;
    P.roll += shift * -0.018;
    P.torsoX += 0.1;
    P.torsoZ += shift * 0.025;
    P.headX += -0.06;
    // hands hover, ready to strike
    P.armLX += -0.62 + Math.sin(t * 2.6) * 0.04;
    P.armLZ += 0.1;
    P.armRX += -0.1 + Math.sin(t * 2.6 + 1.4) * 0.04;
    P.armRZ += -0.34;

    // quick sharp glances: left, right, back to centre
    const g = t % 4.4;
    const look = step(0, 0.08, g) - 2 * step(0.52, 0.62, g) + step(1.08, 1.18, g);
    P.headY += look * 0.5;
    P.torsoY += look * 0.1;
    P.headZ += look * -0.04;
    if (g < 1.12 && rig.face && !animator?.clip && (animator?.worry ?? 0) < 0.3) rig.face.set('focus', 0.12);
  },
};
