/** Wisp the ghost — a well-mannered bedsheet who floats about with a lantern. */
const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// every few seconds a playful "boo!": 0 → 1 → 0
const BOO_T = 6.5;
const boo = (t) => {
  const p = t % BOO_T;
  return smooth(0, 0.2, p) * (1 - smooth(0.8, 1.25, p));
};
const booState = new WeakMap();

// the sheet's upper dome (head-local) — the face sits on it
const DOME_C = [0, 0.4, 0];
const DOME_R = [0.6, 0.58, 0.6];

export default {
  id: 'ghost',
  name: 'Wisp',
  title: 'The Ghost',
  blurb: 'Scared of nothing except split infinitives.',
  accent: 0x9fd8ff,
  shot: 'orb',

  build(k) {
    const { THREE } = k;
    const sheet = k.mat(0xdde6ff, { rough: 0.5, rim: 0.95, rimPower: 2.1, emissive: 0x9fd8ff, emissiveIntensity: 0.05 });
    const ink = k.mat(0x262150, { rough: 0.25, rim: 0.15 });
    const bow = k.mat(0xef4f7d, { rough: 0.45 });
    const bowDark = k.mat(0xc23462, { rough: 0.5 });
    const brass = k.mat(0xf0b648, { metal: 0.55, rough: 0.32 });
    const flame = k.glow(0xffc24a, 2.2);

    // no legs, no torso, no head: one soft sheet hangs from the head joint, which sits at the sheet's waist
    const rig = k.biped({
      skin: sheet,
      top: sheet,
      sleeve: sheet,
      hand: sheet,
      noLegs: true,
      noTorso: true,
      noHead: true,
      legLen: 0.36,
      neckSink: 0.18,
      armLen: 0.32,
      armR: 0.105,
      handR: 0.118,
      shoulderW: 0.5,
      shoulderY: 0.58,
      armRest: 0.95,
    });
    const { head } = rig;

    // the sheet: concave underside → hem lip → gentle waist → big round dome
    const profile = [
      [0, -0.5], [0.3, -0.6], [0.58, -0.71], [0.68, -0.735], [0.715, -0.68], [0.66, -0.5], [0.588, -0.3],
      [0.537, -0.1], [0.538, 0.1], [0.585, 0.28], [0.6, 0.4], [0.58, 0.55], [0.52, 0.69], [0.424, 0.81],
      [0.3, 0.902], [0.155, 0.96], [0, 0.98],
    ];
    head.add(k.mesh(k.G.lathe(profile, 44, true, 72), sheet));

    // wavy hem: soft scallops all the way round (rippled by a ticker)
    const lobes = [];
    const N = 10;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const lobe = k.ball(sheet, 0.21, 0.11, 0.075, 20);
      lobe.rotation.order = 'YXZ';
      lobe.position.set(Math.sin(a) * 0.66, -0.75, Math.cos(a) * 0.66);
      lobe.rotation.y = a;
      head.add(lobe);
      lobes.push({ m: lobe, a });
    }

    // the floppy wisp on top
    const tip = k.at(k.group(), 0.02, 0.93, -0.03, -0.2, 0, 0.35);
    tip.add(k.lathe(sheet, [[0, -0.07], [0.12, -0.04], [0.125, 0.03], [0.09, 0.12], [0.045, 0.21], [0, 0.25]], 24));
    head.add(tip);
    rig.spring(tip, { axis: 'z', gain: 0.18, sway: 0.08, speed: 2.1, k: 60, d: 5 });

    k.face({
      radii: DOME_R,
      center: new THREE.Vector3(...DOME_C),
      eye: { yaw: 22, pitch: 6, size: 0.1, tall: 1.3, color: 0x262150 },
      brow: { color: 0x6a6fae, thick: 0.012 },
      mouth: { pitch: -15, width: 0.085, color: 0x5b2346 },
      cheeks: { color: 0xff8db3, opacity: 0.6, size: 0.085, yaw: 37, pitch: -6 },
      line: ink,
    });

    // tiny bow tie at the waist
    const tie = k.scale(k.at(k.group(), 0, -0.04, 0.537, -0.04, 0, 0), 1.15);
    k.both((s) => {
      const wing = k.at(k.cone(bow, 0.062, 0.12, 16), s * 0.068, 0, 0, 0, 0, (s * Math.PI) / 2);
      wing.scale.z = 0.42;
      tie.add(wing);
    });
    tie.add(k.ball(bowDark, 0.034, 0.03, 0.026));
    head.add(tie);

    // little lantern in the left hand, kept hanging upright by a ticker
    const lantern = k.group();
    const lamp = k.scale(k.at(k.group(), 0, 0.035, 0), 1.12);
    lantern.add(lamp);
    k.both((s) => lamp.add(k.at(k.cyl(brass, 0.009, 0.009, 0.12, 6), s * 0.043, -0.265, 0.043)));
    lamp.add(
      k.at(k.torus(brass, 0.065, 0.011, Math.PI), 0, -0.12, 0),
      k.at(k.cone(brass, 0.085, 0.07, 18), 0, -0.155, 0),
      k.at(k.cyl(brass, 0.078, 0.078, 0.022, 18), 0, -0.195, 0),
      k.at(k.cyl(flame, 0.06, 0.06, 0.12, 16), 0, -0.265, 0),
      k.at(k.cyl(brass, 0.072, 0.08, 0.035, 18), 0, -0.34, 0)
    );
    const glow = k.at(k.halo(0xffc46b, 0.55, 0.55), 0, -0.265, 0);
    lamp.add(glow);
    rig.handL.add(lantern);

    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    const qs = new THREE.Quaternion();
    const Z = new THREE.Vector3(0, 0, 1);
    rig.tickers.push((t) => {
      // hem ripple
      for (const l of lobes) {
        const w = Math.sin(t * 2.6 - l.a * 2);
        l.m.position.y = -0.75 + w * 0.02;
        l.m.rotation.x = -0.08 + w * 0.1;
        l.m.scale.y = 0.11 * (1 + w * 0.14);
      }
      // lantern hangs straight (relative to the body) and swings a little
      rig.handL.getWorldQuaternion(qa).invert();
      rig.pivot.getWorldQuaternion(qb);
      qs.setFromAxisAngle(Z, Math.sin(t * 2.1) * 0.1);
      lantern.quaternion.copy(qa).multiply(qb).multiply(qs);
      const f = 0.86 + 0.14 * Math.sin(t * 11.3) * Math.sin(t * 6.7 + 1);
      flame.emissiveIntensity = 2.2 * f;
      glow.material.opacity = 0.55 * f;
    });

    rig.metrics.headY = rig.metrics.hipY + head.position.y + DOME_C[1];
    rig.metrics.height = rig.metrics.headY + DOME_R[1];
    return rig;
  },

  constrain(P, rig, animator) {
    // the whole sheet hangs from the head joint: nods tip the body, so keep them gentle
    P.headX *= 0.55;
    P.headZ *= 0.8;
    // the dome is wide: little arms go up-and-out, never into it
    if (P.armLZ > 1.15) P.armLZ = 1.15;
    if (P.armRZ < -1.15) P.armRZ = -1.15;
    // always afloat, even mid-clip; knocked out it lies on its side with the hem on the ground
    const clip = animator?.clip;
    const ko = clip?.name === 'ko' ? smooth(0.25, 0.62, clip.t / clip.dur) : 0;
    const t = animator?.t ?? 0;
    const float = 0.13 + Math.sin(t * 1.5) * 0.05;
    P.y += float + (0.3 - float) * ko;
  },

  idle(P, t, rig, animator) {
    const b = boo(t);
    // drifting sheet: the whole body wobbles about its waist
    P.roll += Math.sin(t * 0.8) * 0.035;
    P.headZ += Math.sin(t * 1.25) * 0.05;
    P.headX += Math.sin(t * 1.6 + 0.5) * 0.03 - b * 0.05;
    // nubby arms paddle the air; the lantern arm stays out to the side
    P.armLZ += 0.16 + Math.sin(t * 2.3) * 0.07 + b * 0.9;
    P.armRZ -= Math.sin(t * 2.3 + 1.3) * 0.12 + b * 1.05;
    P.armLX += -0.3;
    P.armRX += Math.sin(t * 2.3 + 0.4) * 0.15 - b * 0.2;
    // boo! — swoop at the player, arms up
    P.z += b * 0.14;
    P.y += b * 0.08;
    P.sq += b * 0.07;
    P.pitch += b * 0.12;
    if (b > 0.05 && !animator?.clip && rig.face) {
      const cycle = Math.floor(t / BOO_T);
      if (booState.get(rig) !== cycle) {
        booState.set(rig, cycle);
        rig.face.set('surprised', 0.9);
      }
    }
  },
};
