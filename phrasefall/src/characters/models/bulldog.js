/** Barnaby the bulldog — stocky, stubborn and impeccably turned out in tweed. */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => clamp(v, 0, 1);
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

// idle timeline: chest puff → determined head shake → a look at the pocket watch
const PERIOD = 9;
const puffW = (f) => step(1.0, 1.5, f) * (1 - step(2.1, 2.5, f));
const shakeW = (f) => step(3.4, 3.55, f) * (1 - step(4.5, 4.8, f));
const watchW = (f) => step(5.6, 6.1, f) * (1 - step(7.3, 7.8, f));

export default {
  id: 'bulldog',
  name: 'Barnaby',
  title: 'The Bulldog',
  blurb: 'Stubborn as they come. Will never, ever give up on a tricky phrase.',
  accent: 0xd4a373,
  shot: 'ball',

  build(k) {
    const THREE = k.THREE;
    const fawn = k.mat(0xe0a35f, { rough: 0.72 });
    const cream = k.mat(0xfff3e2, { rough: 0.75 });
    const crease = k.mat(0xa8713f, { rough: 0.8 });
    const tweed = k.mat(0x6e7b4a, { rough: 0.9, rim: 0.14 });
    const tweedDark = k.mat(0x4b5533, { rough: 0.9, rim: 0.14 });
    const gold = k.mat(0xffc93f, { metal: 0.55, rough: 0.32 });
    const nose = k.mat(0x2b1a1f, { rough: 0.22 });

    const rig = k.biped({
      skin: fawn, top: fawn, bottom: fawn, shoe: cream, hand: cream, sleeve: fawn,
      legLen: 0.22, legR: 0.16, legGap: 0.22, foot: [0.18, 0.1, 0.23],
      torso: [1.15, 0.95, 0.92], head: [0.64, 0.5, 0.55], armLen: 0.42, armR: 0.12, handR: 0.135,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── tweed waistcoat over the fawn body: white V of chest fur, gold buttons, welt pockets
    const vest = k.lathe(tweed, [[0.372, 0], [0.418, 0.19], [0.398, 0.36], [0.33, 0.5], [0.27, 0.56]], 36);
    vest.scale.set(1.15, 0.95, 1.15 * 0.92);
    torso.add(vest);
    const vee = k.at(k.group(k.at(k.box(cream, 0.22, 0.22, 0.04, 0.03), 0, 0, 0, 0, 0, Math.PI / 4)), 0, 0.53, 0.3, -0.64, 0, 0);
    vee.scale.x = 0.8;
    torso.add(vee);
    [0.33, 0.24, 0.15].forEach((y) => torso.add(k.onTorso(k.ball(gold, 0.03, 0.03, 0.02), 0, y, 0.026)));
    k.both((s) => torso.add(k.onTorso(k.box(tweedDark, 0.15, 0.028, 0.03, 0.012), s * 40, 0.2, 0.022)));

    // ── pocket watch on a gold chain: rests in the left pocket, travels to the paw when checked
    const watch = k.group(
      k.at(k.cyl(gold, 0.07, 0.07, 0.03, 24), 0, 0, 0, Math.PI / 2, 0, 0),
      k.at(k.disc(cream, 0.055, 24), 0, 0, 0.0155),
      k.at(k.torus(gold, 0.022, 0.008), 0, 0.088, 0)
    );
    torso.add(watch);
    rig.props.watch = watch;
    const pocket = k.onTorso(new THREE.Object3D(), 40, 0.205, -0.02); // tucked away inside the pocket
    const slit = k.onTorso(new THREE.Object3D(), 40, 0.21, 0.03).position.clone();
    const anchor = k.onTorso(new THREE.Object3D(), 0, 0.24, 0.03).position.clone();
    watch.position.copy(pocket.position);
    watch.quaternion.copy(pocket.quaternion);
    const heldQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-0.35, 0.9, 0.25).normalize());
    const chain = [k.cap(gold, 0.01, 1, 6), k.cap(gold, 0.01, 1, 6)];
    torso.add(...chain);

    // ── head: cream muzzle, droopy jowls (springy), protruding lower jaw with two little teeth
    head.add(k.at(k.ball(cream, 0.3, 0.17, 0.2), 0, c.y - 0.13, 0.42));
    head.add(k.at(k.ball(nose, 0.09, 0.06, 0.06), 0, c.y - 0.04, 0.585));
    const jowls = [];
    k.both((s) => {
      const g = k.at(k.group(), s * 0.16, c.y - 0.1, 0.42);
      g.add(k.at(k.ball(cream, 0.17, 0.16, 0.15), 0, -0.1, 0.02));
      head.add(g);
      jowls.push(g);
    });
    const jawC = new THREE.Vector3(0, c.y - 0.31, 0.47);
    const jawR = [0.16, 0.085, 0.13];
    head.add(k.at(k.ball(cream, ...jawR), jawC.x, jawC.y, jawC.z));
    k.both((s) => head.add(k.at(k.cone(cream, 0.026, 0.07, 12), s * 0.072, c.y - 0.245, 0.575, 0.1, 0, -s * 0.12)));

    k.face({
      eye: { yaw: 27, pitch: 6, size: 0.08, tall: 1.2 },
      brow: { color: 0x4a2e1c, thick: 0.022, width: 0.075 },
      mouth: { center: jawC, radii: jawR, pitch: 22, width: 0.065, lift: 0.004 },
      cheeks: { color: 0xff8f7a, opacity: 0.45 },
    });

    // wrinkles: a rope above the nose and two frown creases between the brows
    const rope = k.onSphere(k.group(), 0, 8, 0.004);
    rope.add(k.at(k.torus(crease, 0.3, 0.014, 0.72), 0, -0.3, 0, 0, 0, Math.PI / 2 - 0.36));
    head.add(rope);
    k.both((s) => {
      const fold = k.onSphere(k.group(), s * 6.5, 20, 0.004);
      fold.add(k.at(k.torus(crease, 0.12, 0.012, 0.8), s * 0.12, 0, 0, 0, 0, s > 0 ? Math.PI - 0.4 : -0.4));
      head.add(fold);
    });

    // small folded "rose" ears, peeking out under the cap
    k.both((s) => {
      const ear = k.onSphere(k.ball(crease, 0.12, 0.08, 0.045), s * 70, 2, 0.02);
      ear.rotateX(0.5);
      ear.rotateZ(s * 0.4);
      head.add(ear);
    });

    // ── tweed flat cap: a band hugging the head above the brows, a flat crown slanting forward
    // over a short peak, and a button on top (centred on the head so it can wobble in place)
    const cap = k.at(k.group(), 0, c.y, 0);
    // band: a less-than-half shell, finished with a rolled edge along its (tilted) rim
    const band = k.at(k.group(), 0, 0, -0.01, -0.45, 0, 0);
    const hem = k.at(k.torus(tweed, 0.6, 0.026), 0, 0.132, 0, Math.PI / 2, 0, 0);
    hem.scale.set(0.644 / 0.6, 0.557 / 0.6, 1);
    band.add(k.dome(tweed, 0.665, 0.53, 0.575, 0.42, 36), hem);
    cap.add(
      band,
      k.at(k.ball(tweed, 0.52, 0.12, 0.62, 32), 0, 0.43, 0.06, 0.1, 0, 0),
      k.at(k.ball(tweedDark, 0.36, 0.028, 0.19), 0, 0.335, 0.56, 0.22, 0, 0),
      k.at(k.ball(tweedDark, 0.045, 0.025, 0.045), 0, 0.555, 0.06)
    );
    head.add(cap);
    rig.props.hat = cap;
    rig.spring(cap, { axis: 'x', gain: 0.04, k: 110, d: 9 });

    // jowls wobble with the head's own motion; the watch follows the paw when it is checked
    const Y = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3();
    const a = new THREE.Vector3();
    const m = new THREE.Vector3();
    const setSeg = (seg, p0, p1) => {
      v.subVectors(p1, p0);
      const len = Math.max(0.001, v.length());
      seg.position.addVectors(p0, p1).multiplyScalar(0.5);
      seg.scale.set(1, len, 1);
      seg.quaternion.setFromUnitVectors(Y, v.normalize());
    };
    const js = { z: 0, vz: 0, x: 0, vx: 0 };
    let prev = null;
    let lastShake = -1;
    rig.tickers.push((t, dt, r, animator) => {
      const h = Math.min(dt, 1 / 30);
      const cur = { y: r.head.rotation.y, z: r.head.rotation.z, x: r.head.rotation.x, p: r.pivot.position.y };
      if (prev && h > 0) {
        const tz = clamp(-(cur.y - prev.y) / h * 0.05 - (cur.z - prev.z) / h * 0.05, -0.45, 0.45);
        const tx = clamp((cur.x - prev.x) / h * 0.04 + (cur.p - prev.p) / h * 0.06, -0.45, 0.45);
        js.vz += (120 * (tz - js.z) - 7 * js.vz) * h;
        js.z += js.vz * h;
        js.vx += (120 * (tx - js.x) - 7 * js.vx) * h;
        js.x += js.vx * h;
      }
      prev = cur;
      for (const g of jowls) {
        g.rotation.z = js.z;
        g.rotation.x = js.x;
      }

      const w = calm(animator);
      const f = t % PERIOD;
      const cycle = Math.floor(t / PERIOD);
      if (shakeW(f) * w > 0.5 && cycle !== lastShake && r.face) {
        lastShake = cycle;
        r.face.set('focus', 1.3);
      }
      // watch: pocket ↔ paw
      const hold = watchW(f) * w;
      r.handL.getWorldPosition(a);
      torso.worldToLocal(a);
      a.add(m.set(-0.02, 0.1, 0.04));
      watch.position.copy(pocket.position).lerp(a, hold);
      watch.quaternion.copy(pocket.quaternion).slerp(heldQ, hold);
      // chain: two links with a little sag, from the middle button into the pocket / to the watch's bow
      a.set(0, 0.088, 0).applyQuaternion(watch.quaternion).add(watch.position);
      a.lerpVectors(slit, a, step(0, 0.35, hold));
      m.addVectors(anchor, a).multiplyScalar(0.5);
      m.y -= 0.035 * (1 - hold) + 0.01;
      m.z += 0.02;
      setSeg(chain[0], anchor, m);
      setSeg(chain[1], m, a);
    });

    return rig;
  },

  idle(P, t) {
    const f = t % PERIOD;
    // planted, stocky stance
    P.legLZ += 0.06;
    P.legRZ += -0.06;
    // gruff chest puff … and a huff
    const puff = puffW(f);
    P.torsoX += -0.1 * puff;
    P.breath += 2.2 * puff;
    P.sq += 0.03 * puff - 0.04 * step(2.4, 2.55, f) * (1 - step(2.55, 2.85, f));
    P.armLZ += 0.12 * puff;
    P.armRZ += -0.12 * puff;
    P.headX += -0.08 * puff;
    // determined head shake (the jowls do the rest)
    const sh = shakeW(f);
    P.headY += Math.sin((f - 3.4) * 17) * 0.3 * sh;
    P.headX += 0.05 * sh;
    // a look at the pocket watch
    const w = watchW(f);
    P.armLX += -1.4 * w;
    P.armLZ += -0.35 * w;
    P.headX += 0.14 * w;
    P.headY += 0.2 * w;
    P.torsoX += 0.07 * w;
  },
};
