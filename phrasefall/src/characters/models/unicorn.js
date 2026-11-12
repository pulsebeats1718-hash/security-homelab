/** Stardust the unicorn — rare, radiant and very fond of a set phrase. */
import * as THREE from 'three';
import { keys } from '../../core/utils.js';

const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const deg = (d) => (d * Math.PI) / 180;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const u = clamp01((v - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** Soft 0 → 1 → 0 window over [a, b] with edges of width e. */
const win = (c, a, b, e = 0.3) => smooth(a, a + e, c) * (1 - smooth(b - e, b, c));

/** Idle cycle: a swish of the mane … the horn glints … a prancing hoof stomp, right then left … glint. */
const PERIOD = 7;
const swishAt = (c) => win(c, 0.8, 2.3, 0.35);
const liftAt = (c, a) => keys(c, [[a, 0], [a + 0.25, 1], [a + 0.42, 1], [a + 0.55, 0]]);
const stompAt = (c, a) => keys(c, [[a + 0.45, 0], [a + 0.55, -0.08], [a + 0.7, 0.025], [a + 0.82, 0]]);
const glintAt = (c) => Math.max(0, 1 - Math.abs(c - 2.6) / 0.2, 1 - Math.abs(c - 6.1) / 0.2);

export default {
  id: 'unicorn',
  name: 'Stardust',
  title: 'The Unicorn',
  blurb: 'Rare, magical and absolutely brilliant at set phrases.',
  accent: 0xc77dff,
  shot: 'star',

  build(k) {
    const white = k.mat(0xfbf8ff, { rough: 0.6 });
    const lilac = k.mat(0xc6a2f5, { rough: 0.4 });
    const iris = k.mat(0x9a6cf2, { rough: 0.2, rim: 0.2 });
    const gold = k.metal(0xffcf4a, 0.25);
    const goldDeep = k.metal(0xe0a12c, 0.3);
    const hi = k.mat(0x222222, { emissive: 0xffffff, emissiveIntensity: 1.15, rough: 0.3, rim: 0 });
    // pastel rainbow: pink, peach, lemon, mint, sky, lilac
    const RB = [0xff9cc6, 0xffbb80, 0xffe46a, 0x8ce6ae, 0x8ccbff, 0xb79bff].map((hex) => k.mat(hex, { rough: 0.55 }));

    const TS = [1, 1, 0.88];
    const H = [0.57, 0.52, 0.54];
    const rig = k.biped({
      skin: white,
      top: white,
      bottom: white,
      shoe: lilac,
      hand: lilac,
      sleeve: white,
      torso: TS,
      head: H,
      foot: [0.14, 0.1, 0.17],
      handR: 0.115,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── soft horse muzzle with little lilac nostrils ─────────────────────
    const muzzleC = new THREE.Vector3(0, c.y - 0.17, 0.37);
    const muzzleR = [0.25, 0.17, 0.2];
    head.add(k.at(k.ball(white, ...muzzleR), muzzleC.x, muzzleC.y, muzzleC.z));
    k.both((s) => head.add(k.onSphere(k.ball(lilac, 0.028, 0.019, 0.01), s * 16, 22, 0, muzzleR, muzzleC)));

    const E = { yaw: 23, pitch: 7, size: 0.098, tall: 1.28 };
    k.face({
      eye: E,
      brow: { color: 0x8e6fc4 },
      mouth: { center: muzzleC, radii: muzzleR, pitch: -28, width: 0.075, lift: 0.004 },
      cheeks: { yaw: 42, pitch: -5, color: 0xff8fbf, size: 0.08, opacity: 0.55 },
    });
    // big sparkly eyes: a violet iris behind the pupil and an extra four-point twinkle
    for (const eye of rig.face.eyes) {
      const ring = k.mesh(k.G.sphere(20), iris, false);
      ring.scale.set(E.size * 1.34, E.size * E.tall * 1.3, E.size * 0.3);
      const spark = k.at(k.star(hi, E.size * 0.26, E.size * 0.08, 4, E.size * 0.06), E.size * 0.36, -E.size * E.tall * 0.42, E.size * 0.46);
      eye.shapes.open.add(ring, spark);
    }

    // ── small pointed ears ───────────────────────────────────────────────
    k.both((s) => {
      const ear = k.at(k.group(), s * 0.3, c.y + 0.38, -0.04, 0, 0, -s * 0.42);
      const outer = k.at(k.cone(white, 0.1, 0.26, 20), 0, 0.12, 0);
      outer.scale.z = 0.55;
      const inner = k.at(k.cone(RB[0], 0.06, 0.17, 16), 0, 0.1, 0.035);
      inner.scale.z = 0.4;
      ear.add(outer, inner);
      head.add(ear);
      rig.spring(ear, { axis: 'x', gain: 0.07, sway: 0.03, speed: 1.6, phase: s });
    });

    // ── spiral golden horn; the tip glints and emits sparkles ────────────
    const horn = k.group();
    horn.position.set(0, c.y + 0.38, 0.29);
    horn.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0, 0.93, 0.36).normalize());
    horn.add(k.at(k.cone(gold, 0.075, 0.42, 24), 0, 0.21, 0));
    [0.06, 0.15, 0.24, 0.32].forEach((y, i) => {
      horn.add(k.at(k.torus(goldDeep, 0.075 * (1 - y / 0.42) + 0.004, 0.011 - i * 0.0015), 0, y, 0, Math.PI / 2 + 0.38, 0, 0.12));
    });
    const tip = k.at(new THREE.Object3D(), 0, 0.44, 0);
    const halo = k.at(k.halo(0xfff0b8, 0.42, 0.18), 0, 0.43, 0);
    const twinkle = k.at(k.star(k.glow(0xfff6d0, 2.2), 0.075, 0.016, 4, 0.01), 0, 0.43, 0.02);
    horn.add(tip, halo, twinkle);
    head.add(horn);
    rig.props.sparkle = tip;

    // ── flowing pastel rainbow mane ──────────────────────────────────────
    const locks = [];
    // a crest of locks along the midline, from behind the horn over the crown to the nape
    [66, 94, 122, 150, 178, 206].forEach((psi, i) => {
      const p = deg(psi);
      const n = _z.set(0, Math.sin(p) / H[1], Math.cos(p) / H[2]).normalize().clone();
      const pos = new THREE.Vector3(0, Math.sin(p) * H[1], Math.cos(p) * H[2]).add(c).addScaledVector(n, 0.05);
      const back = new THREE.Vector3(0, Math.cos(p) * H[1], -Math.sin(p) * H[2]).normalize();
      _y.copy(back).negate();
      _x.crossVectors(_y, n);
      const g = k.group();
      g.position.copy(pos);
      g.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, n));
      g.rotateZ(i % 2 ? 0.26 : -0.26);
      g.rotateX(i < 2 ? -0.42 : -0.12);
      g.add(k.at(k.ball(RB[i], i < 2 ? 0.17 : 0.16, 0.2, 0.08), 0, -0.14, 0));
      head.add(g);
      rig.spring(g, { axis: 'x', gain: 0.06, sway: 0.04, speed: 1.8, phase: -i * 0.6, k: 60, d: 6, max: 0.4 });
      locks.push({ g, rx: g.rotation.x, side: 0, i });
    });
    // and longer locks hanging down the back of the head on both sides
    [[128, 8, 3], [160, 0, 4], [-128, 8, 1], [-160, 0, 2]].forEach(([yaw, pitch, ci], j) => {
      const { pos } = k.surface(H, yaw, pitch, c);
      const s = Math.sign(yaw);
      const g = k.at(k.group(), pos.x + Math.sin(deg(yaw)) * 0.03, pos.y, pos.z + Math.cos(deg(yaw)) * 0.03, 0, deg(yaw), 0);
      g.add(k.at(k.ball(RB[ci], 0.13, 0.26, 0.07), 0, -0.22, 0));
      head.add(g);
      rig.spring(g, { axis: 'x', gain: 0.08, sway: 0.04, speed: 1.5, phase: j, k: 45, d: 4.5, max: 0.4 });
      rig.spring(g, { axis: 'z', gain: 0.04, sway: 0.05, speed: 1.3, phase: j + 1, k: 45, d: 4.5, max: 0.4 });
      locks.push({ g, rx: g.rotation.x, side: s, i: 6 + j });
    });

    // a swoop of forelock curls behind the horn, kept well above the left brow
    [[-6, 60, 0.11, 0], [21, 53, 0.1, 5], [44, 43, 0.088, 4]].forEach(([yaw, pitch, r, ci], i) => {
      const g = k.onSphere(k.group(), yaw, pitch, 0.015);
      g.add(k.ball(RB[ci], r, r * 0.85, r * 0.62));
      head.add(g);
      rig.spring(g, { axis: 'x', gain: 0.05, sway: 0.03, speed: 2.2, phase: i, k: 80, d: 7 });
    });

    // ── lilac collar with a little golden star ───────────────────────────
    const collar = k.at(k.torus(lilac, 0.25, 0.035), 0, 0.58, 0, Math.PI / 2 + 0.12, 0, 0);
    collar.scale.set(1, 0.9, 1);
    const pendant = k.at(k.star(gold, 0.07, 0.032, 5, 0.026), 0, 0.47, 0.31, -0.25, 0, 0);
    torso.add(collar, pendant);

    // ── rainbow tail: a springy plume rising from the rump and cascading down ──
    const tail = rig.joint('tail', k.at(k.group(), 0, 0.12, -0.31, -1.0, 0, 0));
    torso.add(tail);
    let seg = tail;
    [[0.1, 0.13, 0.12], [0.12, 0.14, 0.15], [0.13, 0.14, 0.17], [0.125, 0.135, 0.16], [0.11, 0.125, 0.14], [0.09, 0.11, 0.11]].forEach(([w, l, th], i, all) => {
      seg.add(k.at(k.ball(RB[i], w, l, th), 0, 0.08, 0));
      if (i === all.length - 1) return;
      const next = k.at(k.group(), 0, 0.13, 0, -0.42, 0, 0);
      seg.add(next);
      rig.spring(next, { axis: 'x', gain: 0.05, sway: 0.05, speed: 2, phase: -i * 0.6, k: 50, d: 5 });
      rig.spring(next, { axis: 'z', gain: 0, yawGain: 0.03, sway: 0.07, speed: 1.6, phase: -i * 0.5, k: 50, d: 5 });
      seg = next;
    });

    // ── tickers: the horn glints, the mane ripples on a swish and never dips into the head ──
    rig.tickers.push((t, dt, r, anim) => {
      const cc = t % PERIOD;
      const idle = !anim?.clip;
      const gl = idle ? glintAt(cc) : 0;
      twinkle.visible = gl > 0.02;
      twinkle.scale.setScalar(Math.max(0.001, gl));
      twinkle.rotation.z = t * 2.5;
      halo.material.opacity = 0.18 + 0.72 * gl;
      halo.scale.setScalar(0.42 + 0.32 * gl);

      const sw = idle ? swishAt(cc) : 0;
      for (const L of locks) {
        L.g.rotation.x += Math.sin(t * 5 - L.i * 0.7) * 0.16 * sw;
        if (L.side) L.g.rotation.z += Math.sin(t * 4.2 - 0.6) * 0.22 * sw;
        else L.g.rotation.x = Math.max(L.g.rotation.x, L.rx - 0.04);
      }
    });

    return rig;
  },

  idle(P, t) {
    const c = t % PERIOD;

    // a proud toss of the head swishes the mane
    const sw = swishAt(c);
    const ph = (c - 0.8) * 4.2;
    P.headZ += Math.sin(ph) * 0.13 * sw;
    P.headY += Math.sin(ph + 1.2) * 0.12 * sw;
    P.headX += -0.06 * sw;
    P.torsoZ += Math.sin(ph) * 0.03 * sw;

    // a prancing hoof stomp: right hoof, then left
    const pr = liftAt(c, 3.4);
    const pl = liftAt(c, 4.5);
    P.legRX += -0.6 * pr;
    P.legLX += -0.6 * pl;
    P.armRX += -0.4 * pr;
    P.armLX += -0.4 * pl;
    P.hipsY += 0.03 * (pr + pl);
    P.roll += 0.035 * (pl - pr);
    P.sq += stompAt(c, 3.4) + stompAt(c, 4.5);
    P.headX += 0.05 * (pr + pl);

    // light, springy breathing and a lively tail
    P.hipsY += Math.sin(t * 2.2) * 0.006;
    P.tailY += Math.sin(t * 1.7) * 0.12;
  },

  constrain(P) {
    // raised hooves stay out to the side, clear of the head and mane, so cheers read
    P.armLZ = Math.min(P.armLZ, 2.1);
    P.armRZ = Math.max(P.armRZ, -2.1);
    P.armLX = Math.max(P.armLX, 0.18 * smooth(1.2, 1.9, P.armLZ));
    P.armRX = Math.max(P.armRX, 0.18 * smooth(1.2, 1.9, -P.armRZ));
  },
};
