/** Inspector Finch — a trench-coated sleuth who examines every clue twice. */
import * as THREE from 'three';

const _q = new THREE.Quaternion();
const _hold = new THREE.Quaternion();
const _e = new THREE.Euler();
const _along = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI));

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Soft 0 → 1 → 0 window over [a, b] with edges of width e. */
const win = (c, a, b, e = 0.5) => smooth(a, a + e, c) * (1 - smooth(b - e, b, c));
const lerp = (a, b, t) => a + (b - a) * t;

/** Length of the idle routine: inspect → peer about → stroke chin. */
const PERIOD = 10.5;

export default {
  id: 'detective',
  name: 'Inspector Finch',
  title: 'The Detective',
  blurb: 'Reads between the lines for a living.',
  accent: 0xd9a441,
  shot: 'orb',

  build(k) {
    const coat = k.mat(0xd6a45e, { rough: 0.72 });
    const coatDark = k.mat(0xb07d3e, { rough: 0.72 });
    const felt = k.mat(0x4b3430, { rough: 0.82 });
    const band = k.mat(0xb8323f, { rough: 0.6 });
    const cream = k.mat(0xfff1dc, { rough: 0.7 });
    const skin = k.mat(0xc98d62);
    const hair = k.mat(0x33242a, { rough: 0.8 });
    const trouser = k.mat(0x3a3f5c);
    const leather = k.mat(0x4a2e26, { rough: 0.4 });
    const brass = k.mat(0xe6ae3c, { metal: 0.6, rough: 0.3 });
    const lens = k.glass(0xd2ecff, 0.26);

    const rig = k.biped({ skin, top: coat, bottom: trouser, shoe: leather, hand: skin, sleeve: coat });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── trench coat: skirt, belt, buttons ────────────────────────────────
    const skirt = k.lathe(coat, [[0.47, -0.21], [0.488, -0.18], [0.458, -0.04], [0.425, 0.08], [0.41, 0.17]], 32);
    skirt.scale.z = 0.9;
    const lining = k.at(k.cyl(coatDark, 0.455, 0.455, 0.02, 28), 0, -0.165, 0);
    lining.scale.z = 0.9;
    const belt = k.at(k.torus(coatDark, 0.418, 0.04), 0, 0.165, 0, Math.PI / 2, 0, 0);
    belt.scale.y = 0.885;
    torso.add(skirt, lining, belt);
    torso.add(k.at(k.box(brass, 0.115, 0.1, 0.04, 0.02), 0, 0.165, 0.395));
    torso.add(k.at(k.box(coatDark, 0.06, 0.05, 0.05, 0.012), 0, 0.165, 0.398));
    torso.add(k.at(k.box(coatDark, 0.075, 0.17, 0.03, 0.015), 0.105, 0.1, 0.392, -0.2, 0.2, 0.42)); // loose belt end
    torso.add(k.at(k.box(coatDark, 0.02, 0.3, 0.02, 0.01), -0.07, -0.045, 0.412, -0.19, 0, 0)); // front overlap
    torso.add(k.at(k.box(coatDark, 0.02, 0.24, 0.02, 0.01), 0, -0.075, -0.418, 0.19, 0, 0)); // back vent
    k.both((s) => {
      torso.add(k.onTorso(k.ball(leather, 0.032, 0.032, 0.016), s * 19, 0.27, 0.004));
      torso.add(k.at(k.ball(leather, 0.032, 0.032, 0.016), s * 0.13, 0.03, 0.374, -0.19, s * 0.3, 0));
      // cuffs
      rig[s > 0 ? 'armL' : 'armR'].add(k.at(k.cyl(coatDark, 0.118, 0.124, 0.075, 16), 0, -0.295, 0));
    });

    // ── shirt, striped tie, lapels, turned-up collar ─────────────────────
    torso.add(k.at(k.ball(cream, 0.14, 0.15, 0.055), 0, 0.45, 0.25));
    const tie = k.at(k.group(), 0, 0.415, 0.316, -0.36, 0, 0);
    tie.add(k.at(k.box(band, 0.105, 0.08, 0.05, 0.025), 0, 0.105, 0), k.at(k.box(band, 0.11, 0.21, 0.03, 0.02), 0, -0.035, 0));
    [0.03, -0.055].forEach((y) => tie.add(k.at(k.box(cream, 0.125, 0.026, 0.034, 0.008), 0, y, 0, 0, 0, 0.5)));
    torso.add(tie);
    k.both((s) => {
      const lapel = k.at(k.group(), s * 0.125, 0.4, 0.292, -0.42, s * 0.3, 0);
      const flap = k.cone(coatDark, 0.105, 0.33, 20);
      flap.scale.z = 0.24;
      flap.rotation.z = s * 2.6;
      lapel.add(flap);
      torso.add(lapel);
    });
    const gap = (100 * Math.PI) / 180;
    const collar = k.at(k.group(), 0, 0.585, -0.01);
    const ring = k.torus(coatDark, 0.41, 0.042, Math.PI * 2 - gap);
    ring.rotation.set(Math.PI / 2, 0, Math.PI / 2 + gap / 2);
    ring.scale.z = 2.6;
    collar.add(ring);
    k.both((s) => {
      // collar points
      const tip = k.at(k.ball(coatDark, 0.05, 0.125, 0.075), s * 0.41 * Math.sin(gap / 2), 0.012, 0.41 * Math.cos(gap / 2), 0, s * 0.85, -s * 0.2);
      collar.add(tip);
    });
    collar.scale.z = 0.9;
    torso.add(collar);

    // ── head: hair, nose, moustache ──────────────────────────────────────
    head.add(k.at(k.dome(hair, 0.585, 0.535, 0.545, 0.5), 0, c.y, -0.012, -1.3, 0, 0));
    head.add(k.at(k.ball(k.mat(0xbd7c56), 0.07, 0.062, 0.06), 0, c.y - 0.05, 0.535));
    k.both((s) => {
      head.add(k.at(k.ball(hair, 0.125, 0.052, 0.062), s * 0.105, c.y - 0.142, 0.498, 0, s * 0.3, -s * 0.3));
    });

    k.face({
      eye: { yaw: 22, pitch: 3, size: 0.08 },
      brow: { color: 0x33242a, thick: 0.02, width: 0.085 },
      mouth: { pitch: -31, width: 0.062, lift: 0.004 },
      cheeks: { yaw: 39, pitch: -9, color: 0xe2715d, opacity: 0.4 },
    });

    // ── fedora, tilted over the brow ─────────────────────────────────────
    const hat = k.at(k.group(), 0, c.y + 0.315, 0.012, 0.15, 0, -0.07);
    const brim = k.lathe(felt, [[0.36, 0.045], [0.6, 0.016], [0.72, 0.014], [0.768, 0.046], [0.73, 0.074], [0.6, 0.062], [0.36, 0.09]], 40);
    brim.scale.z = 0.93;
    const crownG = k.group();
    crownG.scale.z = 0.95;
    crownG.add(
      k.lathe(felt, [[0.45, 0.04], [0.456, 0.14], [0.43, 0.3], [0.38, 0.385], [0.2, 0.41], [0, 0.4]], 36),
      k.at(k.cyl(band, 0.458, 0.464, 0.105, 32), 0, 0.125, 0)
    );
    k.both((s) => crownG.add(k.at(k.ball(felt, 0.195, 0.085, 0.35), s * 0.15, 0.372, 0)));
    hat.add(brim, crownG);
    head.add(hat);
    rig.spring(hat, { axis: 'x', gain: 0.05, k: 120, d: 10 });

    // ── magnifying glass ─────────────────────────────────────────────────
    const glass = k.group();
    const lensC = k.at(k.group(), 0, 0.44, 0);
    const pane = k.ball(lens, 0.185, 0.185, 0.028);
    pane.castShadow = false;
    pane.receiveShadow = false;
    pane.renderOrder = 2;
    const glint = k.stroke(k.mat(0xffffff, { transparent: true, opacity: 0.6, rim: 0, depthWrite: false }), -0.09, 0.02, -0.02, 0.1, 0.014);
    glint.position.z = 0.03;
    glint.renderOrder = 3;
    lensC.add(k.torus(brass, 0.2, 0.032), pane, glint);
    glass.add(k.at(k.cyl(leather, 0.034, 0.038, 0.3, 12), 0, 0.05, 0), k.at(k.cyl(brass, 0.042, 0.042, 0.06, 12), 0, 0.21, 0), lensC);
    rig.handR.add(glass);
    rig.props.glass = glass;
    rig.props.muzzle = lensC;
    rig.props.inspect = 0;

    rig.tickers.push((t, dt, r, anim) => {
      // The glass stays upright in the hand; it leans out as the arm lifts (so it clears
      // the hat), tips forward while inspecting and points along the arm during a throw.
      const lift = -r.armR.rotation.z;
      _e.set(0.75 * r.props.inspect, 0, 0.28 - 0.14 * r.props.inspect + 0.85 * smooth(1.9, 2.7, lift));
      _hold.setFromEuler(_e);
      _q.copy(r.armR.quaternion).invert().multiply(_hold);
      const clip = anim?.clip;
      if (clip && clip.name === 'attack') _q.slerp(_along, Math.min(clamp01(clip.t / 0.07), clamp01((clip.dur - clip.t) / 0.14)));
      glass.quaternion.copy(_q);

      // narrow the eyes while peering about
      const cyc = t % PERIOD;
      const f = r.face;
      if (f && !clip && cyc > 4.5 && cyc < 7.0 && f.current === 'neutral' && f.holdT <= 0 && (anim?.worry ?? 0) < 0.3) f.set('focus', 7.2 - cyc);
    });

    return rig;
  },

  idle(P, t, rig) {
    const c = t % PERIOD;
    const wA = win(c, 0.4, 4.0, 0.7); // leaning in to inspect a clue
    const wB = win(c, 4.3, 7.4, 0.4); // peering left and right
    const wC = win(c, 7.7, 10.3, 0.5); // stroking the chin
    rig.props.inspect = wA;

    // right arm: glass held up beside the face ↔ lowered over the clue
    P.armRZ += lerp(-1.2, -0.07 + Math.cos(t * 2.1) * 0.06, wA) + 0.14 * wB;
    P.armRY += lerp(0.5, 0, wA);
    P.armRX += (-0.96 + Math.sin(t * 2.1) * 0.07) * wA;
    P.torsoX += 0.14 * wA;
    P.torsoY += -0.16 * wA;
    P.headX += 0.07 * wA + 0.04 * wB - 0.06 * wC;
    P.headY += (-0.3 + Math.sin(t * 2.1) * 0.04) * wA + 0.12 * wC;
    P.headZ += -0.09 * wA + 0.09 * wC;
    P.hipsY += -0.02 * wA - 0.014 * wB;

    // suspicious glances: left, right, back to centre
    const look = smooth(4.5, 4.9, c) - 2 * smooth(5.7, 6.1, c) + smooth(6.9, 7.3, c);
    P.headY += look * 0.55;
    P.torsoY += look * 0.14;

    // left hand to the chin
    P.armLX += (-2.08 + Math.sin(t * 5.2) * 0.07) * wC;
    P.armLZ += -0.6 * wC;
  },
};
