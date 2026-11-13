/** Cinder the phoenix — crowned with the streak flame itself, and the rarest glow on the island. */
import * as THREE from 'three';

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const u = clamp01((v - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** Soft 0 → 1 → 0 window over [a, b] with edges of width e. */
const win = (c, a, b, e = 0.3) => smooth(a, a + e, c) * (1 - smooth(b - e, b, c));
/** 1 while idling, 0 while an action clip (or a fright) has taken over. */
const calm = (animator) => {
  const c = animator?.clip;
  let w = 1;
  if (c) w = 1 - Math.min(clamp01(c.t / 0.07), c.def.hold ? 1 : clamp01((c.dur - c.t) / 0.14));
  return w * (1 - clamp01((animator?._worry ?? 0) * 2.5));
};
/** Roll something placed by onSphere so its local X axis is level again. */
function level(obj) {
  _x.set(1, 0, 0).applyQuaternion(obj.quaternion);
  _y.set(0, 1, 0).applyQuaternion(obj.quaternion);
  obj.rotateZ(Math.atan2(-_x.y, _y.y));
  return obj;
}

// idle loop: a slow, regal breath … wings unfurl, flames flare and she rises on a few great beats … settle, preen
const PERIOD = 8;
const SPREAD = [2.2, 4.6];
const spreadAt = (c) => win(c, SPREAD[0], SPREAD[1], 0.55);
const PREEN = [5.6, 7.0];

/** Teardrop flame profile, unit height. */
const FLAME = [[0, 0], [0.42, 0.08], [0.6, 0.24], [0.52, 0.46], [0.3, 0.7], [0.1, 0.9], [0, 1]];
/** Long tapering feather profile, unit height. */
const PLUME = [[0, 0], [0.5, 0.1], [0.62, 0.35], [0.5, 0.65], [0.28, 0.88], [0, 1]];

export default {
  id: 'phoenix',
  name: 'Cinder',
  title: 'The Phoenix',
  blurb: 'A hundred days on fire — and only just warming up.',
  accent: 0xff6a1f,
  shot: 'bolt',

  build(k) {
    const crimson = k.mat(0xd82a4c, { rough: 0.5, emissive: 0xff2a20, emissiveIntensity: 0.08 });
    const deep = k.mat(0x9e1a45, { rough: 0.55 });
    const gold = k.mat(0xffc23a, { rough: 0.38, emissive: 0xff9a20, emissiveIntensity: 0.1 });
    const amber = k.mat(0xff8a24, { rough: 0.45, emissive: 0xff5a10, emissiveIntensity: 0.15 });
    const talon = k.mat(0xffd35a, { metal: 0.5, rough: 0.3 });
    const iris = k.mat(0xffb62e, { rough: 0.25, rim: 0.2 });
    const lash = k.mat(0x5a0f2c, { rough: 0.5, rim: 0.1 });
    // fire: layered like the streak flame — red-orange outside, orange, then a hot yellow core
    const fireOut = k.mat(0xff4d1a, { rough: 0.4, rim: 0.6, emissive: 0xff3000, emissiveIntensity: 0.45 });
    const fireMid = k.mat(0xff9a1c, { rough: 0.4, rim: 0.4, emissive: 0xff7000, emissiveIntensity: 0.55 });
    const fireCore = k.mat(0xffe25a, { rough: 0.4, rim: 0.3, emissive: 0xffc020, emissiveIntensity: 0.7 });
    const fires = [fireOut, fireMid, fireCore];

    const TS = [1.02, 0.95, 0.92];
    const H = [0.58, 0.53, 0.545];
    const rig = k.biped({
      skin: crimson,
      top: crimson,
      bottom: talon,
      shoe: talon,
      hand: crimson,
      sleeve: crimson,
      torso: TS,
      head: H,
      legLen: 0.25,
      legR: 0.07,
      legGap: 0.165,
      foot: [0.1, 0.06, 0.12],
      noArms: true,
      armLen: 0.42,
      shoulderW: 0.33,
      shoulderY: 0.46,
      armRest: 0.36,
    });
    const { head, torso } = rig;

    const flames = [];
    /** A layered flame on a group whose +Y runs up the flame. layers: 2 or 3. */
    const flame = (r, h, flat = 0.5, layers = 3) => {
      const g = k.group();
      for (let i = 0; i < layers; i++) {
        const f = 1 - i * 0.3;
        const m = k.at(k.lathe(fires[i], FLAME, 20), 0, h * 0.03 * i, r * flat * 0.42 * i);
        m.scale.set(r * f, h * (1 - i * 0.24), r * flat * f);
        if (i) m.castShadow = false;
        g.add(m);
      }
      flames.push({ g, phase: flames.length * 1.7 });
      return g;
    };

    // ── golden talons and crimson feathered thighs ───────────────────────
    const legY = rig.metrics.hipY + 0.05;
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      rig.m[`foot${side}`].visible = false;
      const leg = rig[`leg${side}`];
      leg.add(k.at(k.ball(crimson, 0.115, 0.1, 0.115), 0, -0.02, 0));
      [-1, 0, 1].forEach((i) => leg.add(k.at(k.ball(talon, 0.042, 0.036, 0.09), i * 0.06, 0.036 - legY, 0.07 + (1 - Math.abs(i)) * 0.025, 0, i * 0.42, 0)));
      leg.add(k.at(k.ball(talon, 0.035, 0.03, 0.06), 0, 0.03 - legY, -0.06));
    });

    // ── golden breast, scalloped, flicking up into a flame point ─────────
    const bellyC = new THREE.Vector3(0, 0.2, 0.25);
    const bellyR = [0.28, 0.31, 0.16];
    torso.add(k.at(k.ball(gold, ...bellyR), bellyC.x, bellyC.y, bellyC.z));
    const point = k.at(k.lathe(gold, FLAME, 20), 0, 0.33, 0.315, -0.38, 0, 0);
    point.scale.set(0.2, 0.28, 0.1);
    torso.add(point);
    const arc = Math.PI * 0.8;
    [[-17, 12], [17, 12], [0, -14], [-32, -16], [32, -16], [-16, -40], [16, -40]].forEach(([yaw, pitch]) => {
      const bar = k.torus(amber, 0.045, 0.012, arc);
      level(k.onSphere(bar, yaw, pitch, 0, bellyR, bellyC));
      bar.rotateZ(Math.PI + (Math.PI - arc) / 2);
      torso.add(bar);
    });

    // ── a regal ruff of amber and gold feathers round her neck ──
    const RUFF = 12;
    for (let i = 0; i < RUFF; i++) {
      const a = (i / RUFF) * Math.PI * 2;
      const front = Math.cos(a);
      const g = k.at(k.group(), Math.sin(a) * 0.27, 0.56, Math.cos(a) * 0.25 + 0.01);
      // point each feather outward and down, flaring more at the front
      g.rotation.order = 'YXZ';
      g.rotation.set(Math.PI - 0.95 - 0.2 * front, a, 0);
      const fe = k.lathe(i % 2 ? gold : amber, PLUME, 14);
      fe.scale.set(0.11, 0.24 + 0.04 * front, 0.04);
      g.add(fe);
      torso.add(g);
    }

    // ── face: big amber-ringed eyes with sweeping lashes, a small hooked beak ──
    const E = { yaw: 24, pitch: 5, size: 0.09, tall: 1.22 };
    k.face({
      eye: E,
      brow: { color: 0x6a1030, width: 0.066, thick: 0.015 },
      mouth: false,
      cheeks: { yaw: 39, pitch: -9, color: 0xffa04a, size: 0.072, opacity: 0.6 },
    });
    for (const eye of rig.face.eyes) {
      const ring = k.mesh(k.G.sphere(24), iris, false);
      ring.scale.set(E.size * 1.3, E.size * E.tall * 1.27, E.size * 0.3);
      eye.shapes.open.add(ring);
      // two little lashes at the outer corner
      const s = eye.side;
      eye.shapes.open.add(
        k.stroke(lash, s * E.size * 1.05, E.size * 0.55, s * E.size * 1.55, E.size * 0.95, 0.011),
        k.stroke(lash, s * E.size * 1.2, E.size * 0.2, s * E.size * 1.72, E.size * 0.42, 0.011)
      );
    }
    const beak = k.onSphere(k.group(), 0, -10, 0);
    const hook = k.at(k.cone(gold, 0.062, 0.15, 18), 0, -0.03, 0.04, Math.PI - 0.35, 0, 0);
    hook.scale.z = 0.8;
    beak.add(k.at(k.ball(gold, 0.066, 0.052, 0.05), 0, 0.02, 0.012), hook);
    const jaw = k.at(k.group(), 0, -0.025, 0.0);
    jaw.add(k.at(k.ball(deep, 0.045, 0.026, 0.05), 0, -0.02, 0.03));
    beak.add(jaw);
    head.add(beak);

    // a little golden flame emblem on her brow, echoing the crest
    const emblem = k.onSphere(k.group(), 0, 35, -0.004);
    const em = k.lathe(gold, FLAME, 18);
    em.scale.set(0.055, 0.14, 0.02);
    em.position.y = -0.06;
    const emCore = k.at(k.lathe(fireCore, FLAME, 14), 0, -0.055, 0.012);
    emCore.scale.set(0.028, 0.08, 0.012);
    emblem.add(em, emCore);
    head.add(emblem);

    // ── crest: the streak flame itself, rising from her crown, with two smaller flames ──
    const crestRoot = k.onSphere(k.group(), 0, 70, -0.1);
    const crest = k.group();
    crestRoot.add(crest);
    crest.quaternion.copy(crestRoot.quaternion).invert();
    crest.rotateX(-0.3);
    const big = flame(0.25, 0.62, 0.48);
    crest.add(big);
    rig.spring(big, { axis: 'z', gain: 0.05, yawGain: 0.05, sway: 0.04, speed: 2.1, k: 60, d: 5 });
    rig.spring(big, { axis: 'x', gain: 0.1, sway: 0.03, speed: 1.7, k: 60, d: 5 });
    k.both((s) => {
      const side = k.at(k.group(), s * 0.17, -0.03, 0.06, 0.05, 0, -s * 0.6);
      side.add(flame(0.14, 0.36, 0.5));
      crest.add(side);
      rig.spring(side, { axis: 'z', gain: 0.08, sway: 0.05, speed: 2.6, phase: s, k: 60, d: 5 });
    });
    head.add(crestRoot);

    // ── wings: a crimson paddle with amber coverts and flame-tipped primaries ──
    // (folded, the flight feathers lie back along her sides; as an arm rises the wing turns
    //  so the feathers hang from it like a real wing, flame tips along the trailing edge)
    const wings = k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      const arm = rig[`arm${side}`];
      const wing = k.group();
      arm.add(wing);
      const main = k.at(k.ball(crimson, 0.09, 0.27, 0.13), 0, -0.19, -0.01);
      wing.add(main, k.at(k.ball(amber, 0.065, 0.22, 0.1), 0, -0.21, -0.075));
      rig.m[`arm${side}`] = main;
      const feathers = [];
      [[-0.07, 0.15, 0.05, 1.05], [-0.15, 0.19, 0.22, 1.12], [-0.23, 0.23, 0.4, 1.2], [-0.31, 0.27, 0.6, 1.28], [-0.39, 0.3, 0.85, 1.36]].forEach(([y, len, tilt, fold], j) => {
        const f = k.at(k.group(), 0, y, -0.08, -(Math.PI / 2 + tilt), 0, 0);
        feathers.push({ f, tilt, fold });
        f.add(k.at(k.ball(j % 2 ? deep : crimson, 0.026, len * 0.52, 0.078), 0, len * 0.45, 0));
        f.add(k.at(flame(0.082 + j * 0.006, 0.19 + j * 0.022, 0.4, 2), 0, len * 0.8, 0, 0, Math.PI / 2, 0));
        wing.add(f);
      });
      return { s, arm, wing, feathers, rest: arm.rotation.z };
    });

    // ── tail: a long centre plume and two side plumes sweeping out and up into flames ──
    const tail = rig.joint('tail', k.at(k.group(), 0, 0.08, -0.28));
    torso.add(tail);
    tail.add(k.at(k.ball(deep, 0.15, 0.13, 0.11), 0, 0.02, -0.02));
    // five broad feathers fanned out behind, each tipped with flame; the longest in the middle
    [[-0.9, 0.5], [-0.45, 0.6], [0, 0.68], [0.45, 0.6], [0.9, 0.5]].forEach(([fan, len], i) => {
      const a = k.at(k.group(), 0, 0, 0, -1.25, 0, fan);
      const pl = k.lathe(i % 2 ? deep : crimson, PLUME, 18);
      pl.scale.set(0.12, len * 0.78, 0.035);
      a.add(pl, k.at(flame(0.1, 0.26, 0.4, 3), 0, len * 0.66, 0));
      tail.add(a);
      rig.spring(a, { axis: 'x', gain: 0.08, sway: 0.04, speed: 1.6, phase: i * 0.6, k: 50, d: 5 });
    });

    // ── a warm glow behind her, and embers drifting up ───────────────────
    const glow = k.at(k.halo(0xff6a20, 2.6, 0.3), 0, 0.7, -0.45);
    torso.add(glow);
    const embers = [];
    for (let i = 0; i < 6; i++) {
      const m = k.ball(i % 2 ? fireMid : fireCore, 0.03, 0.03, 0.03, 10);
      m.castShadow = false;
      rig.pivot.add(m);
      embers.push({ m, a: i * 2.4 + 0.5, r: 0.55 + (i % 3) * 0.12, sp: 0.32 + (i % 3) * 0.07, ph: i / 6 });
    }

    rig.tickers.push((t, dt, r, anim) => {
      const cc = t % PERIOD;
      for (const W of wings) {
        const open = smooth(0.35, 1.15, (W.arm.rotation.z - W.rest) * W.s);
        W.wing.rotation.y = W.s * (Math.PI / 2) * open;
        // folded, the flight feathers lie down along her sides; open, they fan out
        for (const F of W.feathers) F.f.rotation.x = -(Math.PI / 2 + F.fold + (F.tilt - F.fold) * open);
      }
      const w = calm(anim);
      const flare = spreadAt(cc) * w;
      const clip = anim?.clip?.name;
      const boost = clip === 'cheer' || clip === 'power' || clip === 'select' ? 1 : clip === 'ko' ? -0.5 : 0;

      // flickering flames that flare up when she spreads her wings
      for (const f of flames) {
        const n = Math.sin(t * 11 + f.phase) * 0.5 + Math.sin(t * 17.3 + f.phase * 2.1) * 0.3;
        const sc = Math.max(0.2, 1 + 0.08 * n + 0.25 * flare + 0.2 * boost);
        f.g.scale.set(1 - 0.04 * n, sc, 1);
      }
      fireOut.emissiveIntensity = 0.45 + 0.08 * Math.sin(t * 9) + 0.2 * flare;
      fireMid.emissiveIntensity = 0.55 + 0.1 * Math.sin(t * 13) + 0.25 * flare;
      fireCore.emissiveIntensity = 0.7 + 0.12 * Math.sin(t * 15) + 0.3 * flare;
      glow.material.opacity = Math.max(0.05, 0.26 + 0.06 * Math.sin(t * 2.2) + 0.25 * flare + 0.12 * boost);
      glow.scale.setScalar(2.6 + 0.6 * flare);

      // embers spiral up and fade
      for (const e of embers) {
        const u = (t * e.sp + e.ph) % 1;
        const a = e.a + t * 0.6;
        e.m.position.set(Math.cos(a) * e.r * (1 - 0.3 * u), 0.3 + u * 2.0, Math.sin(a) * e.r * 0.6 - 0.1);
        e.m.scale.setScalar(Math.max(0.001, 0.03 * (1 - u) * (1 + 0.5 * flare)));
      }

      // a little gape of the beak with the bigger expressions
      const cur = r.face?.current ?? 'neutral';
      const want = cur === 'happy' ? 0.45 : cur === 'surprised' || cur === 'worried' || cur === 'ko' ? 0.35 : cur === 'hurt' ? 0.2 : 0;
      jaw.rotation.x += (want - jaw.rotation.x) * Math.min(1, dt * 16);
    });

    return rig;
  },

  idle(P, t) {
    const c = t % PERIOD;

    // regal posture: chest up, a slow breath, wings held half open
    const br = Math.sin(t * 1.4);
    P.armLZ += 0.12 + br * 0.03;
    P.armRZ -= 0.12 + br * 0.03;
    P.armLX += 0.12;
    P.armRX += 0.12;
    P.torsoX += -0.05 + br * 0.012;
    P.headX += -0.04 - br * 0.01;
    P.tailX += Math.sin(t * 1.2) * 0.08;
    P.tailZ += Math.sin(t * 0.9) * 0.06;

    // wings unfurl, the flames flare, and she lifts off on a few great beats
    const sp = spreadAt(c);
    const beat = Math.sin((c - SPREAD[0]) * 9);
    P.armLZ += sp * (1.15 + 0.35 * beat);
    P.armRZ -= sp * (1.15 + 0.35 * beat);
    P.armLX += sp * 0.15;
    P.armRX += sp * 0.15;
    P.y += sp * (0.14 + 0.03 * beat);
    P.headX += -0.12 * sp;
    P.legLX += 0.2 * sp;
    P.legRX += 0.2 * sp;
    P.sq += 0.04 * sp * beat;

    // a little preen: head tucks to one side, a shake of the feathers
    const pr = win(c, PREEN[0], PREEN[1], 0.35);
    P.headZ += 0.22 * pr;
    P.headY += 0.35 * pr;
    P.headX += 0.12 * pr;
    P.armLZ += 0.25 * pr;
    const shake = win(c, PREEN[1] - 0.1, PREEN[1] + 0.55, 0.1);
    P.torsoZ += Math.sin(t * 34) * 0.035 * shake;
    P.sq += Math.sin(t * 34) * 0.02 * shake;
  },

  constrain(P) {
    // raised wings stay out to the sides, so the flame tips never brush the crest
    P.armLZ = Math.min(P.armLZ, 2.15);
    P.armRZ = Math.max(P.armRZ, -2.15);
  },
};
