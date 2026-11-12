/** Rory the lion — a golden champion with a magnificent mane and a medal to match. */
import * as THREE from 'three';
import { keys } from '../../core/utils.js';

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
const win = (c, a, b, e = 0.3) => smooth(a, a + e, c) * (1 - smooth(b - e, b, c));

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

/** A flat strap (ribbon) between two points. */
function strap(k, mat, a, b, w, t) {
  _d.subVectors(b, a);
  const m = k.box(mat, w, _d.length(), t, t * 0.45);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, _d.normalize());
  return m;
}

/** Idle cycle: proud chest-out stance … a mane shake … a mighty (but cute) roar. */
const PERIOD = 8;
const ROAR_T = 5.2;
const shakeAt = (c) => win(c, 1.9, 3.0, 0.2);
const roarAt = (c) => keys(c, [[4.75, 0], [5.05, -0.35], [5.25, 1], [6.05, 1], [6.5, 0]]);

export default {
  id: 'lion',
  name: 'Rory',
  title: 'The Lion',
  blurb: "Takes the lion's share of the points — and is ever so humble about it.",
  accent: 0xffb703,
  shot: 'orb',

  build(k) {
    const fur = k.mat(0xf5bd3c, { rough: 0.65 });
    const maneA = k.mat(0xd0702e, { rough: 0.85 });
    const maneB = k.mat(0xb95c26, { rough: 0.85 });
    const cream = k.mat(0xfff0d2, { rough: 0.7 });
    const nose = k.mat(0x8a4a3c, { rough: 0.3 });
    const red = k.mat(0xdc3a3a, { rough: 0.5 });
    const redDark = k.mat(0xa82830, { rough: 0.5 });
    const gold = k.metal(0xffc23d, 0.28);
    const blue = k.mat(0x2f56c4, { rough: 0.55 });

    const TS = [1.05, 1, 0.92];
    const H = [0.56, 0.5, 0.52];
    const rig = k.biped({ skin: fur, top: fur, bottom: fur, shoe: fur, hand: fur, sleeve: fur, torso: TS, head: H });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // cream belly
    torso.add(k.at(k.ball(cream, 0.24, 0.26, 0.11), 0, 0.17, 0.3));

    // ── the mane: two rings of puffs round the face axis + a mane-coloured back of the head ──
    const F = new THREE.Vector3(0, -0.08, 1).normalize();
    const Uf = new THREE.Vector3(0, 1, 0).addScaledVector(F, -F.y).normalize();
    const XA = new THREE.Vector3(1, 0, 0);
    const onHead = (alpha, beta, lift = 0) => {
      const a = deg(alpha);
      const b = deg(beta);
      const u = F.clone()
        .multiplyScalar(Math.cos(a))
        .addScaledVector(Uf, Math.sin(a) * Math.cos(b))
        .addScaledVector(XA, Math.sin(a) * Math.sin(b));
      const n = new THREE.Vector3(u.x / H[0], u.y / H[1], u.z / H[2]).normalize();
      const pos = new THREE.Vector3(u.x * H[0], u.y * H[1], u.z * H[2]).add(c).addScaledVector(n, lift);
      return { pos, n };
    };
    head.add(patch(k, maneB, 180, 4, 82, H, c, 1.02));
    const mane = new THREE.Group();
    head.add(mane);
    const puffs = [];
    const puff = (alpha, beta, r, lift, mat) => {
      const { pos, n } = onHead(alpha, beta, lift);
      const m = k.at(k.ball(mat, r, r, r * 0.92), pos.x, pos.y, pos.z);
      mane.add(m);
      puffs.push({ m, pos, n, r, phase: puffs.length * 1.37 });
    };
    for (let i = 0; i < 12; i++) puff(i % 2 ? 77 : 72, i * 30, i % 2 ? 0.155 : 0.175, 0.03, i % 2 ? maneB : maneA);
    for (let i = 0; i < 10; i++) puff(i % 2 ? 121 : 113, 18 + i * 36, i % 2 ? 0.2 : 0.18, 0, maneB);

    // round ears peeking out of the mane
    k.both((s) => {
      const { pos, n } = onHead(62, s * 36, 0.06);
      const ear = k.group(k.ball(fur, 0.12, 0.115, 0.06), k.at(k.ball(cream, 0.07, 0.068, 0.03), 0, -0.01, 0.036));
      ear.position.copy(pos);
      ear.quaternion.setFromUnitVectors(FWD, _d.copy(n).add(new THREE.Vector3(0, 0, 0.4)).normalize());
      head.add(ear);
      rig.spring(ear, { axis: 'x', gain: 0.05, sway: 0.02, speed: 1.4, phase: s });
    });

    // ── cream muzzle and a rosy-brown nose ───────────────────────────────
    const muzzleC = new THREE.Vector3(0, c.y - 0.15, 0.38);
    const muzzleR = [0.22, 0.15, 0.18];
    head.add(k.at(k.ball(cream, ...muzzleR), muzzleC.x, muzzleC.y, muzzleC.z));
    head.add(k.at(k.ball(nose, 0.072, 0.048, 0.045), 0, c.y - 0.08, 0.555));

    k.face({
      eye: { yaw: 22, pitch: 6, size: 0.085 },
      brow: { color: 0xb95c26, thick: 0.018 },
      mouth: { center: muzzleC, radii: muzzleR, pitch: -36, width: 0.08, lift: 0.004 },
      cheeks: { yaw: 41, pitch: -2, color: 0xff9270, size: 0.072 },
    });
    // two tiny fangs that show whenever the mouth opens
    const mouth = rig.face.mouth;
    k.both((s) => mouth.shapes.open.add(k.at(k.cone(cream, 0.013, 0.032, 10), s * 0.042, -0.014, 0.004, 0, 0, Math.PI)));

    // ── red bow tie ──────────────────────────────────────────────────────
    const bow = k.at(k.group(), 0, 0.43, 0.355);
    k.both((s) => {
      const wing = k.at(k.cone(red, 0.085, 0.16, 16), s * 0.085, 0, 0, 0, 0, s * (Math.PI / 2));
      wing.scale.z = 0.45;
      bow.add(wing);
    });
    bow.add(k.ball(redDark, 0.042, 0.048, 0.04));
    torso.add(bow);

    // ── gold champion's medal on a blue ribbon ───────────────────────────
    k.both((s) => torso.add(strap(k, blue, new THREE.Vector3(s * 0.1, 0.47, 0.33), new THREE.Vector3(s * 0.03, 0.31, 0.42), 0.05, 0.012)));
    const medal = k.at(k.group(), 0, 0.255, 0.418);
    medal.add(k.at(k.cyl(gold, 0.085, 0.085, 0.024, 28), 0, 0, 0, Math.PI / 2, 0, 0), k.at(k.star(cream, 0.052, 0.024, 5, 0.012), 0, 0, 0.014));
    torso.add(medal);
    rig.props.medal = medal;

    // ── tail: down, then curling up to a mane-coloured tuft ──────────────
    const tail = rig.joint('tail', k.at(k.group(), 0, 0.08, -0.32, -2.0, 0, 0));
    const tip = k.at(k.group(), 0, 0.32, 0, 1.6, 0, 0);
    tip.add(k.at(k.cap(fur, 0.038, 0.3), 0, 0.13, 0), k.at(k.ball(maneA, 0.095, 0.11, 0.095), 0, 0.3, 0));
    tail.add(k.at(k.cap(fur, 0.042, 0.36), 0, 0.16, 0), tip);
    torso.add(tail);
    rig.spring(tip, { axis: 'x', gain: 0.1, sway: 0.08, speed: 1.6, k: 40, d: 4 });

    // ── tickers: mane jiggle and puff, the roar (open-mouthed, eyes squeezed) ──
    let lastC = 0;
    rig.tickers.push((t, dt, r, anim) => {
      const cc = t % PERIOD;
      const idle = !anim?.clip;
      const sh = idle ? shakeAt(cc) : 0;
      const ro = idle ? Math.max(0, roarAt(cc)) : 0;
      for (const p of puffs) {
        const j = 0.014 * sh * Math.sin(t * 26 + p.phase) + 0.025 * ro;
        p.m.position.copy(p.pos).addScaledVector(p.n, j);
        const s = p.r * (1 + 0.1 * ro);
        p.m.scale.set(s, s, s * 0.92);
      }
      if (idle && lastC < ROAR_T && cc >= ROAR_T) r.face?.set('happy', 0.85);
      lastC = cc;
      mouth.root.scale.setScalar(1 + 0.6 * ro);
    });

    return rig;
  },

  idle(P, t) {
    const c = t % PERIOD;

    // proud, chest-out stance with deep, satisfied breaths
    const br = Math.sin(t * 1.5);
    P.torsoX += -0.07 + br * 0.015;
    P.headX += -0.05 - br * 0.01;
    P.armLX += 0.12;
    P.armRX += 0.12;
    P.armLZ += 0.08;
    P.armRZ -= 0.08;

    // a magnificent mane shake
    const sh = shakeAt(c);
    P.headY += Math.sin(t * 20) * 0.14 * sh;
    P.headZ += Math.sin(t * 20 + 1.2) * 0.06 * sh;

    // the roar: a little wind-up, then head up, paws out, tail high
    const ro = roarAt(c);
    const up = Math.max(0, ro);
    const wind = Math.max(0, -ro);
    P.headX += -0.2 * up + 0.3 * wind;
    P.torsoX += -0.06 * up + 0.2 * wind;
    P.sq += 0.06 * up - 0.2 * wind;
    P.armLZ += 1.25 * up;
    P.armRZ -= 1.25 * up;
    P.armLX += 0.15 * up;
    P.armRX += 0.15 * up;
    P.tailX += -0.45 * up;
    P.headZ += Math.sin(t * 30) * 0.02 * up;
    P.tailZ += Math.sin(t * 2.4) * 0.15;
  },

  constrain(P) {
    // raised paws stay out wide, beyond the mane, instead of vanishing into it
    P.armLZ = Math.min(P.armLZ, 1.75);
    P.armRZ = Math.max(P.armRZ, -1.75);
    P.armLX = Math.max(P.armLX, 0.25 * smooth(1.2, 1.7, P.armLZ));
    P.armRX = Math.max(P.armRX, 0.25 * smooth(1.2, 1.7, -P.armRZ));
  },
};
