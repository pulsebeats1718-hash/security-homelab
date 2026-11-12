/** Sir Clank — a very shiny, very proud little knight. */
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

/** Seconds between sword salutes. */
const PERIOD = 8;
const SALUTE = 4.0;
const DOWN = 6.1;
/** A struck-armour rattle: a fast, quickly dying wobble starting at c0. */
const clank = (c, c0) => {
  const d = c - c0;
  return d > 0 && d < 0.5 ? Math.exp(-d * 9) * Math.sin(d * 68) : 0;
};

export default {
  id: 'knight',
  name: 'Sir Clank',
  title: 'The Knight',
  blurb: 'A knight in shining armour. He polishes it twice a day.',
  accent: 0xe2504c,
  shot: 'star',

  build(k) {
    const steel = k.metal(0xc8d4ec, 0.26);
    const mail = k.mat(0x7c88a6, { metal: 0.6, rough: 0.42 });
    const gold = k.mat(0xffce4a, { metal: 0.55, rough: 0.32 });
    const red = k.mat(0xdc3b3f, { rough: 0.6 });
    const skin = k.mat(0xf3c7a0);
    const hair = k.mat(0xb9582a, { rough: 0.8 });
    const leather = k.mat(0x5a3a2a, { rough: 0.6 });
    const dark = k.mat(0x39405a, { rough: 0.5 });

    const rig = k.biped({ skin, top: steel, bottom: mail, shoe: steel, hand: steel, sleeve: mail, legR: 0.14, armR: 0.11, handR: 0.135, foot: [0.175, 0.115, 0.25] });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── helmet: open-faced dome with a gold rim, cheek guards, raised visor ──
    const HR = [0.605, 0.56, 0.57];
    const CUT = 0.622;
    const A = Math.PI * CUT;
    const helm = k.at(k.group(), 0, c.y + 0.005, -0.005);
    helm.scale.set(...HR);
    const shell = k.at(k.group(), 0, 0, 0, -0.96, 0, 0);
    shell.add(k.dome(steel, 1, 1, 1, CUT, 40), k.at(k.torus(gold, Math.sin(A), 0.055), 0, Math.cos(A), 0, Math.PI / 2, 0, 0));
    helm.add(shell);
    head.add(helm);
    // chunky cheek guards
    k.both((s) => head.add(k.at(k.ball(steel, 0.12, 0.19, 0.19), s * 0.505, c.y - 0.205, 0.11, 0.15, 0, 0)));
    // visor, flipped up onto the brow of the helmet
    const visor = k.at(k.group(), 0, c.y + 0.445, 0.372, 0.72, 0, 0);
    visor.add(k.ball(steel, 0.41, 0.075, 0.25));
    [-0.14, 0, 0.14].forEach((x) => visor.add(k.at(k.box(dark, 0.042, 0.03, 0.15, 0.014), x, 0.066 - Math.abs(x) * 0.05, 0.02)));
    head.add(visor);
    k.both((s) => head.add(k.at(k.ball(gold, 0.052), s * 0.405, c.y + 0.43, 0.3)));

    // a tuft of ginger hair under the rim
    k.both((s) => head.add(k.onSphere(k.ball(hair, 0.12, 0.06, 0.05), s * 9, 28.5, 0.012).rotateZ(s * 0.25)));

    k.face({
      eye: { yaw: 22, pitch: 2, size: 0.082 },
      brow: { color: 0xa0491f, thick: 0.019 },
      mouth: { pitch: -19, width: 0.09 },
      cheeks: { yaw: 36, pitch: -12 },
    });

    // ── big red plume ────────────────────────────────────────────────────
    const plume = k.at(k.group(), 0, c.y + 0.51, -0.2, -0.08, 0, 0);
    const p2 = k.at(k.group(), 0, 0.3, 0, -0.5, 0, 0);
    const p3 = k.at(k.group(), 0, 0.26, 0, -0.65, 0, 0);
    plume.add(k.at(k.cyl(gold, 0.06, 0.08, 0.12, 14), 0, 0.03, 0), k.at(k.ball(red, 0.125, 0.23, 0.16), 0, 0.22, 0), p2);
    p2.add(k.at(k.ball(red, 0.145, 0.23, 0.2), 0, 0.13, 0), p3);
    p3.add(k.at(k.ball(red, 0.125, 0.21, 0.17), 0, 0.12, 0), k.at(k.ball(red, 0.09, 0.14, 0.11), 0, 0.28, -0.04, -0.5, 0, 0));
    head.add(plume);
    rig.spring(plume, { axis: 'x', gain: 0.08, sway: 0.03, speed: 1.9, k: 70, d: 6 });
    rig.spring(p2, { axis: 'x', gain: 0.16, sway: 0.06, speed: 1.9, phase: -0.8, k: 48, d: 4.5 });
    rig.spring(p3, { axis: 'x', gain: 0.22, sway: 0.09, speed: 1.9, phase: -1.6, k: 40, d: 4 });
    rig.spring(p2, { axis: 'z', gain: 0, yawGain: 0.05, sway: 0.05, speed: 1.4, k: 48, d: 4.5 });

    // ── armour: belt, tassets, sunburst, pauldrons, gauntlets, greaves ───
    const tassets = k.lathe(steel, [[0.445, -0.06], [0.455, -0.03], [0.432, 0.05], [0.41, 0.12]], 32);
    tassets.scale.z = 0.88;
    const belt = k.at(k.torus(gold, 0.408, 0.036), 0, 0.125, 0, Math.PI / 2, 0, 0);
    belt.scale.y = 0.87;
    torso.add(tassets, belt, k.at(k.star(gold, 0.085, 0.05, 8, 0.02), 0, 0.36, 0.335, -0.14, 0, 0));
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      const pauldron = k.at(k.group(), s * 0.05, -0.02, 0);
      pauldron.add(k.ball(steel, 0.175, 0.13, 0.185), k.at(k.torus(gold, 0.165, 0.024), 0, -0.05, 0, Math.PI / 2, 0, 0));
      rig[`arm${side}`].add(pauldron, k.at(k.cyl(steel, 0.135, 0.118, 0.13, 18), 0, -0.275, 0));
      rig.spring(pauldron, { axis: 'z', gain: 0.045, k: 160, d: 7 });
      rig[`leg${side}`].add(k.at(k.cyl(steel, 0.158, 0.15, 0.17, 18), 0, -0.215, 0), k.at(k.ball(gold, 0.062, 0.062, 0.04), 0, -0.14, 0.135));
    });

    // ── short red cape ───────────────────────────────────────────────────
    const capeW = [0.5, 0.64, 0.74, 0.8];
    const SEG = 0.19;
    const capeRest = [0.44, -0.08, 0.0];
    const cape = [];
    let parent = torso;
    for (let i = 0; i < 3; i++) {
      const seg = i === 0 ? k.at(k.group(), 0, 0.565, -0.22, capeRest[0], 0, 0) : k.at(k.group(), 0, -SEG, 0, capeRest[i], 0, 0);
      const panel = k.at(k.cyl(red, capeW[i] / 2, capeW[i + 1] / 2, SEG + 0.04, 24), 0, -SEG / 2, 0);
      panel.scale.z = 0.1;
      seg.add(panel);
      parent.add(seg);
      parent = seg;
      rig.spring(seg, { axis: 'x', gain: 0.05 + i * 0.04, sway: 0.03 + i * 0.022, speed: 2.2, phase: -i * 0.85, k: 50, d: 5, max: 0.7 });
      cape.push(seg);
    }

    // ── heater shield with a sunburst, carried on the left arm ───────────
    const shieldMount = k.group();
    const shield = k.at(k.group(), 0.11, 0.1, 0.17, 0, 0.5, 0);
    const slab = (mat, sx, sy, sz, z) => {
      const g = k.at(k.group(), 0, 0, z);
      const tip = k.at(k.cone(mat, 0.2, 0.34, 28), 0, -0.17, 0, 0, 0, Math.PI);
      g.add(k.at(k.cyl(mat, 0.2, 0.2, 0.2, 28), 0, 0.1, 0), tip);
      g.scale.set(sx, sy, sz);
      return g;
    };
    shield.add(slab(red, 1, 1, 0.14, 0), slab(gold, 1.13, 1.1, 0.1, -0.022));
    shield.add(k.at(k.star(gold, 0.115, 0.066, 8, 0.02), 0, 0.03, 0.034), k.at(k.ball(steel, 0.04, 0.04, 0.025), 0, 0.03, 0.05));
    shieldMount.add(shield);
    rig.handL.add(shieldMount);
    rig.props.shield = shield;

    // ── short broad sword in the right hand ──────────────────────────────
    const sword = k.group();
    const tip = k.at(k.cone(steel, 0.062, 0.14, 16), 0, 0.61, 0);
    tip.scale.z = 0.3;
    sword.add(
      k.at(k.cyl(leather, 0.032, 0.032, 0.18, 10), 0, 0, 0),
      k.at(k.ball(gold, 0.052), 0, -0.12, 0),
      k.at(k.box(gold, 0.3, 0.06, 0.075, 0.028), 0, 0.105, 0),
      k.at(k.box(steel, 0.124, 0.42, 0.038, 0.016), 0, 0.335, 0),
      tip
    );
    rig.handR.add(sword);
    rig.props.sword = sword;

    rig.tickers.push((t, dt, r, anim) => {
      // the shield always faces front; the sword stays upright, leans out as the arm lifts
      // (to clear the helmet) and points along the arm during a throw
      shieldMount.quaternion.copy(r.armL.quaternion).invert();
      const lift = -r.armR.rotation.z;
      _e.set(0.12, 0, 0.25 + 0.95 * smooth(1.9, 2.7, lift));
      _hold.setFromEuler(_e);
      _q.copy(r.armR.quaternion).invert().multiply(_hold);
      const clip = anim?.clip;
      if (clip && clip.name === 'attack') _q.slerp(_along, Math.min(clamp01(clip.t / 0.07), clamp01((clip.dur - clip.t) / 0.14)));
      sword.quaternion.copy(_q);
      // the cape may fly out but never swings through the armour
      if (cape[0].rotation.x < 0.3) cape[0].rotation.x = 0.3;
      for (let i = 1; i < 3; i++) if (cape[i].rotation.x < capeRest[i] - 0.22) cape[i].rotation.x = capeRest[i] - 0.22;
    });

    return rig;
  },

  constrain(P, rig, animator) {
    // the shield arm lifts out to the side but never over the head; when he topples the shield comes to rest on top of him
    const clip = animator?.clip;
    const down = clip && clip.name === 'ko' ? smooth(0.3, 0.62, clip.t / clip.dur) : 0;
    const limit = 0.9 - 0.8 * down;
    if (P.armLZ > limit) P.armLZ = limit;
  },

  idle(P, t) {
    // at attention: chest up, chin up, sword held upright at the side
    P.torsoX += -0.05;
    P.headX += -0.04;
    P.armRZ += -0.2;
    P.armRX += -0.15;
    P.armLZ += 0.06;

    // every few seconds the sword snaps up in salute, and the armour clanks
    const c = t % PERIOD;
    const up = win(c, SALUTE, DOWN, 0.32);
    P.armRX += -1.68 * up; // sword swings up in front of the shoulder, blade vertical beside the face
    P.headX += -0.07 * up;
    P.torsoX += -0.03 * up;
    P.headY += -0.08 * up;
    const hop = c > SALUTE + 0.24 && c < SALUTE + 0.5 ? Math.sin(((c - SALUTE - 0.24) / 0.26) * Math.PI) : 0;
    P.y += hop * 0.035;
    const shake = clank(c, SALUTE + 0.5) + clank(c, DOWN + 0.02);
    P.x += shake * 0.014;
    P.roll += shake * 0.022;
    P.sq += -Math.abs(shake) * 0.035;
    P.headZ += shake * 0.03;
  },
};
