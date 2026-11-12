// Development contact sheet: every character side by side under game-like lighting.
// Params: ?ids=fox,robot &clip=cheer &u=0.4 &expr=happy &yaw=30 &sil=1 &cols=4 &pitch=8 &bg=dawn
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createKit } from '../src/characters/kit/kit.js';
import { Animator, CLIPS } from '../src/characters/animator.js';

// Load models lazily and independently so one broken file never hides the others.
const loaders = import.meta.glob('../src/characters/models/*.js');
const available = Object.keys(loaders).map((p) => p.split('/').pop().replace('.js', '')).sort();

const q = new URLSearchParams(location.search);
const ids = q.get('ids') ? q.get('ids').split(',') : available;
const cols = Number(q.get('cols')) || Math.min(ids.length, 6);
const rows = Math.ceil(ids.length / cols);
const yaw = ((Number(q.get('yaw')) || 0) * Math.PI) / 180;
const camPitch = ((Number(q.get('pitch') ?? 6)) * Math.PI) / 180;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(q.get('bg') === 'dark' ? 0x1b1440 : 0x9fd3f5);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x7a6a5a, 0.75));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
sun.position.set(4, 9, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const span = Math.max(cols * 1.6, rows * 2.2) + 2;
Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.5, far: 40 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);
const rim = new THREE.DirectionalLight(0xa9c8ff, 1.2);
rim.position.set(-5, 5, -7);
scene.add(rim);

const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: 0x6fbf73, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const SPX = 2.3;
const SPZ = 3.2;
const defs = await Promise.all(
  ids.map(async (id) => {
    try {
      // load straight from the server (cache-busted) so files created after start-up work too
      return (await import(/* @vite-ignore */ `/src/characters/models/${id}.js?t=${Date.now()}`)).default;
    } catch (e) {
      console.error(`model "${id}" failed to load: ${e?.message ?? e}`);
      return null;
    }
  })
);
const chars = defs.map((def, i) => {
  if (!def) return null;
  let ch;
  try {
    const k = createKit();
    const rig = def.build(k) ?? k.rig;
    rig.captureRest();
    ch = { def, rig, animator: new Animator(rig, def) };
  } catch (e) {
    console.error(`model "${ids[i]}" failed to build: ${e?.stack ?? e}`);
    return null;
  }
  const col = i % cols;
  const row = Math.floor(i / cols);
  ch.rig.root.position.set((col - (cols - 1) / 2) * SPX, 0, (row - (rows - 1) / 2) * SPZ);
  ch.rig.root.rotation.y = yaw;
  if (q.get('sil')) ch.rig.setSilhouette(true);
  scene.add(ch.rig.root);
  return ch;
}).filter(Boolean);

const aspect = innerWidth / innerHeight;
const camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 200);
const needW = cols * SPX + 0.6;
const needH = rows * 2.6 + (rows - 1) * 0.6 + 0.5;
const dist = Math.max(needH / (2 * Math.tan((15 * Math.PI) / 180)), needW / (2 * Math.tan((15 * Math.PI) / 180) * aspect)) * (Number(q.get('zoom')) ? 1 / Number(q.get('zoom')) : 1);
const cy = Number(q.get('cy') ?? 1.05);
camera.position.set(0, cy + Math.sin(camPitch) * dist, Math.cos(camPitch) * dist);
camera.lookAt(0, cy, 0);

const clipName = q.get('clip');
const fixedU = q.get('u') != null ? Number(q.get('u')) : null;
const expr = q.get('expr');
const gaze = q.get('gaze') != null ? Number(q.get('gaze')) : 0;
const worry = q.get('worry') != null ? Number(q.get('worry')) : 0;
let last = performance.now();
let loopT = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  loopT += dt;
  for (const ch of chars) {
    const a = ch.animator;
    a.gazeUp = gaze;
    a.worry = worry;
    if (clipName && CLIPS[clipName]) {
      if (fixedU != null) {
        if (!a.clip) a.play(clipName);
        a.clip.t = fixedU * a.clip.dur;
        a.clip.fired = 99;
        a.update(0.0001);
        a.clip && (a.clip.t = fixedU * a.clip.dur);
        ch.rig.face?.update(0.05);
      } else {
        if (!a.clip && loopT % 2.2 < 0.1) a.play(clipName);
        a.update(dt);
      }
    } else {
      a.update(dt);
    }
    if (expr && ch.rig.face) ch.rig.face.set(expr);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__ready = true;
