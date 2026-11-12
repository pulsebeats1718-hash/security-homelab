/** Duke — a cheerful little prizefighter: guard up, light on his toes, one-two on the beat. */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (x) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};
/** 0 → 1 → 0 pulse: snaps out, holds, then eases back (all in seconds). */
const pulse = (x, out, hold, back) => smooth(x / out) * (1 - smooth((x - out - hold) / back));
/** 1 while idling, 0 while an action clip (or a fright) has taken over the arms. */
const calm = (animator) => {
  const c = animator?.clip;
  let w = 1;
  if (c) w = 1 - Math.min(clamp01(c.t / 0.07), c.def.hold ? 1 : clamp01((c.dur - c.t) / 0.14));
  return w * (1 - clamp01((animator?._worry ?? 0) * 2.5));
};
/** The one-two: a left jab then a right cross every few seconds. */
const COMBO = 3.6;
const PUNCH = { jab: 0, cross: 0 };
const punches = (t) => {
  const f = t % COMBO;
  PUNCH.jab = pulse(f, 0.09, 0.05, 0.16);
  PUNCH.cross = pulse(f - 0.3, 0.1, 0.07, 0.2);
  return PUNCH;
};
const GUARD = 2.05; // elbow bend while the guard is up

export default {
  id: 'boxer',
  name: 'Duke',
  title: 'The Boxer',
  blurb: 'Rolls with the punches. Always up before the count of three.',
  accent: 0xff5a3c,
  shot: 'orb',

  build(k) {
    const skin = k.mat(0xd29363);
    const hair = k.mat(0x35262a, { rough: 0.85, rim: 0.25 });
    const glove = k.mat(0xe9382d, { rough: 0.2, rim: 0.6 });
    const red = k.mat(0xdf3a30, { rough: 0.55 });
    const white = k.mat(0xf8f5ee, { rough: 0.7 });
    const satin = k.mat(0x2d63dc, { rough: 0.3, rim: 0.55 });
    const gold = k.mat(0xffc93f, { metal: 0.45, rough: 0.34 });

    const S = [1.07, 1, 0.87];
    const rig = k.biped({ skin, top: white, bottom: skin, shoe: red, hand: glove, sleeve: skin, torso: S, armR: 0.112, legR: 0.135, shoulderW: 0.335 });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── vest trim, satin trunks with a wide gold waistband and side stripes
    const neck = k.at(k.torus(satin, 0.21, 0.032), 0, 0.605, 0.01, Math.PI / 2 + 0.1, 0, 0);
    neck.scale.set(1.08, 0.95, 1);
    const trunks = k.lathe(satin, [[0, -0.09], [0.21, -0.08], [0.366, 0.03], [0.395, 0.1], [0.412, 0.17]], 32);
    trunks.scale.set(S[0], 1, S[0] * S[2]);
    const waist = k.lathe(gold, [[0.408, 0.14], [0.421, 0.19], [0.414, 0.245]], 32);
    waist.scale.set(S[0], 1, S[0] * S[2]);
    // side stripes: the trunks' own outline, squashed into a raised band down each hip
    const stripes = k.lathe(gold, [[0.345, -0.03], [0.39, 0.03], [0.418, 0.1], [0.43, 0.145]], 32);
    stripes.scale.set(S[0], 1, S[0] * S[2] * 0.24);
    torso.add(stripes);
    torso.add(neck, trunks, waist, k.onTorso(k.box(white, 0.12, 0.07, 0.03, 0.02), 0, 0.192, 0.014));
    k.both((s) => {
      const leg = rig[s > 0 ? 'legL' : 'legR'];
      leg.add(
        k.at(k.cyl(satin, 0.172, 0.2, 0.2, 22), 0, -0.03, 0),
        // lace-up boots
        k.at(k.cyl(red, 0.15, 0.143, 0.17, 18), 0, -0.27, 0),
        k.at(k.torus(white, 0.151, 0.02), 0, -0.19, 0, Math.PI / 2, 0, 0),
        k.at(k.ball(white, 0.166, 0.04, 0.242), 0, -0.405, 0.076)
      );
      [-0.235, -0.285].forEach((y) => leg.add(k.at(k.box(white, 0.1, 0.022, 0.03, 0.011), 0, y, 0.14)));
      leg.add(k.at(k.box(white, 0.09, 0.022, 0.05, 0.011), 0, -0.262, 0.155, 0.75, 0, 0));
    });

    // ── arms with real elbows, ending in oversized gloves
    const fores = k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      const upper = rig.m[`arm${side}`];
      upper.scale.y = 0.836;
      upper.position.y = -0.121;
      const fore = k.at(k.group(), 0, -0.2, 0);
      const mitt = rig.m[`hand${side}`];
      mitt.scale.set(0.2, 0.205, 0.21);
      mitt.position.set(0, -0.27, 0.01);
      fore.add(
        k.at(k.cap(skin, 0.11, 0.26), 0, -0.02, 0),
        k.at(k.cyl(white, 0.128, 0.14, 0.1, 20), 0, -0.115, 0),
        mitt,
        k.at(k.ball(glove, 0.09, 0.11, 0.1), s * -0.15, -0.24, 0.07, 0, 0, s * -0.35)
      );
      rig[`arm${side}`].add(fore);
      return fore;
    });

    // ── head: ears, flat-top, headband, plaster
    k.both((s) => head.add(k.at(k.ball(skin, 0.07, 0.1, 0.085), s * 0.56, c.y - 0.03, -0.01)));
    head.add(k.at(k.dome(hair, 0.588, 0.54, 0.55, 0.43, 32), 0, c.y, 0, -0.26, 0, 0));
    const top = k.at(k.group(), 0, c.y + 0.26, -0.01);
    const flat = k.at(k.lathe(hair, [[0.505, 0.2], [0.5, 0.36], [0.47, 0.5], [0.38, 0.575], [0.2, 0.605], [0, 0.61]], 32), 0, -0.26, 0);
    flat.scale.z = 0.94;
    top.add(flat);
    head.add(top);
    rig.spring(top, { axis: 'x', gain: 0.05, sway: 0.008, speed: 2.4, k: 130, d: 8 });
    const band = k.at(k.torus(red, 0.5, 0.03), 0, c.y + 0.27, 0, Math.PI / 2 - 0.05, 0, 0);
    band.scale.set(1.01, 0.94, 1.9);
    head.add(band);
    const knot = k.at(k.group(), 0.02, c.y + 0.25, -0.5);
    knot.add(k.ball(red, 0.06, 0.055, 0.05));
    k.both((s) => {
      const tail = k.at(k.group(), s * 0.02, -0.01, -0.01, 0.35, 0, s * 0.5);
      tail.add(k.at(k.box(red, 0.07, 0.19, 0.026, 0.012), 0, -0.1, 0));
      knot.add(tail);
      rig.spring(tail, { axis: 'x', gain: 0.2, sway: 0.08, speed: 3.1, phase: s, k: 60, d: 5 });
    });
    head.add(knot);

    k.face({
      eye: { yaw: 22, pitch: 2, size: 0.079, tall: 1.26 },
      brow: { color: 0x35262a, thick: 0.025, width: 0.085, pitch: 18.5 },
      mouth: { pitch: -19, width: 0.1 },
      cheeks: { color: 0xf0705c, opacity: 0.4, pitch: -11 },
    });
    // a permanent confident slant to the brows
    for (const b of rig.face.brows) b.root.rotateZ(0.13 * b.side);
    // the resting mouth is a toothy, lopsided grin instead of the stock smile
    const mouth = rig.face.mouth;
    const w = 0.105;
    const grin = k.at(k.group(), 0.012, 0.04, 0, 0, 0, -0.1);
    const cavity = k.mesh(k.G.circle(w, 24, Math.PI, Math.PI), k.mat(0x6a2534, { rough: 0.5, rim: 0.05 }), false);
    cavity.scale.set(1.12, 0.78, 1);
    const teeth = k.at(k.box(white, w * 1.8, w * 0.34, 0.012, 0.008), 0, -w * 0.2, 0.002);
    const lip = k.stroke(k.mat(0x2a1c24, { rough: 0.5, rim: 0.1 }), -w * 1.12, 0, w * 1.12, 0, w * 0.13);
    grin.add(cavity, teeth, lip);
    mouth.root.remove(mouth.shapes.smile);
    mouth.shapes.smile = grin;
    mouth.root.add(grin);
    rig.face.apply('neutral');
    // plaster on his left cheek
    const plaster = k.onSphere(k.group(), 41, -9, 0.004);
    plaster.add(k.at(k.box(white, 0.135, 0.052, 0.016, 0.02), 0, 0, 0, 0, 0, -0.6), k.at(k.box(k.mat(0xe9d3b8, { rough: 0.8 }), 0.05, 0.054, 0.02, 0.012), 0, 0, 0, 0, 0, -0.6));
    head.add(plaster);

    // elbows: up in a guard while idling, snapping straight for the one-two, straight for clips
    rig.tickers.push((t, dt, r, animator) => {
      const up = GUARD * calm(animator);
      const p = punches(t);
      fores[0].rotation.x = -up * (1 - p.jab * 0.94);
      fores[1].rotation.x = -up * (1 - p.cross * 0.94);
    });

    return rig;
  },

  // the gloves are too big to tuck behind his head: fists go up in a wide champion's V instead
  constrain(P) {
    if (P.armLZ > 1.4) P.armLZ = 1.4 + (P.armLZ - 1.4) * 0.32;
    if (P.armRZ < -1.4) P.armRZ = -1.4 + (P.armRZ + 1.4) * 0.32;
  },

  idle(P, t, rig, animator) {
    const w = calm(animator);
    const p = punches(t);
    // orthodox stance, bouncing on his toes
    const hop = Math.abs(Math.sin(t * 5.4));
    P.y += hop * 0.045;
    P.sq += (hop - 0.5) * 0.03;
    P.yaw += -0.26;
    P.headY += 0.26;
    P.legLX += -0.2 + Math.sin(t * 5.4) * 0.05;
    P.legRX += 0.17 - Math.sin(t * 5.4) * 0.05;
    P.legLZ += 0.07;
    P.legRZ += -0.07;
    // shoulders rolling, bobbing and weaving
    const roll = Math.sin(t * 2.7);
    P.torsoY += roll * 0.09 - p.jab * 0.3 + p.cross * 0.42;
    P.torsoZ += Math.sin(t * 1.35) * 0.045;
    P.torsoX += 0.1 + (p.jab + p.cross) * 0.08;
    P.headZ += Math.sin(t * 1.35) * -0.04;
    P.z += (p.jab + p.cross) * 0.04;
    // guard: elbows tucked, gloves by the chin (the elbow bend itself lives in a ticker)
    P.armLX += w * (-0.34 + roll * 0.06 - p.jab * 1.12);
    P.armLZ += w * (-0.1 - p.jab * 0.12);
    P.armRX += w * (-0.16 - roll * 0.06 - p.cross * 1.3);
    P.armRZ += w * (0.14 + p.cross * 0.16);
  },
};
