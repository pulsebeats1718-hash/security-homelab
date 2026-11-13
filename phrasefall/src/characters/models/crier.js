/** Bellamy the town crier — a booming voice, a brass bell and a proclamation for every occasion. */
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

// idle loop: proud rocking … RING the bell, "Oyez! Oyez!" … unroll the proclamation and read it … roll it up, chest out
const PERIOD = 9;
const RING = [1.6, 3.9];
const READ = [4.6, 7.6];
const ringAt = (c) => win(c, RING[0], RING[1], 0.35);
const readAt = (c) => win(c, READ[0], READ[1], 0.45);
const unrollAt = (c) => smooth(READ[0] + 0.35, READ[0] + 0.85, c) * (1 - smooth(READ[1] - 0.75, READ[1] - 0.3, c));
const SHEET = 0.46;

export default {
  id: 'crier',
  name: 'Bellamy',
  title: 'The Town Crier',
  blurb: 'Oyez, oyez! Shouts every new word he learns from the rooftops.',
  accent: 0xffc13b,
  shot: 'star',

  build(k) {
    const red = k.mat(0xc8243a, { rough: 0.58 });
    const gold = k.mat(0xffc642, { metal: 0.55, rough: 0.3 });
    const brass = k.mat(0xe9b048, { metal: 0.75, rough: 0.24, rim: 0.3 });
    const brassDark = k.mat(0x6e4a1e, { metal: 0.4, rough: 0.5 });
    const blue = k.mat(0x2b4fb3, { rough: 0.5, rim: 0.2 });
    const charcoal = k.mat(0x2a2531, { rough: 0.62, rim: 0.3 });
    const shoe = k.mat(0x2a2531, { rough: 0.22, rim: 0.3 });
    const white = k.mat(0xf3eee6, { rough: 0.85, rim: 0.4 });
    const lace = k.mat(0xfbf7f0, { rough: 0.7, rim: 0.3 });
    const skin = k.mat(0xb4744a);
    const nose = k.mat(0xc9775a, { rough: 0.45 });
    const wood = k.mat(0x7a4a2a, { rough: 0.5 });
    const parchment = k.mat(0xf6e6c2, { rough: 0.8 });
    const parchmentDark = k.mat(0xe2c991, { rough: 0.75 });
    const ink = k.mat(0x8b6a4a, { rough: 0.8, rim: 0 });

    const TS = [1.14, 0.98, 0.96];
    const rig = k.biped({
      skin,
      top: red,
      bottom: white,
      shoe,
      hand: skin,
      sleeve: red,
      torso: TS,
      legLen: 0.36,
      legR: 0.115,
      foot: [0.15, 0.1, 0.24],
      shoulderW: 0.33,
      armRest: 0.5,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── the long red coat: flared skirts to the knee, gold-trimmed front edges and hem ──
    const skirt = k.lathe(red, [[0.5, -0.15], [0.505, -0.12], [0.47, -0.01], [0.445, 0.1], [0.43, 0.2]], 36);
    skirt.scale.z = 0.94;
    const hem = k.at(k.torus(gold, 0.5, 0.025), 0, -0.137, 0, Math.PI / 2, 0, 0);
    hem.scale.y = 0.94;
    torso.add(skirt, hem);
    // frock-coat back: a vent edged in gold and two buttons at the waist
    const vent = k.at(k.box(gold, 0.035, 0.26, 0.02, 0.012), 0, -0.02, -0.468 * 0.94, 0.26, 0, 0);
    torso.add(vent);
    k.both((s) => torso.add(k.onTorso(k.ball(gold, 0.034, 0.034, 0.022), 180 + s * 14, 0.17, 0.006)));

    // blue waistcoat between the coat fronts, with a column of gold buttons
    const vestC = new THREE.Vector3(0, 0.27, 0.27);
    const vestR = [0.2, 0.3, 0.17];
    torso.add(k.at(k.ball(blue, ...vestR), vestC.x, vestC.y, vestC.z));
    [0.43, 0.33, 0.23, 0.13].forEach((y) => {
      const dz = vestR[2] * Math.sqrt(Math.max(0, 1 - ((y - vestC.y) / vestR[1]) ** 2));
      torso.add(k.at(k.ball(gold, 0.026, 0.026, 0.016), 0, y, vestC.z + dz + 0.004));
    });
    // gold braid down both coat fronts, gold buttons on the coat
    k.both((s) => {
      const a = s * 27;
      torso.add(k.onTorso(k.box(gold, 0.04, 0.42, 0.02, 0.012), a, 0.3, 0.004));
      const low = k.onTorso(k.box(gold, 0.04, 0.2, 0.02, 0.012), a * 1.05, 0.02, 0.06);
      low.position.y = -0.04;
      low.rotateX(-0.25);
      torso.add(low);
      [0.42, 0.3, 0.18].forEach((y) => torso.add(k.onTorso(k.ball(gold, 0.03, 0.03, 0.02), s * 38, y, 0.006)));
    });

    // lace jabot cascading from the collar
    torso.add(
      k.at(k.ball(lace, 0.12, 0.065, 0.075), 0, 0.555, 0.25, 0.5, 0, 0),
      k.at(k.ball(lace, 0.105, 0.06, 0.07), 0, 0.485, 0.31, 0.4, 0, 0),
      k.at(k.ball(lace, 0.085, 0.055, 0.06), 0, 0.42, 0.345, 0.3, 0, 0)
    );
    const collar = k.at(k.torus(red, 0.26, 0.06), 0, 0.585, -0.01, Math.PI / 2 + 0.12, 0, 0);
    collar.scale.set(1.05, 0.95, 1);
    torso.add(collar);

    // big blue cuffs edged in gold
    k.both((s) => {
      const arm = s > 0 ? rig.armL : rig.armR;
      arm.add(k.at(k.cyl(blue, 0.118, 0.15, 0.13, 20), 0, -0.3, 0), k.at(k.torus(gold, 0.148, 0.018), 0, -0.364, 0, Math.PI / 2, 0, 0));
    });

    // white stockings, glossy buckled shoes
    k.both((s) => {
      const leg = s > 0 ? rig.legL : rig.legR;
      const fm = rig.m[s > 0 ? 'footL' : 'footR'];
      leg.add(k.at(k.box(gold, 0.1, 0.07, 0.03, 0.012), 0, fm.position.y + 0.035, fm.position.z + 0.205, -0.5, 0, 0));
      leg.add(k.at(k.box(shoe, 0.055, 0.035, 0.032, 0.01), 0, fm.position.y + 0.036, fm.position.z + 0.214, -0.5, 0, 0));
    });

    // ── face: bushy white brows, a rosy round nose, a handlebar moustache and grand mutton chops ──
    k.face({
      eye: { yaw: 21, pitch: 3, size: 0.08, tall: 1.25 },
      brow: { color: 0xf3eee6, thick: 0.024, width: 0.082 },
      mouth: { pitch: -27, width: 0.1, color: 0x5e1f2c },
      cheeks: { yaw: 37, pitch: -10, color: 0xff7a6a, opacity: 0.5, size: 0.08 },
    });
    head.add(k.onSphere(k.ball(nose, 0.068, 0.058, 0.055), 0, -7, -0.01));
    const tache = k.onSphere(k.group(), 0, -17.5, 0.02);
    k.both((s) => {
      const lobe = k.at(k.ball(white, 0.11, 0.05, 0.05), s * 0.09, 0, 0, 0, 0, s * 0.25);
      const curl = k.at(k.ball(white, 0.045, 0.042, 0.04), s * 0.195, 0.032, -0.016);
      tache.add(lobe, curl);
    });
    head.add(tache);
    k.both((s) => {
      // mutton chops: down from under the hat along the jaw, sweeping in towards the moustache
      const chop = k.onSphere(k.group(), s * 58, -20, -0.035);
      chop.add(k.at(k.ball(white, 0.095, 0.19, 0.085), 0, 0.02, 0, 0, 0, s * 0.5));
      chop.add(k.at(k.ball(white, 0.08, 0.075, 0.07), -s * 0.075, -0.115, 0.012));
      head.add(chop);
    });

    // white hair at the back, gathered into a queue with a black bow
    head.add(k.at(k.dome(white, 0.59, 0.54, 0.555, 0.4, 32), 0, c.y, -0.005, -1.95, 0, 0));
    // powdered side rolls, period style
    k.both((s) => {
      [[118, -2], [128, -20]].forEach(([yaw, pitch]) => {
        const roll = k.onSphere(k.group(), s * yaw, pitch, 0.02);
        roll.add(k.at(k.cap(white, 0.058, 0.26, 12), 0, 0, -0.012, 0, 0, Math.PI / 2));
        head.add(roll);
      });
    });
    const queue = k.at(k.group(), 0, c.y - 0.3, -0.47, 0.35, 0, 0);
    queue.add(k.at(k.cap(white, 0.065, 0.24), 0, -0.1, 0));
    k.both((s) => queue.add(k.at(k.ball(charcoal, 0.065, 0.04, 0.03), s * 0.06, 0.0, -0.045, 0, 0, s * 0.35)));
    queue.add(k.at(k.ball(charcoal, 0.03, 0.03, 0.03), 0, 0, -0.05));
    head.add(queue);
    rig.spring(queue, { axis: 'x', gain: 0.1, sway: 0.03, speed: 2, k: 60, d: 5 });

    // ── black tricorn, edged in gold braid and trimmed with white feathers, with a gold cockade ──
    const hat = k.at(k.group(), 0, c.y + 0.35, -0.02, -0.12, 0, -0.04);
    const brim = k.cyl(charcoal, 0.84, 0.84, 0.04, 3);
    brim.scale.set(1.1, 1, 1.05);
    hat.add(brim, k.at(k.dome(charcoal, 0.49, 0.38, 0.475, 0.5, 32), 0, 0, 0));
    const corners = [[0, 0.88], [0.8, -0.44], [-0.8, -0.44]];
    corners.forEach(([ax, az], i) => {
      const [bx, bz] = corners[(i + 1) % 3];
      const len = Math.hypot(bx - ax, bz - az) / 2;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const flap = k.at(k.group(), mx * 0.985, 0, mz * 0.985);
      flap.rotation.set(-0.3, Math.atan2(mx, mz), 0, 'YXZ');
      const fh = 0.3;
      flap.add(k.dome(charcoal, len * 0.97, fh, 0.06, 0.5, 32), k.dome(gold, len * 0.97 + 0.02, fh + 0.02, 0.036, 0.5, 32));
      for (let j = 0; j < 9; j++) {
        const a = ((14 + j * 19) * Math.PI) / 180;
        const r = j % 2 ? 0.058 : 0.066;
        flap.add(k.at(k.ball(white, r, r * 0.92, r * 0.92, 14), Math.cos(a) * len * 0.96, Math.sin(a) * (fh + 0.012), 0.004));
      }
      hat.add(flap);
    });
    // cockade on the front-left flap
    const cockade = k.at(k.group(), 0.27, 0.2, 0.555, -0.3, 0.55, 0);
    cockade.add(k.star(gold, 0.085, 0.06, 10, 0.02), k.at(k.ball(red, 0.04, 0.04, 0.02), 0, 0, 0.012));
    hat.add(cockade);
    head.add(hat);
    rig.spring(hat, { axis: 'x', gain: 0.04, k: 120, d: 10 });
    rig.props.hat = hat;

    // ── the brass hand bell in the right hand (it rings out every shot) ──
    const bell = k.group();
    rig.handR.add(bell);
    const swing = k.group(); // rotates about the grip
    bell.add(swing);
    const body = k.at(k.group(), 0, -0.36, 0);
    swing.add(body);
    body.add(
      k.lathe(brass, [[0.175, 0], [0.17, 0.025], [0.135, 0.07], [0.105, 0.13], [0.09, 0.19], [0.078, 0.235], [0.04, 0.268], [0, 0.275]], 32),
      k.at(k.torus(brass, 0.168, 0.022), 0, 0.008, 0, Math.PI / 2, 0, 0),
      k.at(k.disc(brassDark, 0.16), 0, 0.03, 0, Math.PI / 2, 0, 0),
      k.at(k.ball(brassDark, 0.042), 0, -0.012, 0),
      k.at(k.cyl(wood, 0.036, 0.048, 0.22, 14), 0, 0.37, 0),
      k.at(k.ball(wood, 0.05), 0, 0.49, 0),
      k.at(k.torus(brass, 0.05, 0.014), 0, 0.27, 0, Math.PI / 2, 0, 0)
    );
    const mouth = k.at(new THREE.Object3D(), 0, -0.02, 0);
    body.add(mouth);
    rig.props.muzzle = mouth;
    rig.props.bell = bell;

    // ── the proclamation in the left hand: a rolled scroll that unrolls to be read ──
    const scroll = k.group();
    rig.handL.add(scroll);
    const roll = (r) => k.at(k.cyl(parchmentDark, r, r, 0.36, 16), 0, 0, 0, 0, 0, Math.PI / 2);
    scroll.add(roll(0.036));
    const paper = k.group();
    scroll.add(paper);
    paper.add(k.at(k.box(parchment, 0.32, 1, 0.012, 0.004), 0, -0.5, 0));
    // lines of writing on the side he reads (no actual letters)
    [0.16, 0.28, 0.4, 0.52, 0.64, 0.76].forEach((y, i) => {
      const w = i % 3 === 2 ? 0.08 : 0.11;
      const line = k.stroke(ink, -w, 0, w - (i === 5 ? 0.05 : 0), 0, 0.007);
      line.position.set(0, -y, 0.0075);
      paper.add(line);
    });
    const bottom = k.group();
    scroll.add(bottom);
    bottom.add(roll(0.042), k.at(k.ball(red, 0.05, 0.05, 0.02), 0, -0.012, -0.046));
    k.both((s) => bottom.add(k.at(k.box(red, 0.03, 0.12, 0.008, 0.004), s * 0.03, -0.09, -0.04, 0, 0, s * 0.25)));
    rig.props.scroll = scroll;

    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    const qIdle = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
    const qRead = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, Math.PI, 0));
    const qs = new THREE.Quaternion();
    const qBell = new THREE.Quaternion();
    const eBell = new THREE.Euler();
    rig.tickers.push((t, dt, r, anim) => {
      const cc = t % PERIOD;
      const w = calm(anim);

      // bell hangs from the grip, swings while ringing and tips away from the head when raised high
      r.handR.getWorldQuaternion(qa).invert();
      r.pivot.getWorldQuaternion(qb);
      const ring = ringAt(cc) * w;
      const clip = anim?.clip;
      const clang = clip?.name === 'attack' ? Math.sin(clamp01(clip.t / clip.dur) * Math.PI * 3) : 0;
      const up = smooth(1.3, 2.3, -r.armR.rotation.z);
      eBell.set(Math.sin(t * 15) * 0.75 * ring + clang * 0.6, 0, -0.55 * up - 0.18 * w * (1 - ring));
      qBell.setFromEuler(eBell);
      bell.quaternion.copy(qa).multiply(qb).multiply(qBell);

      // the scroll: upright baton while idle, unrolled and tilted towards his eyes when reading
      const rd = readAt(cc) * w;
      const L = unrollAt(cc) * w * SHEET;
      r.handL.getWorldQuaternion(qa).invert();
      qs.copy(qIdle).slerp(qRead, rd);
      scroll.quaternion.copy(qa).multiply(qb).multiply(qs);
      paper.scale.y = Math.max(0.001, L);
      paper.visible = L > 0.004;
      bottom.position.y = -L;

      // "Oyez!": a big open-mouthed shout on every swing of the bell
      const face = r.face;
      if (face && ring > 0.5 && face.current === 'neutral' && face.holdT <= 0) face.set('happy', 0.25);
      if (face?.mouth) face.mouth.root.scale.setScalar(1 + 0.45 * ring);
    });

    return rig;
  },

  idle(P, t, rig, animator) {
    const c = t % PERIOD;
    const w = calm(animator);

    // proud stance: chest out, chin up, rocking on his heels
    const rock = Math.sin(t * 1.6);
    P.torsoX += -0.06;
    P.headX += -0.06 - 0.02 * rock;
    P.pitch += 0.025 * rock;
    P.armLZ += 0.12;
    P.armRZ += -0.42;
    P.armRX += -0.12;

    // RING: the bell arm goes up and out, a little hop on every clang
    const ring = ringAt(c);
    P.armRZ += -1.15 * ring;
    P.armRX += -0.2 * ring;
    P.headX += -0.12 * ring;
    P.headZ += 0.08 * ring + Math.sin(t * 15) * 0.03 * ring;
    P.torsoZ += 0.05 * ring;
    P.y += Math.abs(Math.sin(t * 7.5)) * 0.035 * ring;
    P.sq += Math.sin(t * 15) * 0.02 * ring;

    // READ: the scroll comes up in front, he reads it with a nod or two
    const rd = readAt(c);
    P.armLX += -1.45 * rd * w;
    P.armLZ += -0.2 * rd * w;
    P.headX += 0.2 * rd + Math.sin((c - READ[0]) * 5) * 0.03 * rd;
    P.headY += 0.12 * rd;
    P.torsoX += 0.04 * rd;

    // and a satisfied chest-puff to finish
    const puff = win(c, 7.7, 8.9, 0.35);
    P.torsoX += -0.07 * puff;
    P.headX += -0.1 * puff;
    P.sq += 0.04 * puff;
  },

  constrain(P) {
    // the skirts of the coat: legs swing a little, never out through them
    P.legLX *= 0.45;
    P.legRX *= 0.45;
    // raised hands stay out to the side, so the bell and scroll clear the hat and whiskers
    P.armRZ = Math.max(P.armRZ, -1.95);
    P.armLZ = Math.min(P.armLZ, 1.9);
  },
};
