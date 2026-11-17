/**
 * Bark up the wrong tree: a dog, paws on the trunk, barks and barks up into a tree — an empty one.
 * The cat it is after sits smugly on a branch of the other tree, tail swishing, while the hero
 * points at it: "It's over there!"
 */
import * as THREE from 'three';
import { keys, clamp } from '../../../core/utils.js';
import { sit, point } from '../actor.js';
import { tree } from '../props.js';

const LOOP = 6;
const BARKS = [0.5, 1.25, 1.95, 3.6, 4.3, 5.0];
const CAT_TREE = new THREE.Vector3(-1.75, 0, -0.65);
const DOG_TREE = new THREE.Vector3(1.75, 0, -0.65);

export default {
  id: 'bark-up-the-wrong-tree',
  loop: LOOP,
  frame: { x: 0, y: 1.45, z: -0.1, w: 5.0, h: 3.3 },
  view: { yaw: 0.04, pitch: 0.1 },
  avoid: ['let-sleeping-dogs-lie'],

  build(s) {
    const { k } = s;
    const id = s.heroId;
    const hero = s.hero();
    const isDog = id === 'corgi' || id === 'bulldog';
    const dog = isDog ? hero : s.cast(s.other(['corgi', 'bulldog']));
    const cat = id === 'cat' ? hero : s.cast('cat');
    const bystander = hero !== dog && hero !== cat ? hero : null;

    const tA = s.add(tree(s, { h: 2.9, seed: 0 }));
    tA.position.copy(CAT_TREE);
    const tB = s.add(tree(s, { h: 2.9, seed: 1 }));
    tB.position.copy(DOG_TREE);
    // a branch for the cat to sit on
    const wood = k.mat(0x9a6740, { rough: 0.8 });
    const branch = k.at(k.cap(wood, 0.07, 1.0), CAT_TREE.x + 0.3, 1.52, CAT_TREE.z + 0.3, 0.6, 0, -1.25);
    s.add(branch);

    cat.root.scale.setScalar(0.62);
    cat.place(CAT_TREE.x + 0.55, CAT_TREE.z + 0.55, 0.35, 1.62);
    cat.pose = (P, t) => {
      cat.idle(P, { arms: false });
      sit(P, { drop: 0.36, legs: 1.3 });
      P.tailZ += Math.sin(t * 2.4) * 0.5;
      P.headY += -0.25 + Math.sin(t * 0.8) * 0.15;
      P.headZ += 0.12;
      // a cheeky little wave now and then
      const wave = keys(t, [[2.6, 0], [2.9, 1], [3.5, 1], [3.8, 0]]);
      P.armRZ += -wave * (2.2 + Math.sin(t * 12) * 0.25);
      P.armLZ += 0.12;
    };
    cat.mood('happy');

    const dogScale = 0.85;
    dog.root.scale.setScalar(dogScale);
    dog.place(DOG_TREE.x - 0.75, DOG_TREE.z + 0.55, 0.75);
    const barkAt = (t) => BARKS.reduce((m, b) => (t >= b && t - b < 0.35 ? Math.sin(((t - b) / 0.35) * Math.PI) : m), 0);
    dog.pose = (P, t) => {
      dog.idle(P, { arms: false });
      const b = barkAt(t);
      // up on the hind legs, front paws on the trunk, nose to the sky
      P.armLX += -2.1;
      P.armRX += -2.1;
      P.pitch += -0.12;
      P.headX += -0.55 - b * 0.25;
      P.sq += b * 0.08;
      P.y += b * 0.06;
      P.tailY += Math.sin(t * 16) * 0.5;
    };

    if (bystander) {
      bystander.place(-0.5, 0.8, 0.15);
      bystander.mood('surprised');
      bystander.pose = (P, t) => {
        bystander.idle(P, { arms: false });
        // pointing at the cat, looking round at the dog
        point(P, 'R', keys(t, [[0.2, 0], [0.6, 1], [5.4, 1], [5.9, 0]]), 0.9);
        P.headY += keys(t, [[0, 0.5], [1.5, 0.5], [2.0, -0.4], [3.2, -0.4], [3.7, 0.5]]);
        P.armLZ += 0.25;
        P.y += Math.max(0, Math.sin(t * 7)) * 0.04 * clamp(Math.sin(t * 1.1));
      };
    }

    // WOOF! bubbles float up towards the empty tree
    const woofs = [0, 1, 2].map(() => s.add(s.label('WOOF!', { size: 0.32, color: '#17123f', stroke: null, bg: '#fff6e3', pad: 0.35 })));

    return {
      update(t) {
        let n = 0;
        for (const b of BARKS) {
          const u = (t - b) / 1.1;
          if (u < 0 || u > 1 || n >= woofs.length) continue;
          const w = woofs[n++];
          w.visible = true;
          w.position.set(DOG_TREE.x - 0.85 + u * 0.3, 1.5 + u * 0.7, DOG_TREE.z + 1.35);
          w.scale.setScalar(Math.min(1, u * 6) * (u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1) + 0.001);
          w.rotation.z = -0.15 + Math.sin(u * 9) * 0.06;
        }
        for (; n < woofs.length; n++) woofs[n].visible = false;
        dog.mood(barkAt(t) > 0.1 ? 'surprised' : 'focus');
        // the empty tree's leaves shiver at each bark; the cat's tree is still
        tB.rotation.z = barkAt(t) * 0.02;
      },
    };
  },
};
