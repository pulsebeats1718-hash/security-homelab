/** Captain Luna — a zero-g explorer who never quite touches the ground. */
export default {
  id: 'astronaut',
  name: 'Captain Luna',
  title: 'The Astronaut',
  blurb: 'Has orbited the Earth 400 times and still says "over the moon" every single lap.',
  accent: 0x5cc8ff,
  shot: 'star',

  build(k) {
    const suit = k.mat(0xf4f5fa, { rough: 0.5 });
    const trim = k.mat(0xff6a48);
    const grey = k.mat(0x8f97ad, { rough: 0.5 });
    const dark = k.mat(0x3a405a);
    const skin = k.mat(0xf3c7a2);
    const hair = k.mat(0x6b3b27, { rough: 0.8 });
    const steel = k.metal(0xcfd6e4, 0.28);
    const glass = k.glass(0xd6ecff, 0.2);

    const rig = k.biped({
      skin,
      top: suit,
      bottom: suit,
      shoe: grey,
      hand: grey,
      sleeve: suit,
      legR: 0.15,
      armR: 0.122,
      handR: 0.138,
      foot: [0.18, 0.12, 0.255],
      head: [0.49, 0.46, 0.47],
      neckSink: 0.02,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // hair
    const cap = k.at(k.dome(hair, 0.515, 0.49, 0.5, 0.46), 0, c.y + 0.005, -0.015, -0.32, 0, 0);
    head.add(cap, k.at(k.ball(hair, 0.2, 0.1, 0.13), -0.13, c.y + 0.33, 0.3, 0.2, 0, 0.25), k.at(k.ball(hair, 0.15, 0.09, 0.12), 0.16, c.y + 0.36, 0.27, 0.2, 0, -0.3));

    k.face({ eye: { yaw: 23, pitch: 1, size: 0.08 }, brow: { color: 0x5a2f1f }, mouth: { pitch: -19, width: 0.09 } });

    // helmet: glass bubble, hard shell at the back, collar ring and ear caps
    const hc = c.y + 0.03;
    const bubble = k.at(k.ball(glass, 0.655, 0.64, 0.655, 36), 0, hc, 0.02);
    bubble.castShadow = false;
    bubble.receiveShadow = false;
    bubble.renderOrder = 2;
    const shell = k.at(k.dome(suit, 0.675, 0.675, 0.66, 0.5, 32), 0, hc, 0.02, -Math.PI / 2 - 0.22, 0, 0);
    const glint = k.mesh(k.G.sphere(12), k.mat(0xffffff, { transparent: true, opacity: 0.55, rim: 0, depthWrite: false }), false);
    glint.scale.set(0.045, 0.15, 0.01);
    k.onSphere(glint, -38, 30, 0.004, [0.655, 0.64, 0.655], new k.THREE.Vector3(0, hc, 0.02));
    glint.rotateZ(-0.5);
    glint.renderOrder = 3;
    const collar = k.at(k.torus(steel, 0.41, 0.075), 0, c.y - 0.47, 0.02, Math.PI / 2, 0, 0);
    head.add(shell, bubble, glint, collar);
    k.both((s) => {
      head.add(k.at(k.cyl(trim, 0.13, 0.13, 0.09, 20), s * 0.66, hc - 0.04, 0, 0, 0, Math.PI / 2));
      head.add(k.at(k.cyl(steel, 0.075, 0.075, 0.12, 16), s * 0.67, hc - 0.04, 0, 0, 0, Math.PI / 2));
    });

    // antenna with a blinking beacon
    const antenna = k.at(k.group(), -0.6, hc + 0.12, -0.05, 0, 0, 0.25);
    const beaconMat = k.glow(0xff5a4a, 2.2);
    const beacon = k.at(k.ball(beaconMat, 0.05), 0, 0.33, 0);
    const halo = k.at(k.halo(0xff6a55, 0.36, 0.6), 0, 0.33, 0);
    antenna.add(k.at(k.cyl(steel, 0.014, 0.018, 0.32, 8), 0, 0.16, 0), beacon, halo);
    head.add(antenna);
    rig.spring(antenna, { axis: 'z', gain: 0.12, sway: 0.03, speed: 2.4, k: 60, d: 5 });
    rig.tickers.push((t) => {
      const on = (t * 0.9) % 1 < 0.22 ? 1 : 0.12;
      beaconMat.emissiveIntensity = 2.6 * on;
      halo.material.opacity = 0.65 * on;
    });

    // chest console
    const consoleBox = k.at(k.box(grey, 0.33, 0.2, 0.09, 0.04), 0, 0.33, 0.325, -0.12, 0, 0);
    const lights = [0xff5a5a, 0xffd34d, 0x57e39a].map((col, i) => k.at(k.ball(k.glow(col, 1.8), 0.028), -0.085 + i * 0.085, 0.36, 0.378));
    const dial = k.at(k.cyl(dark, 0.04, 0.04, 0.03, 14), -0.08, 0.29, 0.372, Math.PI / 2 - 0.12, 0, 0);
    const bar = k.at(k.box(k.glow(0x6ff0ff, 1.6), 0.13, 0.03, 0.02, 0.01), 0.055, 0.29, 0.372, -0.12, 0, 0);
    torso.add(consoleBox, ...lights, dial, bar);

    // life-support pack
    torso.add(k.at(k.box(grey, 0.52, 0.56, 0.24, 0.09), 0, 0.33, -0.36));
    k.both((s) => torso.add(k.at(k.cap(suit, 0.085, 0.5), s * 0.3, 0.33, -0.42)));
    torso.add(k.at(k.box(trim, 0.24, 0.07, 0.03, 0.02), 0, 0.5, -0.482));

    // suit rings
    const belt = k.at(k.torus(trim, 0.385, 0.04), 0, 0.1, 0, Math.PI / 2, 0, 0);
    belt.scale.y = 0.86;
    torso.add(belt);
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      rig[`arm${side}`].add(k.at(k.torus(trim, 0.127, 0.036), 0, -0.13, 0, Math.PI / 2, 0, 0), k.at(k.torus(steel, 0.125, 0.032), 0, -0.345, 0, Math.PI / 2, 0, 0));
      rig[`leg${side}`].add(k.at(k.torus(trim, 0.155, 0.036), 0, -0.2, 0, Math.PI / 2, 0, 0));
      // boot soles
      const sole = k.at(k.ball(dark, 0.185, 0.045, 0.26), 0, -0.415, 0.082);
      rig[`leg${side}`].add(sole);
    });

    return rig;
  },

  idle(P, t) {
    // weightless drift
    P.y += 0.13 + Math.sin(t * 1.25) * 0.07;
    P.roll += Math.sin(t * 0.8) * 0.055;
    P.pitch += Math.sin(t * 0.62 + 1) * 0.045;
    P.legLX += Math.sin(t * 1.25) * 0.16 + 0.1;
    P.legRX += Math.sin(t * 1.25 + 1.6) * 0.16 - 0.06;
    P.armLZ += 0.28 + Math.sin(t * 1.1) * 0.08;
    P.armRZ -= 0.28 + Math.sin(t * 1.1 + 0.8) * 0.08;
    P.armLX += -0.15;
    P.armRX += -0.1;
  },
};
