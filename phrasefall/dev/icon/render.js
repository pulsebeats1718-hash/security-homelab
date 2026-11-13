// App icon, step 1: Maple the fox, rendered by the game's own engine on a transparent background.
// render-fox.cjs opens this page and saves the picture; make-icons.sh composites it with the SVG layers.
// Query parameters (all optional):
//   size  canvas size in px              yaw   body turn in degrees (+ = towards the viewer's right)
//   gu    upward gaze 0…1                gx    sideways gaze −1…1 (+ = viewer's right)
//   cam   camera offset from the head centre "x,y,z"   look  look-at offset from the head centre "x,y,z"
//   fov   vertical field of view          face  delight | happy | surprised | neutral
//   key, rim, rim2, hemi, env            light strengths
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCharacter } from '../../src/characters/index.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const vec = (k, d) => (q.has(k) ? q.get(k).split(',').map(Number) : d);
const SIZE = num('size', 2048);

const canvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.setClearColor(0x000000, 0);
document.body.append(canvas);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = num('env', 0.4);
// dusk light: violet sky above, a warm glow from below, the golden speech bubble up and to the right
scene.add(new THREE.HemisphereLight(0xd8ccff, 0xffb28c, num('hemi', 0.9)));
const key = new THREE.DirectionalLight(0xffe2a6, num('key', 2.5));
key.position.set(4, 6, 6);
const rim = new THREE.DirectionalLight(0x9fb2ff, num('rim', 2.4));
rim.position.set(-5, 3, -5);
const rim2 = new THREE.DirectionalLight(0xff9ccf, num('rim2', 1.6));
rim2.position.set(5, 1, -4);
scene.add(key, rim, rim2);

const { rig, animator } = createCharacter(q.get('id') ?? 'fox');
rig.root.rotation.y = (num('yaw', 8) * Math.PI) / 180;
scene.add(rig.root);

// one fixed moment: no random glances, no blinking
animator.t = 0;
animator._glanceT = Infinity;
animator._glance = 0;
animator.gazeUp = num('gu', 0.9);
animator.gazeX = num('gx', 0.22);
const face = rig.face;
const mood = q.get('face') ?? 'delight';
if (face) {
  if (mood === 'delight') {
    // wide-open eyes and raised brows (surprised) with the open smile of "happy"
    face.set('surprised');
    face.target = { ...face.target, mouth: 'open', tilt: 0, lift: 0.05, sx: 1.1, sy: 1.16 };
    for (const [name, shape] of Object.entries(face.mouth?.shapes ?? {})) shape.visible = name === 'open';
  } else {
    face.set(mood);
  }
  face.blinkT = Infinity;
}
for (let i = 0; i < 90; i++) animator.update(1 / 30);

rig.root.updateMatrixWorld(true);
const headObj = rig.joints.head?.obj;
const head = headObj ? headObj.localToWorld(rig.headCenter.clone()) : new THREE.Vector3(0, rig.metrics.headY, 0);
const camera = new THREE.PerspectiveCamera(num('fov', 24), 1, 0.1, 60);
const [cx, cy, cz] = vec('cam', [0.3, 0.5, 7]);
const [lx, ly, lz] = vec('look', [0, -0.55, 0]);
camera.position.set(head.x + cx, head.y + cy, head.z + cz);
camera.lookAt(head.x + lx, head.y + ly, head.z + lz);
renderer.render(scene, camera);

window.__png = () => canvas.toDataURL('image/png');
window.__ready = true;
