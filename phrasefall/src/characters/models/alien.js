/** Zib — a curious little visitor from somewhere much further away than the Moon. */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Soft 0 → 1 → 0 window over [a, b] with edges of width e. */
const win = (c, a, b, e = 0.5) => smooth(a, a + e, c) * (1 - smooth(b - e, b, c));
const r4 = (n) => Math.round(n * 10000) / 10000;

/** Seconds between finger waves. */
const PERIOD = 6.5;
const GLOW = 0x7dffb0;

export default {
  id: 'alien',
  name: 'Zib',
  title: 'The Alien',
  blurb: 'Came for the tea. Stayed for the idioms.',
  accent: 0x7dffb0,
  shot: 'orb',

  build(k) {
    const V3 = k.THREE.Vector3;
    const skin = k.mat(0x63d99d);
    const pale = k.mat(0xdcfae6, { rough: 0.7 });
    const spot = k.mat(0x35b47d);
    const violet = k.mat(0x7c58e8, { rough: 0.5 });
    const violetDeep = k.mat(0x5b3cc4, { rough: 0.6 });
    const silver = k.metal(0xd3daea, 0.28);
    const gemMat = k.glow(GLOW, 1.4);
    const bobMat = [k.glow(GLOW, 1.5), k.glow(GLOW, 1.51)];

    // The head is an inverted teardrop: a wide ellipsoidal cranium (centre CY, radii RX/RY)
    // that tapers through a paraboloid jaw into a small chin.
    const CY = 0.6;
    const RX = 0.62;
    const RY = 0.46;
    const ZS = 0.9;
    const JOIN = 0.42;
    const CHIN = -0.035;
    const TOP = CY + RY;
    const rJoin = RX * Math.sqrt(1 - ((JOIN - CY) / RY) ** 2);
    const jawR = (y) => rJoin * Math.sqrt(clamp01((y - CHIN) / (JOIN - CHIN)));
    const profile = [];
    for (let i = 0; i <= 10; i++) {
      const y = CHIN + (JOIN - CHIN) * (i / 10) ** 1.7;
      profile.push([r4(jawR(y)), r4(y)]);
    }
    const a0 = Math.asin((JOIN - CY) / RY);
    for (let i = 1; i <= 18; i++) {
      const a = a0 + ((Math.PI / 2 - a0) * i) / 18;
      profile.push([i === 18 ? 0 : r4(RX * Math.cos(a)), r4(CY + RY * Math.sin(a))]);
    }
    const FR = [RX, RY, RX * ZS]; // the ellipsoid the face sits on

    const rig = k.biped({
      skin,
      top: skin,
      bottom: skin,
      shoe: violet,
      hand: skin,
      sleeve: skin,
      noHead: true,
      legLen: 0.22,
      legR: 0.1,
      legGap: 0.15,
      foot: [0.125, 0.09, 0.19],
      torso: [0.84, 0.86, 0.9],
      armLen: 0.4,
      armR: 0.065,
      handR: 0.085,
      shoulderW: 0.25,
      shoulderY: 0.43,
      armRest: 0.3,
      head: FR,
      neckSink: 0.05,
    });
    const { head, torso } = rig;
    const c = rig.headCenter.set(0, CY, 0);
    rig.metrics.headY = rig.metrics.hipY + head.position.y + CY;
    rig.metrics.height = rig.metrics.hipY + head.position.y + TOP;

    const skull = k.lathe(skin, profile, 44, false);
    skull.scale.z = ZS;
    head.add(skull);
    rig.m.head = skull;

    // forehead spots (and a few on the back of the head)
    [[0, 45, 0.055], [-13, 36, 0.038], [13, 36, 0.038], [180, 34, 0.075], [156, 14, 0.05], [205, 10, 0.045]].forEach(([yaw, pitch, r]) => {
      const dot = k.ball(spot, r, r * 0.8, 0.012);
      dot.castShadow = false;
      head.add(k.onSphere(dot, yaw, pitch, 0.003, FR, c));
    });

    // the mouth sits on the jaw, below the ellipsoid, so it gets its own little sphere to ride on
    const yM = 0.225;
    const pM = -Math.atan(((jawR(yM + 0.01) - jawR(yM - 0.01)) / 0.02) * ZS);
    const mouthC = new V3(0, yM - 0.3 * Math.sin(pM), jawR(yM) * ZS - 0.3 * Math.cos(pM));
    k.face({
      radii: FR,
      center: c,
      eye: { yaw: 23.5, pitch: -2, size: 0.118, tall: 1.42, tilt: 0.42, color: 0x15122e },
      brow: false,
      mouth: { center: mouthC, radii: [0.3, 0.3, 0.3], pitch: (pM * 180) / Math.PI, width: 0.052, lift: 0.006 },
      cheeks: { yaw: 45, pitch: -20, color: 0xff9dba, size: 0.07, opacity: 0.8 },
    });

    // ── antennae with softly glowing bobbles ─────────────────────────────
    const halos = [];
    k.both((s) => {
      const i = s > 0 ? 0 : 1;
      const x = 0.2;
      const base = k.at(k.group(), s * x, CY + RY * Math.sqrt(1 - (x / RX) ** 2) - 0.025, 0, 0, 0, -s * 0.28);
      const tip = k.at(k.group(), 0, 0.3, 0, 0, 0, -s * 0.42);
      const halo = k.at(k.halo(GLOW, 0.46, 0.55), 0, 0.25, 0);
      halos.push(halo);
      base.add(k.ball(skin, 0.055, 0.035, 0.055), k.at(k.cyl(spot, 0.016, 0.022, 0.31, 8), 0, 0.15, 0), tip);
      tip.add(k.ball(spot, 0.021), k.at(k.cyl(spot, 0.013, 0.016, 0.22, 8), 0, 0.1, 0), k.at(k.ball(bobMat[i], 0.072), 0, 0.25, 0), halo);
      head.add(base);
      rig.spring(base, { axis: 'z', gain: 0.1, yawGain: 0.04, sway: 0.05, speed: 1.6, phase: s, k: 50, d: 4 });
      rig.spring(base, { axis: 'x', gain: 0.14, sway: 0.035, speed: 1.3, phase: 1 + s, k: 50, d: 4 });
      rig.spring(tip, { axis: 'z', gain: 0.16, yawGain: 0.06, sway: 0.09, speed: 1.6, phase: s - 0.9, k: 36, d: 3.2 });
      rig.spring(tip, { axis: 'x', gain: 0.2, sway: 0.06, speed: 1.3, phase: s, k: 36, d: 3.2 });
    });

    // ── body: pale belly, space collar with a glowing gem ────────────────
    torso.add(k.at(k.ball(pale, 0.175, 0.18, 0.1), 0, 0.13, 0.236));
    const collar = k.group();
    collar.scale.z = 0.9;
    collar.add(
      k.lathe(violet, [[0.4, 0.27], [0.405, 0.3], [0.36, 0.4], [0.27, 0.49], [0.17, 0.545]], 36),
      k.at(k.cyl(violetDeep, 0.395, 0.395, 0.02, 32), 0, 0.283, 0),
      k.at(k.torus(silver, 0.402, 0.03), 0, 0.283, 0, Math.PI / 2, 0, 0)
    );
    torso.add(collar);
    const gem = k.at(k.group(), 0, 0.385, 0.337, -0.72, 0, 0);
    const gemHalo = k.at(k.halo(GLOW, 0.4, 0.5), 0, 0, 0.05);
    gem.add(k.ball(gemMat, 0.058, 0.07, 0.036), k.torus(silver, 0.072, 0.02), gemHalo);
    torso.add(gem);

    // three-fingered hands, silver cuffs and ankle rings
    const fingers = [];
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      rig[`arm${side}`].add(k.at(k.torus(silver, 0.068, 0.022), 0, -0.3, 0, Math.PI / 2, 0, 0));
      rig[`leg${side}`].add(k.at(k.torus(silver, 0.104, 0.024), 0, -0.165, 0, Math.PI / 2, 0, 0));
      [-1, 0, 1].forEach((d) => {
        const f = k.at(k.group(), d * 0.045, -0.055, 0, 0, 0, d * 0.5);
        f.add(k.at(k.cap(skin, 0.03, 0.115, 8), 0, -0.035, 0));
        rig[`hand${side}`].add(f);
        if (s > 0) fingers.push({ f, d });
      });
    });

    rig.props.wave = 0;
    rig.tickers.push((t, dt, r) => {
      // antennae pulse in turn, the gem breathes slowly
      bobMat.forEach((m, i) => {
        const p = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 2.1);
        m.emissiveIntensity = 0.75 + p * 1.0;
        halos[i].material.opacity = 0.28 + p * 0.42;
        halos[i].scale.setScalar(0.38 + p * 0.14);
      });
      const g = 0.5 + 0.5 * Math.sin(t * 1.5);
      gemMat.emissiveIntensity = 0.8 + g * 0.7;
      gemHalo.material.opacity = 0.3 + g * 0.3;
      // the wave is all in the fingers
      const w = r.props.wave;
      for (const { f, d } of fingers) f.rotation.z = d * 0.5 + Math.sin(t * 9 - d * 1.3) * 0.38 * w;
    });

    // the dizzy-star anchor and anything else that asks sees the full height of the tall head
    rig.headRadii = [RX, (TOP + 0.03) / 1.9, RX * ZS];
    return rig;
  },

  constrain(P) {
    // the cranium is wide: arms go up-and-out, never straight up into it
    if (P.armLZ > 2.1) P.armLZ = 2.1;
    if (P.armRZ < -2.1) P.armRZ = -2.1;
  },

  idle(P, t, rig) {
    // gentle levitation, legs dangling
    P.y += 0.14 + Math.sin(t * 1.4) * 0.05;
    P.roll += Math.sin(t * 0.7) * 0.03;
    P.pitch += Math.sin(t * 0.9 + 1) * 0.025;
    P.legLX += 0.1 + Math.sin(t * 1.4 + 0.6) * 0.1;
    P.legRX += 0.02 + Math.sin(t * 1.4 + 2.2) * 0.1;
    P.legLZ += 0.05;
    P.legRZ -= 0.05;
    P.armLZ += 0.14 + Math.sin(t * 1.4 + 0.4) * 0.06;
    P.armRZ -= 0.14 + Math.sin(t * 1.4 + 1.1) * 0.06;

    // curious head tilts: hold one side, then the other
    P.headZ += Math.tanh(Math.sin(t * 0.62) * 3) * 0.15;
    P.headY += Math.tanh(Math.sin(t * 0.62 + 1.3) * 3) * 0.1;

    // every few seconds: a tiny wave of the fingers
    const w = win(t % PERIOD, 3.4, 5.9, 0.45);
    rig.props.wave = w;
    P.armLZ += w * (1.86 + Math.sin(t * 5) * 0.08);
    P.armLX += w * 0.2;
    P.headZ += w * 0.06;
  },
};
