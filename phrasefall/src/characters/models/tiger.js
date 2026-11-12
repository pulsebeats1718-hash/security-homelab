/** Raja the tiger — proud, playful and very pleased with his stripes. */
import * as THREE from 'three';
import { keys, ease } from '../../core/utils.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const _n = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** Re-roll something placed by onSphere / onTorso so its +Y runs up the surface and its +X stays level. */
function upright(obj) {
  _n.set(0, 0, 1).applyQuaternion(obj.quaternion);
  _x.crossVectors(WORLD_UP, _n).normalize();
  _y.crossVectors(_n, _x);
  obj.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _n));
  return obj;
}

const SWIPE_PERIOD = 6.5;
const SWIPE_DUR = 1.15;

export default {
  id: 'tiger',
  name: 'Raja',
  title: 'The Tiger',
  blurb: 'Earned his stripes one expression at a time.',
  accent: 0xff9a2e,
  shot: 'orb',

  build(k) {
    const fur = k.mat(0xffa22e);
    const cream = k.mat(0xfff0d2, { rough: 0.7 });
    const stripe = k.mat(0x4b2a1c, { rough: 0.6 });
    const nose = k.mat(0xff8097, { rough: 0.25 });
    const band = k.mat(0x2f80e6, { rough: 0.72 });
    const bandDark = k.mat(0x2164c4, { rough: 0.72 });

    const armR = 0.11;
    const legR = 0.135;
    const rig = k.biped({ skin: fur, top: fur, bottom: fur, shoe: fur, hand: fur, sleeve: fur, armR, legR, handR: 0.13 });
    const { head, torso } = rig;
    const c = rig.headCenter;
    const H = rig.headRadii;

    // cream belly
    torso.add(k.at(k.ball(cream, 0.245, 0.29, 0.12), 0, 0.22, 0.243));

    // round ears: cream centres, dark backs
    k.both((s) => {
      const ear = k.at(k.group(), s * 0.34, c.y + 0.37, -0.03, 0, 0, -s * 0.5);
      ear.add(
        k.at(k.ball(fur, 0.165, 0.16, 0.085), 0, 0.085, 0),
        k.at(k.ball(cream, 0.1, 0.098, 0.05), 0, 0.085, 0.048),
        k.at(k.ball(stripe, 0.095, 0.09, 0.04), 0, 0.1, -0.056)
      );
      head.add(ear);
      rig.spring(ear, { axis: 'x', gain: 0.07, sway: 0.03, speed: 1.8, phase: s });
    });

    // muzzle with two whisker pads, pink nose, cream jowls
    const muzzleC = new k.THREE.Vector3(0, c.y - 0.17, 0.4);
    const muzzleR = [0.225, 0.15, 0.185];
    head.add(k.at(k.ball(cream, ...muzzleR), muzzleC.x, muzzleC.y, muzzleC.z));
    k.both((s) => {
      head.add(k.at(k.ball(cream, 0.118, 0.098, 0.1), s * 0.09, c.y - 0.135, 0.495));
      head.add(k.at(k.ball(cream, 0.17, 0.15, 0.17), s * 0.385, c.y - 0.235, 0.14));
    });
    head.add(k.at(k.ball(nose, 0.066, 0.046, 0.045), 0, c.y - 0.075, 0.585));

    // bold stripes painted on the head: tapered marks that sink into the surface at both ends
    const mark = (yaw, pitch, len, wid, rot = 0) => {
      const m = k.ball(stripe, wid, len, 0.034);
      upright(k.onSphere(m, yaw, pitch, -0.014)).rotateZ(rot);
      head.add(m);
    };
    mark(0, 68, 0.19, 0.044); //   over the crown: three in front…
    mark(180, 66, 0.19, 0.044); // …and three behind
    k.both((s) => {
      mark(s * 34, 62, 0.14, 0.038);
      mark(s * 146, 61, 0.14, 0.038);
      mark(s * 66, 9, 0.12, 0.034, Math.PI / 2 - s * 0.12); //   cheeks
      mark(s * 71, -8, 0.1, 0.03, Math.PI / 2 + s * 0.1);
      mark(s * 137, 4, 0.17, 0.04, Math.PI / 2 + s * 0.12); //   back of the head
      mark(s * 144, -17, 0.13, 0.036, Math.PI / 2 - s * 0.05);
    });

    k.face({
      eye: { yaw: 22, pitch: 4, size: 0.085 },
      brow: { color: 0x4b2a1c, pitch: 20.5, thick: 0.015 },
      mouth: { center: muzzleC, radii: muzzleR, pitch: -47, width: 0.075, lift: 0.004 },
      cheeks: { yaw: 41, pitch: -7, color: 0xff8f7a },
    });

    // sporty headband, knotted at the back with two fluttering tails
    const sweat = k.lathe(band, [[0.5, 0.232], [0.535, 0.25], [0.52, 0.275], [0.498, 0.305], [0.47, 0.335], [0.438, 0.357], [0.405, 0.366]], 40);
    sweat.scale.z = H[2] / H[0];
    sweat.position.y = c.y;
    head.add(sweat);
    const knot = upright(k.onSphere(k.group(), 170, 33, 0.03));
    knot.add(k.ball(bandDark, 0.08, 0.066, 0.055));
    [[-0.05, 0.3, band, 0.36], [0.06, -0.22, bandDark, 0.28]].forEach(([x, rz, mat, len], i) => {
      const end = k.at(k.group(), x, -0.02, 0.012 + i * 0.02, -0.1, 0, rz);
      end.add(k.at(k.box(mat, 0.115, len, 0.03, 0.014), 0, -len / 2, 0));
      knot.add(end);
      rig.spring(end, { axis: 'x', gain: 0.16, yawGain: 0.04, sway: 0.09, speed: 2.6, phase: i * 1.3, k: 50, d: 5 });
    });
    head.add(knot);

    // body stripes: across the back and round the flanks
    const bodyMark = (yaw, y, len, wid, rot = 0) => {
      const m = upright(k.onTorso(k.ball(stripe, len, wid, 0.032), yaw, y, -0.013));
      m.rotateZ(rot);
      torso.add(m);
    };
    bodyMark(180, 0.46, 0.15, 0.034);
    bodyMark(180, 0.33, 0.2, 0.038);
    bodyMark(180, 0.2, 0.17, 0.036);
    k.both((s) => {
      bodyMark(s * 118, 0.395, 0.1, 0.03, s * 0.2);
      bodyMark(s * 112, 0.26, 0.11, 0.032, s * 0.1);
    });

    // limb stripes: rings pushed off-centre so they show as crescents on the outside of each limb
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      [-0.1, -0.235].forEach((y) => {
        const ring = k.at(k.torus(stripe, armR * 0.93, 0.019), s * 0.013, y, -0.004, Math.PI / 2, 0, 0);
        ring.scale.z = 1.5;
        rig[`arm${side}`].add(ring);
      });
      const legRing = k.at(k.torus(stripe, legR * 0.93, 0.02), s * 0.014, -0.13, -0.004, Math.PI / 2, 0, 0);
      legRing.scale.z = 1.5;
      rig[`leg${side}`].add(legRing);
    });

    // long striped tail: a chain of short capsules in a lazy S, sprung at every other joint, dark at the tip
    const SEG = 0.17;
    const bends = [0, 10, 20, 25, 20, 10, -30];
    const tail = rig.joint('tail', k.at(k.group(), 0.04, 0.1, -0.29, -0.15, 0.2, -Math.PI / 2 - 0.09));
    torso.add(tail);
    let parent = tail;
    bends.forEach((bend, i) => {
      let seg = parent;
      if (i > 0) {
        seg = k.at(k.group(), 0, SEG, 0, 0, 0, (bend * Math.PI) / 180);
        parent.add(seg);
        if (i % 2 === 0) {
          rig.spring(seg, { axis: 'z', gain: 0.1, sway: 0.05 + i * 0.022, speed: 2.1, phase: -i * 0.5, k: 60, d: 6 });
          rig.spring(seg, { axis: 'x', gain: 0.06, yawGain: 0.03, sway: 0.03, speed: 1.3, phase: i * 0.6, k: 60, d: 6 });
        }
      }
      const r = 0.072 - i * 0.0024;
      const tip = i === bends.length - 1;
      seg.add(k.at(k.cap(tip ? stripe : fur, r, SEG + 2 * r), 0, SEG / 2, 0));
      if (!tip && i > 0) {
        const ring = k.at(k.torus(stripe, r * 0.97, 0.021), 0, SEG * 0.5, 0, Math.PI / 2, 0, 0);
        ring.scale.z = 1.5;
        seg.add(ring);
      }
      parent = seg;
    });

    return rig;
  },

  idle(P, t) {
    // proud, chest-out stance
    P.torsoX += -0.075;
    P.headX += 0.06;
    P.armLZ += 0.13;
    P.armRZ -= 0.13;
    P.armLX += 0.14;
    P.armRX += 0.14;
    P.hipsY += Math.sin(t * 2.1) * 0.006;

    // tail: slow sweep with a sharp flick now and then
    const flick = Math.pow(Math.max(0, Math.sin(t * 1.3)), 10);
    P.tailY += Math.sin(t * 1.7) * 0.14 + flick * 0.3;
    P.tailZ += flick * 0.28;

    // playful claw-swipe with the right paw
    const cyc = t % SWIPE_PERIOD;
    if (cyc < SWIPE_DUR) {
      const u = cyc / SWIPE_DUR;
      P.armRZ += keys(u, [[0, 0], [0.3, -1.55], [0.38, -1.55], [0.52, 0.42], [0.68, 0.36], [1, 0]], ease.inOutCubic);
      P.armRX += keys(u, [[0, 0], [0.3, -0.35], [0.38, -0.35], [0.52, -1.5], [0.68, -1.4], [1, 0]], ease.inOutCubic);
      P.torsoY += keys(u, [[0, 0], [0.3, -0.26], [0.38, -0.28], [0.52, 0.3], [0.68, 0.26], [1, 0]], ease.inOutCubic);
      P.torsoX += keys(u, [[0, 0], [0.3, -0.05], [0.52, 0.14], [0.68, 0.12], [1, 0]]);
      P.headY += keys(u, [[0, 0], [0.3, 0.12], [0.52, -0.1], [1, 0]]);
      P.sq += keys(u, [[0, 0], [0.3, 0.04], [0.52, -0.06], [0.7, 0.02], [1, 0]]);
      P.tailZ += keys(u, [[0, 0], [0.4, 0.3], [0.6, -0.2], [1, 0]]);
    }
  },
};
