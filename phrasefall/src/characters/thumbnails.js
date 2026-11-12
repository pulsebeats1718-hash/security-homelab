/**
 * Renders a portrait of every character (and a locked silhouette) in the background
 * after start-up. Uses its own small WebGL context so the main scene is never
 * disturbed, then frees it — the collection strip is just lightweight images.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CHARACTERS, createCharacter } from './index.js';

const SIZE = 176;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {Map<string, {normal: string, locked: string}>} out filled as portraits finish
 * @param {{ onThumb?: (id: string) => void, busy?: () => boolean }} o
 *        busy() → true while the game is being played, so rendering waits its turn.
 */
export async function makeThumbnails(out, { onThumb = () => {}, busy = () => false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return out;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  scene.add(new THREE.HemisphereLight(0xcfe4ff, 0xb08a7a, 0.95));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4);
  key.position.set(3, 5, 6);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 1.2);
  rim.position.set(-4, 4, -6);
  scene.add(key, rim);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);

  for (const def of CHARACTERS) {
    while (busy()) await wait(400);
    try {
      const ch = createCharacter(def.id);
      ch.rig.root.rotation.y = 0.32;
      scene.add(ch.rig.root);
      for (let k = 0; k < 4; k++) ch.animator.update(1 / 30);
      const top = ch.rig.metrics.height;
      camera.position.set(0, top - 0.5, 5.4);
      camera.lookAt(0, top - 0.62, 0);
      renderer.render(scene, camera);
      const normal = renderer.domElement.toDataURL('image/webp', 0.88);
      ch.rig.setSilhouette(true);
      renderer.render(scene, camera);
      const locked = renderer.domElement.toDataURL('image/webp', 0.8);
      out.set(def.id, { normal, locked });
      ch.rig.dispose();
      onThumb(def.id);
    } catch (err) {
      console.warn(`portrait failed for ${def.id}`, err);
    }
    await wait(30);
  }

  pmrem.dispose();
  scene.environment?.dispose();
  renderer.dispose();
  renderer.forceContextLoss?.();
  return out;
}
