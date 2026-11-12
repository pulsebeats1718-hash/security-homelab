/** Prince Pip the frog — royalty in waiting, with a grin as wide as his lily pad. */
import * as THREE from 'three';
import { clamp, keys } from '../../core/utils.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const _n = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _m = new THREE.Matrix4();
const RAD = Math.PI / 180;

/** Re-roll something placed by onSphere / onTorso so its +Y runs up the surface and its +X stays level. */
function upright(obj) {
  _n.set(0, 0, 1).applyQuaternion(obj.quaternion);
  _x.crossVectors(WORLD_UP, _n).normalize();
  _y.crossVectors(_n, _x);
  obj.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _n));
  return obj;
}

/**
 * A lip line that hugs the curved face: an arc of a small circle on the head ellipsoid.
 * `axis` is the pitch (deg) of the circle's axis and `at` the pitch of the middle of the line,
 * both measured on the unit sphere before the head radii are applied. Axis above the line gives
 * a smile, axis below it a frown. Returns a group to add to the head.
 */
function lipArc(k, mat, radii, center, axis, at, halfArc, tube) {
  const g = new THREE.Group();
  g.position.copy(center);
  g.scale.set(radii[0], radii[1], radii[2]);
  const b = axis * RAD;
  const smile = axis > at;
  const gamma = Math.abs(axis - at) * RAD;
  const rho = Math.sin(gamma);
  const d = Math.cos(gamma);
  const h = halfArc * RAD;
  const mid = smile ? -Math.PI / 2 : Math.PI / 2;
  const line = k.mesh(k.G.torus(rho, tube, 2 * h, 40, 8), mat, false);
  line.position.set(0, d * Math.sin(b), d * Math.cos(b));
  line.rotation.set(-b, 0, mid - h);
  g.add(line);
  for (const a of [mid - h, mid + h]) {
    const dot = k.mesh(k.G.sphere(10), mat, false);
    dot.scale.setScalar(tube * 1.5);
    dot.position.set(rho * Math.cos(a), d * Math.sin(b) + rho * Math.sin(a) * Math.cos(b), d * Math.cos(b) - rho * Math.sin(a) * Math.sin(b));
    g.add(dot);
  }
  return g;
}

const HOP_PERIOD = 5.2;
const HOP_DUR = 1.05;

export default {
  id: 'frog',
  name: 'Prince Pip',
  title: 'The Frog',
  blurb: 'Still waiting for that kiss. Learning idioms in the meantime.',
  accent: 0x5ee06a,
  shot: 'ball',

  build(k) {
    const green = k.mat(0x62cf4c);
    const greenDark = k.mat(0x3fa63e, { rough: 0.6 });
    const lime = k.mat(0xdff59f, { rough: 0.65 });
    const gold = k.mat(0xffd04a, { metal: 0.6, rough: 0.28 });
    const ruby = k.mat(0xff4f6d, { rough: 0.2, rim: 0.6 });
    const iris = k.mat(0xf6c93f, { rough: 0.25, rim: 0.2 });
    const lip = k.mat(0x245c2e, { rough: 0.5, rim: 0.1 });
    const blush = k.mat(0xff8f8f, { rough: 0.9, rim: 0, transparent: true, opacity: 0.5, depthWrite: false });

    const HR = [0.62, 0.42, 0.5];
    const TS = [1.05, 0.95, 0.9];
    const foot = [0.19, 0.07, 0.25];
    const legLen = 0.26;
    const rig = k.biped({
      skin: green,
      top: green,
      bottom: green,
      shoe: green,
      hand: green,
      sleeve: green,
      head: HR,
      torso: TS,
      legLen,
      legR: 0.118,
      legGap: 0.2,
      foot,
      armR: 0.092,
      handR: 0.13,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // pale belly and a throat that puffs in and out
    torso.add(k.at(k.ball(lime, 0.285, 0.3, 0.135), 0, 0.2, 0.262));
    const throat = k.at(k.ball(lime, 0.21, 0.15, 0.16), 0, 0.5, 0.2);
    torso.add(throat);
    const throatBase = throat.scale.clone();

    // webbed hands: flat mitts with three round finger pads
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      rig.m[`hand${side}`].scale.set(0.135, 0.125, 0.08);
      const hand = rig[`hand${side}`];
      [-1, 0, 1].forEach((i) => hand.add(k.at(k.ball(lime, 0.05, 0.05, 0.045), i * 0.092, -0.085 - (i === 0 ? 0.035 : 0), 0.012)));
      // webbed feet: wide flat pads with three toes
      const toes = k.at(k.group(), 0, -legLen - 0.05 + foot[1] * 0.15, foot[2] * 0.32, 0, s * 0.28, 0);
      [-1, 0, 1].forEach((i) => toes.add(k.at(k.ball(lime, 0.062, 0.05, 0.075), i * 0.115, -0.012, 0.215 - Math.abs(i) * 0.045)));
      rig[`leg${side}`].add(toes);
      rig.m[`foot${side}`].rotation.y = s * 0.28;
    });

    // pale lower jaw: a slightly smaller, lowered copy of the head that breaks through below the smile line
    head.add(k.at(k.ball(lime, HR[0] * 0.954, HR[1] * 0.954, HR[2] * 0.954, 36), 0, c.y - 0.042, 0));

    // two big eye bumps on top of the head
    const bumpR = 0.2;
    const bumpC = new THREE.Vector3(0.3, c.y + 0.3, 0.1);
    k.both((s) => head.add(k.at(k.ball(green, bumpR), s * bumpC.x, bumpC.y, bumpC.z)));

    // The eyes sit on the bumps: the face is laid on one big virtual sphere that touches the
    // front of both bumps, so open, happy, hurt and ko eye shapes all land in the right place.
    const look = new THREE.Vector3(0.2, 0.2, 0.96).normalize();
    const R = bumpC.x / look.x + bumpR;
    const faceC = new THREE.Vector3(0, bumpC.y - (R - bumpR) * look.y, bumpC.z - (R - bumpR) * look.z);
    const E = { yaw: Math.atan2(look.x, look.z) / RAD, pitch: Math.asin(look.y) / RAD, size: 0.1, tall: 1.14, lift: -0.02 };
    k.face({
      radii: [R, R, R],
      center: faceC,
      eye: E,
      brow: false,
      cheeks: false,
      mouth: { radii: HR, center: c, pitch: -31.5, width: 0.115, lift: 0.013, color: 0x7a2636 },
    });
    for (const eye of rig.face.eyes) {
      const ring = k.mesh(k.G.sphere(20), iris, false);
      ring.scale.set(E.size * 1.2, E.size * E.tall * 1.18, E.size * 0.3);
      eye.shapes.open.add(ring);
    }

    // a very wide smile: swap the kit's narrow lip strokes for arcs that follow the head
    const M = rig.face.mouth;
    const AT = -32;
    const wide = {
      smile: lipArc(k, lip, HR, c, 20, AT, 47, 0.034),
      frown: lipArc(k, lip, HR, c, -84, AT - 5, 36, 0.034),
      flat: lipArc(k, lip, HR, c, 62, AT - 1, 28, 0.034),
    };
    for (const key of Object.keys(wide)) {
      M.root.remove(M.shapes[key]);
      M.shapes[key] = wide[key];
      head.add(wide[key]);
    }
    const laugh = k.group(lipArc(k, lip, HR, c, 20, AT, 47, 0.034));
    const cavity = k.group(M.shapes.open);
    cavity.position.copy(M.root.position);
    cavity.quaternion.copy(M.root.quaternion);
    laugh.add(cavity);
    M.shapes.open = laugh;
    head.add(laugh);
    rig.face.apply('neutral');

    // nostrils, blush, darker spots
    k.both((s) => {
      head.add(k.onSphere(k.ball(lip, 0.016, 0.012, 0.008), s * 6.5, 3, 0.001, HR, c));
      const cheek = k.mesh(k.G.sphere(14), blush, false);
      cheek.scale.set(0.085, 0.052, 0.012);
      head.add(k.onSphere(cheek, s * 47, -9, 0.003, HR, c));
    });
    const spot = (yaw, pitch, size) => head.add(upright(k.onSphere(k.ball(greenDark, size, size * 0.82, 0.02), yaw, pitch, -0.009, HR, c)));
    spot(-52, 30, 0.062);
    spot(-66, 12, 0.036);
    spot(58, 22, 0.045);
    spot(150, 28, 0.085);
    spot(-140, 8, 0.065);
    spot(178, -6, 0.05);
    [[168, 0.4, 0.07], [-160, 0.2, 0.055], [150, 0.12, 0.04]].forEach(([yaw, y, size]) => torso.add(upright(k.onTorso(k.ball(greenDark, size, size * 0.85, 0.02), yaw, y, -0.009))));

    // tiny gold crown, tilted between the eyes
    const crown = k.at(k.group(), 0.01, c.y + 0.385, 0.03, 0.12, 0, -0.26);
    crown.add(k.at(k.cyl(gold, 0.098, 0.082, 0.075, 20), 0, 0.035, 0), k.at(k.torus(gold, 0.086, 0.017), 0, 0.006, 0, Math.PI / 2, 0, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = Math.sin(a) * 0.082;
      const z = Math.cos(a) * 0.082;
      crown.add(k.at(k.cone(gold, 0.034, 0.085, 10), x, 0.105, z), k.at(k.ball(gold, 0.017), x, 0.15, z));
    }
    crown.add(k.at(k.ball(ruby, 0.024, 0.024, 0.016), 0, 0.04, 0.09));
    crown.scale.setScalar(1.3);
    head.add(crown);
    rig.spring(crown, { axis: 'x', gain: 0.1, sway: 0.0, k: 80, d: 6 });

    // throat puffs and slow, sleepy blinks
    rig.tickers.push((t, dt, r) => {
      const puff = Math.pow(0.5 + 0.5 * Math.sin(t * 3.0), 1.6);
      throat.scale.copy(throatBase).multiplyScalar(1 + puff * 0.2);
      const cyc = t % 4.3;
      const idleEyes = r.face.eyes[0].shapes.open.visible;
      const lid = idleEyes && cyc < 0.7 ? Math.pow(Math.sin((cyc / 0.7) * Math.PI), 0.7) : 0;
      for (const eye of r.face.eyes) eye.root.scale.y = 1 - lid * 0.9;
    });

    return rig;
  },

  idle(P, t) {
    // settled, slightly squat stance
    P.armLZ += 0.1;
    P.armRZ -= 0.1;
    P.legLZ += 0.06;
    P.legRZ -= 0.06;
    P.sq += Math.sin(t * 3.0) * 0.008;

    // every few seconds: crouch, spring up on the spot, land with a squash
    const cyc = t % HOP_PERIOD;
    if (cyc < HOP_DUR) {
      const u = cyc / HOP_DUR;
      const j = clamp((u - 0.32) / 0.4);
      const air = u > 0.32 && u < 0.72 ? 4 * j * (1 - j) : 0;
      P.y += air * 0.42;
      P.sq += keys(u, [[0, 0], [0.26, -0.22], [0.36, 0.2], [0.52, 0.04], [0.7, 0.12], [0.78, -0.2], [0.9, 0.06], [1, 0]]);
      const crouch = keys(u, [[0, 0], [0.26, 1], [0.36, 0], [0.72, 0], [0.8, 0.7], [1, 0]]);
      P.legLZ += crouch * 0.16 + air * 0.3;
      P.legRZ -= crouch * 0.16 + air * 0.3;
      P.legLX += air * -0.45;
      P.legRX += air * -0.45;
      P.armLZ += crouch * -0.08 + air * 0.9;
      P.armRZ -= crouch * -0.08 + air * 0.9;
      P.armLX += crouch * -0.3;
      P.armRX += crouch * -0.3;
      P.headX += crouch * 0.1 - air * 0.12;
    }
  },
};
