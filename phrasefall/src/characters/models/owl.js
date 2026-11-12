/** Professor Hoot the owl — a bookish don in a mortarboard and round wire spectacles. */
import * as THREE from 'three';
import { keys, ease } from '../../core/utils.js';

const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _d = new THREE.Vector3();

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const u = clamp01((v - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** Soft 0 → 1 → 0 window over [a, b] with edges of width e. */
const win = (c, a, b, e = 0.4) => smooth(a, a + e, c) * (1 - smooth(b - e, b, c));

// DEV: ?it=<seconds> freezes the idle clock for close-ups (removed before shipping)
const DEV_T = (() => {
  try {
    const v = new URLSearchParams(globalThis.location?.search ?? '').get('it');
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
})();
const clock = (t) => (DEV_T == null ? t : DEV_T);

/** Idle routine: slow blink … owl head swivels … push the spectacles up … a smug chin-up. */
const PERIOD = 10;
const swivelAt = (c) =>
  keys(c, [[2.1, 0], [2.32, -0.78], [2.95, -0.78], [3.2, 0.68], [3.8, 0.68], [4.1, 0]], ease.inOutCubic);
const blinkAt = (c) => Math.max(win(c, 0.5, 1.75, 0.5), win(c, 8.3, 9.45, 0.42));
const adjustAt = (c) => win(c, 5.1, 6.9, 0.55);

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

/** A thin rod between two points (wire, cord). */
function rod(k, mat, a, b, r) {
  _d.subVectors(b, a);
  const m = k.cap(mat, r, _d.length() + 2 * r, 8);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, _d.normalize());
  return m;
}

/** Roll something placed by onSphere so its local X axis is level again. */
function level(obj) {
  _x.set(1, 0, 0).applyQuaternion(obj.quaternion);
  _y.set(0, 1, 0).applyQuaternion(obj.quaternion);
  obj.rotateZ(Math.atan2(-_x.y, _y.y));
  return obj;
}

export default {
  id: 'owl',
  name: 'Professor Hoot',
  title: 'The Owl',
  blurb: 'Wise, well read and slightly smug about the subjunctive.',
  accent: 0xa77bff,
  shot: 'star',

  build(k) {
    const brown = k.mat(0x8f5c3c);
    const umber = k.mat(0x5e3927, { rough: 0.6 });
    const cream = k.mat(0xf8e9cf, { rough: 0.75 });
    const speck = k.mat(0xc08b5e, { rough: 0.75 });
    const gold = k.mat(0xffbd44, { rough: 0.4 });
    const iris = k.mat(0xff8a24, { rough: 0.25, rim: 0.2 });
    const navy = k.mat(0x2d2f55, { rough: 0.62 });
    const wire = k.metal(0xeab64a, 0.28);
    const lens = k.glass(0xe2f2ff, 0.12);
    const plum = k.mat(0xa77bff, { rough: 0.55 });

    const TS = [1.08, 0.95, 0.92];
    const H = [0.6, 0.55, 0.56];
    const rig = k.biped({
      skin: brown,
      top: brown,
      bottom: brown,
      shoe: gold,
      hand: brown,
      sleeve: brown,
      torso: TS,
      head: H,
      legLen: 0.17,
      legR: 0.105,
      legGap: 0.17,
      foot: [0.12, 0.07, 0.15],
      noArms: true,
      armLen: 0.4,
      shoulderW: 0.35,
      shoulderY: 0.45,
      armRest: 0.28,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── golden talons instead of shoes ───────────────────────────────────
    const legY = rig.metrics.hipY + 0.05;
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      rig.m[`foot${side}`].visible = false;
      const leg = rig[`leg${side}`];
      [-1, 0, 1].forEach((i) => leg.add(k.at(k.ball(gold, 0.05, 0.045, 0.088), i * 0.066, 0.045 - legY, 0.07 + (1 - Math.abs(i)) * 0.03, 0, i * 0.38, 0)));
    });

    // ── wings: a soft paddle on each arm with three dark primaries fanning out below ──
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      const arm = rig[`arm${side}`];
      const main = k.at(k.ball(brown, 0.088, 0.265, 0.165), s * 0.012, -0.18, 0);
      arm.add(main);
      rig.m[`arm${side}`] = main;
      [[0.072, -0.42], [0, 0], [-0.072, 0.42]].forEach(([z, rx]) => {
        arm.add(k.at(k.ball(umber, 0.046, 0.12, 0.05), s * 0.014, -0.4 + Math.abs(z) * 0.45, z, rx, 0, 0));
      });
    });

    // ── cream belly with little brown bars ───────────────────────────────
    const bellyC = new THREE.Vector3(0, 0.21, 0.25);
    const bellyR = [0.3, 0.33, 0.17];
    torso.add(k.at(k.ball(cream, ...bellyR), bellyC.x, bellyC.y, bellyC.z));
    const arc = Math.PI * 0.8;
    [[-24, 36], [0, 42], [24, 36], [-34, 8], [-11, 14], [11, 14], [34, 8], [-21, -20], [0, -15], [21, -20]].forEach(([yaw, pitch]) => {
      const bar = k.torus(speck, 0.03, 0.0095, arc);
      level(k.onSphere(bar, yaw, pitch, 0, bellyR, bellyC));
      bar.rotateZ(Math.PI + (Math.PI - arc) / 2);
      torso.add(bar);
    });

    // ── heart-shaped facial disc: two lobes round the eyes and a chin patch ──
    k.both((s) => head.add(patch(k, cream, s * 28, 3, 31, H, c, s > 0 ? 1.016 : 1.0175)));
    head.add(patch(k, cream, 0, -27, 21, H, c, 1.015));
    const FR = H.map((r) => r * 1.02);

    const E = { yaw: 28, pitch: 3, size: 0.088, tall: 1.08, lift: 0.012 };
    k.face({
      radii: FR,
      eye: E,
      brow: { color: 0x5e3927, pitch: 27.5, yaw: 28, width: 0.085, thick: 0.017 },
      mouth: false,
      cheeks: { yaw: 45, pitch: -14, color: 0xff9a8a, size: 0.068, opacity: 0.45 },
    });
    // big orange irises behind the pupils
    for (const eye of rig.face.eyes) {
      const ring = k.mesh(k.G.sphere(24), iris, false);
      ring.scale.set(E.size * 1.78, E.size * E.tall * 1.7, E.size * 0.3);
      eye.shapes.open.add(ring);
    }

    // small hooked beak
    const beak = k.onSphere(k.group(), 0, -6, 0, FR, c);
    const hook = k.at(k.cone(gold, 0.06, 0.15, 18), 0, -0.035, 0.035, Math.PI - 0.3, 0, 0);
    hook.scale.z = 0.75;
    beak.add(k.at(k.ball(gold, 0.06, 0.05, 0.045), 0, 0.02, 0.012), hook);
    head.add(beak);

    // ── ear tufts poking out from under the cap ──────────────────────────
    k.both((s) => {
      const tuft = k.at(k.group(), s * 0.43, c.y + 0.27, 0, 0, 0, -s * 1.0);
      const main = k.at(k.cone(brown, 0.095, 0.3, 16), 0, 0.13, 0);
      main.scale.z = 0.5;
      const under = k.at(k.cone(umber, 0.068, 0.21, 14), s * 0.05, 0.075, -0.02, 0, 0, -s * 0.32);
      under.scale.z = 0.5;
      tuft.add(main, under);
      head.add(tuft);
      rig.spring(tuft, { axis: 'z', gain: 0.08, sway: 0.03, speed: 1.4, phase: s, k: 70, d: 7 });
    });

    // ── round wire spectacles (a group, so they can slip down the beak) ──
    const glasses = k.at(k.group(), c.x, c.y, c.z);
    head.add(glasses);
    const GL = { yaw: 28, pitch: 3, R: 0.162, lift: 0.058 };
    const inner = [];
    k.both((s) => {
      const rimG = k.onSphere(k.group(), s * GL.yaw, GL.pitch, GL.lift, FR, ORIGIN);
      level(rimG);
      const pane = k.ball(lens, GL.R, GL.R, 0.008);
      pane.castShadow = pane.receiveShadow = false;
      rimG.add(k.torus(wire, GL.R, 0.0125), pane);
      glasses.add(rimG);
      rimG.updateMatrix();
      const pt = (x, y) => new THREE.Vector3(x, y, 0).applyMatrix4(rimG.matrix);
      inner.push(pt(-s * GL.R * 0.94, GL.R * 0.34));
      // temple arm running back into the feathers
      glasses.add(rod(k, wire, pt(s * GL.R, GL.R * 0.15), k.surface(FR, s * 66, 9, ORIGIN).pos, 0.011));
    });
    glasses.add(rod(k, wire, inner[0], inner[1], 0.011));
    rig.props.glasses = glasses;

    // ── mortarboard with a swinging tassel ───────────────────────────────
    const cap = k.at(k.group(), 0, c.y + 0.38, -0.03, 0.1, 0, 0.06);
    const skull = k.at(k.cyl(navy, 0.4, 0.47, 0.22, 32), 0, 0.02, 0);
    skull.scale.z = 0.94;
    const board = k.at(k.group(), 0, 0.15, 0, 0, 0.16, 0);
    board.add(k.box(navy, 0.96, 0.05, 0.96, 0.018), k.at(k.ball(gold, 0.045, 0.028, 0.045), 0, 0.03, 0));
    const corner = new THREE.Vector3(-0.445, 0.03, 0.445);
    board.add(rod(k, gold, new THREE.Vector3(0, 0.036, 0), corner, 0.011));
    const tassel = k.at(k.group(), corner.x, corner.y, corner.z);
    tassel.add(
      k.at(k.cap(gold, 0.011, 0.2), 0, -0.09, 0),
      k.at(k.ball(gold, 0.027), 0, -0.19, 0),
      k.at(k.cone(gold, 0.05, 0.15, 14), 0, -0.27, 0)
    );
    board.add(tassel);
    cap.add(skull, board);
    head.add(cap);
    rig.spring(tassel, { axis: 'z', gain: 0.2, yawGain: 0.08, sway: 0.07, speed: 1.9, k: 38, d: 3 });
    rig.spring(tassel, { axis: 'x', gain: 0.24, sway: 0.05, speed: 1.5, phase: 1, k: 38, d: 3 });
    rig.spring(cap, { axis: 'x', gain: 0.04, k: 120, d: 10 });

    // ── short fan tail ───────────────────────────────────────────────────
    const tail = rig.joint('tail', k.at(k.group(), 0, 0.05, -0.31, -1.2, 0, 0));
    [[-0.07, 0.38, brown], [0.07, -0.38, brown], [0, 0, umber]].forEach(([x, rz, mat]) => tail.add(k.at(k.ball(mat, 0.062, 0.15, 0.03), x, 0.1, 0, 0, 0, rz)));
    torso.add(tail);

    // ── a little book tucked under the left wing ─────────────────────────
    const book = k.at(k.group(), 0.035, -0.08, 0.06, 0, -0.55, 0.08);
    book.add(
      k.box(plum, 0.075, 0.27, 0.21, 0.022),
      k.at(k.box(cream, 0.058, 0.252, 0.2, 0.008), 0, 0, 0.011),
      k.at(k.star(gold, 0.048, 0.021, 5, 0.012), 0.039, 0.025, 0, 0, Math.PI / 2, 0)
    );
    rig.handL.add(book);
    rig.props.book = book;

    // ── tickers: spectacles creep down and get pushed up; slow, satisfied blinks;
    //    the tassel lags behind quick head turns ───────────────────────────
    let blinking = false;
    let lastYaw = 0;
    let swing = 0;
    let swingV = 0;
    rig.tickers.push((t, dt, r, anim) => {
      const c2 = clock(t) % PERIOD;
      const idle = !anim?.clip;

      const slip = idle ? smooth(0.8, 5.5, c2) * (1 - smooth(5.75, 6.15, c2)) : 0;
      glasses.position.set(c.x, c.y - 0.022 * slip, c.z);
      glasses.rotation.z = 0.05 * slip;

      const f = r.face;
      const b = idle ? blinkAt(c2) : 0;
      if (f && f.current === 'neutral' && b > 0.001) {
        f.blinkPhase = 0;
        f.blinkT = Math.max(f.blinkT, 0.4);
        f.blink = b;
        blinking = true;
      } else if (blinking) {
        if (f) f.blink = 0;
        blinking = false;
      }

      const h = Math.min(dt, 1 / 30);
      const yaw = r.head.rotation.y;
      const vel = dt > 0 ? (yaw - lastYaw) / dt : 0;
      lastYaw = yaw;
      const target = Math.max(-0.7, Math.min(0.7, -vel * 0.09));
      swingV += (-42 * (swing - target) - 4.5 * swingV) * h;
      swing += swingV * h;
      tassel.rotation.z += swing * 0.8;
      tassel.rotation.x -= swing * 0.6;
    });

    return rig;
  },

  idle(P, t) {
    const c = clock(t) % PERIOD;

    // the book tucked under the left wing; a gentle owlish bob
    P.armLZ += 0.1;
    P.armLX += -0.12;
    P.hipsY += Math.sin(t * 1.6) * 0.008;
    P.headX += Math.sin(t * 1.6 + 0.6) * 0.014;

    // owl head swivels: snap one way, hold, snap the other, back to the front
    const sw = swivelAt(c);
    P.headY += sw;
    P.torsoY += sw * 0.07;
    P.headZ += 0.12 * win(c, 2.35, 2.95, 0.15) - 0.1 * win(c, 3.2, 3.8, 0.15);

    // push the spectacles back up with the right wing tip
    const g = adjustAt(c);
    const push = win(c, 5.65, 6.25, 0.2);
    P.armRX += g * -2.0;
    P.armRZ += g * 0.3;
    P.headX += g * 0.05 - push * 0.07;
    P.headZ += g * 0.1;
    P.headY += g * -0.12;

    // slow, satisfied blinks with the chin up
    const smug = win(c, 8.1, 9.7, 0.5);
    P.headX += -0.12 * smug;
    P.torsoX += -0.045 * smug;
    P.headZ += 0.05 * smug;
    P.tailX += Math.sin(t * 1.6) * 0.06;
  },
};
