/** Marina the mermaid — sea-shanty soloist, idiom collector, pearl twirler. */
const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

export default {
  id: 'mermaid',
  name: 'Marina',
  title: 'The Mermaid',
  blurb: 'Knows every sea shanty and twice as many idioms about fish.',
  accent: 0x2ec4b6,
  shot: 'orb',

  build(k) {
    const { THREE } = k;
    const skin = k.mat(0x93593a);
    const hair = k.mat(0x2a1a1e, { rough: 0.78 });
    const coral = k.mat(0xff7a85, { rough: 0.55 });
    const coralDark = k.mat(0xe0566c, { rough: 0.6 });
    const teal = k.mat(0x22b3a5, { rough: 0.38 });
    const aqua = k.mat(0x8ff0dd, { rough: 0.35 });
    const peach = k.mat(0xffb898, { rough: 0.45 });
    const pearl = k.mat(0xfff3ea, { rough: 0.14, rim: 0.85 });
    const starMat = k.mat(0xffa94a, { rough: 0.5 });

    const rig = k.biped({ skin, top: coral, sleeve: skin, hand: skin, noLegs: true, legLen: 0.441, torso: [1, 1, 0.94] });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── hair: dark curls, tilted cap, side-swept fringe, long locks drifting behind ──
    head.add(k.at(k.dome(hair, 0.6, 0.555, 0.565, 0.5), 0, c.y, 0, -0.48, 0, 0));
    const curl = (r, yaw, pitch, lift, sy = 0.88) => head.add(k.onSphere(k.ball(hair, r, r * sy, r), yaw, pitch, lift));
    curl(0.2, 0, 70, 0.02);
    curl(0.19, 75, 45, 0.0);
    curl(0.19, -60, 48, 0.0);
    curl(0.13, -28, 40, -0.02);
    k.both((s) => curl(0.19, s * 82, -5, 0.0, 1));
    [[180, -18, 0, 0], [140, -24, 0.32, 1.2], [-140, -24, -0.32, 2.3]].forEach(([yaw, pitch, out, ph]) => {
      const lock = k.onSphere(k.group(), yaw, pitch, -0.04);
      const hang = k.at(k.group(), 0, 0, 0);
      lock.add(hang);
      // hang points down the back, drifting outwards as if under water
      hang.quaternion.copy(lock.quaternion).invert();
      hang.rotateX(0.3);
      hang.rotateZ(out);
      hang.add(k.at(k.ball(hair, 0.17, 0.15, 0.16), 0, -0.1, 0), k.at(k.ball(hair, 0.13, 0.13, 0.12), 0, -0.29, -0.03));
      head.add(lock);
      rig.spring(hang, { axis: 'x', gain: 0.1, sway: 0.09, speed: 1.1, phase: ph, k: 40, d: 4 });
      rig.spring(hang, { axis: 'z', gain: 0.02, sway: 0.07, speed: 0.8, phase: ph + 1, k: 40, d: 4 });
    });

    // starfish clip in the curls
    head.add(k.onSphere(k.star(starMat, 0.1, 0.045, 5, 0.032), 45, 34, 0.07));

    k.face({
      eye: { yaw: 22, pitch: 3, size: 0.088 },
      brow: { color: 0x2a1a1e, thick: 0.011 },
      mouth: { width: 0.095, color: 0x6a2232 },
      cheeks: { color: 0xff7a6a, opacity: 0.42 },
    });

    // ── coral wrap top: sash band with a bow at the left hip, pearl necklace ──
    const band = k.lathe(coralDark, [[0.408, 0.13], [0.428, 0.165], [0.425, 0.21], [0.4, 0.245]], 36);
    band.scale.z = 0.94;
    torso.add(band);
    const bow = k.onTorso(k.group(), 62, 0.19, 0.035);
    k.both((s) => bow.add(k.at(k.ball(coralDark, 0.062, 0.042, 0.026), s * 0.052, 0.008, 0, 0, 0, s * 0.45)));
    bow.add(k.ball(coralDark, 0.03, 0.03, 0.028));
    torso.add(bow);
    for (let i = -3; i <= 3; i++) {
      const yaw = i * 20;
      torso.add(k.onTorso(k.ball(pearl, i === 0 ? 0.042 : 0.033), yaw, 0.47 + 0.055 * (yaw / 60) ** 2, 0.022));
    }

    // ── tail: three jointed segments curling to her left, teal fading to coral, big fin ──
    const T0 = rig.joint('tail', k.at(k.group(), 0, 0.02, 0, 0.05, 0, 0.15));
    torso.add(T0);
    const seg0 = k.lathe(teal, [[0, -0.34], [0.2, -0.315], [0.285, -0.25], [0.32, -0.17], [0.36, -0.07], [0.395, 0.04], [0.412, 0.14], [0.39, 0.2]], 36);
    seg0.scale.z = 0.94;
    T0.add(seg0);
    const T1 = k.at(k.group(), 0, -0.22, 0, 0.08, 0, 0.5);
    T0.add(T1);
    T1.add(k.lathe(teal, [[0, -0.29], [0.15, -0.27], [0.21, -0.21], [0.235, -0.12], [0.265, -0.02], [0.29, 0.06], [0.25, 0.14], [0, 0.17]], 32));
    const T2 = k.at(k.group(), 0, -0.19, 0, 0.06, 0, 0.65);
    T1.add(T2);
    T2.add(k.lathe(teal, [[0, -0.23], [0.1, -0.215], [0.14, -0.16], [0.165, -0.08], [0.19, 0.02], [0.2, 0.08], [0.15, 0.14], [0, 0.16]], 28));

    // scales: rows of little arcs, aqua near the hips and peach further down
    const scaleArc = (parent, mat, R, r, y, yawDeg, tilt, zs = 1) => {
      const a = (yawDeg * Math.PI) / 180;
      const m = k.torus(mat, R, 0.012, Math.PI);
      m.rotation.order = 'YXZ';
      m.rotation.set(tilt, a, Math.PI);
      m.position.set(Math.sin(a) * (r + 0.004), y, Math.cos(a) * (r + 0.004) * zs);
      parent.add(m);
    };
    [-48, -16, 16, 48].forEach((yaw) => scaleArc(T0, aqua, 0.052, 0.382, 0.02, yaw, 0.35, 0.94));
    [-32, 0, 32].forEach((yaw) => scaleArc(T0, aqua, 0.052, 0.352, -0.05, yaw, 0.35, 0.94));
    [-19, 0, 19].forEach((yaw) => scaleArc(T1, peach, 0.045, 0.27, 0.0, yaw, 0.3));

    // fin: coral cuff, two big flukes with peach centres
    const fin = k.at(k.group(), 0, -0.16, 0, 0, 0, 0.75);
    T2.add(fin);
    fin.add(k.at(k.torus(coral, 0.13, 0.04), 0, 0.03, 0, Math.PI / 2, 0, 0), k.at(k.ball(coral, 0.1, 0.09, 0.07), 0, -0.05, 0));
    k.both((s) => {
      const lobe = k.at(k.group(), 0, -0.05, 0, 0, 0, s * 0.55);
      lobe.add(k.at(k.ball(coral, 0.11, 0.21, 0.035), 0, -0.19, 0), k.at(k.ball(peach, 0.065, 0.13, 0.045), 0, -0.22, 0));
      fin.add(lobe);
    });

    // a travelling wave down the tail
    rig.spring(T1, { axis: 'z', gain: 0.05, sway: 0.07, speed: 1.4, phase: -0.7, k: 50, d: 6 });
    rig.spring(T2, { axis: 'z', gain: 0.08, sway: 0.1, speed: 1.4, phase: -1.4, k: 45, d: 5 });
    rig.spring(fin, { axis: 'z', gain: 0.12, sway: 0.16, speed: 1.4, phase: -2.1, k: 40, d: 4 });
    rig.spring(fin, { axis: 'x', gain: 0.1, sway: 0.12, speed: 2.2, phase: 0.5, k: 40, d: 4 });

    // ── a pearl twirling above her right palm (kept upright, whatever the arm does) ──
    const twirl = k.group();
    rig.handR.add(twirl);
    const spin = k.ball(pearl, 0.05);
    twirl.add(spin);
    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    rig.tickers.push((t) => {
      rig.handR.getWorldQuaternion(qa).invert();
      rig.pivot.getWorldQuaternion(qb);
      twirl.quaternion.copy(qa).multiply(qb);
      const a = t * 5.2;
      spin.position.set(Math.cos(a) * 0.07, 0.17 + Math.sin(a * 2) * 0.012, Math.sin(a) * 0.07);
    });

    return rig;
  },

  constrain(P, rig, animator) {
    // she floats, even mid-clip; knocked out she sinks to the sea floor
    const clip = animator?.clip;
    const ko = clip?.name === 'ko' ? smooth(0.25, 0.62, clip.t / clip.dur) : 0;
    const t = animator?.t ?? 0;
    const float = 0.09 + Math.sin(t * 1.2) * 0.04;
    P.y += float + (0.1 - float) * ko;
  },

  idle(P, t) {
    // drifting in the current
    P.roll += Math.sin(t * 0.7) * 0.035;
    P.x += Math.sin(t * 0.5) * 0.03;
    P.torsoZ += Math.sin(t * 0.7 + 0.6) * 0.03;
    // the tail sways and swishes; springs carry the wave down to the fin
    P.tailZ += Math.sin(t * 1.4) * 0.12;
    P.tailX += Math.sin(t * 1.1 + 0.4) * 0.07;
    // right hand up at her side, twirling a pearl she can't stop admiring
    P.armRZ += -1.25 + Math.sin(t * 1.3) * 0.05;
    P.armRX += -0.3;
    P.headY += -0.22 + Math.sin(t * 0.6) * 0.05;
    P.headZ += -0.07;
    P.headX += -0.04;
    // left arm floats out for balance
    P.armLZ += 0.6 + Math.sin(t * 1.05) * 0.1;
    P.armLX += -0.12 + Math.sin(t * 0.85) * 0.08;
  },
};
