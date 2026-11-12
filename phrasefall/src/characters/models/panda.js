/** Bao the panda — a chubby, unhurried bamboo connoisseur. */
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _arm = new THREE.Vector3();
const _hand = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _dir = new THREE.Vector3();

const smooth = (a, b, v) => {
  const u = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/** Idle cycle: raise the bamboo, munch, lower it, sway contentedly. */
const PERIOD = 8;
const munchAt = (t) => {
  const c = t % PERIOD;
  return smooth(0.2, 0.85, c) * (1 - smooth(3.5, 4.1, c));
};

export default {
  id: 'panda',
  name: 'Bao',
  title: 'The Panda',
  blurb: 'Calm as a cucumber, and twice as fond of bamboo.',
  accent: 0x8fd14f,
  shot: 'orb',

  build(k) {
    const white = k.mat(0xf8f3ea, { rough: 0.7 });
    const ink = k.mat(0x2e3148);
    const nose = k.mat(0x1d1e2c, { rough: 0.22 });
    const iris = k.mat(0x9c6130, { rough: 0.28, rim: 0.2 });
    const light = k.mat(0xfff6e6, { rough: 0.5, rim: 0.1 });
    const kerchief = k.mat(0x8fd14f, { rough: 0.75 });
    const kerchiefDark = k.mat(0x6cb53c, { rough: 0.75 });
    const cane = k.mat(0xb9d65c, { rough: 0.5 });
    const node = k.mat(0x6f9f35, { rough: 0.55 });
    const leaf = k.mat(0x46a64b, { rough: 0.6 });

    const TS = [1.12, 1, 0.9];
    const rig = k.biped({
      skin: white,
      top: white,
      bottom: ink,
      shoe: ink,
      hand: ink,
      sleeve: ink,
      torso: TS,
      head: [0.6, 0.53, 0.54],
      legR: 0.145,
      legGap: 0.2,
      armR: 0.118,
      handR: 0.135,
      foot: [0.17, 0.11, 0.24],
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // the dark shoulder band that joins the arms across the chest and back
    const band = k.lathe(ink, [[0.35, 0.305], [0.403, 0.338], [0.399, 0.385], [0.331, 0.51], [0.224, 0.62], [0.1, 0.677], [0, 0.69]]);
    band.scale.set(TS[0], TS[1], TS[0] * TS[2]);
    torso.add(band);

    // round ears
    k.both((s) => {
      const ear = k.at(k.group(), s * 0.37, c.y + 0.37, -0.03, 0, 0, -s * 0.55);
      ear.add(k.at(k.ball(ink, 0.175, 0.17, 0.1), 0, 0.085, 0));
      head.add(ear);
      rig.spring(ear, { axis: 'x', gain: 0.07, sway: 0.025, speed: 1.5, phase: s });
    });

    // tilted eye patches
    k.both((s) => {
      const patch = k.onSphere(k.ball(ink, 0.132, 0.178, 0.04), s * 23.5, 0.5, 0);
      patch.rotateZ(s * 0.5);
      head.add(patch);
    });

    // short muzzle and nose
    const muzzleC = new THREE.Vector3(0, c.y - 0.16, 0.415);
    const muzzleR = [0.2, 0.145, 0.175];
    head.add(k.at(k.ball(white, ...muzzleR), muzzleC.x, muzzleC.y, muzzleC.z));
    head.add(k.at(k.ball(nose, 0.062, 0.044, 0.042), 0, c.y - 0.095, 0.583));

    const E = { yaw: 21.5, pitch: 4, size: 0.074, tall: 1.2, lift: 0.03 };
    k.face({
      eye: E,
      brow: { color: 0x2e3148, pitch: 27.5, yaw: 17.5, width: 0.044, thick: 0.016 },
      mouth: { center: muzzleC, radii: muzzleR, pitch: -42, width: 0.07, lift: 0.004 },
      cheeks: { yaw: 44, pitch: -15, color: 0xff9aa8, size: 0.07 },
    });
    // dark eyes on dark patches: a warm iris ring behind each pupil, and pale expression strokes
    for (const eye of rig.face.eyes) {
      const ring = k.mesh(k.G.sphere(20), iris, false);
      ring.scale.set(E.size * 1.25, E.size * E.tall * 1.21, E.size * 0.3);
      eye.shapes.open.add(ring);
      eye.shapes.happy.material = light;
      for (const m of [...eye.shapes.hurt.children, ...eye.shapes.ko.children]) m.material = light;
    }

    // tiny tail
    const tail = rig.joint('tail', k.at(k.group(), 0, 0.06, -0.345));
    tail.add(k.at(k.ball(white, 0.1, 0.095, 0.09), 0, 0.01, -0.04));
    torso.add(tail);

    // leaf-green neckerchief: ring, a triangle on the chest, a knot with two tails at the back
    const ring = k.at(k.torus(kerchief, 0.27, 0.078), 0, 0.553, 0.015, Math.PI / 2 + 0.1, 0, 0);
    ring.scale.set(1.1, 1, 0.82);
    const bib = k.at(k.cone(kerchief, 0.21, 0.23, 24), 0, 0.402, 0.372, Math.PI - 0.6, 0, 0);
    bib.scale.z = 0.22;
    const knot = k.at(k.group(), 0, 0.535, -0.3);
    knot.add(k.ball(kerchiefDark, 0.075, 0.06, 0.06));
    k.both((s) => {
      const end = k.at(k.cone(kerchief, 0.07, 0.2, 16), s * 0.07, -0.1, -0.015, Math.PI + 0.25, 0, s * 0.45);
      end.scale.z = 0.4;
      knot.add(end);
    });
    torso.add(ring, bib, knot);
    rig.spring(knot, { axis: 'x', gain: 0.1, sway: 0.04, speed: 2 });

    // bamboo stalk in the left paw
    const stalk = k.group();
    stalk.add(k.at(k.cyl(cane, 0.05, 0.053, 0.84, 16), 0, 0.2, 0));
    stalk.add(k.at(k.ball(cane, 0.05, 0.024, 0.05), 0, 0.62, 0), k.at(k.ball(node, 0.053, 0.024, 0.053), 0, -0.22, 0));
    [-0.05, 0.2, 0.44].forEach((y) => stalk.add(k.at(k.torus(node, 0.052, 0.016), 0, y, 0, Math.PI / 2, 0, 0)));
    [[0.2, -1.05, 0.15, 0.16], [0.2, -0.5, -0.6, 0.13], [0.44, -0.8, 0.5, 0.125]].forEach(([y, rz, ry, len], i) => {
      const sprig = k.at(k.group(), 0.04, y, 0, 0, ry, rz);
      const blade = k.at(k.ball(leaf, 0.046, len, 0.014), 0, len + 0.02, 0);
      sprig.add(blade, k.at(k.cyl(node, 0.009, 0.012, 0.07, 6), 0, 0.02, 0));
      stalk.add(sprig);
      rig.spring(sprig, { axis: 'z', gain: 0.14, sway: 0.05, speed: 2.3, phase: i * 1.7, k: 60, d: 6 });
    });
    rig.handL.add(stalk);
    rig.props.bamboo = stalk;

    // Keep the stalk upright while carried, aim it at the mouth while munching, and let it
    // follow the paw like a banner when the arm is raised (cheer, wave, ko).
    const restDir = new THREE.Vector3(0.2, 0.97, 0.1).normalize();
    const mouthLocal = new THREE.Vector3(0.04, c.y - 0.28, 0.61);
    const armLen = rig.metrics.armLen;
    let m = 0;
    rig.tickers.push((t, dt, r, anim) => {
      const target = anim?.clip ? 0 : munchAt(t);
      m += (target - m) * Math.min(1, dt * 14);
      const arm = r.armL;
      _arm.set(0, -1, 0).applyQuaternion(arm.quaternion);
      _hand.copy(_arm).multiplyScalar(armLen - 0.01).add(arm.position);
      _aim.copy(mouthLocal).applyQuaternion(r.head.quaternion).add(r.head.position).sub(_hand).normalize();
      const nibble = Math.sin(t * 13) * 0.05 * m;
      _dir.copy(restDir).lerp(_aim, m);
      _dir.y += nibble;
      _dir.lerp(_arm, smooth(-0.25, 0.45, _arm.y) * 0.88).normalize();
      _q.setFromUnitVectors(UP, _dir);
      stalk.quaternion.copy(arm.quaternion).invert().multiply(_q);
    });

    return rig;
  },

  idle(P, t) {
    const c = t % PERIOD;
    const m = munchAt(t);

    // carry the bamboo out to the side; bring it up to the mouth to munch
    P.armLX += -0.55 + (-1.08 + 0.55) * m;
    P.armLZ += 0.38 + (-0.5 - 0.38) * m;
    const chew = Math.sin(t * 13);
    P.headX += m * (0.1 + chew * 0.045);
    P.headY += m * 0.1;
    P.headZ += m * -0.05;
    P.torsoX += m * 0.04;
    P.sq += m * chew * 0.006;

    // …then a slow, contented sway
    const sway = smooth(4.0, 4.9, c) * (1 - smooth(7.0, 7.9, c));
    const s = Math.sin(t * 2.0);
    P.roll += s * 0.05 * sway;
    P.headZ += Math.sin(t * 2.0 - 0.6) * 0.085 * sway;
    P.armRZ -= (0.12 + s * 0.1) * sway;
    P.armRX += -0.1 * sway;
    P.tailZ += Math.sin(t * 4) * 0.25 * sway;

    // heavy, sleepy breathing
    P.hipsY += Math.sin(t * 1.4) * 0.008;
    P.tailX += Math.sin(t * 1.4) * 0.1;
  },
};
