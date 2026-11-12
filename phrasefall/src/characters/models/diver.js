/** Ollie the deep-sea diver — brass helmet, canvas suit, bottomless vocabulary. */
const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// a slow, friendly wave every few seconds
const WAVE_T = 7;
const waveAmt = (t) => {
  const p = t % WAVE_T;
  return smooth(0, 0.9, p) * (1 - smooth(3.2, 4.2, p));
};
const waveState = new WeakMap();

export default {
  id: 'diver',
  name: 'Ollie',
  title: 'The Deep-Sea Diver',
  blurb: 'Goes deeper than anyone. Comes up with the best expressions.',
  accent: 0x3fd0c9,
  shot: 'orb',

  build(k) {
    const { THREE } = k;
    const suit = k.mat(0xc8922c, { rough: 0.93, rim: 0.3 });
    const copper = k.mat(0xd2743e, { metal: 0.45, rough: 0.32 });
    const brass = k.mat(0xe8b54a, { metal: 0.5, rough: 0.3 });
    const rubber = k.mat(0x1f7774, { rough: 0.5 });
    const leather = k.mat(0x5a3a2a, { rough: 0.7 });
    const skin = k.mat(0xf2c09c);
    const ginger = k.mat(0xc8602a, { rough: 0.8 });
    const interior = k.mat(0x1a2031, { rough: 0.9, rim: 0, side: THREE.BackSide });
    const portGlass = k.mat(0x2b3550, { rough: 0.1, rim: 0.6 });
    const glass = k.glass(0xd2f0ff, 0.16);
    const bubbleMat = k.glass(0xe2f8ff, 0.45);

    const rig = k.biped({
      skin,
      top: suit,
      bottom: suit,
      sleeve: suit,
      hand: rubber,
      shoe: brass,
      head: [0.47, 0.44, 0.45],
      legR: 0.145,
      armR: 0.12,
      handR: 0.135,
      foot: [0.19, 0.12, 0.27],
      torso: [1.06, 1, 0.9],
      neckSink: 0.02,
      shoulderW: 0.33,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── the face inside: ginger hair, freckles ──
    head.add(k.at(k.dome(ginger, 0.49, 0.46, 0.47, 0.42), 0, c.y, 0, -0.4, 0, 0));
    k.face({
      eye: { yaw: 21, pitch: 1, size: 0.075 },
      brow: { color: 0xa84a1c, thick: 0.011 },
      mouth: { width: 0.085 },
      cheeks: { yaw: 33, pitch: -10, color: 0xff8f80, opacity: 0.5 },
    });
    k.both((s) => {
      head.add(k.onSphere(k.ball(ginger, 0.011, 0.011, 0.005), s * 27, -6, 0.003));
      head.add(k.onSphere(k.ball(ginger, 0.01, 0.01, 0.005), s * 33, -2, 0.003));
    });

    // ── copper helmet: a sphere opened at the front, dark inside, brass porthole with bolts ──
    const R = 0.62;
    const H = new THREE.Vector3(0, c.y + 0.02, 0);
    const prof = [180, 155, 130, 105, 80, 60, 45, 35].map((d) => {
      const a = (d * Math.PI) / 180;
      return [R * Math.sin(a), R * Math.cos(a)];
    });
    prof.push([0.335, 0.5]);
    const shell = k.at(k.mesh(k.G.lathe(prof, 40, true, 48), copper), H.x, H.y, H.z, Math.PI / 2, 0, 0);
    const inner = k.at(k.ball(interior, 0.6, 0.6, 0.6, 28), H.x, H.y, H.z);
    inner.castShadow = false;
    inner.receiveShadow = false;
    const pane = k.at(k.dome(glass, 0.33, 0.07, 0.33, 0.5), H.x, H.y, H.z + 0.5, Math.PI / 2, 0, 0);
    pane.castShadow = false;
    pane.receiveShadow = false;
    pane.renderOrder = 2;
    const frame = k.at(k.torus(brass, 0.355, 0.05), H.x, H.y, H.z + 0.5);
    head.add(shell, inner, pane, frame);
    [45, 135, 225, 315].forEach((d) => {
      const a = (d * Math.PI) / 180;
      head.add(k.at(k.ball(copper, 0.03), H.x + Math.cos(a) * 0.355, H.y + Math.sin(a) * 0.355, H.z + 0.545));
    });
    // side ports
    k.both((s) => {
      const port = k.onSphere(k.group(), s * 90, 5, 0, [R, R, R], H);
      port.add(k.torus(brass, 0.11, 0.03), k.ball(portGlass, 0.1, 0.1, 0.03));
      head.add(port);
    });
    // exhaust valve on the top-right, where the bubbles come from
    const valve = k.onSphere(k.group(), -45, 50, 0, [R, R, R], H);
    valve.add(k.at(k.cyl(brass, 0.045, 0.05, 0.1, 14), 0, 0, 0.03, Math.PI / 2, 0, 0), k.at(k.ball(brass, 0.052), 0, 0, 0.085));
    const valveTip = k.at(k.group(), 0, 0, 0.12);
    valve.add(valveTip);
    head.add(valve);
    // neck ring sitting on the breastplate
    head.add(k.at(k.torus(brass, 0.385, 0.05), 0, H.y - 0.49, 0, Math.PI / 2, 0, 0));

    // ── breastplate, air hose, belt ──
    const plate = k.lathe(copper, [[0.5, 0.36], [0.53, 0.4], [0.5, 0.47], [0.44, 0.53], [0.37, 0.58]], 36);
    plate.scale.z = 0.92;
    torso.add(plate);
    k.both((s) => torso.add(k.at(k.ball(brass, 0.032), s * 0.255, 0.45, 0.405)));
    const hose = k.at(k.torus(rubber, 0.43, 0.055, Math.PI), 0, 0.62, -0.38);
    hose.rotation.order = 'YXZ';
    hose.rotation.set(0, Math.PI / 2, -Math.PI / 2);
    torso.add(hose);
    const belt = k.at(k.torus(leather, 0.43, 0.045), 0, 0.12, 0, Math.PI / 2, 0, 0);
    belt.scale.y = 0.9;
    torso.add(belt, k.at(k.box(brass, 0.1, 0.08, 0.03, 0.012), 0, 0.12, 0.425));

    // ── heavy brass boots, gloves ──
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      const leg = rig[`leg${side}`];
      leg.add(
        k.at(k.ball(leather, 0.2, 0.04, 0.28), 0, -0.425, 0.086),
        k.at(k.cyl(brass, 0.165, 0.175, 0.1, 20), 0, -0.22, 0.01),
        k.at(k.torus(leather, 0.168, 0.026), 0, -0.17, 0.01, Math.PI / 2, 0, 0)
      );
      rig[`arm${side}`].add(k.at(k.torus(rubber, 0.13, 0.035), 0, -0.34, 0, Math.PI / 2, 0, 0));
    });

    // ── bubbles rise from the valve, straight up in the water (root space) ──
    const emit = new THREE.Vector3();
    const bub = [];
    for (let i = 0; i < 5; i++) {
      const m = k.ball(bubbleMat, 1, 1, 1, 14);
      m.castShadow = false;
      m.receiveShadow = false;
      m.scale.setScalar(0.0001);
      rig.root.add(m);
      bub.push({ m, from: new THREE.Vector3(), last: -1 });
    }
    let primed = false;
    rig.tickers.push((t) => {
      valveTip.getWorldPosition(emit);
      rig.root.worldToLocal(emit);
      bub.forEach((b, i) => {
        const a = (t / 2.6 + i / bub.length) % 1;
        if (!primed || a < b.last) b.from.copy(emit);
        b.last = a;
        const wob = Math.sin(a * 11 + i * 2) * 0.03 * a;
        b.m.position.set(b.from.x + wob - a * 0.05, b.from.y + 0.03 + a * 1.0, b.from.z + Math.cos(a * 9 + i) * 0.02);
        const sz = (0.026 + a * 0.04) * (1 - smooth(0.85, 1, a)) * smooth(0, 0.08, a);
        b.m.scale.setScalar(Math.max(0.0001, sz));
      });
      primed = true;
    });

    rig.metrics.height = rig.metrics.hipY + head.position.y + H.y + R;
    return rig;
  },

  constrain(P, rig, animator) {
    // a heavy helmet: gentler nods, and arms never reach up into it
    P.headX *= 0.6;
    P.headZ *= 0.7;
    if (P.armLZ > 1.55) P.armLZ = 1.55;
    if (P.armRZ < -1.55) P.armRZ = -1.55;
    // the big helmet needs a little more room when he topples over
    const clip = animator?.clip;
    if (clip?.name === 'ko') P.y += 0.12 * smooth(0.3, 0.62, clip.t / clip.dur);
  },

  idle(P, t, rig, animator) {
    // slow, heavy underwater sway
    const s = Math.sin(t * 0.75);
    P.roll += s * 0.045;
    P.x += s * 0.035;
    P.torsoZ += -s * 0.03;
    P.headZ += -s * 0.03;
    P.hipsY += Math.sin(t * 1.5) * 0.008;
    // arms drift out a little, buoyed by the water
    P.armLZ += 0.22 + Math.sin(t * 0.9) * 0.06;
    P.armRZ -= 0.22 + Math.sin(t * 0.9 + 0.7) * 0.06;
    P.armLX += -0.1 + Math.sin(t * 0.8) * 0.05;
    P.armRX += -0.1 + Math.sin(t * 0.8 + 1) * 0.05;
    // every few seconds a slow, friendly wave
    const w = waveAmt(t);
    P.armLZ += w * 1.05 + w * Math.sin(t * 3.2) * 0.2;
    P.armLX += w * 0.2;
    P.headZ += w * 0.08;
    P.headY += w * 0.15;
    P.torsoZ += -w * 0.04;
    if (w > 0.3 && !animator?.clip && rig.face) {
      const cycle = Math.floor(t / WAVE_T);
      if (waveState.get(rig) !== cycle) {
        waveState.set(rig, cycle);
        rig.face.set('happy', 2.6);
      }
    }
  },
};
