/** Conker the hedgehog — a round little hedgerow forager in a woolly scarf. */
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const _d = new THREE.Vector3();
const deg = (d) => (d * Math.PI) / 180;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const u = clamp01((v - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** Soft 0 → 1 → 0 window over [a, b] with edges of width e. */
const win = (c, a, b, e = 0.4) => smooth(a, a + e, c) * (1 - smooth(b - e, b, c));

/** Soft, round-tipped spine: one shared lathe profile pointing along +Y. */
const SPINE = [[0, 0], [0.12, 0.005], [0.112, 0.06], [0.082, 0.13], [0.045, 0.195], [0.016, 0.236], [0, 0.245]];

/** Idle cycle: sniff about … curl up a little … uncurl with a spine-ruffling shake … potter. */
const PERIOD = 9;
const sniffAt = (c) => win(c, 0.3, 2.7, 0.4);
const curlAt = (c) => win(c, 3.2, 4.9, 0.45);
const ruffleAt = (c) => win(c, 4.7, 5.9, 0.2);

/** A thin shell hugging an ellipsoid: a spherical cap of half-angle `deg` centred on (yaw, pitch). */
function patch(k, mat, yaw, pitch, halfAngle, radii, center, inflate) {
  const g = k.group();
  g.position.copy(center);
  g.scale.set(radii[0] * inflate, radii[1] * inflate, radii[2] * inflate);
  const cap = k.dome(mat, 1, 1, 1, halfAngle / 180, 36);
  cap.castShadow = false;
  const p = k.surface(radii, yaw, pitch).pos;
  cap.quaternion.setFromUnitVectors(UP, _d.set(p.x / radii[0], p.y / radii[1], p.z / radii[2]).normalize());
  g.add(cap);
  return g;
}

export default {
  id: 'hedgehog',
  name: 'Conker',
  title: 'The Hedgehog',
  blurb: 'Prickly on the outside, a total softie about idioms.',
  accent: 0xc68b59,
  shot: 'orb',

  build(k) {
    const brown = k.mat(0x86583a, { rough: 0.75 });
    const tan = k.mat(0xb07d52, { rough: 0.75 });
    const cream = k.mat(0xf3dfbf, { rough: 0.72 });
    const limb = k.mat(0x5e3b2a, { rough: 0.7 });
    const paw = k.mat(0xd29b77, { rough: 0.6 });
    const nose = k.mat(0x2a1d1c, { rough: 0.2 });
    const wool = k.mat(0x4fa85b, { rough: 0.95 });
    const woolDark = k.mat(0x37894a, { rough: 0.95 });
    const red = k.mat(0xe2453c, { rough: 0.35 });

    const TS = [1.1, 0.95, 0.95];
    const H = [0.58, 0.53, 0.54];
    const rig = k.biped({
      skin: cream,
      top: brown,
      bottom: limb,
      shoe: paw,
      hand: paw,
      sleeve: limb,
      torso: TS,
      head: H,
      legLen: 0.26,
      legR: 0.12,
      legGap: 0.19,
      foot: [0.14, 0.085, 0.21],
      armR: 0.1,
      handR: 0.11,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // cream belly
    torso.add(k.at(k.ball(cream, 0.3, 0.32, 0.14), 0, 0.22, 0.29));

    // ── spines ───────────────────────────────────────────────────────────
    const spines = [];
    const plant = (parent, pos, n, droop, len, w, mat) => {
      const m = k.lathe(mat, SPINE, 12);
      m.position.copy(pos).addScaledVector(n, -0.03);
      m.quaternion.setFromUnitVectors(UP, _d.copy(n).add(droop).normalize());
      m.scale.set(w, len, w);
      parent.add(m);
      spines.push({ m, len, w, phase: spines.length * 2.39 });
    };

    // the head: a brown shell over the back and crown leaves a cream face mask; spines sit in
    // rows around the shell's axis (theta from the back-top, phi round it: 0 = forehead, + = left)
    head.add(patch(k, brown, 180, 22, 102, H, c, 1.012));
    const ps = k.surface(H, 180, 22).pos;
    const B = new THREE.Vector3(ps.x / H[0], ps.y / H[1], ps.z / H[2]).normalize();
    const U = new THREE.Vector3(0, 1, 0).addScaledVector(B, -B.y).normalize();
    const XA = new THREE.Vector3(1, 0, 0);
    const onHead = (theta, phi, lift = 0) => {
      const th = deg(theta);
      const ph = deg(phi);
      const u = B.clone()
        .multiplyScalar(Math.cos(th))
        .addScaledVector(U, Math.sin(th) * Math.cos(ph))
        .addScaledVector(XA, Math.sin(th) * Math.sin(ph));
      const n = new THREE.Vector3(u.x / H[0], u.y / H[1], u.z / H[2]).normalize();
      const pos = new THREE.Vector3(u.x * H[0], u.y * H[1], u.z * H[2]).add(c).addScaledVector(n, lift);
      return { pos, n };
    };
    const headDroop = new THREE.Vector3(0, -0.15, -0.35);
    [
      [94, [0, 30, -30, 90, -90, 122, -122]],
      [60, [28, -28, 85, -85, 140, -140, 180]],
      [26, [0, 120, -120]],
    ].forEach(([theta, phis], r) =>
      phis.forEach((phi, i) => {
        const { pos, n } = onHead(theta, phi);
        plant(head, pos, n, headDroop, r === 0 ? 0.92 : 1, 1, (r + i) % 3 === 0 ? tan : brown);
      })
    );

    // the back: rows of slightly smaller spines, kept behind the arms
    const bodyDroop = new THREE.Vector3(0, -0.45, -0.1);
    const probe = new THREE.Object3D();
    [
      [0.06, [148, 180, 212]],
      [0.24, [126, 154, 180, 206, 234]],
      [0.42, [138, 166, 194, 222]],
      [0.56, [158, 202]],
    ].forEach(([y, yaws], r) =>
      yaws.forEach((yaw, i) => {
        k.onTorso(probe, yaw, y, 0);
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(probe.quaternion);
        plant(torso, probe.position.clone(), n, bodyDroop, 0.85, 0.92, (r + i) % 3 === 1 ? tan : brown);
      })
    );

    // tiny round ears peeking out at the hairline
    k.both((s) => {
      const { pos, n } = onHead(100, s * 60, 0.025);
      const ear = k.ball(paw, 0.085, 0.08, 0.045);
      ear.position.copy(pos);
      ear.quaternion.setFromUnitVectors(FWD, _d.copy(n).add(new THREE.Vector3(0, 0, 0.5)).normalize());
      head.add(ear);
    });

    // ── pointed snout with a black button nose (a group, so it can sniff) ──
    const snout = k.at(k.group(), 0, c.y - 0.13, 0.36);
    const SR = [0.14, 0.12, 0.21];
    const SC = new THREE.Vector3(0, 0, 0.07);
    const button = k.at(k.ball(nose, 0.062, 0.05, 0.05), 0, 0.022, 0.275);
    snout.add(k.at(k.ball(cream, ...SR), SC.x, SC.y, SC.z), button);
    head.add(snout);

    k.face({
      eye: { yaw: 25, pitch: 10, size: 0.082, tall: 1.25 },
      brow: { color: 0x5e3b2a },
      mouth: { parent: snout, center: SC, radii: SR, pitch: -20, width: 0.062, lift: 0.004 },
      cheeks: { yaw: 43, pitch: -6, color: 0xff9e8f, size: 0.07 },
    });

    // ── a red apple stuck on the spines ──────────────────────────────────
    {
      const { pos, n } = onHead(70, -40, 0.15);
      const apple = k.group();
      apple.position.copy(pos);
      apple.quaternion.setFromUnitVectors(UP, _d.copy(n).add(UP).normalize());
      apple.add(
        k.ball(red, 0.125, 0.112, 0.125),
        k.at(k.cap(limb, 0.013, 0.075), 0.005, 0.12, 0, 0, 0, -0.2),
        k.at(k.ball(wool, 0.055, 0.014, 0.03), 0.05, 0.125, 0, 0, 0.4, -0.45)
      );
      head.add(apple);
      rig.props.apple = apple;
    }

    // ── green woolly scarf: ring, knot, one striped end over the belly ───
    const ring = k.at(k.torus(wool, 0.27, 0.095), 0, 0.565, 0, Math.PI / 2 + 0.15, 0, 0);
    ring.scale.set(1.05, 1, 1);
    const knot = k.at(k.group(), 0.13, 0.5, 0.33, -0.45, 0, -0.15);
    knot.add(
      k.ball(woolDark, 0.068, 0.062, 0.058),
      k.at(k.box(wool, 0.13, 0.28, 0.055, 0.025), 0, -0.15, 0),
      k.at(k.box(woolDark, 0.134, 0.045, 0.06, 0.016), 0, -0.21, 0)
    );
    torso.add(ring, knot);
    const knotRx = knot.rotation.x;
    rig.spring(knot, { axis: 'x', gain: 0.1, sway: 0.04, speed: 2.1 });

    // ── tickers: sniffing snout, bristling / ruffling spines, scarf kept off the belly ──
    rig.tickers.push((t, dt, r, anim) => {
      const cc = t % PERIOD;
      const idle = !anim?.clip;
      const sn = idle ? sniffAt(cc) : 0;
      snout.rotation.x = Math.sin(t * 23) * 0.05 * sn - 0.05 * sn;
      snout.rotation.y = Math.sin(t * 9) * 0.06 * sn;
      button.scale.set(0.062 * (1 + 0.1 * Math.sin(t * 31) * (0.3 + sn)), 0.05, 0.05);

      const cu = idle ? curlAt(cc) : 0;
      const ru = idle ? ruffleAt(cc) : 0;
      for (const s of spines) {
        const q = 1 + 0.12 * cu + 0.14 * ru * Math.sin(t * 34 + s.phase);
        s.m.scale.set(s.w * (1 + 0.05 * ru * Math.sin(t * 29 + s.phase)), s.len * q, s.w);
      }
      knot.rotation.x = Math.min(knot.rotation.x, knotRx + 0.05);
    });

    return rig;
  },

  idle(P, t) {
    const c = t % PERIOD;

    // sniffing about: nose up, head sweeping from side to side
    const sn = sniffAt(c);
    P.headY += Math.sin((c - 0.3) * 2.6) * 0.3 * sn;
    P.headX += -0.06 * sn + Math.sin(t * 11) * 0.012 * sn;
    P.torsoX += 0.03 * sn;

    // curl up a little: hunch over, tuck the head, paws in
    const cu = curlAt(c);
    P.torsoX += 0.26 * cu;
    P.headX += 0.2 * cu;
    P.armLX += -0.45 * cu;
    P.armRX += -0.45 * cu;
    P.armLZ += -0.06 * cu;
    P.armRZ += 0.06 * cu;
    P.sq += -0.07 * cu;
    P.hipsY += -0.025 * cu;
    P.legLX += -0.12 * cu;
    P.legRX += -0.12 * cu;

    // …then uncurl with a shake that ruffles the spines (ticker)
    const ru = ruffleAt(c);
    P.roll += Math.sin(t * 24) * 0.035 * ru;
    P.torsoY += Math.sin(t * 24 + 1) * 0.06 * ru;

    // a contented little waddle in between
    P.hipsY += Math.abs(Math.sin(t * 1.9)) * 0.006;
    P.headZ += Math.sin(t * 0.8) * 0.03;
  },
};
