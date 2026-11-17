/**
 * On cloud nine: a big fluffy cloud with a golden 9 on it floats over the dais, a rainbow behind,
 * and the hero sits on top swinging its legs, arms in the air, beaming, as hearts and sparkles
 * drift up around it.
 */
import { sit } from '../actor.js';
import { cloud } from '../props.js';

const LOOP = 6;

function rainbow(s) {
  const { k } = s;
  const g = k.group();
  [0xff5d73, 0xff9a3d, 0xffd23f, 0x5ee06a, 0x5cc8ff, 0x8f7bff].forEach((c, i) => {
    g.add(k.torus(k.mat(c, { rough: 0.6, emissive: c, emissiveIntensity: 0.15 }), 1.75 - i * 0.12, 0.065, Math.PI));
  });
  return s.baked(g);
}

export default {
  id: 'on-cloud-nine',
  loop: LOOP,
  frame: { x: 0, y: 1.75, z: 0, w: 3.9, h: 3.6 },
  view: { yaw: 0.1, pitch: 0.1 },

  build(s) {
    const { k } = s;
    const hero = s.hero();
    hero.mood('happy');
    const bow = s.add(rainbow(s));
    bow.position.set(0, 1.0, -1.5);
    const puff = s.add(cloud(s, { w: 2.5, h: 1.05 }));
    // the big golden 9 on the front of the cloud
    const nine = s.label('9', { size: 1.25, color: '#ffc83d', stroke: '#b5650a' });
    const sign = k.group(nine);
    s.add(sign);
    const shadow = s.add(s.blob(1.1, 0.25));
    shadow.position.set(0, 0.02, 0.2);

    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      sit(P, { drop: 0.36, legs: 1.25 });
      // legs swinging over the edge, arms up, swaying with joy
      P.legLX += Math.sin(t * 4.2) * 0.3;
      P.legRX -= Math.sin(t * 4.2) * 0.3;
      const a = 2.2 + Math.sin(t * 3.1) * 0.15;
      P.armLZ += a;
      P.armRZ -= a;
      P.armLX += 0.2;
      P.armRX += 0.2;
      P.roll += Math.sin(t * 2.1) * 0.08;
      P.headZ += Math.sin(t * 2.1 + 0.5) * 0.12;
      P.headX += -0.08;
    };

    return {
      update(t, dt) {
        const bob = Math.sin((t / LOOP) * Math.PI * 4) * 0.12;
        puff.position.set(0, 0.95 + bob, 0);
        puff.rotation.z = Math.sin((t / LOOP) * Math.PI * 2) * 0.04;
        hero.root.position.set(0, 1.48 + bob, -0.05);
        sign.position.set(0.05, 0.86 + bob, 0.8);
        sign.rotation.z = Math.sin(t * 1.7) * 0.06;
        shadow.scale.setScalar(1 - bob * 0.4);
        // hearts and sparkles floating up
        if (Math.random() < dt * 9) {
          const x = (Math.random() - 0.5) * 2.4;
          s.fx.spark(x, 1.2 + Math.random() * 0.6, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.6, 0, Math.random() < 0.5 ? 0xff8fb8 : 0xffe08a, 0.5 + Math.random() * 0.4, 1.4, -0.2, 0.6);
        }
      },
    };
  },
};
