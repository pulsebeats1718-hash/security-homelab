/** Jinks the jester — juggler, punster, and the jingliest hat in the kingdom. */
const RATE = 0.8; // juggling cycles per second, per ball

export default {
  id: 'jester',
  name: 'Jinks',
  title: 'The Jester',
  blurb: 'Tells the best jokes in the kingdom. Most of them are puns.',
  accent: 0xffd60a,
  shot: 'star',

  build(k) {
    const { THREE } = k;
    const skin = k.mat(0xe9b48c);
    const blue = k.mat(0x3d5ce6, { rough: 0.5 });
    const yellow = k.mat(0xffcd3c, { rough: 0.5 });
    const red = k.mat(0xf0435a, { rough: 0.5 });
    const gold = k.mat(0xf7c948, { metal: 0.7, rough: 0.25 });
    const cream = k.mat(0xfff1d8, { rough: 0.8 });
    const hair = k.mat(0x6b3a22, { rough: 0.8 });
    const wood = k.mat(0x8a5a36, { rough: 0.6 });
    const dark = k.mat(0x3a2414, { rough: 0.5 });

    const rig = k.biped({ skin, top: blue, bottom: yellow, shoe: blue, hand: skin, sleeve: yellow });
    const { head, torso } = rig;
    const c = rig.headCenter;
    // motley: left sleeve and right leg red, the others yellow
    rig.m.armL.material = red;
    rig.m.legR.material = red;

    // ── jester hat: cap, gold band, three floppy points with bells ──
    head.add(k.at(k.dome(blue, 0.6, 0.56, 0.57, 0.5), 0, c.y, 0, -0.55, 0, 0));
    const band = k.at(k.torus(gold, 0.6, 0.04), 0, c.y, 0, Math.PI / 2 - 0.55, 0, 0);
    band.scale.y = 0.95;
    head.add(band);

    const SEG_A = [[0, -0.08], [0.12, -0.06], [0.165, 0], [0.15, 0.12], [0.125, 0.24], [0.11, 0.3]];
    const SEG_B = [[0, -0.07], [0.09, -0.05], [0.118, 0.02], [0.1, 0.12], [0.07, 0.22], [0.035, 0.29], [0, 0.31]];
    const horn = (mat, pos, rotA, rotB, axis, phase) => {
      const a = k.at(k.group(), pos[0], pos[1], pos[2], rotA[0], 0, rotA[1]);
      a.add(k.lathe(mat, SEG_A, 24));
      const b = k.at(k.group(), 0, 0.28, 0, rotB[0], 0, rotB[1]);
      b.add(k.lathe(mat, SEG_B, 20));
      a.add(b);
      // the bell hangs straight down from the tip
      const bell = k.at(k.group(), 0, 0.3, 0);
      bell.quaternion.copy(a.quaternion).multiply(b.quaternion).invert();
      const slit = k.stroke(dark, -0.025, -0.085, 0.025, -0.085, 0.008);
      slit.position.z = 0.056;
      bell.add(k.at(k.ball(gold, 0.065), 0, -0.06, 0), slit);
      b.add(bell);
      head.add(a);
      rig.spring(a, { axis, gain: 0.06, sway: 0.03, speed: 2, phase });
      rig.spring(b, { axis, gain: 0.22, sway: 0.06, speed: 2.4, phase: phase + 0.6, k: 55, d: 4.5 });
      rig.spring(bell, { axis: 'z', gain: 0.35, sway: 0.05, speed: 3, phase, k: 45, d: 3.5 });
    };
    k.both((s) => {
      const p = k.surface([0.6, 0.56, 0.57], s * 72, 38, c).pos;
      horn(red, [p.x * 0.94, p.y - 0.03, p.z * 0.94], [0, -s * 0.75], [0, -s * 1.25], 'z', s);
    });
    horn(yellow, [0, c.y + 0.5, -0.05], [-0.3, 0.25], [-1.2, 0.4], 'x', 2.2);

    // hair peeking out under the cap
    k.both((s) => head.add(k.onSphere(k.ball(hair, 0.105, 0.115, 0.085), s * 74, -2, -0.01)));

    k.face({
      eye: { yaw: 22, pitch: 2, size: 0.085 },
      brow: { color: 0x6b3a22, thick: 0.012 },
      mouth: { width: 0.105 },
      cheeks: { color: 0xff6f7f, opacity: 0.55 },
    });

    // ── ruffled collar ──
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      torso.add(k.at(k.ball(cream, 0.11, 0.075, 0.1), Math.sin(a) * 0.29, 0.565, Math.cos(a) * 0.25, 0, a, 0));
    }

    // ── harlequin diamonds on the tunic ──
    [[-22, 0.37, yellow], [22, 0.37, yellow], [-44, 0.2, red], [0, 0.2, red], [44, 0.2, red]].forEach(([yaw, y, m]) => {
      const d = k.onTorso(k.box(m, 0.12, 0.12, 0.03, 0.02), yaw, y, 0.006);
      d.rotateZ(Math.PI / 4);
      torso.add(d);
    });

    // ── curly-toed shoes ──
    k.both((s) => {
      const curl = k.at(k.torus(blue, 0.06, 0.03, Math.PI * 1.5), 0, -0.27, 0.32);
      curl.rotation.order = 'YXZ';
      curl.rotation.set(0, -Math.PI / 2, -Math.PI / 2);
      rig[`leg${s > 0 ? 'L' : 'R'}`].add(curl);
    });

    // ── marotte in the left hand: a stick with a tiny jester head, kept upright ──
    const marotte = k.group();
    rig.handL.add(marotte);
    const stick = k.at(k.group(), 0, 0, 0, 0, 0, -0.2);
    marotte.add(stick);
    stick.add(k.at(k.cyl(wood, 0.022, 0.026, 0.52, 10), 0, 0.08, 0), k.at(k.ball(skin, 0.075), 0, 0.42, 0));
    k.both((s) => {
      stick.add(k.at(k.cone(s > 0 ? red : yellow, 0.045, 0.13, 14), s * 0.045, 0.5, 0, 0, 0, -s * 0.65));
      stick.add(k.at(k.ball(dark, 0.012), s * 0.026, 0.43, 0.068));
    });

    // ── three juggling balls, thrown up from the right hand in a fountain ──
    const balls = [red, yellow, blue].map((m) => {
      const b = k.ball(m, 0.076, 0.076, 0.076, 18);
      torso.add(b);
      return b;
    });

    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    const hp = new THREE.Vector3();
    rig.tickers.push((t, dt, r, animator) => {
      // marotte upright relative to the body
      rig.handL.getWorldQuaternion(qa).invert();
      rig.pivot.getWorldQuaternion(qb);
      marotte.quaternion.copy(qa).multiply(qb);
      // juggling (hidden while an action clip plays)
      const show = !animator?.clip;
      for (const b of balls) b.visible = show;
      if (!show) return;
      rig.handR.getWorldPosition(hp);
      torso.worldToLocal(hp);
      balls.forEach((b, i) => {
        const ph = (t * RATE + i / 3) % 1;
        if (ph < 0.78) {
          const s = ph / 0.78;
          b.position.set(hp.x + 0.07 - 0.17 * s, hp.y + 0.1 + 0.42 * 4 * s * (1 - s), hp.z + 0.04 * Math.sin(Math.PI * s));
        } else {
          const s = (ph - 0.78) / 0.22;
          b.position.set(hp.x - 0.1 + 0.17 * s, hp.y + 0.1 - 0.05 * Math.sin(Math.PI * s), hp.z + 0.02);
        }
      });
    });

    return rig;
  },

  constrain(P) {
    // hands go up-and-out: clear of the hair tufts, and the marotte never meets the head
    if (P.armLZ > 1.75) P.armLZ = 1.75;
    if (P.armRZ < -1.75) P.armRZ = -1.75;
  },

  idle(P, t) {
    // bouncing on his toes in time with the juggling, so the bells jingle
    const hop = Math.abs(Math.sin(t * Math.PI * RATE * 1.5));
    P.y += hop * 0.045;
    P.sq += (hop - 0.5) * 0.03;
    P.headZ += Math.sin(t * Math.PI * RATE * 0.75) * 0.06;
    // right hand juggles, pumping with every throw
    P.armRZ += -0.75;
    P.armRX += -0.45 + Math.sin(t * Math.PI * 2 * RATE * 3) * 0.06;
    // left hand waggles the marotte
    P.armLZ += 0.25 + Math.sin(t * 2.6) * 0.06;
    P.armLX += -0.45 + Math.sin(t * 2.6 + 1) * 0.05;
    P.torsoY += Math.sin(t * 1.3) * 0.05;
    P.headY += -0.12;
  },
};
