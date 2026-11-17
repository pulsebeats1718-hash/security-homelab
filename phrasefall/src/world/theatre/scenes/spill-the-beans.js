/**
 * Spill the beans: the hero tips a big tin of baked beans and they pour out in a glossy orange
 * stream, piling up on the dais in a puddle of sauce, while a friend gasps. Oops!
 */
import * as THREE from 'three';
import { keys, ease, clamp, lerp } from '../../../core/utils.js';

const LOOP = 6.4;
const BEANS = 90;
const POUR = [1.15, 3.7]; // the beans leave the tin between these times
const PILE = new THREE.Vector3(0.62, 0, 0.42);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** The tin's paper label: orange, with the word and a few beans on it. */
function labelTexture(s) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2f6fd6';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#ff7a2f';
  g.fillRect(0, 14, 512, 100);
  g.font = '700 64px "Fredoka Variable", "Fredoka", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.lineJoin = 'round';
  g.strokeStyle = '#7a2a12';
  g.fillStyle = '#fff6e3';
  for (const x of [128, 384]) {
    g.strokeText('BEANS', x, 66);
    g.fillText('BEANS', x, 66);
  }
  g.fillStyle = '#c8501f';
  for (const [x, y] of [[20, 40], [36, 88], [236, 30], [262, 94], [276, 60], [492, 44], [480, 90]]) {
    g.beginPath();
    g.ellipse(x, y, 13, 9, 0.5, 0, Math.PI * 2);
    g.fill();
  }
  const tex = s.own(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export default {
  id: 'spill-the-beans',
  loop: LOOP,
  frame: { x: 0.2, y: 1.15, z: 0.2, w: 3.9, h: 2.9 },
  view: { yaw: 0.16, pitch: 0.16 },
  avoid: ['let-the-cat-out-of-the-bag', 'cry-over-spilt-milk'],

  build(s) {
    const { k } = s;
    const hero = s.hero();
    hero.place(-0.55, 0.05, 0.25);
    const friend = s.cast(s.other(['bunny', 'panda', 'penguin']), { x: 1.5, z: -0.05, yaw: -0.55 });

    // the tin: a metal can with a paper label, open at the top
    const tin = k.group();
    const metal = k.metal(0xd7dbe6, 0.32);
    tin.add(k.at(k.cyl(metal, 0.25, 0.25, 0.56, 28), 0, 0, 0));
    tin.add(k.at(k.torus(metal, 0.25, 0.022), 0, 0.28, 0, Math.PI / 2, 0, 0));
    tin.add(k.at(k.torus(metal, 0.25, 0.022), 0, -0.28, 0, Math.PI / 2, 0, 0));
    tin.add(k.at(k.cyl(k.mat(0xd8752f, { rough: 0.3 }), 0.235, 0.235, 0.02, 24), 0, 0.22, 0));
    const paper = new THREE.Mesh(s.own(new THREE.CylinderGeometry(0.258, 0.258, 0.4, 32, 1, true)), s.own(new THREE.MeshStandardMaterial({ map: labelTexture(s), roughness: 0.6 })));
    paper.rotation.y = -Math.PI / 2;
    tin.add(paper);
    s.add(tin);

    // the beans (one draw call) and their puddle of sauce
    const beanGeo = s.own(new THREE.SphereGeometry(1, 9, 7));
    beanGeo.scale(0.058, 0.04, 0.04);
    const sauce = s.add(k.at(k.cyl(k.mat(0xd9542f, { rough: 0.2 }), 1, 1, 0.012, 32), PILE.x, 0.008, PILE.z));
    const mouth = new THREE.Vector3(0.1, 1.25, 0.6);
    const starts = [];
    for (let i = 0; i < BEANS; i++) {
      const a = i * 2.39996;
      const r = 0.5 * Math.sqrt((i + 0.5) / BEANS);
      starts.push({
        at: lerp(POUR[0], POUR[1], i / BEANS),
        from: mouth.clone(),
        rest: new THREE.Vector3(PILE.x + Math.cos(a) * r * 1.2, 0.035 + (1 - r / 0.5) * 0.17 * (0.4 + (0.6 * i) / BEANS), PILE.z + Math.sin(a) * r * 0.75),
        spin: a,
      });
    }
    s.swarm(beanGeo, k.mat(0xd8752f, { rough: 0.28 }), BEANS, (d, i, t) => {
      const b = starts[i];
      if (t < b.at) return false;
      const fly = 0.42;
      const u = (t - b.at) / fly;
      if (u < 1) {
        d.position.lerpVectors(b.from, b.rest, u);
        d.position.y = lerp(b.from.y, b.rest.y, u * u) + Math.sin(u * Math.PI) * 0.12;
        d.rotation.set(b.spin + u * 9, u * 7, b.spin);
      } else {
        const bounce = u < 1.5 ? Math.sin(((u - 1) / 0.5) * Math.PI) * 0.05 : 0;
        d.position.copy(b.rest);
        d.position.y += bounce;
        d.rotation.set(b.spin + 9, 7, b.spin);
      }
      const fade = t > LOOP - 0.55 ? clamp((LOOP - t) / 0.45) : 1;
      d.scale.setScalar(fade);
    });

    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      const tip = keys(t, [[0.7, 0], [1.2, 1], [3.75, 1], [4.2, 0]], ease.inOutCubic);
      P.armLX += -1.2 + tip * 0.15;
      P.armRX += -1.2 - tip * 0.1;
      P.armLZ += -0.18 + tip * 0.35;
      P.armRZ += 0.22 + tip * 0.18;
      P.torsoZ += -tip * 0.08;
      P.headX += 0.18;
      P.headY += tip * 0.35;
      // afterwards: a guilty hop back
      const oops = keys(t, [[4.1, 0], [4.35, 1], [5.6, 1], [6.1, 0]]);
      P.y += Math.sin(clamp((t - 4.1) / 0.35) * Math.PI) * 0.12;
      P.headX += oops * -0.12;
    };
    friend.pose = (P, t) => {
      friend.idle(P, { arms: false });
      const gasp = keys(t, [[1.3, 0], [1.6, 1], [5.4, 1], [6.0, 0]]);
      // hands to cheeks
      P.armLZ += gasp * 1.15;
      P.armRZ -= gasp * 1.15;
      P.armLX += gasp * -0.95;
      P.armRX += gasp * -0.95;
      P.headX += gasp * 0.16;
      P.sq += Math.sin(clamp((t - 1.3) / 0.3) * Math.PI) * -0.08;
    };

    return {
      update(t) {
        // the tin rides between the hero's hands and tips over to pour
        hero.handPos('L', _a);
        hero.handPos('R', _b);
        tin.position.addVectors(_a, _b).multiplyScalar(0.5);
        tin.position.y += 0.08;
        tin.position.z += 0.06;
        const tip = keys(t, [[0.7, 0], [1.2, 1], [3.75, 1], [4.2, 0]], ease.inOutCubic);
        tin.rotation.set(0, 0, -tip * 2.0);
        tin.position.x += tip * 0.08;
        mouth.set(0, 0.29, 0).applyEuler(tin.rotation).add(tin.position);
        for (const b of starts) if (s.cue(b.at) || t < b.at) b.from.copy(mouth);
        const amount = clamp((t - POUR[0] - 0.3) / (POUR[1] - POUR[0]));
        const fade = t > LOOP - 0.55 ? clamp((LOOP - t) / 0.45) : 1;
        sauce.scale.set(0.65 * amount * fade + 0.001, 1, 0.42 * amount * fade + 0.001);
        hero.mood(t > 1.3 && t < 5.8 ? 'surprised' : null);
        friend.mood(t > 1.4 && t < 5.7 ? 'surprised' : null);
        if (s.cue(1.25)) s.sound('pop');
      },
    };
  },
};
