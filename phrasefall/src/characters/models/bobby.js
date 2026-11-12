/** Constable Cobb — a kindly British bobby: tall custodian helmet, a whistle on a chain and a warm moustache. */
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

// idle: rock on the heels, then a flourish — alternately a tip of the helmet and a little whistle
const PERIOD = 7;
const flourishOf = (t) => Math.floor(t / PERIOD) % 2; // 0 = tip, 1 = whistle
const tipW = (t) => {
  const f = t % PERIOD;
  return flourishOf(t) === 0 ? step(3.8, 4.15, f) * (1 - step(5.1, 5.5, f)) : 0;
};
const whistleW = (t) => {
  const f = t % PERIOD;
  return flourishOf(t) === 1 ? step(3.8, 4.0, f) * (1 - step(5.5, 5.8, f)) : 0;
};

export default {
  id: 'bobby',
  name: 'Constable Cobb',
  title: 'The Bobby',
  blurb: '"Evening all." Always ready to help you find your way — or the right phrasal verb.',
  accent: 0x3a7bd5,
  shot: 'orb',

  build(k) {
    const navy = k.mat(0x24336e, { rough: 0.6, rim: 0.18 });
    const silver = k.metal(0xdfe6f0, 0.25);
    const white = k.mat(0xf3f1ea, { rough: 0.7 });
    const dark = k.mat(0x25232b, { rough: 0.3, rim: 0.2 });
    const skin = k.mat(0xe2a985);
    const hair = k.mat(0x8a4a2b, { rough: 0.8 });
    const blue = k.mat(0x3a7bd5, { rough: 0.35 });

    // a comfortably round constable
    const rig = k.biped({ skin, top: navy, bottom: navy, shoe: dark, hand: skin, sleeve: navy, torso: [1.08, 0.98, 0.9] });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── tunic: black belt + silver buckle, silver buttons, boots
    const belt = k.at(k.torus(dark, 0.43, 0.045), 0, 0.186, 0, Math.PI / 2, 0, 0);
    belt.scale.set(1.017, 0.917, 1.6);
    torso.add(belt, k.at(k.box(silver, 0.15, 0.12, 0.05, 0.025), 0, 0.186, 0.42));
    [0.465, 0.375, 0.285, 0.085].forEach((y) => torso.add(k.onTorso(k.ball(silver, 0.033, 0.033, 0.02), 0, y, 0.004)));
    k.both((s) => (s > 0 ? rig.legL : rig.legR).add(k.at(k.cyl(dark, 0.142, 0.15, 0.13, 20), 0, -0.25, 0)));

    // whistle on a chain from the top button, dangling on the chest
    const whistle = k.at(k.group(), 0, 0.465, 0.36);
    const chain = k.stroke(silver, 0, 0, 0.085, -0.105, 0.009);
    chain.rotation.x = -0.3;
    whistle.add(
      chain,
      k.at(k.cyl(silver, 0.03, 0.03, 0.1, 16), 0.1, -0.17, 0.05, 0, 0, 0.15),
      k.at(k.box(silver, 0.034, 0.05, 0.022, 0.008), 0.11, -0.235, 0.04, 0, 0, 0.15)
    );
    torso.add(whistle);
    rig.props.whistle = whistle;
    rig.spring(whistle, { axis: 'z', gain: 0.05, sway: 0.04, speed: 2.2, max: 0.15 });

    // black-and-white chequered duty band on the left sleeve
    const band = k.at(k.group(), 0, -0.2, 0);
    band.add(k.cyl(white, 0.113, 0.113, 0.1, 24));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      band.add(k.at(k.box(dark, 0.088, 0.05, 0.016, 0.006), Math.sin(a) * 0.116, i % 2 ? 0.025 : -0.025, Math.cos(a) * 0.116, 0, a, 0));
    }
    rig.armL.add(band);

    // ── face: kind eyes, rosy cheeks, a warm chestnut moustache, short hair at the nape
    k.face({
      eye: { yaw: 21, pitch: 2, size: 0.082, tall: 1.25, tilt: -0.1 },
      brow: { color: 0x7a3f22, thick: 0.018, width: 0.07 },
      mouth: { pitch: -25, width: 0.08 },
      cheeks: { yaw: 38, pitch: -10, size: 0.085, color: 0xff8a7a, opacity: 0.6 },
    });
    k.both((s) => {
      const lobe = k.onSphere(k.ball(hair, 0.108, 0.052, 0.06), s * 9, -13, 0.022);
      lobe.rotateZ(s * -0.32);
      head.add(lobe);
    });
    head.add(k.onSphere(k.ball(hair, 0.06, 0.05, 0.05), 0, -11.5, 0.025));
    head.add(k.at(k.dome(hair, 0.585, 0.535, 0.545, 0.38, 32), 0, c.y, -0.005, -1.823, 0, 0));

    // ── custodian helmet: a cap tilted to sit just above the brows, a tall rounded crown with a comb
    // and silver top, front and back peaks, an original star badge and a leather chin strap
    const helmet = k.at(k.group(), 0, c.y, 0);
    head.add(helmet);
    rig.props.hat = helmet;
    helmet.add(k.at(k.dome(navy, 0.6, 0.56, 0.585, 0.5, 36), 0, 0, -0.01, -0.55, 0, 0));
    const roll = k.at(k.torus(navy, 0.592, 0.04), 0, 0, -0.01, Math.PI / 2 - 0.55, 0, 0);
    roll.scale.set(0.6 / 0.592, 0.585 / 0.592, 1);
    helmet.add(roll);
    const crown = k.at(k.group(), 0, 0.2, -0.04, -0.06, 0, 0);
    const shell = k.lathe(navy, [[0.48, 0], [0.555, 0.1], [0.565, 0.3], [0.52, 0.5], [0.41, 0.68], [0.23, 0.82], [0, 0.87]], 36);
    shell.scale.z = 1.03;
    crown.add(
      shell,
      k.at(k.torus(navy, 0.565, 0.036, 1.222), 0, 0.3326, 0, 0, Math.PI / 2, 0.96),
      k.at(k.ball(silver, 0.06), 0, 0.915, 0),
      k.at(k.star(silver, 0.088, 0.055, 7, 0.022), 0, 0.22, 0.59),
      k.at(k.ball(blue, 0.032, 0.032, 0.012), 0, 0.22, 0.608)
    );
    helmet.add(crown);
    helmet.add(k.at(k.ball(navy, 0.28, 0.022, 0.22), 0, 0.3, 0.45, 0.15, 0, 0));
    helmet.add(k.at(k.ball(navy, 0.26, 0.02, 0.16), 0, -0.31, -0.45, -0.35, 0, 0));
    helmet.add(k.at(k.torus(dark, 0.59, 0.016, Math.PI - 0.14), 0, 0.5 - c.y, -0.02, -0.804, 0, Math.PI + 0.07));
    k.both((s) => helmet.add(k.at(k.ball(silver, 0.04, 0.04, 0.03), s * 0.59, 0.02, 0.024, 0, s * 1.4, 0)));
    rig.spring(helmet, { axis: 'x', gain: 0.03, k: 120, d: 10 });

    // idle flourishes: the helmet lifts and tips towards the raised hand; a whistle purses the lips
    const restY = helmet.position.y;
    let lastTip = -1;
    let whistling = false;
    rig.tickers.push((t, dt, r, animator) => {
      const w = calm(animator);
      const a = tipW(t) * w;
      helmet.position.y = restY + 0.05 * a;
      helmet.rotation.z = -0.14 * a;
      helmet.rotation.x += -0.08 * a;
      const cycle = Math.floor(t / PERIOD);
      if (a > 0.5 && cycle !== lastTip && r.face) {
        lastTip = cycle;
        r.face.set('happy', 1.0);
      }
      const face = r.face;
      if (!face) return;
      if (whistleW(t) * w > 0.5) {
        whistling = true;
        for (const [key, m] of Object.entries(face.mouth.shapes)) m.visible = key === 'o';
        for (const e of face.eyes) {
          e.shapes.open.visible = false;
          e.shapes.happy.visible = true;
        }
      } else if (whistling) {
        whistling = false;
        face.apply(face.current);
      }
    });

    return rig;
  },

  idle(P, t) {
    const f = t % PERIOD;
    const tip = tipW(t);
    const wh = whistleW(t);
    const busy = Math.max(tip, wh);
    // hands clasped behind the back
    P.armLX += 0.6;
    P.armLZ += -0.2;
    P.armRX += 0.6 + (0.35 - 0.6) * tip;
    P.armRZ += 0.2 + (-2.05 - 0.2) * tip;
    // rocking up on the toes and back onto the heels
    const rock = Math.sin(t * Math.PI) * (1 - busy);
    P.pitch += 0.045 * rock;
    P.y += 0.02 * Math.max(0, rock);
    P.headX += -0.025 * rock;
    // tip of the helmet: lean into the raised hand, friendly nod
    P.headZ += 0.13 * tip;
    P.headX += 0.1 * step(4.2, 4.4, f) * (1 - step(4.55, 4.8, f)) * tip;
    P.torsoZ += 0.04 * tip;
    // a little whistle: chin up, jaunty head bob
    const beat = Math.sin((f - 3.8) * 7);
    P.headZ += 0.07 * beat * wh;
    P.headX += -0.06 * wh;
    P.hipsY += 0.012 * Math.abs(beat) * wh;
  },
};
