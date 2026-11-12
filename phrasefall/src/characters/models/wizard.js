/** Merriweather — a kindly wizard with a floppy hat and a glowing staff. */
import * as THREE from 'three';

const _q = new THREE.Quaternion();
const _id = new THREE.Quaternion();

export default {
  id: 'wizard',
  name: 'Merriweather',
  title: 'The Wizard',
  blurb: 'Turns awkward silences into sparkling small talk with a flick of his staff.',
  accent: 0x8f7bff,
  shot: 'orb',

  build(k) {
    const robe = k.mat(0x6a4bd8, { rough: 0.7 });
    const robeDark = k.mat(0x4a31ab, { rough: 0.7 });
    const gold = k.mat(0xffce4a, { metal: 0.55, rough: 0.32 });
    const skin = k.mat(0xf2c8a5);
    const white = k.mat(0xfbfaf5, { rough: 0.85 });
    const wood = k.mat(0x8b5a3a, { rough: 0.8 });
    const boot = k.mat(0x35264f);
    const orbMat = k.glow(0x7df4ff, 2.4);

    const rig = k.biped({ skin, top: robe, bottom: robeDark, shoe: boot, hand: skin, sleeve: robe, legLen: 0.22, legGap: 0.17 });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // robe skirt, hem, belt
    const skirt = k.lathe(robe, [[0.5, -0.305], [0.52, -0.27], [0.47, -0.1], [0.41, 0.1], [0.38, 0.22]], 32);
    skirt.scale.z = 0.9;
    const hem = k.at(k.torus(gold, 0.505, 0.03), 0, -0.285, 0, Math.PI / 2, 0, 0);
    hem.scale.y = 0.9;
    const belt = k.at(k.torus(gold, 0.395, 0.04), 0, 0.2, 0, Math.PI / 2, 0, 0);
    belt.scale.y = 0.87;
    torso.add(skirt, hem, belt, k.at(k.star(gold, 0.085), 0, 0.2, 0.37));
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      rig[`arm${side}`].add(k.at(k.cyl(robe, 0.1, 0.185, 0.3, 20), 0, -0.24, 0), k.at(k.torus(gold, 0.18, 0.022), 0, -0.385, 0, Math.PI / 2, 0, 0));
    });

    // beard, moustache, nose, hair
    head.add(k.at(k.ball(white, 0.36, 0.3, 0.2), 0, c.y - 0.3, 0.3));
    const beardTip = k.at(k.cone(white, 0.26, 0.5, 24), 0, c.y - 0.6, 0.3, Math.PI, 0, 0);
    beardTip.scale.z = 0.6;
    head.add(beardTip);
    k.both((s) => {
      head.add(k.at(k.ball(white, 0.17, 0.075, 0.09), s * 0.13, c.y - 0.13, 0.5, 0, 0, s * -0.32));
      head.add(k.at(k.ball(white, 0.16, 0.24, 0.2), s * 0.47, c.y - 0.12, 0.1));
    });
    head.add(k.at(k.ball(k.mat(0xf0a58f), 0.075, 0.07, 0.07), 0, c.y - 0.05, 0.535));
    head.add(k.at(k.dome(white, 0.585, 0.53, 0.55, 0.62), 0, c.y, -0.03, -1.15, 0, 0));

    k.face({
      eye: { yaw: 22, pitch: 6, size: 0.078 },
      brow: { color: 0xfbfaf5, thick: 0.034, width: 0.1, lift: 0.012 },
      mouth: { pitch: -30, width: 0.07, lift: 0.105, color: 0x6a2534 },
      cheeks: { yaw: 37, pitch: -3 },
    });

    // floppy hat
    const hat = k.at(k.group(), 0, c.y + 0.32, -0.03, -0.2, 0, 0.06);
    const brim = k.ball(robeDark, 0.78, 0.05, 0.78, 36);
    const cone = k.at(k.cyl(robe, 0.22, 0.47, 0.5, 28), 0, 0.26, 0);
    const band = k.at(k.torus(gold, 0.455, 0.042), 0, 0.07, 0, Math.PI / 2, 0, 0);
    const tip = k.at(k.group(), 0, 0.5, 0, 0, 0, 0.55);
    tip.add(k.at(k.cone(robe, 0.222, 0.56, 28), 0, 0.27, 0), k.at(k.ball(gold, 0.06), 0, 0.56, 0));
    hat.add(brim, cone, band, tip, k.ball(robe, 0.222).translateY(0.5));
    [[30, 0.2, 0.07], [-55, 0.34, 0.055], [140, 0.26, 0.06], [-150, 0.16, 0.05]].forEach(([yawDeg, y, size]) => {
      const a = (yawDeg * Math.PI) / 180;
      const r = 0.47 - (y / 0.5) * 0.25 + 0.012;
      const star = k.star(gold, size, size * 0.45, 5, 0.02);
      star.position.set(Math.sin(a) * r, y + 0.01, Math.cos(a) * r);
      star.rotation.set(-0.45, a, 0, 'YXZ');
      hat.add(star);
    });
    head.add(hat);
    rig.spring(tip, { axis: 'z', gain: 0.22, sway: 0.06, speed: 1.6, k: 40, d: 4 });
    rig.spring(hat, { axis: 'x', gain: 0.05, k: 120, d: 10 });

    // staff with a glowing orb
    const staff = k.group();
    const orb = k.at(k.ball(orbMat, 0.115), 0, 0.98, 0);
    const halo = k.at(k.halo(0x7df4ff, 0.75, 0.6), 0, 0.98, 0);
    staff.add(k.at(k.cyl(wood, 0.036, 0.045, 1.5, 12), 0, 0.14, 0), orb, halo, k.at(k.torus(gold, 0.06, 0.022), 0, 0.86, 0, Math.PI / 2, 0, 0));
    [0, 1, 2].forEach((i) => {
      const a = (i / 3) * Math.PI * 2;
      const claw = k.at(k.cone(gold, 0.028, 0.2, 8), Math.sin(a) * 0.1, 0.94, Math.cos(a) * 0.1);
      claw.rotation.set(Math.cos(a) * -0.5, 0, Math.sin(a) * 0.5);
      staff.add(claw);
    });
    rig.handR.add(staff);
    rig.props.staff = staff;
    rig.props.sparkle = orb;
    rig.props.muzzle = orb;

    let follow = 0;
    rig.tickers.push((t, dt, r, anim) => {
      // keep the staff upright while idling; let it swing with the arm when casting
      const casting = anim?.clip && (anim.clip.name === 'attack' || anim.clip.name === 'ko' || anim.clip.name === 'hit');
      follow += ((casting ? 1 : 0) - follow) * Math.min(1, dt * 14);
      _q.copy(r.armR.quaternion).invert();
      staff.quaternion.copy(_q).slerp(_id, follow * 0.75);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
      orbMat.emissiveIntensity = 1.9 + pulse * 1.2;
      halo.material.opacity = 0.45 + pulse * 0.3;
      halo.scale.setScalar(0.68 + pulse * 0.16);
    });

    return rig;
  },

  constrain(P) {
    // keep feet inside the robe
    P.legLX *= 0.25;
    P.legRX *= 0.25;
  },

  idle(P, t) {
    // staff held out front, the free hand gesturing as if mid-spell
    P.armRX += -0.5 + Math.sin(t * 1.3) * 0.04;
    P.armRZ += -0.72;
    P.armLX += -0.35 + Math.sin(t * 1.9) * 0.12;
    P.armLZ += 0.25 + Math.sin(t * 1.9 + 1) * 0.1;
    P.torsoY += -0.1;
    P.headY += 0.08;
    P.hipsY += Math.sin(t * 1.3) * 0.008;
  },
};
