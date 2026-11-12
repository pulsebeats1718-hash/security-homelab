/** Clover the bunny — a lop-eared whirlwind in a mint hoodie. */
import * as THREE from 'three';
import { keys } from '../../core/utils.js';

const X = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const u = clamp01((v - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** Soft 0 → 1 → 0 window over [a, b] with edges of width e. */
const win = (c, a, b, e = 0.3) => smooth(a, a + e, c) * (1 - smooth(b - e, b, c));

/** A thin rod between two points (drawstrings). */
function rod(k, mat, a, b, r) {
  _d.subVectors(b, a);
  const m = k.cap(mat, r, _d.length() + 2 * r, 8);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, _d.normalize());
  return m;
}

/** Idle cycle: nose twitch … left ear perks up and flops … twitch … a little hop … right ear. */
const PERIOD = 6;
const HOP_A = 3.5;
const HOP_B = 3.92;
const flopAt = (c, a) => keys(c, [[a, 0], [a + 0.22, 1], [a + 0.55, 1], [a + 0.75, -0.18], [a + 0.9, 0.08], [a + 1.05, 0]]);
const twitchAt = (c) => Math.max(win(c, 0, 0.7, 0.12), win(c, 2.45, 3.05, 0.12), win(c, 5.0, 5.45, 0.1));

export default {
  id: 'bunny',
  name: 'Clover',
  title: 'The Bunny',
  blurb: 'Hops between topics faster than anyone can follow.',
  accent: 0xffb3c7,
  shot: 'orb',

  build(k) {
    const fur = k.mat(0xfbf3e6, { rough: 0.72 });
    const pink = k.mat(0xffa3bd, { rough: 0.6 });
    const nosePink = k.mat(0xff7fa6, { rough: 0.3 });
    const mint = k.mat(0x97e3c4, { rough: 0.78 });
    const mintDark = k.mat(0x6ccaa6, { rough: 0.78 });
    const tooth = k.mat(0xfffdf8, { rough: 0.3 });
    const dark = k.mat(0x4a2434, { rough: 0.5, rim: 0.05 });
    const blush = k.mat(0xff8fae, { rough: 0.9, rim: 0, transparent: true, opacity: 0.5, depthWrite: false });

    const TS = [1.04, 0.98, 0.9];
    const H = [0.58, 0.52, 0.54];
    const rig = k.biped({
      skin: fur,
      top: mint,
      bottom: fur,
      shoe: fur,
      hand: fur,
      sleeve: mint,
      torso: TS,
      head: H,
      legGap: 0.18,
      foot: [0.15, 0.1, 0.28],
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── long lop ears: the root folds over the crown, the flap hangs beside the head ──
    const ears = [];
    k.both((s) => {
      const crown = new THREE.Vector3(s * 0.22, c.y + 0.47, -0.14);
      const fold = new THREE.Vector3(s * 0.65, c.y + 0.15, -0.24);
      const dir = new THREE.Vector3().subVectors(fold, crown);
      const len = dir.length();
      dir.normalize();
      if (s < 0) dir.negate();
      const base = k.ball(fur, len * 0.55, 0.1, 0.15);
      base.position.copy(crown).add(fold).multiplyScalar(0.5);
      base.quaternion.setFromUnitVectors(X, dir);
      head.add(base);

      const flap = k.at(k.group(), fold.x, fold.y, fold.z, 0, s * 0.35, s * 0.06);
      flap.add(k.at(k.ball(fur, 0.13, 0.48, 0.07), 0, -0.42, 0), k.at(k.ball(pink, 0.092, 0.38, 0.035), 0, -0.45, 0.045));
      head.add(flap);
      rig.spring(flap, { axis: 'z', gain: s * 0.09, sway: 0.035, speed: 1.6, phase: s, k: 55, d: 5, max: 0.5 });
      rig.spring(flap, { axis: 'x', gain: 0.05, sway: 0.03, speed: 1.3, phase: s * 2, k: 45, d: 5, max: 0.3 });
      ears.push({ s, flap, rz: flap.rotation.z, rx: flap.rotation.x });
    });

    // ── chubby cheeks, soft muzzle, pink nose ────────────────────────────
    const cheekR = [0.19, 0.15, 0.15];
    k.both((s) => {
      const cc = new THREE.Vector3(s * 0.24, c.y - 0.16, 0.355);
      head.add(k.at(k.ball(fur, ...cheekR), cc.x, cc.y, cc.z));
      const b = k.mesh(k.G.sphere(14), blush, false);
      b.scale.set(0.075, 0.046, 0.012);
      head.add(k.onSphere(b, s * 35, 10, 0.003, cheekR, cc));
    });
    const muzzleC = new THREE.Vector3(0, c.y - 0.17, 0.4);
    const muzzleR = [0.17, 0.13, 0.16];
    head.add(k.at(k.ball(fur, ...muzzleR), muzzleC.x, muzzleC.y, muzzleC.z));
    const noseY = c.y - 0.095;
    const nose = k.at(k.ball(nosePink, 0.05, 0.035, 0.038), 0, noseY, 0.545);
    head.add(nose);
    const philtrum = k.stroke(dark, 0, c.y - 0.125, 0, c.y - 0.198, 0.0065);
    philtrum.position.z = 0.559;
    head.add(philtrum);

    const MW = 0.068;
    k.face({
      eye: { yaw: 22, pitch: 6, size: 0.086, tall: 1.3 },
      brow: { color: 0xb07a86 },
      mouth: { center: muzzleC, radii: muzzleR, pitch: -20, width: MW, lift: 0.004 },
      cheeks: false,
    });

    // two little front teeth that follow the mouth shape
    const teeth = k.group(k.at(k.box(dark, 0.058, 0.04, 0.008, 0.008), 0, -0.0175, -0.003));
    k.both((s) => teeth.add(k.at(k.box(tooth, 0.024, 0.032, 0.012, 0.006), s * 0.0128, -0.016, 0.002)));
    const mouth = rig.face.mouth;
    mouth.root.add(teeth);

    // ── tail: a round cotton puff ────────────────────────────────────────
    const tail = rig.joint('tail', k.at(k.group(), 0, 0.06, -0.335));
    tail.add(k.at(k.ball(fur, 0.12), 0, 0, -0.04));
    [[0.075, 0.04], [-0.075, 0.04], [0.06, -0.06], [-0.06, -0.06], [0, 0.085]].forEach(([x, y]) => tail.add(k.at(k.ball(fur, 0.065), x, y, -0.07)));
    torso.add(tail);

    // ── mint hoodie: waistband, cuffs, kangaroo pocket with a clover, hood down, drawstrings ──
    const band = k.at(k.torus(mintDark, 0.35, 0.05), 0, 0.035, 0, Math.PI / 2, 0, 0);
    band.scale.set(1.046, 0.943, 1);
    torso.add(band);
    k.both((s) => {
      const arm = rig[s > 0 ? 'armL' : 'armR'];
      arm.add(k.at(k.torus(mintDark, 0.105, 0.035), 0, -0.315, 0, Math.PI / 2, 0, 0));
    });
    torso.add(k.onTorso(k.ball(mintDark, 0.2, 0.095, 0.05), 0, 0.17, -0.018));
    const clover = k.onTorso(k.group(), 0, 0.185, 0.036);
    [[0, 0.026], [-0.024, -0.01], [0.024, -0.01]].forEach(([x, y]) => clover.add(k.at(k.ball(fur, 0.026, 0.026, 0.01), x, y, 0)));
    clover.add(k.at(k.cap(fur, 0.006, 0.045), 0.008, -0.036, 0, 0, 0, 0.35));
    torso.add(clover);

    const collar = k.at(k.torus(mint, 0.25, 0.07), 0, 0.585, -0.01, Math.PI / 2 + 0.22, 0, 0);
    collar.scale.set(1.08, 1.12, 1);
    const hood = k.at(k.group(), 0, 0.42, -0.32, 0.36, 0, 0);
    hood.add(k.ball(mint, 0.28, 0.22, 0.12), k.at(k.ball(pink, 0.2, 0.1, 0.05), 0, 0.07, -0.095));
    torso.add(collar, hood);
    k.both((s) => {
      const a = new THREE.Vector3(s * 0.07, 0.52, 0.29);
      const b = new THREE.Vector3(s * 0.078, 0.37, 0.36);
      torso.add(rod(k, fur, a, b, 0.012), k.at(k.cap(pink, 0.019, 0.055), b.x, b.y - 0.022, b.z + 0.004, 0.25, 0, 0));
    });

    // ── tickers: nose twitches, ear perks, ears kept clear of the head, teeth follow the mouth ──
    rig.tickers.push((t, dt, r, anim) => {
      const cc = t % PERIOD;
      const idle = !anim?.clip;

      const tw = idle ? twitchAt(cc) : 0;
      const n = Math.sin(t * 34) * (0.15 + 0.85 * tw);
      nose.scale.set(0.05 * (1 - 0.07 * n), 0.035 * (1 + 0.16 * n), 0.038);
      nose.position.y = noseY + 0.006 * n;

      for (const e of ears) {
        const f = idle ? flopAt(cc, e.s > 0 ? 1.0 : 4.6) : 0;
        const z = e.flap.rotation.z + e.s * 0.55 * f;
        e.flap.rotation.z = e.s > 0 ? Math.max(z, e.rz - 0.08) : Math.min(z, e.rz + 0.08);
        e.flap.rotation.x = Math.max(e.flap.rotation.x, e.rx - 0.2);
      }

      const sh = mouth.shapes;
      if (sh.open.visible) {
        teeth.visible = true;
        teeth.position.set(0, MW * 0.3 - 0.006, 0.006);
      } else if (sh.smile.visible) {
        teeth.visible = true;
        teeth.position.set(0, -MW * 0.38 - 0.002, 0);
      } else if (sh.flat.visible || sh.frown.visible) {
        teeth.visible = true;
        teeth.position.set(0, -0.004, 0);
      } else {
        teeth.visible = false;
      }
    });

    return rig;
  },

  idle(P, t) {
    const c = t % PERIOD;

    // paws held a little forward, bunny-fashion
    P.armLX += -0.12;
    P.armRX += -0.12;

    // a little hop: crouch, spring, tuck the feet, land with a squash
    const hu = clamp01((c - HOP_A) / (HOP_B - HOP_A));
    const air = c > HOP_A && c < HOP_B ? 4 * hu * (1 - hu) : 0;
    P.y += 0.14 * air;
    P.sq += keys(c, [[3.2, 0], [3.45, -0.13], [3.56, 0.1], [3.8, 0.02], [3.95, -0.12], [4.12, 0.04], [4.3, 0]]);
    P.legLX += 0.3 * air;
    P.legRX += 0.3 * air;
    P.armLZ += 0.35 * air;
    P.armRZ -= 0.35 * air;
    P.headX += keys(c, [[3.35, 0], [3.48, 0.06], [3.7, -0.08], [3.97, 0.07], [4.25, 0]]);

    // an ear perks up (ticker) with a curious head tilt
    P.headZ += 0.08 * Math.max(0, flopAt(c, 1.0)) - 0.08 * Math.max(0, flopAt(c, 4.6));

    // a quick tail wiggle and a light bounce in the knees
    P.tailY += Math.sin(t * 16) * 0.3 * win(c, 2.3, 3.0, 0.15);
    P.hipsY += Math.abs(Math.sin(t * 2.2)) * 0.008;
  },

  constrain(P) {
    // the wide head and long ears would swallow paws raised straight up: keep raised arms
    // out to the sides and a touch forward, in front of the ears, so cheers stay readable
    P.armLZ = Math.min(P.armLZ, 2.05);
    P.armRZ = Math.max(P.armRZ, -2.05);
    P.armLX = Math.max(P.armLX, 0.18 * smooth(1.2, 1.9, P.armLZ));
    P.armRX = Math.max(P.armRX, 0.18 * smooth(1.2, 1.9, -P.armRZ));
  },
};
