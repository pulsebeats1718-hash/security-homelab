/**
 * The elephant in the room: a cosy little sitting room — wallpaper, a window, a picture, a lamp —
 * with an enormous elephant squeezed into it. The hero sips tea and whistles, looking anywhere
 * but at it, even when the elephant waves its trunk and taps it on the shoulder.
 */
import * as THREE from 'three';
import { keys } from '../../../core/utils.js';
import { teacup } from '../props.js';

const LOOP = 7;
const TAP = [3.4, 4.6];

function room(s) {
  const { k } = s;
  const paper = k.mat(0xffe9c2, { rough: 0.9 });
  const stripe = k.mat(0xffd79a, { rough: 0.9 });
  const skirting = k.mat(0x8a5a3c, { rough: 0.6 });
  const frame = k.mat(0xfff6e3, { rough: 0.5 });
  const g = k.group();
  const W = 3.9;
  const H = 2.75;
  const back = -1.05;
  g.add(k.at(k.box(paper, W, H, 0.12, 0.03), 0, H / 2, back));
  for (let i = 0; i < 9; i++) g.add(k.at(k.box(stripe, 0.12, H - 0.2, 0.02, 0.01), -W / 2 + 0.3 + i * 0.42, H / 2, back + 0.065));
  g.add(k.at(k.box(paper, 0.12, H, 1.5, 0.03), -W / 2, H / 2, back + 0.7));
  g.add(k.at(k.box(skirting, W, 0.16, 0.05, 0.02), 0, 0.08, back + 0.07), k.at(k.box(skirting, 0.05, 0.16, 1.5, 0.02), -W / 2 + 0.07, 0.08, back + 0.7));
  // a window with curtains, high on the back wall
  g.add(k.at(k.box(frame, 1.0, 0.9, 0.06, 0.03), -0.85, 1.75, back + 0.08));
  g.add(k.at(k.box(k.mat(0x9fd8ff, { rough: 0.15, emissive: 0x5cc8ff, emissiveIntensity: 0.25 }), 0.86, 0.76, 0.04, 0.02), -0.85, 1.75, back + 0.1));
  g.add(k.at(k.box(frame, 0.05, 0.8, 0.05, 0.01), -0.85, 1.75, back + 0.13), k.at(k.box(frame, 0.9, 0.05, 0.05, 0.01), -0.85, 1.75, back + 0.13));
  const curtain = k.mat(0xe8505b, { rough: 0.9 });
  k.both((sd) => g.add(k.at(k.box(curtain, 0.24, 1.05, 0.06, 0.05), -0.85 + sd * 0.6, 1.72, back + 0.16)));
  // a framed picture of a hill
  g.add(k.at(k.box(k.mat(0xc9a14a, { metal: 0.4, rough: 0.4 }), 0.66, 0.5, 0.05, 0.02), 0.95, 1.95, back + 0.08));
  g.add(k.at(k.box(k.mat(0xbfe7ff), 0.54, 0.38, 0.03, 0.01), 0.95, 1.95, back + 0.1));
  g.add(k.at(k.ball(k.mat(0x6fc35a), 0.3, 0.13, 0.02), 0.92, 1.8, back + 0.12));
  // a rug, and a standard lamp in the corner
  g.add(k.at(k.cyl(k.mat(0x5cc8ff, { rough: 0.95 }), 1.55, 1.55, 0.02, 40), 0, 0.012, -0.05));
  g.add(k.at(k.cyl(k.mat(0xfff6e3, { rough: 0.95 }), 1.35, 1.35, 0.022, 40), 0, 0.014, -0.05));
  g.add(k.at(k.cyl(skirting, 0.02, 0.02, 1.7, 8), -1.55, 0.85, back + 0.4), k.at(k.cyl(skirting, 0.18, 0.2, 0.04, 16), -1.55, 0.02, back + 0.4));
  g.add(k.at(k.cyl(k.mat(0xffc83d, { rough: 0.6 }), 0.16, 0.28, 0.32, 20, true), -1.55, 1.78, back + 0.4));
  const out = k.group(s.baked(g));
  const bulb = k.halo(0xffe2a0, 1.1, 0.55);
  bulb.position.set(-1.55, 1.72, back + 0.4);
  out.add(bulb);
  return out;
}

/** A big friendly elephant sitting down, facing +Z. Returns { group, head, trunk: [segments], face, ears }. */
function elephant(s) {
  const { k } = s;
  const grey = k.mat(0xa9b1cf, { rough: 0.7 });
  const pale = k.mat(0xc6cce3, { rough: 0.7 });
  const pink = k.mat(0xffb3c7, { rough: 0.8 });
  const nail = k.mat(0xfff6e3, { rough: 0.4 });
  const g = k.group();
  const body = k.group();
  body.add(k.at(k.ball(grey, 0.78, 0.82, 0.7), 0, 0.85, 0));
  body.add(k.at(k.ball(pale, 0.5, 0.55, 0.3), 0, 0.78, 0.45));
  // sitting: haunches out to the sides, feet forward with toenails, front legs down the middle
  k.both((sd) => {
    body.add(k.at(k.ball(grey, 0.38, 0.32, 0.45), sd * 0.6, 0.35, 0.1));
    body.add(k.at(k.cap(grey, 0.2, 0.5), sd * 0.62, 0.22, 0.55, Math.PI / 2, 0, 0));
    body.add(k.at(k.cap(grey, 0.2, 0.75), sd * 0.3, 0.5, 0.52, 0.15, 0, 0));
    for (const dx of [-0.07, 0.07]) {
      body.add(k.at(k.ball(nail, 0.05, 0.04, 0.03), sd * 0.62 + dx, 0.12, 0.82));
      body.add(k.at(k.ball(nail, 0.05, 0.04, 0.03), sd * 0.3 + dx, 0.14, 0.66));
    }
  });
  body.add(k.at(k.cap(grey, 0.04, 0.45), 0.35, 0.4, -0.65, -0.6, 0, 0.6));
  g.add(s.baked(body));
  // head, with flapping ears and a trunk made of segments that can curl
  const head = k.at(k.group(), 0, 1.78, 0.18);
  head.add(k.ball(grey, 0.58, 0.53, 0.52));
  const ears = [];
  k.both((sd) => {
    const ear = k.at(k.group(), sd * 0.45, 0.05, -0.05);
    ear.add(k.at(k.ball(grey, 0.07, 0.5, 0.42), sd * 0.18, -0.05, 0, 0, sd * 0.5, 0));
    ear.add(k.at(k.ball(pink, 0.04, 0.38, 0.3), sd * 0.2, -0.05, 0.05, 0, sd * 0.5, 0));
    head.add(ear);
    ears.push({ ear, sd });
  });
  const trunk = [];
  let parent = head;
  for (let i = 0; i < 6; i++) {
    const seg = k.at(k.group(), 0, i === 0 ? -0.12 : -0.17, i === 0 ? 0.42 : 0);
    const r = 0.16 - i * 0.017;
    seg.add(k.at(k.cap(grey, r, 0.26), 0, -0.08, 0));
    if (i === 5) seg.add(k.at(k.ball(pink, r * 0.9, 0.03, r * 0.9), 0, -0.2, 0));
    parent.add(seg);
    trunk.push(seg);
    parent = seg;
  }
  g.add(head);
  const face = s.face({ parent: head, radii: [0.58, 0.53, 0.52], eye: { yaw: 30, pitch: 14, size: 0.07 }, mouth: false, cheeks: { color: 0xff9db3, yaw: 40, pitch: -8, size: 0.09 }, brow: { color: 0x5a6280, thick: 0.014 } });
  face.set('happy', 1e9);
  return { group: g, head, trunk, face, ears };
}

export default {
  id: 'the-elephant-in-the-room',
  loop: LOOP,
  frame: { x: 0, y: 1.3, z: -0.1, w: 4.0, h: 3.0 },
  view: { yaw: 0.12, pitch: 0.12 },
  avoid: ['the-tip-of-the-iceberg'],

  build(s) {
    const { k } = s;
    s.add(room(s));
    const hero = s.hero();
    hero.place(-0.95, 0.45, 0.2);
    const el = elephant(s);
    el.group.position.set(0.75, 0, -0.3);
    el.group.rotation.y = -0.35;
    el.group.scale.setScalar(0.9);
    s.add(el.group);

    // a cup of tea on its saucer in the hero's hand
    const cup = teacup(s, { r: 0.13, rim: 0xff5d73 });
    hero.hold('L', cup, { upright: true, y: 0.02, z: 0.05 });

    // whistling: notes drift up from the hero
    const notes = [0, 1, 2].map(() => s.add(s.label('♪', { size: 0.34, color: '#ffc83d' })));

    const tapping = (t) => keys(t, [[TAP[0] - 0.5, 0], [TAP[0], 1], [TAP[1], 1], [TAP[1] + 0.5, 0]]);
    hero.pose = (P, t) => {
      hero.idle(P, { arms: false });
      // sipping now and then; eyes firmly elsewhere
      const sip = keys(t % 3.5, [[0.8, 0], [1.2, 1], [1.9, 1], [2.3, 0]]);
      P.armLX += -0.9 - sip * 0.7;
      P.armLZ += -0.2 - sip * 0.3;
      P.armRZ += -0.15;
      P.headY += -0.55;
      P.headX += -0.12 + sip * 0.15;
      P.headZ += 0.1;
      const tap = tapping(t);
      // each tap: a tiny jolt, but no looking round
      P.sq += Math.max(0, Math.sin((t - TAP[0]) * 9)) * 0.04 * tap;
    };

    return {
      update(t) {
        const tap = tapping(t);
        // the trunk sways and curls; then reaches across to tap the hero
        el.trunk.forEach((seg, i) => {
          const sway = Math.sin(t * 1.6 - i * 0.5) * 0.12 * (1 - tap);
          const curl = (0.1 + i * 0.05) * (1 - tap) + Math.sin(t * 1.1) * 0.05;
          const reach = tap * (i < 2 ? -0.55 : 0.12);
          seg.rotation.set(-curl + reach * 0.4 - (i === 5 ? Math.max(0, Math.sin((t - TAP[0]) * 9)) * 0.5 * tap : 0), 0, sway - tap * (i < 3 ? 0.42 : 0.1));
        });
        el.head.rotation.set(Math.sin(t * 0.9) * 0.04, -0.15 - tap * 0.35, Math.sin(t * 0.7) * 0.05);
        for (const { ear, sd } of el.ears) ear.rotation.y = sd * (0.15 + Math.sin(t * 2.3) * 0.18);
        el.group.position.y = Math.max(0, Math.sin(t * 1.4)) * 0.02;
        // musical notes from the whistling hero
        notes.forEach((n, i) => {
          const u = (t * 0.55 + i / 3) % 1;
          hero.rig.head.getWorldPosition(_v);
          n.position.set(_v.x - 0.35 - u * 0.5, _v.y + 0.55 + u * 0.9, _v.z + 0.3);
          n.rotation.z = Math.sin(t * 3 + i) * 0.3;
          n.scale.setScalar(Math.sin(u * Math.PI) * 1.1 + 0.001);
        });
        hero.mood(tap > 0.5 ? 'happy' : 'neutral');
        const face = tap > 0.4 ? 'happy' : Math.sin(t * 0.8) > 0.6 ? 'surprised' : 'happy';
        if (el.face.current !== face) el.face.set(face, 1e9);
      },
    };
  },
};

const _v = new THREE.Vector3();
