/**
 * Under the weather: a sunny day everywhere except right over the hero, where a little grey
 * cloud rains on it and it alone. Wrapped in a woolly scarf, a thermometer in its mouth, the
 * hero shivers, shuffles aside (the cloud follows) and sneezes. Bless you!
 */
import * as THREE from 'three';
import { keys, clamp } from '../../../core/utils.js';
import { cloud, sun, dropGeometry } from '../props.js';

const LOOP = 6.4;
const SNEEZE = 3.6;

export default {
  id: 'under-the-weather',
  loop: LOOP,
  frame: { x: 0.1, y: 1.6, z: 0.2, w: 3.6, h: 3.7 },
  view: { yaw: 0.16, pitch: 0.12 },
  avoid: ['rain-cats-and-dogs', 'a-storm-in-a-teacup'],

  build(s) {
    const { k } = s;
    const hero = s.hero();
    hero.place(0, 0.2, 0);
    hero.mood('worried');

    // a woolly scarf round the neck, ends hanging down the front
    const wool = k.mat(0x3ddbb4, { rough: 0.95 });
    const stripe = k.mat(0xfff6e3, { rough: 0.95 });
    const scarf = k.group();
    const neckY = (hero.rig.metrics.torsoTop ?? 0.68) - 0.04;
    scarf.add(k.at(k.torus(wool, 0.3, 0.085), 0, neckY, 0.02, Math.PI / 2 + 0.12, 0, 0));
    scarf.add(k.at(k.torus(stripe, 0.305, 0.05), 0, neckY + 0.07, 0.01, Math.PI / 2 + 0.12, 0, 0));
    const tail = k.group();
    tail.add(k.at(k.box(wool, 0.16, 0.42, 0.06, 0.03), 0, -0.18, 0));
    tail.add(k.at(k.box(stripe, 0.165, 0.06, 0.065, 0.02), 0, -0.12, 0));
    tail.add(k.at(k.box(stripe, 0.165, 0.06, 0.065, 0.02), 0, -0.3, 0));
    tail.position.set(0.15, neckY - 0.02, 0.36);
    tail.rotation.set(-0.25, 0, 0.12);
    scarf.add(tail);
    hero.attach('torso', scarf);

    // a thermometer sticking out of the mouth
    const thermo = k.group();
    thermo.add(k.at(k.cap(k.glass(0xeaf6ff, 0.55), 0.03, 0.4), 0, 0, 0.13, Math.PI / 2, 0, 0));
    const mercury = k.at(k.cap(k.mat(0xff3b4f, { emissive: 0xff2040, emissiveIntensity: 0.4 }), 0.014, 0.3), 0, 0, 0.1, Math.PI / 2, 0, 0);
    thermo.add(mercury, k.at(k.ball(k.mat(0xff3b4f), 0.035), 0, 0, -0.04));
    const mouth = hero.rig.face?.mouth?.root;
    if (mouth) hero.attach(mouth, thermo, { ry: 0.45, rx: 0.25 });
    else hero.attach('head', thermo, { y: hero.rig.headCenter.y - 0.2, z: (hero.rig.headRadii?.[2] ?? 0.53) * 0.95, ry: 0.45, rx: 0.25 });

    // the personal rain cloud, and a sunny day for everybody else
    const rain = s.add(cloud(s, { w: 1.5, h: 0.62, dark: true }));
    const sunny = s.add(sun(s, { r: 0.42 }));
    sunny.position.set(-1.55, 3.5, -1.2);
    sunny.userData.face.set('happy', 1e9);
    const top = hero.height + 0.18;
    const drops = s.swarm(dropGeometry(s, 0.03), k.mat(0x6fb8ff, { rough: 0.1, transparent: true, opacity: 0.8, depthWrite: false }), 26, (d, i, t) => {
      const a = i * 2.39996;
      const r = 0.55 * Math.sqrt((i + 0.5) / 26);
      const x = rain.position.x + Math.cos(a) * r;
      const z = rain.position.z + Math.sin(a) * r * 0.7;
      const u = (t * 1.6 + ((i * 0.618) % 1)) % 1;
      const fromY = rain.position.y - 0.2;
      const head = Math.hypot(x - hero.root.position.x, (z - hero.root.position.z) * 1.3) < 0.48;
      const floor = head ? top - 0.12 : 0.02;
      d.position.set(x, fromY + (floor - fromY) * u, z);
      return d.position.y > floor;
    });
    drops.castShadow = false;
    const shade = s.add(s.blob(0.75, 0.22));

    // shuffle aside... and the cloud follows
    const stepX = (t) => keys(t, [[0.6, 0.35], [1.5, -0.45], [4.6, -0.45], [5.6, 0.35]]);
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false, own: false });
      const moving = t > 0.6 && t < 1.5 ? 1 : t > 4.6 && t < 5.6 ? 1 : 0;
      const c = t * 8;
      P.legLX += moving * Math.sin(c) * 0.35;
      P.legRX -= moving * Math.sin(c) * 0.35;
      P.y += moving * Math.abs(Math.cos(c)) * 0.04;
      // shivering, arms hugging the body
      P.x += Math.sin(t * 47) * 0.012;
      P.armLZ += -0.15 + Math.sin(t * 40) * 0.03;
      P.armRZ += 0.15 - Math.sin(t * 40) * 0.03;
      P.armLX += -0.75;
      P.armRX += -0.75;
      P.headX += 0.12;
      P.headZ += Math.sin(t * 0.8) * 0.06;
      // the sneeze: a breath in, then ATCHOO
      const inhale = keys(t, [[SNEEZE - 0.7, 0], [SNEEZE, 1], [SNEEZE + 0.05, 0]]);
      const blow = keys(t, [[SNEEZE, 0], [SNEEZE + 0.08, 1], [SNEEZE + 0.5, 0]]);
      P.headX += -inhale * 0.35 + blow * 0.45;
      P.torsoX += -inhale * 0.1 + blow * 0.18;
      P.sq += inhale * 0.06 - blow * 0.12;
    };

    return {
      update(t, dt) {
        hero.root.position.x = stepX(t);
        // the cloud trails after the hero, a little late
        const want = stepX(t - 0.45);
        rain.position.set(want + Math.sin(t * 1.3) * 0.05, top + 0.75 + Math.sin(t * 2) * 0.05, 0.05);
        rain.rotation.z = (stepX(t) - want) * 0.25;
        shade.position.set(rain.position.x, 0.02, 0.15);
        mercury.scale.y = 0.75 + 0.25 * Math.sin(t * 1.4) ** 2;
        sunny.userData.rays.rotation.z = t * 0.3;
        hero.mood(t > SNEEZE - 0.05 && t < SNEEZE + 0.5 ? 'hurt' : 'worried');
        if (s.cue(SNEEZE + 0.05)) {
          hero.rig.head.getWorldPosition(_p);
          _p.y += 0.2;
          _p.z += 0.5;
          s.fx.burst(_p, { count: 18, color: 0xe6f6ff, color2: 0x9fd8ff, speed: 3.5, size: 0.4, life: 0.5, gravity: 2, spread: 0.2, up: 0.3 });
        }
      },
    };
  },
};

const _p = new THREE.Vector3();
