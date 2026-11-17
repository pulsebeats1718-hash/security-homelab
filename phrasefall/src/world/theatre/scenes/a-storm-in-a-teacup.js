/**
 * A storm in a teacup: in a giant teacup, a tiny, furious storm cloud rages over the tea — rain,
 * lightning, waves sloshing — while the hero, teaspoon in hand, peers in and then just shrugs.
 */
import * as THREE from 'three';
import { keys } from '../../../core/utils.js';
import { cloud, teacup, dropGeometry } from '../props.js';

const LOOP = 6;
const FLASHES = [0.6, 1.5, 2.3, 2.6, 3.5, 4.2, 5.2];
const CUP = new THREE.Vector3(0.55, 0, -0.05);

export default {
  id: 'a-storm-in-a-teacup',
  loop: LOOP,
  frame: { x: 0.15, y: 1.25, z: 0.1, w: 3.4, h: 2.8 },
  view: { yaw: 0.14, pitch: 0.22 },
  avoid: ['under-the-weather', 'make-a-mountain-out-of-a-molehill'],

  build(s) {
    const { k } = s;
    const hero = s.hero();
    hero.place(-1.05, 0.35, 0.3);
    hero.yaw = 0.62;

    const cup = s.add(teacup(s, { r: 0.8, color: 0xfff6e3, rim: 0x5cc8ff, tea: 0xb0703a }));
    cup.position.copy(CUP);
    const tea = cup.userData.surface;
    const teaY = tea.position.y;

    // the storm: a grumpy little cloud with a face, swirling over the tea
    const storm = k.group();
    storm.add(cloud(s, { w: 1.45, h: 0.7, dark: true }));
    const cheek = k.at(k.ball(k.mat(0x9aa0b8, { rough: 0.95 }), 0.36, 0.3, 0.26), 0, -0.06, 0.3);
    storm.add(cheek);
    const face = s.face({ parent: storm, radii: [0.36, 0.3, 0.26], center: new THREE.Vector3(0, -0.06, 0.3), eye: { yaw: 24, pitch: 8, size: 0.07 }, mouth: { pitch: -26, width: 0.08 }, brow: { color: 0x2f2e4a, thick: 0.02 }, cheeks: { color: 0xff7a7a, opacity: 0.5 } });
    face.set('focus', 1e9);
    s.add(storm);

    // a zigzag of lightning
    const bolt = k.group();
    const zap = k.mat(0x222222, { emissive: 0xffe25a, emissiveIntensity: 2.2, rough: 0.4, rim: 0 });
    bolt.add(k.at(k.box(zap, 0.08, 0.3, 0.04, 0.015), 0, -0.13, 0, 0, 0, 0.5), k.at(k.box(zap, 0.08, 0.24, 0.04, 0.015), 0.09, -0.34, 0, 0, 0, -0.6), k.at(k.box(zap, 0.08, 0.26, 0.04, 0.015), 0.04, -0.54, 0, 0, 0, 0.45));
    bolt.add(k.halo(0xfff2a0, 0.9, 0.7));
    bolt.scale.setScalar(1.35);
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
        storm.position.set(CUP.x + Math.cos(a) * 0.14, CUP.y + teaY + 0.95 + Math.sin(t * 5) * 0.05, CUP.z + Math.sin(a) * 0.1);
        storm.rotation.z = Math.sin(t * 7) * 0.12;
        storm.scale.setScalar(1 + Math.sin(t * 11) * 0.03);
        // the tea sloshes
        tea.rotation.set(Math.sin(t * 6) * 0.08, 0, Math.cos(t * 5.3) * 0.08);
        tea.position.y = teaY + Math.sin(t * 9) * 0.012;
        // lightning
        const on = FLASHES.some((f) => t > f && t < f + 0.22);
        bolt.visible = on;
        bolt.position.set(storm.position.x + 0.12, storm.position.y - 0.2, storm.position.z + 0.3);
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
