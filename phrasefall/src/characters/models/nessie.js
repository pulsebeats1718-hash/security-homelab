/** Nessie, the Loch Legend — shy, sweet, and only seen by the most devoted of learners. */
import * as THREE from 'three';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const u = clamp01((v - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** Soft 0 → 1 → 0 window over [a, b] with edges of width e. */
const win = (c, a, b, e = 0.3) => smooth(a, a + e, c) * (1 - smooth(b - e, b, c));
/** 1 while idling, 0 while an action clip (or a fright) has taken over. */
const calm = (animator) => {
  const c = animator?.clip;
  let w = 1;
  if (c) w = 1 - Math.min(clamp01(c.t / 0.07), c.def.hold ? 1 : clamp01((c.dur - c.t) / 0.14));
  return w * (1 - clamp01((animator?._worry ?? 0) * 2.5));
};

// idle loop: a long, swaying neck … ducks down shyly … pops back up tall, beaming, and blows a few bubbles
const PERIOD = 8.5;
const DUCK = [2.4, 4.2];
const RISE = [4.0, 5.6];
const BUBBLES = 4.5;
const duckAt = (c) => win(c, DUCK[0], DUCK[1], 0.5);
const riseAt = (c) => win(c, RISE[0], RISE[1], 0.35);

export default {
  id: 'nessie',
  name: 'Nessie',
  title: 'The Loch Legend',
  blurb: 'Spotted once in a blue moon — or after a whole year of practice.',
  accent: 0x3fd4a6,
  shot: 'orb',

  build(k) {
    const teal = k.mat(0x2fb59a, { rough: 0.5 });
    const tealDeep = k.mat(0x1f8a7a, { rough: 0.55 });
    const mint = k.mat(0xaee9d0, { rough: 0.7 });
    const nose = k.mat(0x175a52, { rough: 0.3 });
    const navy = k.mat(0x283466, { rough: 0.88, rim: 0.3 });
    const red = k.mat(0xd8343f, { rough: 0.8, rim: 0.25 });
    const green = k.mat(0x1d5b44, { rough: 0.8 });
    const cream = k.mat(0xfff3dc, { rough: 0.85 });
    const purple = k.mat(0xa46ad8, { rough: 0.8, rim: 0.35 });
    const bubble = k.glass(0xc8f2ff, 0.32);

    const TS = [1.2, 0.92, 1.0];
    const H = [0.52, 0.46, 0.5];
    const rig = k.biped({
      skin: teal,
      top: teal,
      bottom: teal,
      shoe: teal,
      hand: teal,
      sleeve: teal,
      torso: TS,
      head: H,
      legLen: 0.12,
      legGap: 0.24,
      foot: [0.18, 0.06, 0.24],
      noArms: true,
      noLegs: true,
      armLen: 0.36,
      shoulderW: 0.37,
      shoulderY: 0.42,
      armRest: 0.5,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── the long neck: two segments that sway; the head rides on top ──
    const N1 = [0.14, 0.1];
    const N2 = [-0.3, -0.2];
    const n1 = k.at(k.group(), 0, 0.46, 0.05, N1[0], 0, N1[1]);
    torso.add(n1);
    n1.add(k.at(k.cap(teal, 0.2, 0.44), 0, 0.16, 0));
    n1.add(k.at(k.ball(mint, 0.12, 0.2, 0.09), 0, 0.18, 0.13, -0.05, 0, 0));
    const n2 = k.at(k.group(), 0, 0.3, 0, N2[0], 0, N2[1]);
    n1.add(n2);
    n2.add(k.at(k.cap(teal, 0.18, 0.42), 0, 0.16, 0), k.at(k.ball(teal, 0.19), 0, 0.0, 0));
    n2.add(k.at(k.ball(mint, 0.1, 0.19, 0.08), 0, 0.15, 0.11));
    torso.remove(head);
    n2.add(head);
    head.position.set(0, 0.28, 0.0);
    head.rotation.set(0.16, 0, 0.1);
    rig.props.neck = [n1, n2];

    // ── plump body: minty belly, darker dapples, soft humps down the back ──
    torso.add(k.at(k.ball(mint, 0.29, 0.29, 0.14), 0, 0.18, 0.355));
    [[62, 0.32, 0.055], [80, 0.14, 0.045], [-58, 0.36, 0.05], [-82, 0.18, 0.06], [150, 0.4, 0.05], [-140, 0.2, 0.055]].forEach(([yaw, y, r]) => {
      const spot = k.onTorso(k.ball(tealDeep, r, r * 0.8, 0.02), yaw, y, 0.0);
      spot.castShadow = false;
      torso.add(spot);
    });
    const hump = (r, h) => k.ball(tealDeep, r * 0.55, h, r);
    torso.add(k.at(hump(0.21, 0.2), 0, 0.5, -0.27, -0.55, 0, 0));
    torso.add(k.at(hump(0.18, 0.17), 0, 0.27, -0.4, -1.05, 0, 0));
    torso.add(k.at(hump(0.14, 0.13), 0, 0.05, -0.44, -1.45, 0, 0));
    n1.add(k.at(hump(0.11, 0.1), 0, 0.2, -0.17, -0.15, 0, 0));
    n2.add(k.at(hump(0.095, 0.085), 0, 0.17, -0.15, -0.1, 0, 0));

    // ── flippers: front ones on the arm joints, broad hind ones resting on the ground ──
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      const arm = rig[`arm${side}`];
      const fl = k.at(k.ball(teal, 0.06, 0.2, 0.13), s * 0.01, -0.16, 0.02, 0.15, 0, 0);
      arm.add(fl, k.at(k.ball(tealDeep, 0.045, 0.08, 0.1), s * 0.012, -0.32, 0.03, 0.15, 0, 0));
      rig.m[`arm${side}`] = fl;
      const leg = rig[`leg${side}`];
      const footY = -(rig.metrics.hipY + 0.05);
      leg.add(k.at(k.cap(teal, 0.11, 0.2), 0, -0.07, 0));
      const flip = k.at(k.group(), s * 0.04, footY + 0.045, 0.08, 0, s * 0.35, 0);
      flip.add(k.ball(teal, 0.15, 0.05, 0.22), k.at(k.ball(tealDeep, 0.12, 0.035, 0.07), 0, 0.012, 0.17));
      leg.add(flip);
      rig.m[`foot${side}`] = flip;
    });

    // ── a tail curling round on the ground, with a little fin ──
    const tail = rig.joint('tail', k.at(k.group(), 0, -0.02, -0.36, -1.25, 0.0, 0.0));
    torso.add(tail);
    const t1 = k.at(k.group(), 0, 0, 0);
    t1.add(k.at(k.cap(teal, 0.15, 0.36), 0, 0.12, 0));
    const t2 = k.at(k.group(), 0, 0.26, 0, -0.15, 0, 0.75);
    t2.add(k.at(k.cap(teal, 0.1, 0.3), 0, 0.11, 0));
    const t3 = k.at(k.group(), 0, 0.22, 0, 0, 0, 0.8);
    t3.add(k.at(k.cap(teal, 0.065, 0.22), 0, 0.08, 0));
    const fin = k.at(k.ball(tealDeep, 0.1, 0.09, 0.025), 0, 0.2, 0, 0, 0, Math.PI / 4);
    t3.add(fin);
    t2.add(t3);
    t1.add(t2);
    tail.add(t1);
    rig.spring(t2, { axis: 'z', gain: 0.05, yawGain: 0.04, sway: 0.08, speed: 1.6, phase: -0.6, k: 45, d: 5 });
    rig.spring(t3, { axis: 'z', gain: 0.08, yawGain: 0.05, sway: 0.1, speed: 1.6, phase: -1.2, k: 40, d: 4 });

    // ── head: a rounded snout with a wide smile, little fin ears ──
    const muzzleC = new THREE.Vector3(0, c.y - 0.12, 0.33);
    const muzzleR = [0.29, 0.19, 0.24];
    head.add(k.at(k.ball(teal, ...muzzleR), muzzleC.x, muzzleC.y, muzzleC.z));
    k.both((s) => head.add(k.onSphere(k.ball(nose, 0.022, 0.016, 0.01), s * 22, 38, 0.002, muzzleR, muzzleC)));
    k.face({
      eye: { yaw: 26, pitch: 13, size: 0.088, tall: 1.28 },
      brow: { color: 0x17695e, thick: 0.014, width: 0.06 },
      mouth: { center: muzzleC, radii: muzzleR, pitch: -16, width: 0.1, lift: 0.004 },
      cheeks: { yaw: 46, pitch: -4, color: 0xff8f9a, size: 0.07, opacity: 0.6 },
    });
    k.both((s) => {
      const ear = k.onSphere(k.group(), s * 78, 18, -0.02);
      const finEar = k.at(k.group(), 0, 0, 0);
      finEar.quaternion.copy(ear.quaternion).invert();
      finEar.rotateY(s * 0.9);
      finEar.rotateZ(-s * 0.5);
      finEar.add(k.at(k.ball(tealDeep, 0.03, 0.1, 0.13), 0, 0.02, -0.05));
      ear.add(finEar);
      head.add(ear);
      rig.spring(finEar, { axis: 'x', gain: 0.06, sway: 0.04, speed: 2, phase: s, k: 60, d: 5 });
    });
    const snout = k.at(new THREE.Object3D(), 0, muzzleC.y, muzzleC.z + muzzleR[2]);
    head.add(snout);
    rig.props.muzzle = snout;

    // ── tam o' shanter: a floppy navy bonnet, red band, red toorie on top ──
    const tam = k.at(k.group(), 0.02, c.y + 0.33, -0.03, -0.12, 0, 0.2);
    tam.add(k.at(k.torus(red, 0.36, 0.042), 0, 0, 0, Math.PI / 2, 0, 0));
    tam.add(k.at(k.ball(navy, 0.55, 0.14, 0.53), 0, 0.1, 0));
    // a little thistle brooch pinned to the band
    const thistle = k.at(k.group(), 0.25, 0.02, 0.25, 0.1, 0.8, -0.2);
    thistle.add(k.at(k.ball(green, 0.045, 0.05, 0.045), 0, -0.02, 0), k.at(k.ball(purple, 0.042, 0.05, 0.042), 0, 0.045, 0));
    k.both((s) => thistle.add(k.at(k.ball(green, 0.012, 0.045, 0.012), s * 0.04, -0.035, 0, 0, 0, s * 0.9)));
    tam.add(thistle);
    const toorie = k.at(k.group(), 0, 0.22, 0);
    toorie.add(k.ball(red, 0.085, 0.08, 0.085));
    tam.add(toorie);
    head.add(tam);
    rig.spring(tam, { axis: 'z', gain: 0.05, yawGain: 0.03, k: 90, d: 8 });
    rig.spring(toorie, { axis: 'x', gain: 0.22, sway: 0.05, speed: 2.4, k: 45, d: 4 });

    // ── red tartan scarf round the base of the neck ──
    const scarf = k.at(k.group(), 0, 0.6, 0.06, Math.PI / 2 + 0.2, 0, 0);
    scarf.scale.set(1.05, 1.0, 1);
    scarf.add(k.torus(red, 0.235, 0.08));
    // tartan stripes running round the scarf
    [[0.035, green], [-0.04, navy]].forEach(([z, m]) => {
      const R = 0.235 + Math.sqrt(0.08 * 0.08 - z * z) - 0.006;
      scarf.add(k.at(k.torus(m, R, 0.013), 0, 0, z));
    });
    torso.add(scarf);
    const end = k.at(k.group(), 0.16, 0.54, 0.4, -0.3, 0, 0.22);
    end.add(k.at(k.box(red, 0.15, 0.32, 0.05, 0.025), 0, -0.14, 0));
    [-0.035, 0.035].forEach((x) => end.add(k.at(k.box(green, 0.024, 0.32, 0.054, 0.008), x, -0.14, 0)));
    [-0.07, -0.19].forEach((y) => end.add(k.at(k.box(navy, 0.154, 0.022, 0.056, 0.008), 0, y, 0)));
    [-1, 0, 1].forEach((i) => end.add(k.at(k.cap(cream, 0.016, 0.07), i * 0.05, -0.33, 0)));
    torso.add(end, k.at(k.ball(red, 0.1, 0.085, 0.075), 0.15, 0.57, 0.33));
    rig.spring(end, { axis: 'x', gain: 0.12, sway: 0.04, speed: 2.1, k: 70, d: 6 });

    // ── bubbles she blows when she pops back up ──
    const bubbles = [0, 1, 2].map((i) => {
      const b = k.ball(bubble, 0.05 + i * 0.012, 0.05 + i * 0.012, 0.05 + i * 0.012, 16);
      b.castShadow = false;
      b.visible = false;
      rig.pivot.add(b);
      return b;
    });

    // where her head ends up (for the card, the dizzy stars and the portrait)
    rig.root.updateMatrixWorld(true);
    const hc = head.localToWorld(c.clone());
    rig.metrics.headY = hc.y;
    rig.metrics.height = hc.y + H[1] + 0.08;

    const sp = new THREE.Vector3();
    let lastC = -1;
    rig.tickers.push((t, dt, r, anim) => {
      const cc = t % PERIOD;
      const w = calm(anim);

      // the neck: a lazy S-sway, it folds down when she ducks and stretches when she rises
      const d = duckAt(cc) * w;
      const up = riseAt(cc) * w;
      n1.rotation.set(N1[0] + 0.16 * d - 0.12 * up, 0, N1[1] + Math.sin(t * 0.9) * 0.06 + 0.1 * d - 0.08 * up);
      n2.rotation.set(N2[0] + 0.14 * d - 0.1 * up, 0, N2[1] - Math.sin(t * 0.9 - 0.7) * 0.08 - 0.08 * d + 0.1 * up);

      // a happy beam as she surfaces
      if (w > 0.5 && lastC >= 0 && lastC < RISE[0] + 0.2 && cc >= RISE[0] + 0.2 && cc - lastC < 0.3) r.face?.set('happy', 1.1);
      lastC = cc;

      // bubbles drift up from her snout and pop
      snout.getWorldPosition(sp);
      r.pivot.worldToLocal(sp);
      bubbles.forEach((b, i) => {
        const u = (cc - BUBBLES - i * 0.3) / 1.3;
        const show = w > 0.5 && u > 0 && u < 1;
        b.visible = show;
        if (!show) return;
        b.position.set(sp.x + Math.sin(u * 9 + i) * 0.05, sp.y + 0.05 + u * 0.75, sp.z + 0.05 + u * 0.1);
        b.scale.setScalar((0.05 + i * 0.012) * (u > 0.85 ? (1 - u) / 0.15 + 0.2 : Math.min(1, u * 6)));
      });
    });

    return rig;
  },

  idle(P, t, rig, animator) {
    const c = t % PERIOD;
    const w = calm(animator);

    // gentle paddling flippers and a contented little bob
    P.armLZ += 0.12 + Math.sin(t * 2.2) * 0.1;
    P.armRZ -= 0.12 + Math.sin(t * 2.2 + 0.8) * 0.1;
    P.armLX += -0.15;
    P.armRX += -0.15;
    P.hipsY += Math.abs(Math.sin(t * 1.6)) * 0.012;
    P.tailZ += Math.sin(t * 1.4) * 0.12;
    P.headZ += Math.sin(t * 0.9 + 0.5) * 0.06;

    // ducks down shyly …
    const d = duckAt(c) * w;
    P.headX += 0.1 * d;
    P.headY += 0.3 * d;
    P.headZ += 0.12 * d;
    P.sq += -0.05 * d;
    P.armLZ += 0.25 * d;
    P.armRZ -= 0.25 * d;
    P.armLX += -0.4 * d;
    P.armRX += -0.4 * d;

    // … and pops back up, tall and beaming, with a little hop
    const up = riseAt(c) * w;
    P.headX += -0.18 * up;
    P.sq += 0.06 * up;
    P.y += 0.06 * Math.max(0, Math.sin((c - RISE[0]) * 4)) * up;
    P.tailZ += Math.sin(t * 6) * 0.2 * up;
  },

  constrain(P) {
    // flippers are short: keep raised ones out to the sides, clear of the scarf and the neck
    P.armLZ = Math.min(P.armLZ, 2.2);
    P.armRZ = Math.max(P.armRZ, -2.2);
  },
};
