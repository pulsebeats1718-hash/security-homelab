/** Lexi Lightning — an original heroine in teal and magenta with a billowing cape. */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Soft 0 → 1 → 0 window over [a, b] with edges of width e. */
const win = (c, a, b, e = 0.5) => smooth(a, a + e, c) * (1 - smooth(b - e, b, c));

/** Seconds between hovers. */
const PERIOD = 7.5;

/** A thin shell hugging an ellipsoid: a spherical cap of half-angle `deg` centred on (yaw, pitch). */
function patch(k, mat, yaw, pitch, deg, radii, center, inflate = 1.016) {
  const g = k.group();
  g.position.copy(center);
  g.scale.set(radii[0] * inflate, radii[1] * inflate, radii[2] * inflate);
  const cap = k.dome(mat, 1, 1, 1, deg / 180, 32);
  cap.castShadow = false;
  const p = k.surface(radii, yaw, pitch).pos;
  cap.quaternion.setFromUnitVectors(new k.THREE.Vector3(0, 1, 0), new k.THREE.Vector3(p.x / radii[0], p.y / radii[1], p.z / radii[2]).normalize());
  g.add(cap);
  return g;
}

export default {
  id: 'superhero',
  name: 'Lexi Lightning',
  title: 'The Superhero',
  blurb: 'Fights crime and comma splices. Faster than a split infinitive.',
  accent: 0xffd23f,
  shot: 'bolt',

  build(k) {
    const teal = k.mat(0x17b8b3, { rough: 0.45 });
    const tealDeep = k.mat(0x0f7f8e, { rough: 0.5 });
    const magenta = k.mat(0xea3a92, { rough: 0.45 });
    const yellow = k.mat(0xffd23f, { rough: 0.4 });
    const skin = k.mat(0x9d6440);
    const hair = k.mat(0x2f2a66, { rough: 0.65 });

    const rig = k.biped({ skin, top: teal, bottom: tealDeep, shoe: magenta, hand: magenta, sleeve: teal, noArms: true });
    const { head, torso } = rig;
    const c = rig.headCenter;
    const R = rig.headRadii;

    // ── arms with a real elbow, so she can plant her fists on her hips ────
    const HALF = 0.215;
    const arms = k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      const upper = k.group();
      const fore = k.at(k.group(), 0, -HALF, 0);
      const sleeve = k.at(k.cap(teal, 0.105, 0.33), 0, -0.1, 0);
      const glove = k.ball(magenta, 0.128, 0.122, 0.128);
      upper.add(sleeve, fore);
      fore.add(k.ball(teal, 0.104), k.at(k.cyl(magenta, 0.142, 0.108, 0.13, 18), 0, -0.125, 0)); // elbow, gauntlet flare
      const hand = rig[`hand${side}`];
      fore.add(hand);
      hand.position.set(0, -HALF, 0);
      hand.add(glove);
      rig[`arm${side}`].add(upper);
      rig.m[`arm${side}`] = sleeve;
      rig.m[`hand${side}`] = glove;
      return { s, upper, fore };
    });

    // ── suit: lightning emblem, belt, boots ──────────────────────────────
    const bolt = () => {
      const g = k.group();
      const blade = k.at(k.cone(yellow, 0.066, 0.28, 20), -0.012, -0.082, 0, 0, 0, Math.PI - 0.48);
      blade.scale.z = 0.3;
      g.add(k.at(k.box(yellow, 0.1, 0.255, 0.04, 0.012), 0.022, 0.092, 0, 0, 0, -0.61), blade);
      return g;
    };
    torso.add(k.at(bolt(), 0, 0.335, 0.338, -0.17, 0, 0));
    const belt = k.at(k.torus(yellow, 0.388, 0.034), 0, 0.085, 0, Math.PI / 2, 0, 0);
    belt.scale.y = 0.87;
    torso.add(belt, k.at(k.box(yellow, 0.085, 0.085, 0.04, 0.015), 0, 0.085, 0.345, 0, 0, Math.PI / 4));
    k.both((s) => {
      const leg = rig[s > 0 ? 'legL' : 'legR'];
      leg.add(k.at(k.cyl(magenta, 0.152, 0.144, 0.15, 18), 0, -0.252, 0), k.at(k.torus(yellow, 0.15, 0.022), 0, -0.178, 0, Math.PI / 2, 0, 0));
    });

    // ── cape: four hinged panels that billow ─────────────────────────────
    const capeW = [0.5, 0.68, 0.82, 0.92, 0.98];
    const SEG = 0.2;
    const capeRest = [0.44, -0.08, -0.04, 0.06];
    const cape = [];
    let parent = torso;
    for (let i = 0; i < 4; i++) {
      const seg = i === 0 ? k.at(k.group(), 0, 0.57, -0.215, capeRest[0], 0, 0) : k.at(k.group(), 0, -SEG, 0, capeRest[i], 0, 0);
      const panel = k.at(k.cyl(magenta, capeW[i] / 2, capeW[i + 1] / 2, SEG + 0.045, 24), 0, -SEG / 2, 0);
      panel.scale.z = 0.09;
      seg.add(panel);
      parent.add(seg);
      parent = seg;
      rig.spring(seg, { axis: 'x', gain: 0.05 + i * 0.035, sway: 0.04 + i * 0.035, speed: 2.7, phase: -i * 0.85, k: 46, d: 5, max: 0.7 });
      cape.push(seg);
    }
    cape[1].add(k.at(bolt(), 0, -SEG * 0.9, -0.045, 0, Math.PI, 0)); // the same bolt on her back
    // jagged, lightning-cut hem
    for (let i = 0; i < 5; i++) {
      const tooth = k.at(k.cone(magenta, 0.108, 0.17, 16), (i - 2) * 0.196, -SEG - 0.075, 0, 0, 0, Math.PI);
      tooth.scale.z = 0.36;
      parent.add(tooth);
    }
    const yoke = k.at(k.torus(magenta, 0.27, 0.058), 0, 0.555, -0.02, Math.PI / 2, 0, 0);
    yoke.scale.y = 0.86;
    torso.add(yoke);
    k.both((s) => torso.add(k.at(k.ball(yellow, 0.052, 0.052, 0.03), s * 0.2, 0.535, 0.185, -0.5, s * 0.5, 0)));

    // ── hair: side-swept quiff with a lightning streak, high ponytail ────
    head.add(k.at(k.dome(hair, 0.592, 0.545, 0.556, 0.5), 0, c.y + 0.004, -0.018, -0.68, 0, 0));
    [[9, 46, 0.31, 0.125, 0.1, -0.2], [47, 31, 0.15, 0.095, 0.07, -1.0], [-36, 40, 0.19, 0.11, 0.08, 0.62]].forEach(([yaw, pitch, rx, ry, rz, turn]) => {
      const lock = k.onSphere(k.group(), yaw, pitch);
      lock.add(k.at(k.ball(hair, rx, ry, rz), 0, 0, 0, 0, 0, turn));
      head.add(lock);
    });
    // the streak: a little yellow bolt lying in the quiff (same shape as the chest emblem)
    const streak = k.onSphere(k.group(), 6, 48, 0.098);
    const spark = k.at(k.cone(yellow, 0.04, 0.17, 16), -0.008, -0.05, 0, 0, 0, Math.PI - 0.48);
    spark.scale.z = 0.4;
    streak.add(k.at(k.box(yellow, 0.062, 0.155, 0.03, 0.01), 0.014, 0.056, 0, 0, 0, -0.61), spark);
    streak.rotateZ(-0.5);
    head.add(streak);
    const pony = k.at(k.group(), 0, c.y + 0.42, -0.3, -0.6, 0, 0);
    pony.add(k.at(k.torus(magenta, 0.09, 0.04), 0, 0.03, 0, Math.PI / 2, 0, 0), k.lathe(hair, [[0, 0], [0.09, 0.03], [0.165, 0.16], [0.17, 0.3], [0.12, 0.4], [0, 0.44]]));
    const ponyTip = k.at(k.group(), 0, 0.34, 0, -1.5, 0, 0);
    ponyTip.add(k.lathe(hair, [[0, -0.07], [0.11, 0], [0.135, 0.12], [0.108, 0.25], [0.1, 0.27]]), k.lathe(yellow, [[0.108, 0.245], [0.085, 0.32], [0.035, 0.4], [0, 0.42]]));
    pony.add(ponyTip);
    head.add(pony);
    rig.spring(pony, { axis: 'x', gain: 0.09, sway: 0.035, speed: 2.3, k: 70, d: 6 });
    rig.spring(ponyTip, { axis: 'x', gain: 0.18, sway: 0.07, speed: 2.3, phase: -0.9, k: 50, d: 5 });
    rig.spring(ponyTip, { axis: 'z', gain: 0, yawGain: 0.05, sway: 0.06, speed: 1.7, k: 50, d: 5 });

    // ── domino mask and face ─────────────────────────────────────────────
    k.both((s) => {
      head.add(patch(k, magenta, s * 17, 4, 20, R, c));
      const flick = k.onSphere(k.group(), s * 35, 15, 0.006);
      const tip = k.at(k.cone(magenta, 0.07, 0.14, 16), 0, 0, 0, 0, 0, -s * 1.05);
      tip.scale.z = 0.14;
      flick.add(tip);
      head.add(flick);
    });
    k.face({
      eye: { yaw: 21.5, pitch: 3, size: 0.084, lift: 0.012 },
      brow: { color: 0x2f2a66, pitch: 27, thick: 0.017 },
      mouth: { pitch: -21, width: 0.1 },
      cheeks: { yaw: 38, pitch: -19, color: 0xe5636e, opacity: 0.42 },
    });

    rig.tickers.push((t, dt, r, anim) => {
      // elbows bend for the hands-on-hips stance and straighten whenever a clip or a flinch takes over
      const clip = anim?.clip;
      let bend = 1;
      if (clip) bend = 1 - Math.min(clamp01(clip.t / 0.07), clip.def.hold ? 1 : clamp01((clip.dur - clip.t) / 0.14));
      bend *= 1 - smooth(0.05, 0.4, anim?._worry ?? anim?.worry ?? 0);
      for (const a of arms) {
        a.upper.rotation.z = a.s * 0.883 * bend;
        a.fore.rotation.z = -a.s * 1.535 * bend;
      }
      // the cape may fly out but never swings through the body
      if (cape[0].rotation.x < 0.3) cape[0].rotation.x = 0.3;
      for (let i = 1; i < 4; i++) if (cape[i].rotation.x < capeRest[i] - 0.22) cape[i].rotation.x = capeRest[i] - 0.22;
    });

    return rig;
  },

  idle(P, t) {
    // heroic stance: chest out, chin up, feet planted
    P.torsoX += -0.07 + Math.sin(t * 1.05) * 0.012;
    P.headX += -0.05;
    P.legLZ += 0.1;
    P.legRZ -= 0.1;
    P.torsoY += Math.sin(t * 0.5) * 0.06;
    P.headY += Math.sin(t * 0.5 + 0.6) * 0.08;

    // every few seconds she lifts off for a little hover
    const h = win(t % PERIOD, 3.4, 6.3, 0.75);
    P.y += h * (0.2 + Math.sin(t * 2.4) * 0.03);
    P.legLX += h * 0.22;
    P.legRX += h * -0.4;
    P.legLZ -= h * 0.07;
    P.legRZ += h * 0.07;
    P.pitch += h * 0.04;
    P.headX += h * -0.06;
  },
};
