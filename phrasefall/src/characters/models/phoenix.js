/** Cinder the phoenix — a hundred days of flame, and the rarest glow on the island. */
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

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

// idle loop: a slow, regal breath … wings unfurl, flames flare and she rises on a few great beats … settle, preen
const PERIOD = 8;
const SPREAD = [2.2, 4.6];
const spreadAt = (c) => win(c, SPREAD[0], SPREAD[1], 0.55);
const PREEN = [5.6, 7.0];

/** Teardrop flame profile, unit height. */
const FLAME = [[0, 0], [0.42, 0.08], [0.6, 0.24], [0.52, 0.46], [0.3, 0.7], [0.1, 0.9], [0, 1]];
/** Long tapering feather profile, unit height. */
const PLUME = [[0, 0], [0.5, 0.1], [0.62, 0.35], [0.5, 0.65], [0.28, 0.88], [0, 1]];

/** A thin shell hugging an ellipsoid: a spherical cap of half-angle `deg` centred on (yaw, pitch). */
function patch(k, mat, yaw, pitch, deg, radii, center, inflate) {
  const g = k.group();
  g.position.copy(center);
  g.scale.set(radii[0] * inflate, radii[1] * inflate, radii[2] * inflate);
  const cap = k.dome(mat, 1, 1, 1, deg / 180, 32);
  cap.castShadow = false;
  const p = k.surface(radii, yaw, pitch).pos;
  cap.quaternion.setFromUnitVectors(UP, _d.set(p.x / radii[0], p.y / radii[1], p.z / radii[2]).normalize());
  g.add(cap);
  return g;
}

export default {
  id: 'phoenix',
  name: 'Cinder',
  title: 'The Phoenix',
  blurb: 'A hundred days on fire — and only just warming up.',
  accent: 0xff6a1f,
  shot: 'bolt',

  build(k) {
    const crimson = k.mat(0xe0304f, { rough: 0.5, emissive: 0xff2a20, emissiveIntensity: 0.1 });
    const deep = k.mat(0xa81c46, { rough: 0.55 });
    const gold = k.mat(0xffc23a, { rough: 0.38, emissive: 0xff9a20, emissiveIntensity: 0.08 });
    const amber = k.mat(0xff9a2a, { rough: 0.45, emissive: 0xff6a10, emissiveIntensity: 0.12 });
    const talon = k.mat(0xffd35a, { metal: 0.5, rough: 0.3 });
    const iris = k.mat(0xffb62e, { rough: 0.25, rim: 0.2 });
    const fire = k.glow(0xff7417, 1.7);
    const core = k.glow(0xffd84a, 1.9);

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
      armRest: 0.3,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;
    const flames = [];
    /** A two-tone flame (fire outside, hot core inside) on a group whose +Y is "up the flame". */
    const flame = (r, h, flat = 0.75) => {
      const g = k.group();
      const outer = k.lathe(fire, FLAME, 20);
      outer.scale.set(r, h, r * flat);
      outer.castShadow = false;
      const inner = k.at(k.lathe(core, FLAME, 16), 0, h * 0.02, r * 0.18);
      inner.scale.set(r * 0.55, h * 0.62, r * 0.5 * flat);
      inner.castShadow = false;
      g.add(outer, inner);
      flames.push({ g, phase: flames.length * 1.7, base: 1 });
      return g;
    };

    // ── golden talons ────────────────────────────────────────────────────
    const legY = rig.metrics.hipY + 0.05;
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      rig.m[`foot${side}`].visible = false;
      const leg = rig[`leg${side}`];
      leg.add(k.at(k.ball(crimson, 0.115, 0.1, 0.115), 0, -0.02, 0));
      [-1, 0, 1].forEach((i) => leg.add(k.at(k.ball(talon, 0.042, 0.036, 0.09), i * 0.06, 0.036 - legY, 0.07 + (1 - Math.abs(i)) * 0.025, 0, i * 0.42, 0)));
      leg.add(k.at(k.ball(talon, 0.035, 0.03, 0.06), 0, 0.03 - legY, -0.06));
    });

    // ── golden breast with rows of scalloped feathers ────────────────────
    const bellyC = new THREE.Vector3(0, 0.2, 0.25);
    const bellyR = [0.28, 0.31, 0.16];
    torso.add(k.at(k.ball(gold, ...bellyR), bellyC.x, bellyC.y, bellyC.z));
    const arc = Math.PI * 0.8;
    [[-20, 22], [20, 22], [0, -8], [-34, -10], [34, -10], [-16, -36], [16, -36]].forEach(([yaw, pitch]) => {
      const bar = k.torus(amber, 0.045, 0.012, arc);
      k.onSphere(bar, yaw, pitch, 0, bellyR, bellyC);
      // level the arc so it reads as a feather edge
      const x = new THREE.Vector3(1, 0, 0).applyQuaternion(bar.quaternion);
      const y = new THREE.Vector3(0, 1, 0).applyQuaternion(bar.quaternion);
      bar.rotateZ(Math.atan2(-x.y, y.y) + Math.PI + (Math.PI - arc) / 2);
      torso.add(bar);
    });

    // ── face: a golden mask round the eyes, amber irises, a small hooked beak ──
    k.both((s) => head.add(patch(k, gold, s * 25, 6, 27, H, c, s > 0 ? 1.014 : 1.0155)));
    const FR = H.map((r) => r * 1.018);
    const E = { yaw: 25, pitch: 6, size: 0.086, tall: 1.18, lift: 0.01 };
    k.face({
      radii: FR,
      eye: E,
      brow: { color: 0xa81c46, pitch: 27, yaw: 25, width: 0.07, thick: 0.016 },
      mouth: false,
      cheeks: { yaw: 40, pitch: -12, color: 0xff7a8a, size: 0.06, opacity: 0.5 },
    });
    for (const eye of rig.face.eyes) {
      const ring = k.mesh(k.G.sphere(24), iris, false);
      ring.scale.set(E.size * 1.42, E.size * E.tall * 1.38, E.size * 0.3);
      eye.shapes.open.add(ring);
    }
    const beak = k.onSphere(k.group(), 0, -9, 0, FR, c);
    const hook = k.at(k.cone(gold, 0.062, 0.15, 18), 0, -0.03, 0.04, Math.PI - 0.35, 0, 0);
    hook.scale.z = 0.8;
    beak.add(k.at(k.ball(gold, 0.066, 0.052, 0.05), 0, 0.02, 0.012), hook);
    const jaw = k.at(k.group(), 0, -0.025, 0.0);
    jaw.add(k.at(k.ball(amber, 0.045, 0.026, 0.05), 0, -0.02, 0.03));
    beak.add(jaw);
    head.add(beak);

    // ── crest: a crown of flame-tipped plumes ────────────────────────────
    [[0, 66, 0.15, 0.36, 0], [-24, 60, 0.12, 0.3, -0.35], [24, 60, 0.12, 0.3, 0.35], [-46, 48, 0.1, 0.22, -0.6], [46, 48, 0.1, 0.22, 0.6]].forEach(([yaw, pitch, r, h, roll], i) => {
      const base = k.onSphere(k.group(), yaw, pitch, -0.03);
      const up = k.group();
      base.add(up);
      // stand the plume up (local +Y out of the head), lean it back and out a little
      up.quaternion.copy(base.quaternion).invert();
      up.rotateX(-0.42 + (i === 0 ? -0.05 : 0.1));
      up.rotateZ(-roll);
      const plume = k.lathe(i % 3 === 0 ? crimson : deep, PLUME, 18);
      plume.scale.set(r * 0.62, h * 0.55, r * 0.45);
      up.add(plume, k.at(flame(r * 0.85, h * 0.85), 0, h * 0.38, 0));
      head.add(base);
      rig.spring(up, { axis: 'z', gain: 0.1, yawGain: 0.04, sway: 0.05, speed: 2.2, phase: i, k: 55, d: 5 });
    });

    // ── wings: a crimson paddle with golden coverts and flame-tipped primaries ──
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      const arm = rig[`arm${side}`];
      const main = k.at(k.ball(crimson, 0.09, 0.27, 0.17), s * 0.012, -0.18, 0);
      arm.add(main, k.at(k.ball(gold, 0.07, 0.12, 0.13), s * 0.04, -0.06, 0.01));
      rig.m[`arm${side}`] = main;
      [[0.075, -0.45], [0, 0], [-0.075, 0.45]].forEach(([z, rx], j) => {
        const f = k.at(k.group(), s * 0.012, -0.36 + Math.abs(z) * 0.4, z, rx, 0, -s * 0.08);
        f.add(k.at(k.ball(deep, 0.048, 0.12, 0.052), 0, -0.04, 0));
        const tip = flame(0.075, 0.2 - Math.abs(z) * 0.5, 0.6);
        tip.rotation.x = Math.PI;
        tip.position.y = -0.1;
        f.add(tip);
        arm.add(f);
      });
    });

    // ── tail: three long plumes sweeping back and up, each ending in a flame ──
    const tail = rig.joint('tail', k.at(k.group(), 0, 0.1, -0.29, -0.55, 0, 0));
    torso.add(tail);
    tail.add(k.at(k.ball(deep, 0.14, 0.12, 0.1), 0, 0.02, 0));
    [[-0.5, 0.62, 0.95], [0, 0.78, 0.5], [0.5, 0.62, 0.95]].forEach(([rz, len, bend], i) => {
      const a = k.at(k.group(), 0, 0, 0, -0.75, 0, rz);
      const pl = k.lathe(i === 1 ? crimson : deep, PLUME, 18);
      pl.scale.set(0.085, len * 0.62, 0.05);
      a.add(pl);
      const b = k.at(k.group(), 0, len * 0.55, 0, bend, 0, rz * 0.4);
      const pl2 = k.lathe(amber, PLUME, 16);
      pl2.scale.set(0.07, len * 0.4, 0.045);
      b.add(pl2, k.at(flame(0.11, 0.3, 0.65), 0, len * 0.32, 0));
      a.add(b);
      tail.add(a);
      rig.spring(a, { axis: 'z', gain: 0.03, yawGain: 0.05, sway: 0.04, speed: 1.6, phase: i, k: 50, d: 5 });
      rig.spring(b, { axis: 'x', gain: 0.12, sway: 0.08, speed: 1.6, phase: i - 0.8, k: 40, d: 4 });
    });

    // ── a warm glow behind her, and embers drifting up ───────────────────
    const glow = k.at(k.halo(0xff7a2a, 2.3, 0.32), 0, 0.6, -0.35);
    torso.add(glow);
    const embers = [];
    for (let i = 0; i < 6; i++) {
      const m = k.ball(i % 2 ? fire : core, 0.022, 0.022, 0.022, 10);
      m.castShadow = false;
      rig.pivot.add(m);
      embers.push({ m, a: i * 2.4 + 0.5, r: 0.55 + (i % 3) * 0.12, sp: 0.32 + (i % 3) * 0.07, ph: i / 6 });
    }

    rig.props.flutter = 0;
    rig.tickers.push((t, dt, r, anim) => {
      const cc = t % PERIOD;
      const w = calm(anim);
      const flare = spreadAt(cc) * w;
      const clip = anim?.clip?.name;
      const boost = clip === 'cheer' || clip === 'power' || clip === 'select' ? 1 : clip === 'ko' ? -0.6 : 0;

      // flickering flames that flare up when she spreads her wings
      for (const f of flames) {
        const n = Math.sin(t * 11 + f.phase) * 0.5 + Math.sin(t * 17.3 + f.phase * 2.1) * 0.3;
        const sc = Math.max(0.2, 1 + 0.07 * n + 0.28 * flare + 0.2 * boost);
        f.g.scale.set(1 - 0.03 * n, sc, 1);
      }
      fire.emissiveIntensity = 1.6 + 0.25 * Math.sin(t * 9) + 0.5 * flare;
      core.emissiveIntensity = 1.8 + 0.2 * Math.sin(t * 13) + 0.4 * flare;
      glow.material.opacity = Math.max(0.05, 0.28 + 0.06 * Math.sin(t * 2.2) + 0.3 * flare + 0.15 * boost);
      glow.scale.setScalar(2.3 + 0.6 * flare);

      // embers spiral up and fade
      for (const e of embers) {
        const u = (t * e.sp + e.ph) % 1;
        const a = e.a + t * 0.6;
        e.m.position.set(Math.cos(a) * e.r * (1 - 0.3 * u), 0.3 + u * 2.0, Math.sin(a) * e.r * 0.6 - 0.1);
        e.m.scale.setScalar(Math.max(0.001, 0.022 * (1 - u) * (1 + 0.5 * flare)));
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

    // regal posture: chest up, a slow breath, wings folded close
    const br = Math.sin(t * 1.4);
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
