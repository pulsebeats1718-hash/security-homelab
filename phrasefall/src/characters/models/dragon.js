/** Ember — a baby dragon who is still learning to aim. */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Soft 0 → 1 → 0 window over [a, b] with edges of width e. */
const win = (c, a, b, e = 0.5) => smooth(a, a + e, c) * (1 - smooth(b - e, b, c));
/** One hop: 0 → 1 → 0 between a and b. */
const hop = (c, a, b) => (c > a && c < b ? Math.sin(((c - a) / (b - a)) * Math.PI) : 0);

/** Idle routine: hop-hop … puff … big tail swish. */
const PERIOD = 7;
const PUFF = 3.1;
const EMBER_LIFE = 1.5;
const FIRE = 0xff9a2e;

export default {
  id: 'dragon',
  name: 'Ember',
  title: 'The Dragon',
  blurb: 'Small dragon, big vocabulary. Breathes fire only at double negatives.',
  accent: 0xff7a3c,
  shot: 'orb',

  build(k) {
    const { Vector3, Quaternion, Euler } = k.THREE;
    const coral = k.mat(0xf2614c);
    const coralDeep = k.mat(0xc9413a);
    const cream = k.mat(0xffe8c2, { rough: 0.7 });
    const creamLine = k.mat(0xeec58e, { rough: 0.7 });
    const amber = k.mat(0xffab3d, { rough: 0.5 });
    const ivory = k.mat(0xfff4dc, { rough: 0.35 });
    const dark = k.mat(0x8f2a2c, { rough: 0.5 });
    const emberMat = k.glow(FIRE, 2.4);

    const rig = k.biped({
      skin: coral,
      top: coral,
      bottom: coral,
      shoe: coral,
      hand: coral,
      sleeve: coral,
      legLen: 0.2,
      legR: 0.15,
      legGap: 0.2,
      foot: [0.19, 0.115, 0.25],
      torso: [1.06, 0.96, 0.9],
      armLen: 0.36,
      armR: 0.1,
      handR: 0.115,
      shoulderY: 0.46,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── head: snout, nostrils, fang, horns ───────────────────────────────
    const snoutC = new Vector3(0, c.y - 0.15, 0.4);
    const snoutR = [0.27, 0.19, 0.24];
    head.add(k.at(k.ball(coral, ...snoutR), snoutC.x, snoutC.y, snoutC.z));
    k.both((s) => {
      head.add(k.onSphere(k.ball(dark, 0.03, 0.024, 0.012), s * 24, 40, 0.002, snoutR, snoutC));
      const horn = k.at(k.group(), s * 0.27, c.y + 0.42, -0.03, -0.2, 0, -s * 0.4);
      const hornTip = k.at(k.group(), 0, 0.14, 0, -0.55, 0, -s * 0.15);
      hornTip.add(k.at(k.cone(ivory, 0.058, 0.2, 16), 0, 0.085, 0));
      horn.add(k.at(k.cyl(ivory, 0.057, 0.088, 0.17, 16), 0, 0.06, 0), hornTip);
      head.add(horn);
    });
    const fang = k.onSphere(k.group(), 13, -30, 0, snoutR, snoutC);
    fang.add(k.at(k.cone(ivory, 0.024, 0.055, 10), 0, -0.02, 0.012, 0, 0, Math.PI));
    head.add(fang);

    k.face({
      eye: { yaw: 24, pitch: 12, size: 0.1 },
      brow: { color: 0xa83230, thick: 0.02 },
      mouth: { center: snoutC, radii: snoutR, pitch: -33, width: 0.085, lift: 0.004 },
      cheeks: { yaw: 43, pitch: -4, color: 0xffa98a, opacity: 0.6 },
    });

    // ── soft triangular spikes down the head and spine ───────────────────
    const fin = (h, r) => {
      const g = k.group();
      const cone = k.at(k.cone(amber, r, h, 14), 0, 0, h * 0.4, Math.PI / 2, 0, 0);
      cone.scale.x = 0.5;
      g.add(cone);
      return g;
    };
    [[0, 76, 0.16, 0.09], [180, 68, 0.23, 0.125], [180, 36, 0.25, 0.135], [180, 6, 0.22, 0.125]].forEach(([yaw, pitch, h, r]) => head.add(k.onSphere(fin(h, r), yaw, pitch, -0.02)));
    torso.add(k.at(fin(0.22, 0.12), 0, 0.42, -0.31, Math.PI + 0.35, 0, 0));

    // ── cream belly with segment lines, clawed feet ──────────────────────
    const bellyC = [0.2, 0.275];
    const bellyR = [0.27, 0.3, 0.13];
    torso.add(k.at(k.ball(cream, ...bellyR), 0, bellyC[0], bellyC[1]));
    [0.09, 0.2, 0.31].forEach((y) => {
      const rr = bellyC[1] + bellyR[2] * Math.sqrt(1 - ((y - bellyC[0]) / bellyR[1]) ** 2) - 0.006;
      const arc = 1.0;
      torso.add(k.at(k.torus(creamLine, rr, 0.014, arc), 0, y, 0, Math.PI / 2, 0, Math.PI / 2 - arc / 2));
    });
    k.both((s) => {
      const leg = rig[s > 0 ? 'legL' : 'legR'];
      [-1, 0, 1].forEach((d) => leg.add(k.at(k.ball(ivory, 0.04, 0.036, 0.055), d * 0.095, -0.262, 0.3 - Math.abs(d) * 0.03)));
    });

    // ── little bat wings ─────────────────────────────────────────────────
    const wings = k.both((s) => {
      const root = k.at(k.group(), s * 0.16, 0.47, -0.27);
      root.scale.x = s; // mirror the right wing
      const wing = k.at(k.group(), 0, 0, 0, 0, 0.42, 0);
      // leading edge: shoulder → wrist → tip; the membrane hangs from it in three points
      const W = [0.3, 0.3];
      const T = [0.72, 0.1];
      wing.add(k.stroke(coralDeep, 0, 0, W[0], W[1], 0.045, true), k.stroke(coralDeep, W[0], W[1], T[0], T[1], 0.04, true));
      [[0.6, 0.17, 0.67, -0.22, 0.15], [0.39, 0.27, 0.43, -0.14, 0.165], [0.17, 0.17, 0.2, -0.13, 0.15]].forEach(([bx, by, tx, ty, r]) => {
        const len = Math.hypot(tx - bx, ty - by);
        const web = k.at(k.cone(amber, r, len, 16), (bx + tx) / 2, (by + ty) / 2, 0, 0, 0, Math.atan2(ty - by, tx - bx) - Math.PI / 2);
        web.scale.z = 0.12;
        wing.add(web);
      });
      wing.scale.setScalar(1.12);
      root.add(wing);
      torso.add(root);
      rig.spring(wing, { axis: 'z', gain: 0.12, k: 60, d: 6, max: 0.6 });
      return wing;
    });

    // ── thick tail curling round to one side, with a spade tip ───────────
    const tail = rig.joint('tail', k.at(k.group(), 0, 0.02, -0.3, -Math.PI / 2 - 0.2, 0, -0.92));
    const tailB = k.at(k.group(), 0, 0.36, 0, 0, 0, -0.95);
    const tailC = k.at(k.group(), 0, 0.34, 0, 1.25, 0, -0.3);
    tail.add(k.at(k.cyl(coral, 0.14, 0.2, 0.36, 20), 0, 0.18, 0), k.at(fin(0.16, 0.09), 0, 0.2, 0.15), tailB);
    tailB.add(k.ball(coral, 0.14), k.at(k.cyl(coral, 0.1, 0.14, 0.34, 18), 0, 0.17, 0), tailC);
    tailC.add(k.ball(coral, 0.1), k.at(k.cyl(coral, 0.06, 0.1, 0.26, 16), 0, 0.13, 0));
    torso.add(tail);
    const spade = k.at(k.group(), 0, 0.25, 0);
    const point = k.at(k.cone(amber, 0.15, 0.24, 20), 0, 0.14, 0);
    point.scale.z = 0.3;
    spade.add(point);
    k.both((s) => spade.add(k.at(k.ball(amber, 0.085, 0.075, 0.045), s * 0.07, 0.035, 0)));
    tailC.add(spade);
    // keep the spade upright and facing the front, whatever the curl of the tail
    rig.root.updateMatrixWorld(true);
    spade.quaternion.copy(tailC.getWorldQuaternion(new Quaternion())).invert().multiply(new Quaternion().setFromEuler(new Euler(0, 0.3, -0.25)));
    rig.spring(tailB, { axis: 'z', gain: 0, yawGain: 0.08, sway: 0.07, speed: 2.6, phase: -0.8, k: 50, d: 5 });
    rig.spring(tailC, { axis: 'x', gain: 0.14, sway: 0.08, speed: 2.6, phase: -1.6, k: 44, d: 4 });

    // ── the ember he puffs out now and then ──────────────────────────────
    const nozzle = k.at(k.group(), 0, snoutC.y + 0.02, snoutC.z + snoutR[2] + 0.02);
    head.add(nozzle);
    rig.props.muzzle = nozzle;
    const ember = k.ball(emberMat, 0.055);
    ember.castShadow = false;
    const emberHalo = k.halo(FIRE, 0.5, 0);
    const spark = k.ball(emberMat, 0.024);
    spark.castShadow = false;
    nozzle.add(ember, emberHalo, spark);

    rig.props.flutter = 0;
    rig.tickers.push((t, dt, r, anim) => {
      // wings: a steady little flutter, harder while hopping
      const f = r.props.flutter;
      const beat = Math.sin(t * 13) * (0.1 + 0.2 * f) + Math.sin(t * 2.1) * 0.07;
      for (const w of wings) {
        w.rotation.z += beat + 0.12 * f;
        w.rotation.y = 0.42 + Math.cos(t * 13) * (0.05 + 0.1 * f);
      }

      // ember: pops out of the snout, wobbles upward, shrinks and fades
      const cyc = t % PERIOD;
      const u = (cyc - PUFF) / EMBER_LIFE;
      const idle = !anim?.clip;
      if (u > 0 && u < 1 && idle) {
        const size = Math.min(1, u / 0.08) * Math.pow(1 - u, 0.6);
        ember.position.set(Math.sin(u * 9) * 0.022, u * 0.5 + u * u * 0.3, 0.04 + u * 0.3);
        ember.scale.setScalar(0.055 * (0.45 + 0.75 * size));
        emberMat.emissiveIntensity = 1.2 + 1.8 * size;
        emberHalo.position.copy(ember.position);
        emberHalo.material.opacity = 0.75 * size;
        emberHalo.scale.setScalar(0.3 + 0.3 * size);
        const v = clamp01(u * 1.6);
        spark.position.set(-0.07 - v * 0.08, v * 0.3 - v * v * 0.12, 0.05 + v * 0.14);
        spark.scale.setScalar(0.024 * (1 - v));
      } else {
        ember.scale.setScalar(0.0001);
        spark.scale.setScalar(0.0001);
        emberHalo.material.opacity = 0;
      }
      // a round little mouth for the puff itself
      const face = r.face;
      if (face && idle && cyc > PUFF - 0.05 && cyc < PUFF + 0.4 && face.current === 'neutral' && face.holdT <= 0 && (anim?.worry ?? 0) < 0.3) face.set('surprised', PUFF + 0.45 - cyc);
    });

    return rig;
  },

  idle(P, t, rig) {
    const c = t % PERIOD;

    // tail swishes all the time, with a big happy sweep late in the loop
    const sweep = win(c, 4.9, 6.6, 0.5);
    P.tailZ += Math.sin(t * 2.6) * (0.16 + 0.3 * sweep);
    P.tailX += Math.sin(t * 1.3) * 0.05 + 0.1 * sweep;
    P.headZ += Math.sin(t * 2.6 + 0.5) * 0.05 * sweep;

    // a happy little double bounce
    const h = hop(c, 0.45, 0.8) + hop(c, 0.9, 1.25);
    const squat = hop(c, 0.25, 0.47) + hop(c, 0.78, 0.92) * 0.6 + hop(c, 1.24, 1.42) * 0.8;
    P.y += h * 0.11;
    P.sq += h * 0.07 - squat * 0.09;
    P.armLZ += h * 0.5;
    P.armRZ -= h * 0.5;
    P.legLZ += h * 0.12;
    P.legRZ -= h * 0.12;
    P.headX += -0.07 * h;
    rig.props.flutter = Math.max(win(c, 0.3, 1.5, 0.2), 0.35 * sweep);

    // the puff: breathe in, lean back … and a tiny ember pops out
    const inhale = win(c, PUFF - 0.75, PUFF + 0.02, 0.3);
    const kick = c > PUFF && c < PUFF + 0.5 ? Math.exp(-(c - PUFF) * 7) : 0;
    P.headX += -0.16 * inhale + 0.2 * kick;
    P.torsoX += -0.06 * inhale + 0.07 * kick;
    P.sq += 0.05 * inhale - 0.08 * kick;
    P.armLZ += 0.25 * inhale;
    P.armRZ -= 0.25 * inhale;

    // otherwise: a contented wiggle
    P.torsoZ += Math.sin(t * 2.6) * 0.02;
    P.hipsY += Math.abs(Math.sin(t * 1.3)) * 0.01;
  },
};
