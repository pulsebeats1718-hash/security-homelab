/** Corporal Crumpet — a Royal Guard under a towering bearskin who breaks his stillness only to march on the spot. */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const step = (a, b, x) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** 1 while idling, 0 while an action clip (or a fright) has taken over. */
const calm = (animator) => {
  const c = animator?.clip;
  let w = 1;
  if (c) w = 1 - Math.min(clamp01(c.t / 0.07), c.def.hold ? 1 : clamp01((c.dur - c.t) / 0.14));
  return w * (1 - clamp01((animator?._worry ?? 0) * 2.5));
};

// idle timeline (seconds within one loop)
const PERIOD = 8.2;
const MARCH0 = 3.2; // four crisp steps on the spot
const STEP = 0.56;
const MARCH1 = MARCH0 + 4 * STEP;
const GLANCE0 = 6.4; // one sneaky sideways glance

export default {
  id: 'guard',
  name: 'Corporal Crumpet',
  title: 'The Royal Guard',
  blurb: 'Stands perfectly still for hours. Has never once lost his composure — or his hat.',
  accent: 0xe8323c,
  shot: 'star',

  build(k) {
    const scarlet = k.mat(0xd8283a, { rough: 0.6 });
    const fur = k.mat(0x26222f, { rough: 0.95, rim: 0.45 });
    const navy = k.mat(0x252b54, { rough: 0.6, rim: 0.14 });
    const gold = k.mat(0xffc93f, { metal: 0.55, rough: 0.32 });
    const white = k.mat(0xf6f3ec, { rough: 0.7 });
    const boot = k.mat(0x27242f, { rough: 0.22, rim: 0.25 });
    const skin = k.mat(0xf4c8a6);

    const rig = k.biped({ skin, top: scarlet, bottom: navy, shoe: boot, hand: white, sleeve: scarlet, legLen: 0.38, legR: 0.12, foot: [0.15, 0.1, 0.24], noLegs: true });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── legs with real knees (for proper high-knee marching): navy trousers, red stripe, glossy boots
    const knees = [];
    k.both((s) => {
      const leg = s > 0 ? rig.legL : rig.legR;
      leg.add(k.at(k.cap(navy, 0.12, 0.42), 0, -0.11, 0), k.at(k.cap(scarlet, 0.021, 0.27), s * 0.106, -0.125, 0));
      const knee = k.at(k.group(), 0, -0.2, 0);
      knee.add(
        k.at(k.cap(navy, 0.118, 0.27), 0, -0.015, 0),
        k.at(k.cyl(boot, 0.134, 0.138, 0.2, 22), 0, -0.145, 0),
        k.at(k.ball(boot, 0.15, 0.1, 0.24), 0, -0.215, 0.077)
      );
      leg.add(knee);
      knees.push([leg, knee]);
    });

    // ── scarlet tunic: white belt + gold buckle, a column of gold buttons, navy collar, shoulder straps, cuffs
    const belt = k.at(k.torus(white, 0.4, 0.045), 0, 0.2, 0, Math.PI / 2, 0, 0);
    belt.scale.set(1.01, 0.875, 1.6);
    torso.add(belt, k.at(k.box(gold, 0.17, 0.13, 0.05, 0.025), 0, 0.2, 0.372));
    [0.47, 0.385, 0.3, 0.085].forEach((y) => torso.add(k.onTorso(k.ball(gold, 0.032, 0.032, 0.02), 0, y, 0.004)));
    const collar = k.at(k.torus(navy, 0.235, 0.055), 0, 0.575, 0, Math.PI / 2, 0, 0);
    collar.scale.set(1, 0.92, 1.3);
    torso.add(collar);
    k.both((s) => {
      const arm = s > 0 ? rig.armL : rig.armR;
      arm.add(k.at(k.ball(navy, 0.135, 0.05, 0.135), 0, 0.075, 0, 0, 0, s * -0.12), k.at(k.cyl(navy, 0.113, 0.12, 0.09, 20), 0, -0.33, 0));
    });

    k.face({
      eye: { yaw: 21, pitch: 0, size: 0.08, tall: 1.3 },
      brow: { color: 0x4a3226, thick: 0.017, width: 0.068 },
      mouth: { pitch: -19, width: 0.085 },
      cheeks: { yaw: 37, pitch: -12, color: 0xff8a8a, opacity: 0.6 },
    });

    // ── the bearskin: a fur cap tilted back so it sits just above the brows, a tall fur core and
    // overlapping tufts for the fluffy outline (all centred on the head so it can wobble in place)
    const hat = k.at(k.group(), 0, c.y, 0);
    head.add(hat);
    rig.props.hat = hat;
    hat.add(k.at(k.dome(fur, 0.61, 0.57, 0.58, 0.5, 36), 0, 0, -0.01, -0.52, 0, 0));
    // soft rolled edge along the (tilted) rim of the cap
    const roll = k.at(k.torus(fur, 0.595, 0.042), 0, 0, -0.01, Math.PI / 2 - 0.52, 0, 0);
    roll.scale.set(0.61 / 0.595, 0.58 / 0.595, 1);
    hat.add(roll);
    const coreR = [0.6, 0.64, 0.56];
    const coreC = new k.THREE.Vector3(0, 0.623, -0.02);
    hat.add(k.at(k.ball(fur, ...coreR, 36), coreC.x, coreC.y, coreC.z));
    const tufts = [
      [0, 58, 0.19], [120, 58, 0.19], [240, 58, 0.19],
      [36, 26, 0.21], [108, 26, 0.21], [180, 26, 0.21], [252, 26, 0.21], [324, 26, 0.21],
      [0, -4, 0.22], [60, -4, 0.22], [120, -4, 0.22], [180, -4, 0.22], [240, -4, 0.22], [300, -4, 0.22],
      [70, -34, 0.2], [140, -34, 0.2], [220, -34, 0.2], [290, -34, 0.2],
    ];
    for (const [yaw, pitch, r] of tufts) {
      const { pos, normal } = k.surface(coreR, yaw, pitch, coreC);
      pos.addScaledVector(normal, 0.075 - r);
      hat.add(k.at(k.ball(fur, r, r, r, 20), pos.x, pos.y, pos.z));
    }
    // fur hangs down over the back of the head to the collar
    hat.add(k.at(k.ball(fur, 0.21, 0.21, 0.21, 20), 0, -0.25, -0.46), k.at(k.ball(fur, 0.19, 0.19, 0.19, 20), 0.27, -0.2, -0.42), k.at(k.ball(fur, 0.19, 0.19, 0.19, 20), -0.27, -0.2, -0.42));
    // thin gold chin strap: a tilted arc from under the gold bosses, along the jaw and beneath the chin
    hat.add(k.at(k.torus(gold, 0.59, 0.014, Math.PI - 0.14), 0, 0.5 - c.y, -0.02, -0.804, 0, Math.PI + 0.07));
    k.both((s) => hat.add(k.at(k.ball(gold, 0.04, 0.04, 0.03), s * 0.59, 0.02, 0.024, 0, s * 1.4, 0)));
    rig.spring(hat, { axis: 'x', gain: 0.03, k: 130, d: 10 });

    // knees bend as the thigh lifts, so the shin stays upright (a proper high-knee step)
    rig.tickers.push((t, dt, r, animator) => {
      const w = 0.35 + 0.65 * calm(animator);
      for (const [leg, knee] of knees) knee.rotation.x = Math.min(1.5, Math.max(0, -leg.rotation.x)) * w;
    });

    return rig;
  },

  idle(P, t, rig, animator) {
    const f = t % PERIOD;
    // rigid attention: the usual sway is mostly suppressed, chin up, chest out, arms pinned to the seams
    P.headZ *= 0.3;
    P.headX *= 0.3;
    P.roll *= 0.3;
    P.armLX *= 0.3;
    P.armRX *= 0.3;
    // eyes front: cancel most of the shared idle glancing (his one glance is a deliberate, sneaky one)
    P.headY -= (animator?._glance ?? 0) * 0.85 * (1 - (animator?._gazeUp ?? 0));
    P.headX += -0.05;
    P.torsoX += -0.03;
    P.armLZ += -0.07;
    P.armRZ += 0.07;

    // march on the spot: four steps, high knees, crisp opposite-arm swings
    const i = Math.floor((f - MARCH0) / STEP);
    if (i >= 0 && i < 4) {
      const u = (f - MARCH0 - i * STEP) / STEP;
      const lift = step(0, 0.3, u) * (1 - step(0.6, 0.94, u));
      const left = i % 2 === 0;
      P[left ? 'legLX' : 'legRX'] += -1.15 * lift;
      P[left ? 'armRX' : 'armLX'] += -0.85 * lift;
      P[left ? 'armLX' : 'armRX'] += 0.35 * lift;
      P.y += 0.018 * lift;
      P.sq += -0.03 * step(0.88, 0.94, u) * (1 - step(0.94, 1, u));
    }
    const m = step(MARCH0 - 0.2, MARCH0, f) * (1 - step(MARCH1, MARCH1 + 0.2, f));
    P.headX += 0.03 * m;

    // a sneaky sideways glance … and straight back to attention
    const g = step(GLANCE0, GLANCE0 + 0.12, f) * (1 - step(GLANCE0 + 0.85, GLANCE0 + 0.97, f));
    P.headY += 0.48 * g;
    P.headZ += -0.04 * g;
    P.torsoY += 0.04 * g;
  },
};
