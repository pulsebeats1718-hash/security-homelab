/** Bolt — a sunny-yellow robot with a screen for a face. */
export default {
  id: 'robot',
  name: 'Bolt',
  title: 'The Robot',
  blurb: 'Runs on rechargeable batteries and very dry British understatement.',
  accent: 0x5ff2ff,
  shot: 'bolt',

  build(k) {
    const shell = k.mat(0xffc531, { rough: 0.4 });
    const shellDark = k.mat(0xe89f12, { rough: 0.45 });
    const dark = k.mat(0x30374a, { rough: 0.5 });
    const joint = k.mat(0x7e889f, { metal: 0.65, rough: 0.34 });
    const screen = k.mat(0x111727, { rough: 0.1, rim: 0.7 });
    const led = k.glow(0x66f3ff, 2.3);
    const chestMat = k.glow(0x66f3ff, 2.0);
    const beaconMat = k.glow(0xff5d5d, 2.2);

    const headR = [0.56, 0.43, 0.45];
    const rig = k.biped({
      skin: shell,
      top: shell,
      bottom: joint,
      shoe: dark,
      hand: dark,
      sleeve: joint,
      noHead: true,
      noTorso: true,
      legR: 0.095,
      legGap: 0.19,
      armR: 0.082,
      armLen: 0.43,
      shoulderW: 0.41,
      shoulderY: 0.47,
      handR: 0.13,
      foot: [0.175, 0.115, 0.25],
      head: headR,
      neckSink: -0.04,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // body
    torso.add(k.at(k.box(shell, 0.74, 0.64, 0.58, 0.17), 0, 0.3, 0));
    torso.add(k.at(k.box(shellDark, 0.5, 0.3, 0.08, 0.06), 0, 0.3, 0.262));
    const core = k.at(k.ball(chestMat, 0.07, 0.07, 0.03), -0.12, 0.33, 0.305);
    const coreHalo = k.at(k.halo(0x66f3ff, 0.34, 0.5), -0.12, 0.33, 0.33);
    torso.add(core, coreHalo, k.at(k.torus(dark, 0.085, 0.018), -0.12, 0.33, 0.3));
    [0, 1, 2].forEach((i) => torso.add(k.at(k.box(dark, 0.17, 0.028, 0.02, 0.01), 0.1, 0.37 - i * 0.055, 0.303)));
    torso.add(k.at(k.cyl(dark, 0.15, 0.17, 0.16, 20), 0, 0.66, 0));
    torso.add(k.at(k.cyl(dark, 0.3, 0.26, 0.1, 24), 0, -0.02, 0));
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      rig[`arm${side}`].add(k.ball(dark, 0.125), k.at(k.cyl(shell, 0.11, 0.125, 0.16, 16), 0, -0.3, 0));
      rig[`leg${side}`].add(k.at(k.cyl(shell, 0.125, 0.14, 0.14, 16), 0, -0.26, 0));
    });

    // head with a screen face
    head.add(k.at(k.box(shell, headR[0] * 2, headR[1] * 2, headR[2] * 2, 0.25), 0, c.y, 0));
    head.add(k.at(k.box(screen, 0.9, 0.6, 0.12, 0.18), 0, c.y - 0.01, headR[2] - 0.045));
    k.both((s) => {
      head.add(k.at(k.cyl(dark, 0.13, 0.13, 0.1, 20), s * 0.57, c.y, 0, 0, 0, Math.PI / 2));
      head.add(k.at(k.cyl(joint, 0.07, 0.07, 0.16, 16), s * 0.58, c.y, 0, 0, 0, Math.PI / 2));
    });
    k.face({
      radii: [2.2, 2.2, headR[2] + 0.02],
      eye: { yaw: 23, pitch: 3, size: 0.07, tall: 1.25, shape: 'pill', mat: led, highlights: false },
      brow: false,
      cheeks: false,
      line: led,
      mouth: { mat: led, pitch: -15, width: 0.085, lift: 0.004 },
    });

    // springy antenna
    const antenna = k.at(k.group(), 0, c.y + headR[1], 0);
    const bulb = k.at(k.ball(beaconMat, 0.075), 0, 0.3, 0);
    const bulbHalo = k.at(k.halo(0xff6a6a, 0.42, 0.6), 0, 0.3, 0);
    antenna.add(k.at(k.cyl(dark, 0.07, 0.09, 0.05, 14), 0, 0.02, 0), k.at(k.cyl(joint, 0.018, 0.022, 0.26, 8), 0, 0.16, 0), bulb, bulbHalo);
    head.add(antenna);
    rig.spring(antenna, { axis: 'z', gain: 0.16, yawGain: 0.05, sway: 0.05, speed: 2.6, k: 55, d: 4 });
    rig.spring(antenna, { axis: 'x', gain: 0.16, sway: 0.03, speed: 2.1, k: 55, d: 4 });

    rig.tickers.push((t) => {
      const pulse = 0.65 + 0.35 * Math.sin(t * 3.2);
      chestMat.emissiveIntensity = 1.4 + pulse;
      coreHalo.material.opacity = 0.3 + 0.3 * pulse;
      const blink = (t * 0.6) % 1 < 0.5 ? 1 : 0.25;
      beaconMat.emissiveIntensity = 2.4 * blink;
      bulbHalo.material.opacity = 0.6 * blink;
    });

    return rig;
  },

  idle(P, t) {
    // crisp, mechanical head ticks and a full head spin every few seconds
    const tick = Math.round(Math.sin(t * 1.1) * 2) / 2;
    P.headZ = tick * 0.09;
    const cycle = t % 7.5;
    if (cycle < 0.7) {
      const u = cycle / 0.7;
      P.headY += (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2) * Math.PI * 2;
    }
    P.armLX += Math.sin(t * 2.2) * 0.08;
    P.armRX += Math.sin(t * 2.2 + Math.PI) * 0.08;
    P.hipsY += Math.sin(t * 4.4) * 0.006;
  },
};
