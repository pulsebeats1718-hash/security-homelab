/**
 * Let the cat out of the bag: a sack on the dais wriggles and bulges; the hero leans in,
 * curious, and pulls the ribbon — and out pops a cat, arms up, delighted. The hero jumps back
 * in surprise; the cat ducks back in and the sack ties itself up again.
 */
import * as THREE from 'three';
import { keys, ease, clamp } from '../../../core/utils.js';
import { gasp } from '../actor.js';
import { hessian, folded } from '../props.js';

const LOOP = 6.6;
const SACK = new THREE.Vector3(0.5, 0, 0.12);

export default {
  id: 'let-the-cat-out-of-the-bag',
  loop: LOOP,
  frame: { x: 0.05, y: 1.25, z: 0.1, w: 3.6, h: 3.0 },
  view: { yaw: 0.12, pitch: 0.13 },
  avoid: ['spill-the-beans'],

  build(s) {
    const { k } = s;
    // who plays whom: the hero is the cat if it is one; otherwise the hero opens the sack
    const heroIsCat = s.heroId === 'cat';
    const hero = s.hero();
    const cat = heroIsCat ? hero : s.cast('cat', { scale: 0.86 });
    const opener = heroIsCat ? s.cast(s.other(['panda', 'penguin', 'bear'])) : hero;
    opener.place(-0.95, 0.15, 0.55);
    if (heroIsCat) hero.root.scale.setScalar(0.86);
    cat.place(SACK.x, SACK.z + 0.05, -0.15);

    // the sack: soft hessian, gathered in folds at a ruffled neck, tied with a red bow
    const burlap = hessian(s);
    const sack = k.group();
    const body = k.mesh(folded(s, [[0, 0], [0.46, 0.01], [0.7, 0.18], [0.76, 0.5], [0.68, 0.82], [0.5, 1.0], [0.37, 1.08]], { folds: 7, amp: 0.05, rise: 1.5 }), burlap);
    const neck = k.at(k.mesh(folded(s, [[0.35, 0], [0.32, 0.07], [0.4, 0.17], [0.52, 0.26]], { folds: 9, amp: 0.12, rise: 0.5 }), burlap), 0, 1.04, 0);
    const patch = k.at(k.box(k.mat(0xb08a52, { rough: 0.95 }), 0.26, 0.22, 0.04, 0.03), 0.2, 0.42, 0.7, 0, 0.28, 0.1);
    const stitch = k.mat(0x6b4a2a);
    [[-0.08], [0], [0.08]].forEach(([x]) => patch.add(k.at(k.box(stitch, 0.012, 0.05, 0.02, 0.005), x * 1.2, 0.1, 0.02)));
    const bow = k.group();
    const red = k.mat(0xe8323c, { rough: 0.45 });
    bow.add(k.at(k.torus(red, 0.37, 0.035), 0, 0, 0, Math.PI / 2, 0, 0));
    k.both((sd) => bow.add(k.at(k.ball(red, 0.12, 0.07, 0.04), sd * 0.13, 0.02, 0.37, 0, 0, sd * 0.35)));
    bow.add(k.at(k.ball(red, 0.045), 0, 0.01, 0.38));
    bow.position.y = 1.07;
    sack.add(body, neck, patch, bow);
    sack.position.copy(SACK);
    s.add(sack);

    // a "?" floats over the wriggling sack
    const what = s.add(s.label('?', { size: 0.55, color: '#ffc83d' }));

    const popAt = 2.05;
    const duck = 4.75;
    const rise = (t) => keys(t, [[popAt - 0.05, 0], [popAt + 0.22, 1.08], [popAt + 0.42, 0.96], [popAt + 0.6, 1], [duck, 1], [duck + 0.42, 0]], ease.outQuad);

    cat.pose = (P, t) => {
      cat.idle(P, { arms: false });
      const up = rise(t);
      // hidden below the floor until it pops up, standing in the sack
      P.y += -2.3 + up * 2.92;
      cat.clip(P, 'cheer', clamp((t - popAt) / 0.8), up);
      const wave = t > popAt + 0.8 && t < duck ? 1 : 0;
      if (wave) {
        P.armRZ += -2.3 + Math.sin(t * 9) * 0.25;
        P.armLZ += 0.5;
        P.headZ += Math.sin(t * 2.2) * 0.12;
      }
    };
    opener.pose = (P, t) => {
      opener.idle(P, { arms: false });
      const lean = keys(t, [[0.4, 0], [1.2, 1], [popAt, 1], [popAt + 0.15, 0]]);
      const reach = keys(t, [[1.3, 0], [1.75, 1], [popAt, 1], [popAt + 0.15, 0]]);
      P.torsoX += lean * 0.22;
      P.headZ += lean * 0.18;
      P.headX += lean * 0.15;
      P.armLX += reach * -1.3;
      P.armLZ += reach * -0.1;
      // the surprise: a jump back, hands to mouth
      const jump = clamp((t - popAt) / 0.35);
      P.y += Math.sin(jump * Math.PI) * 0.22;
      P.x -= keys(t, [[popAt, 0], [popAt + 0.35, 0.3], [5.6, 0.3], [6.3, 0]]);
      const shock = keys(t, [[popAt + 0.1, 0], [popAt + 0.3, 1], [5.4, 1], [6.0, 0]]);
      gasp(P, shock);
      P.pitch += shock * -0.08;
    };
    opener.yaw = 0.55;

    return {
      update(t, dt) {
        // the sack wriggles before the cat comes out, and bulges as it squeezes past
        const shut = t < popAt || t > duck + 0.3;
        const wig = shut ? Math.sin(t * 13) * (0.5 + 0.5 * Math.sin(t * 2.3)) : 0;
        const pop = Math.sin(clamp((t - popAt + 0.1) / 0.4) * Math.PI);
        sack.scale.set(1 + wig * 0.05 + pop * 0.12, 1 - wig * 0.04 - pop * 0.06, 1 + wig * 0.05 + pop * 0.12);
        sack.rotation.z = wig * 0.05;
        // the neck opens round the cat and closes again
        const open = keys(t, [[popAt - 0.15, 0], [popAt + 0.05, 1], [duck + 0.2, 1], [duck + 0.6, 0]]);
        neck.scale.set(1 + open * 0.65, 1 - open * 0.35, 1 + open * 0.65);
        body.scale.set(1 + open * 0.06, 1, 1 + open * 0.06);
        // the bow: pulled off, tossed aside, then it ties itself again
        const off = keys(t, [[1.7, 0], [popAt, 1], [duck + 0.5, 1], [duck + 0.9, 0]]);
        bow.scale.setScalar(Math.max(0.001, 1 - off));
        bow.position.set(-off * 0.3, 1.07 + Math.sin(off * Math.PI) * 0.4, off * 0.2);
        // the question mark bobs over the sack while it wriggles
        const q = shut && t < popAt - 0.2 ? clamp(Math.min(t / 0.3, (popAt - 0.2 - t) / 0.2)) : 0;
        what.position.set(SACK.x + 0.1, 1.9 + Math.sin(t * 4) * 0.06, SACK.z + 0.2);
        what.scale.setScalar(Math.max(0.001, q));
        what.rotation.z = Math.sin(t * 3) * 0.15;
        cat.mood(t > popAt - 0.1 ? 'happy' : null);
        opener.mood(t < popAt - 0.1 ? 'focus' : t < 5.5 ? 'surprised' : null);
        if (s.cue(popAt + 0.12)) {
          _p.set(SACK.x, 1.4, SACK.z + 0.3);
          s.fx.burst(_p, { count: 26, color: 0xffe08a, color2: 0xb48cff, speed: 4.5, size: 0.55, life: 0.7, gravity: 3, up: 1.6 });
          s.sound('pop');
        }
      },
    };
  },
};

const _p = new THREE.Vector3();
