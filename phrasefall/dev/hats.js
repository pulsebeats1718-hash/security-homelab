// Hat contact sheet: one cell per (character, hat), rows = characters, columns = hats.
//   ?ids=fox,cat,wizard   characters (default: all)
//   &hats=none,top-hat     hats (default: none + every hat)
//   &yaw=25 &pitch=6       view angle of the character (degrees)
//   &clip=cheer&u=0.4      pose: an action clip frozen at u (default: idle)
//   &cell=190              cell size in px      &full=1   whole body instead of the head
//   &sil=1                 locked silhouette    &t=0      idle time (pose seed)
//   &wrap=4                lay the characters out in 4 blocks side by side
// A red label means setHat() returned false (that character does not wear that hat).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CHARACTERS, createCharacter } from '../src/characters/index.js';
import { CLIPS } from '../src/characters/animator.js';
import { HATS, setHat } from '../src/characters/kit/hats.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.get(k) != null ? Number(q.get(k)) : d);
const ids = q.get('ids') ? q.get('ids').split(',') : CHARACTERS.map((c) => c.id);
const hats = q.get('hats') ? q.get('hats').split(',') : ['none', ...HATS.map((h) => h.id)];
const CELL = num('cell', 190);
const full = q.get('full') === '1';
const yaw = (num('yaw', 0) * Math.PI) / 180;
const pitch = (num('pitch', 6) * Math.PI) / 180;
const clipName = q.get('clip');
const fixedU = num('u', 0.5);

const WRAP = Math.max(1, num('wrap', 1));
const W = hats.length * CELL * Math.min(WRAP, ids.length);
const H = Math.ceil(ids.length / WRAP) * CELL;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setScissorTest(true);
const wrap = document.getElementById('wrap');
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x7a6a5a, 0.75));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
sun.position.set(4, 9, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 4, bottom: -1, near: 0.5, far: 30 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);
const rim = new THREE.DirectionalLight(0xa9c8ff, 1.2);
rim.position.set(-5, 5, -7);
scene.add(rim);
const ground = new THREE.Mesh(new THREE.CircleGeometry(8, 40), new THREE.MeshStandardMaterial({ color: 0x8fcf8a, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(full ? 26 : 22, 1, 0.1, 60);
const target = new THREE.Vector3();
const bg = q.get('sil') ? new THREE.Color(0x1b1440) : new THREE.Color(0x9fd3f5);

function pose(ch) {
  const a = ch.animator;
  a.t = num('t', 0);
  if (clipName && CLIPS[clipName]) {
    a.play(clipName);
    for (let i = 0; i < 3; i++) {
      a.clip.t = fixedU * a.clip.dur;
      a.clip.fired = 99;
      a.update(1 / 60);
      if (!a.clip) a.play(clipName);
    }
    if (a.clip) a.clip.t = fixedU * a.clip.dur;
  } else {
    for (let i = 0; i < 6; i++) a.update(1 / 30);
  }
}

const label = (txt, x, y, bad) => {
  const d = document.createElement('div');
  d.className = bad ? 'lbl no' : 'lbl';
  d.textContent = txt;
  d.style.left = `${x}px`;
  d.style.top = `${y}px`;
  wrap.appendChild(d);
};

const t0 = performance.now();
const results = {};
ids.forEach((id, i) => {
  const row = Math.floor(i / WRAP);
  const x0 = (i % WRAP) * hats.length * CELL;
  let ch;
  try {
    ch = createCharacter(id);
  } catch (e) {
    console.error(`${id} failed to build: ${e?.stack ?? e}`);
    return;
  }
  if (q.get('sil')) ch.rig.setSilhouette(true);
  ch.rig.root.rotation.y = yaw;
  scene.add(ch.rig.root);
  results[id] = {};
  hats.forEach((hat, col) => {
    let worn = true;
    try {
      worn = setHat(ch.rig, hat === 'none' ? null : hat);
    } catch (e) {
      console.error(`${id} + ${hat}: ${e?.stack ?? e}`);
      worn = false;
    }
    results[id][hat] = worn;
    pose(ch);
    ch.rig.root.updateMatrixWorld(true);
    const R = ch.rig.headRadii;
    let span;
    if (full) {
      target.set(0, (ch.rig.metrics.height + 0.5) / 2, 0);
      span = ch.rig.metrics.height + 1.1;
    } else {
      ch.rig.head.localToWorld(target.copy(ch.rig.headCenter));
      target.y += R[1] * 0.55;
      span = R[1] * 2 + 1.25;
    }
    const dist = span / (2 * Math.tan((camera.fov * Math.PI) / 360));
    camera.position.set(target.x, target.y + Math.sin(pitch) * dist, target.z + Math.cos(pitch) * dist);
    camera.lookAt(target);
    const x = x0 + col * CELL;
    const y = H - (row + 1) * CELL;
    renderer.setViewport(x, y, CELL, CELL);
    renderer.setScissor(x, y, CELL, CELL);
    renderer.setClearColor(bg);
    renderer.clear();
    renderer.render(scene, camera);
    label(`${id} · ${hat}`, x, row * CELL, hat !== 'none' && !worn);
  });
  setHat(ch.rig, null);
  ch.rig.dispose();
});
console.log(`rendered ${ids.length * hats.length} cells in ${Math.round(performance.now() - t0)} ms`);
window.__results = results;
window.__ready = true;
