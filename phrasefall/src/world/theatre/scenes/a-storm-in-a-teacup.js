/**
 * A storm in a teacup: in a giant teacup, a tiny, furious storm cloud rages over the tea — rain,
 * lightning, waves sloshing — while the hero, teaspoon in hand, peers in and then just shrugs.
 */
import * as THREE from 'three';
import { keys, clamp } from '../../../core/utils.js';
import { cloud, teacup, dropGeometry } from '../props.js';

const LOOP = 6;
const FLASHES = [0.9, 2.3, 2.55, 4.1];
const CUP = new THREE.Vector3(0.55, 0, -0.05);

export default {
  id: 'a-storm-in-a-teacup',
  loop: LOOP,
  frame: { x: 0.15, y: 1.15, z: 0.1, w: 3.7, h: 2.8 },
  view: { yaw: 0.14, pitch: 0.22 },
  avoid: ['under-the-weather', 'make-a-mountain-out-of-a-molehill'],

  build(s) {
    const { k } = s;
    const hero = s.hero();
    hero.place(-1.05, 0.35, 0.3);
    hero.yaw = 0.62;

    const cup = s.add(teacup(s, { r: 0.74, color: 0xfff6e3, rim: 0x5cc8ff, tea: 0xb0703a }));
    cup.position.copy(CUP);
    const tea = cup.userData.surface;
    const teaY = tea.position.y;

    // the storm: a grumpy little cloud with a face, swirling over the tea
    const storm = k.group();
    storm.add(cloud(s, { w: 1.05, h: 0.5, dark: true }));
    const cheek = k.at(k.ball(k.mat(0x8d93ad, { rough: 0.95 }), 0.27, 0.24, 0.2), 0, -0.02, 0.18);
    storm.add(cheek);
    const face = s.face({ parent: storm, radii: [0.27, 0.24, 0.2], center: new THREE.Vector3(0, -0.02, 0.18), eye: { yaw: 24, pitch: 6, size: 0.042 }, mouth: { pitch: -24, width: 0.05 }, brow: { color: 0x3b3a5a, thick: 0.012 }, cheeks: false });
    face.set('focus', 1e9);
    s.add(storm);

    // a zigzag of lightning
    const bolt = k.group();
    const zap = k.mat(0x222222, { emissive: 0xffe25a, emissiveIntensity: 2.2, rough: 0.4, rim: 0 });
    bolt.add(k.at(k.box(zap, 0.05, 0.2, 0.03, 0.01), 0, -0.1, 0, 0, 0, 0.5), k.at(k.box(zap, 0.05, 0.16, 0.03, 0.01), 0.06, -0.24, 0, 0, 0, -0.6), k.at(k.box(zap, 0.05, 0.18, 0.03, 0.01), 0.03, -0.38, 0, 0, 0, 0.45));
    s.add(bolt);

    const rain = s.swarm(dropGeometry(s, 0.022), k.mat(0x6fb8ff, { rough: 0.1, transparent: true, opacity: 0.85, depthWrite: false }), 16, (d, i, t) => {
      const a = i * 2.4;
      const r = 0.32 * Math.sqrt((i + 0.5) / 16);
      const u = (t * 2.2 + ((i * 0.618) % 1)) % 1;
      const top = storm.position.y - 0.18;
      const y = top + (teaY + CUP.y + 0.02 - top) * u;
      d.position.set(storm.position.x + Math.cos(a) * r, y, storm.position.z + Math.sin(a) * r * 0.8);
    });
    rain.castShadow = false;

    // a teaspoon for the hero
    const spoon = k.group();
    const silver = k.metal(0xe3e7ef, 0.25);
    spoon.add(k.at(k.cap(silver, 0.025, 0.5), 0, 0.22, 0), k.at(k.ball(silver, 0.08, 0.11, 0.035), 0, 0.5, 0));
    hero.hold('R', spoon, { rx: 0.6 });

    const shrug = (t) => keys(t, [[3.6, 0], [4.0, 1], [5.3, 1], [5.7, 0]]);
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      const peer = keys(t, [[0.2, 0], [0.8, 1], [3.4, 1], [3.8, 0]]);
      const sh = shrug(t);
      // leaning over the rim to look in
      P.torsoX += peer * 0.2;
      P.headX += peer * 0.32;
      P.armRX += -0.7 * (1 - sh) - 0.2 * peer;
      P.armLZ += 0.15;
      // then a shrug: palms up, head tilted — what a fuss about nothing
      P.armLZ += sh * 0.75;
      P.armRZ -= sh * 0.75;
      P.armLX += sh * -0.45;
      P.armRX += sh * -0.45;
      P.headZ += sh * 0.2;
      P.y += sh * 0.04;
    };

    return {
      update(t) {
        // the storm whirls round the cup, raging
        const a = t * 2.6;
        storm.position.set(CUP.x + Math.cos(a) * 0.14, CUP.y + teaY + 0.62 + Math.sin(t * 5) * 0.05, CUP.z + Math.sin(a) * 0.1);
        storm.rotation.z = Math.sin(t * 7) * 0.12;
        storm.scale.setScalar(1 + Math.sin(t * 11) * 0.03);
        // the tea sloshes
        tea.rotation.set(Math.sin(t * 6) * 0.08, 0, Math.cos(t * 5.3) * 0.08);
        tea.position.y = teaY + Math.sin(t * 9) * 0.012;
        // lightning
        const on = FLASHES.some((f) => t > f && t < f + 0.14);
        bolt.visible = on;
        bolt.position.set(storm.position.x + 0.05, storm.position.y - 0.1, storm.position.z + 0.05);
        for (const f of FLASHES) {
          if (s.cue(f)) {
            _v.set(storm.position.x, CUP.y + teaY + 0.05, storm.position.z);
            s.fx.burst(_v, { count: 12, color: 0xffe25a, color2: 0xffffff, speed: 2.5, size: 0.4, life: 0.35, gravity: 4, up: 1 });
          }
        }
        const sh = shrug(t);
        hero.mood(sh > 0.5 ? 'happy' : t > 0.6 ? 'surprised' : null);
      },
    };
  },
};

const _v = new THREE.Vector3();
