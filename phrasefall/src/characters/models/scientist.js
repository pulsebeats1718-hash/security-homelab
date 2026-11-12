/** Dr Ada Sparks — the lab's most enthusiastic (and least fireproof) scientist. */
const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// a 5.2 s routine: swirl … lean in and peer … a puff of bubbles
const LAB_T = 5.2;
const routine = (t) => {
  const p = t % LAB_T;
  return {
    p,
    peer: smooth(1.4, 2.0, p) * (1 - smooth(3.6, 4.1, p)),
    puff: smooth(3.9, 4.05, p) * (1 - smooth(4.3, 5.0, p)),
  };
};
const faceState = new WeakMap();

export default {
  id: 'scientist',
  name: 'Dr Ada Sparks',
  title: 'The Scientist',
  blurb: 'Her experiments mostly explode. Her vocabulary never does.',
  accent: 0x7cf29c,
  shot: 'bolt',

  build(k) {
    const { THREE } = k;
    const skin = k.mat(0xf6d2ae);
    const hair = k.mat(0x241f2c, { rough: 0.85 });
    const coat = k.mat(0xdde5ee, { rough: 0.62 });
    const coatShade = k.mat(0xc3cdd9, { rough: 0.6 });
    const purple = k.mat(0x7b55d9, { rough: 0.5 });
    const lens = k.glass(0xd9c8ff, 0.5);
    const trousers = k.mat(0x2f3557);
    const shoes = k.mat(0x2a2638, { rough: 0.45 });
    const card = k.mat(0xdff1ff, { rough: 0.4 });
    const glassMat = k.glass(0xd8ffe6, 0.17);
    const rimGlass = k.mat(0xe9fff1, { rough: 0.1, rim: 0.8, transparent: true, opacity: 0.75 });
    const liquid = k.glow(0x35d66a, 0.95);
    const fizz = k.glow(0xb8ffd0, 1.3);

    const rig = k.biped({ skin, top: coat, sleeve: coat, hand: skin, bottom: trousers, shoe: shoes });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── big frizzy hair: a soft mass behind the hairline with frizz puffs sunk into it ──
    head.add(k.at(k.dome(hair, 0.62, 0.58, 0.59, 0.5), 0, c.y, 0, -0.5, 0, 0));
    const MC = new THREE.Vector3(0, c.y + 0.2, -0.2);
    const MR = [0.74, 0.6, 0.66];
    head.add(k.at(k.ball(hair, ...MR, 32), MC.x, MC.y, MC.z));
    const puff = (r, yaw, pitch) => head.add(k.onSphere(k.ball(hair, r, r * 0.9, r), yaw, pitch, -0.06, MR, MC));
    puff(0.22, 0, 60);
    k.both((s) => puff(0.22, s * 45, 40));
    k.both((s) => puff(0.24, s * 90, 12));
    k.both((s) => puff(0.22, s * 135, 25));
    puff(0.22, 180, 35);

    // purple goggles pushed up onto the hair
    k.both((s) => {
      const g = k.onSphere(k.group(), s * 20, 30, 0.02, MR, MC);
      g.add(k.torus(purple, 0.085, 0.024), k.ball(lens, 0.075, 0.075, 0.022));
      head.add(g);
    });
    head.add(k.onSphere(k.box(purple, 0.08, 0.03, 0.03, 0.012), 0, 30, 0.035, MR, MC));
    const strap = k.at(k.torus(purple, 0.7, 0.022), 0, c.y + 0.4, -0.2, Math.PI / 2 - 0.177, 0, 0);
    strap.scale.y = 0.81;
    head.add(strap);

    k.face({
      eye: { yaw: 23, pitch: 2, size: 0.079, tall: 1.18, tilt: -0.1 },
      brow: { color: 0x241f2c, thick: 0.011 },
      mouth: { width: 0.09 },
      cheeks: { color: 0xff8f8f, opacity: 0.5 },
    });

    // ── knee-length lab coat ──
    const skirt = k.lathe(coat, [[0.49, -0.16], [0.5, -0.13], [0.465, -0.03], [0.43, 0.07], [0.41, 0.15], [0.405, 0.19]], 36);
    skirt.scale.z = 0.86;
    torso.add(skirt);
    const seam = k.at(k.group(), 0, -0.01, 0.396, -0.245, 0, 0);
    seam.add(k.stroke(coatShade, 0, 0.14, 0, -0.14, 0.008));
    torso.add(seam);
    [0.25, 0.165].forEach((y) => torso.add(k.onTorso(k.ball(coatShade, 0.026, 0.026, 0.014), 0, y, 0.008)));

    // purple top showing in the V between the lapels
    torso.add(k.at(k.ball(purple, 0.15, 0.14, 0.06), 0, 0.46, 0.255));
    k.both((s) => {
      const lapel = k.at(k.group(), s * 0.098, 0.43, 0.296, -0.43, 0, 0);
      lapel.add(k.at(k.box(coat, 0.075, 0.25, 0.035, 0.016), 0, 0, 0, 0, 0, -s * 0.42));
      torso.add(lapel);
    });

    // breast pocket with pens, ID badge on the other side
    const pocket = k.onTorso(k.group(), 32, 0.27, 0.006);
    pocket.add(k.box(coatShade, 0.13, 0.1, 0.02, 0.01));
    [[-0.035, 0.07, k.mat(0xff5a5f)], [0, 0.077, purple], [0.035, 0.064, k.mat(0xffc93c)]].forEach(([x, y, m]) =>
      pocket.add(k.at(k.cap(m, 0.014, 0.11), x, y, -0.005))
    );
    torso.add(pocket);
    const badge = k.onTorso(k.group(), -32, 0.27, 0.008);
    badge.add(
      k.box(card, 0.1, 0.13, 0.012, 0.012),
      k.at(k.box(purple, 0.1, 0.03, 0.014, 0.008), 0, 0.045, 0.002),
      k.at(k.ball(skin, 0.022, 0.022, 0.008), 0, -0.008, 0.008)
    );
    torso.add(badge);

    // turned-back cuffs
    k.both((s) => rig[`arm${s > 0 ? 'L' : 'R'}`].add(k.at(k.torus(coat, 0.112, 0.032), 0, -0.335, 0, Math.PI / 2, 0, 0)));

    // ── bubbling flask, held up in the right hand, kept upright and swirling ──
    const holder = k.group();
    rig.handR.add(holder);
    const flask = k.scale(k.at(k.group(), 0.06, 0.06, 0.15), 1.3);
    holder.add(flask);
    flask.add(
      k.lathe(liquid, [[0, -0.19], [0.105, -0.19], [0.118, -0.175], [0.08, -0.07], [0, -0.07]], 24, false),
      k.lathe(glassMat, [[0, -0.2], [0.115, -0.2], [0.13, -0.18], [0.11, -0.1], [0.06, -0.02], [0.042, 0.03], [0.042, 0.1], [0.052, 0.115], [0.05, 0.13]], 28)
    );
    flask.children[1].renderOrder = 2;
    flask.children[1].castShadow = false;
    flask.add(k.at(k.torus(rimGlass, 0.05, 0.012), 0, 0.125, 0, Math.PI / 2, 0, 0));
    const glow = k.at(k.halo(0x7cf29c, 0.38, 0.32), 0, -0.13, 0);
    const mouth = k.at(k.group(), 0, 0.14, 0);
    flask.add(glow, mouth);
    rig.props.muzzle = mouth;
    const bubbles = [];
    for (let i = 0; i < 4; i++) {
      const b = k.ball(fizz, 1, 1, 1, 12);
      b.castShadow = false;
      flask.add(b);
      bubbles.push(b);
    }

    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    const qs = new THREE.Quaternion();
    const e = new THREE.Euler();
    rig.tickers.push((t, dt, r, animator) => {
      const { puff: pf } = routine(t);
      const idle = animator?.clip ? 0 : 1;
      // upright relative to the body, swirling in a small circle
      rig.handR.getWorldQuaternion(qa).invert();
      rig.pivot.getWorldQuaternion(qb);
      e.set(Math.cos(t * 4.2) * 0.13 * idle, 0, Math.sin(t * 4.2) * 0.13 * idle);
      qs.setFromEuler(e);
      holder.quaternion.copy(qa).multiply(qb).multiply(qs);
      // fizzing bubbles; every few seconds a bigger puff
      const p = pf * idle;
      bubbles.forEach((b, i) => {
        const a = (t * (0.55 + p * 0.9) + i / bubbles.length) % 1;
        const pop = 1 - smooth(0.82, 1, a);
        b.position.set(Math.sin(a * 8 + i * 1.7) * (0.025 + p * 0.03), 0.13 + a * (0.3 + p * 0.25), Math.cos(a * 7 + i * 2.3) * 0.02);
        b.scale.setScalar(Math.max(0.0001, (0.012 + a * 0.02) * (1 + p * 0.8) * pop));
      });
      liquid.emissiveIntensity = 0.95 + p * 0.9;
      glow.material.opacity = 0.32 + p * 0.35;
    });

    return rig;
  },

  constrain(P) {
    // big hair: hands go up-and-out, never into the frizz
    if (P.armLZ > 1.7) P.armLZ = 1.7;
    if (P.armRZ < -1.7) P.armRZ = -1.7;
  },

  idle(P, t, rig, animator) {
    const { peer, puff, p } = routine(t);
    // flask held up at her side, swirled in small circles
    P.armRZ += -0.88 + Math.cos(t * 4.2) * 0.04 + peer * 0.22;
    P.armRX += -0.6 + Math.sin(t * 4.2) * 0.04 - peer * 0.28;
    // other hand on her hip
    P.armLZ += 0.45;
    P.armLX += 0.35;
    // watching the experiment… then leaning in for a closer look
    P.headY += -0.3 - peer * 0.1;
    P.headX += 0.08 + peer * 0.06;
    P.headZ += -0.08 - peer * 0.05;
    P.torsoY += -0.08 - peer * 0.06;
    P.torsoX += peer * 0.06;
    // the puff makes her jump a little
    P.y += puff * 0.03;
    P.sq += puff * 0.04;
    P.headX += -puff * 0.1;
    if (!animator?.clip && rig.face) {
      const want = p > 1.45 && p < 3.6 ? 'focus' : p > 3.95 && p < 4.6 ? 'surprised' : null;
      const key = want ? `${want}${Math.floor(t / LAB_T)}` : null;
      if (key && faceState.get(rig) !== key) {
        faceState.set(rig, key);
        rig.face.set(want, want === 'focus' ? 2.1 : 0.65);
      }
    }
  },
};
