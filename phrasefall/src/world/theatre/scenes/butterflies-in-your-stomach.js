/**
 * Butterflies in your stomach: on a little stage, in front of a microphone, the hero waits to
 * perform — knees knocking, hands on its tummy — while bright butterflies flutter out of its
 * stomach, loop round it and dive back in.
 */
import * as THREE from 'three';

const LOOP = 6;
const FLIES = 12;
const COLOURS = [0xff2d55, 0xffb000, 0x1e90ff, 0x00b386, 0x7b4dff, 0xff6a00];

/** One butterfly wing, hinged at the origin and reaching out along +X (flat in XZ). */
function wingGeo(s) {
  const { k } = s;
  const g = k.group();
  const m = k.mat(0xffffff, { rough: 0.6 });
  g.add(k.at(k.ball(m, 0.25, 0.016, 0.19), 0.22, 0, 0.09, 0, -0.3, 0));
  g.add(k.at(k.ball(m, 0.16, 0.014, 0.12), 0.16, 0, -0.15, 0, 0.4, 0));
  return s.bake(g);
}

function curtains(s) {
  const { k } = s;
  const red = k.mat(0xc8283c, { rough: 0.8 });
  const gold = k.mat(0xffc83d, { metal: 0.3, rough: 0.4 });
  const g = k.group();
  k.both((sd) => {
    for (let i = 0; i < 4; i++) g.add(k.at(k.cap(red, 0.16, 2.7), sd * (1.55 + i * 0.2), 1.35, -1.0 - i * 0.02));
    g.add(k.at(k.torus(gold, 0.2, 0.04), sd * 1.75, 1.05, -0.8, Math.PI / 2, 0, 0));
  });
  // a scalloped pelmet with a gold fringe
  for (let i = -6; i <= 6; i++) {
    g.add(k.at(k.ball(red, 0.22, 0.3, 0.14), i * 0.34, 2.72, -0.95));
    g.add(k.at(k.ball(gold, 0.045), i * 0.34, 2.43, -0.86));
  }
  g.add(k.at(k.box(red, 4.6, 0.26, 0.26, 0.1), 0, 2.95, -1.0));
  return s.baked(g);
}

export default {
  id: 'butterflies-in-your-stomach',
  loop: LOOP,
  frame: { x: 0, y: 1.3, z: 0.1, w: 3.7, h: 3.1 },
  view: { yaw: 0.1, pitch: 0.12 },
  avoid: ['have-butterflies-in-your-stomach', 'get-cold-feet'],

  build(s) {
    const { k } = s;
    s.add(curtains(s));
    const hero = s.hero();
    hero.place(0, 0, -0.1);
    hero.mood('worried');

    // the microphone, waiting
    const mic = k.group();
    const steel = k.metal(0x9aa3b8, 0.3);
    mic.add(k.at(k.cyl(steel, 0.2, 0.22, 0.04, 20), 0, 0.02, 0), k.at(k.cyl(steel, 0.025, 0.025, 1.25, 8), 0, 0.65, 0));
    mic.add(k.at(k.cap(k.mat(0x2a2233, { rough: 0.4 }), 0.05, 0.22), 0, 1.32, 0.03, 0.4, 0, 0), k.at(k.ball(k.metal(0xd8dde8, 0.5), 0.085, 0.1, 0.085), 0, 1.45, 0.08));
    s.add(s.baked(mic)).position.set(0.95, 0, 0.75);

    // a warm glow in the tummy
    const glow = k.halo(0xffb3cf, 1.1, 0.5);
    hero.attach('torso', glow, { y: 0.25, z: 0.45 });

    // the butterflies: two instanced wing sets and a body set, one draw call each
    const belly = new THREE.Vector3();
    const fly = [];
    for (let i = 0; i < FLIES; i++) fly.push({ phase: i / FLIES, spin: i % 2 ? 1 : -1, lift: 0.1 + ((i * 0.37) % 1) * 0.6, wide: 0.95 + ((i * 0.61) % 1) * 0.5, p: new THREE.Vector3(), yaw: 0, flap: 0, scale: 0 });
    const place = (t) => {
      for (const f of fly) {
        const u = (t / 3 + f.phase) % 1;
        const out = Math.sin(u * Math.PI); // 0 in the tummy, 1 at the far end of its loop
        // out of the tummy, fanning about in front of the hero, and back in
        const a = Math.sin(u * Math.PI * 2) * 0.7 * f.spin + (f.phase - 0.5) * 2.7;
        f.p.set(belly.x + Math.sin(a) * f.wide * out, belly.y + f.lift * out + Math.sin(u * 9) * 0.06, belly.z + 0.1 + Math.cos(a) * f.wide * 0.85 * out);
        f.yaw = a + (Math.PI / 2) * f.spin * (u < 0.5 ? 1 : -1);
        // never across the face: in front of the hero they stay down by the tummy
        const front = 1 - Math.min(1, Math.abs(f.p.x - belly.x) / 0.6);
        f.p.y = Math.min(f.p.y, belly.y + 0.55 - front * 0.4);
        f.flap = Math.sin(t * 26 + f.phase * 40) * 0.9;
        f.scale = Math.min(1, out * 4);
      }
    };
    const wing = wingGeo(s);
    const wmat = k.mat(0xffffff, { rough: 0.45, rim: 0.15, side: THREE.DoubleSide, wings: 1 });
    const meshes = [];
    for (const side of [1, -1]) {
      meshes.push(
        s.swarm(wing, wmat, FLIES, (d, i) => {
          const f = fly[i];
          d.position.copy(f.p);
          d.rotation.set(0, f.yaw, 0);
          d.rotateZ(f.flap * side);
          d.scale.set(side * f.scale, f.scale, f.scale);
        }, { shadow: false })
      );
    }
    for (const m of meshes) {
      const c = new THREE.Color();
      for (let i = 0; i < FLIES; i++) m.setColorAt(i, c.set(COLOURS[i % COLOURS.length]));
      m.instanceColor.needsUpdate = true;
    }
    const bodyGeo = s.own(new THREE.CapsuleGeometry(0.026, 0.18, 4, 6));
    bodyGeo.rotateX(Math.PI / 2);
    s.swarm(bodyGeo, k.mat(0x2a2233, { rough: 0.5 }), FLIES, (d, i) => {
      const f = fly[i];
      d.position.copy(f.p);
      d.rotation.set(0, f.yaw, 0);
      d.scale.setScalar(f.scale);
    }, { shadow: false });

    hero.pose = (P, t) => {
      hero.idle(P, { arms: false, own: false });
      // hands on the tummy, knees knocking, a nervous little jiggle
      P.armLX += -0.7;
      P.armRX += -0.7;
      P.armLZ += -0.38;
      P.armRZ += 0.38;
      const knock = Math.sin(t * 14);
      P.legLZ += -0.1 + knock * 0.08;
      P.legRZ += 0.1 + knock * 0.08;
      P.x += Math.sin(t * 31) * 0.01;
      P.headX += 0.08;
      P.headY += Math.sin(t * 1.7) * 0.25;
      P.sq += Math.sin(t * 2.5) * 0.02;
    };

    return {
      update(t) {
        hero.rig.torso.getWorldPosition(belly);
        belly.y += 0.25;
        belly.z += 0.3;
        place(t);
        glow.material.opacity = 0.35 + 0.2 * Math.sin(t * 6);
        hero.mood(Math.sin(t * 0.9) > 0.7 ? 'surprised' : 'worried');
      },
    };
  },
};
