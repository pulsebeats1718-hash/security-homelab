/** Stylised puffy clouds: a drifting middle layer and a soft "sea" far below the islands. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/utils.js';

function puffGeometry(rng, blobs) {
  const parts = [];
  for (let i = 0; i < blobs; i++) {
    const g = new THREE.SphereGeometry(1, 11, 7);
    const t = blobs === 1 ? 0 : i / (blobs - 1) - 0.5;
    const r = 0.75 + rng() * 0.55 - Math.abs(t) * 0.5;
    g.scale(r, r * 0.78, r * 0.9);
    g.translate(t * blobs * 0.72, (rng() - 0.35) * 0.45, (rng() - 0.5) * 0.7);
    parts.push(g);
  }
  // flat-ish base
  const base = new THREE.SphereGeometry(1, 11, 6);
  base.scale(blobs * 0.42, 0.34, 0.8);
  base.translate(0, -0.34, 0);
  parts.push(base);
  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()), false);
  parts.forEach((g) => g.dispose());
  return merged;
}

export class Clouds {
  constructor(scene, { quality = 'high' } = {}) {
    const rng = mulberry32(11);
    this.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xff9d8a, emissiveIntensity: 0.2 });
    this.group = new THREE.Group();
    this.group.name = 'clouds';
    scene.add(this.group);

    const variants = [puffGeometry(rng, 4), puffGeometry(rng, 5), puffGeometry(rng, 3)];
    const midCount = quality === 'low' ? 9 : 16;
    const seaCount = quality === 'low' ? 12 : 22;
    this.items = [];
    const dummy = (this.dummy = new THREE.Object3D());

    this.meshes = variants.map((geo, vi) => {
      const count = Math.ceil((midCount + seaCount) / variants.length) + 1;
      const mesh = new THREE.InstancedMesh(geo, this.material, count);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.used = 0;
      mesh.userData.vi = vi;
      this.group.add(mesh);
      return mesh;
    });

    const push = (item) => {
      const mesh = this.meshes[this.items.length % this.meshes.length];
      item.mesh = mesh;
      item.index = mesh.userData.used++;
      this.items.push(item);
    };
    // middle layer: drifts across behind the island
    for (let i = 0; i < midCount; i++) {
      const z = -10 - rng() * 62;
      push({ x: (rng() * 2 - 1) * 60, y: -3 + rng() * 22, z, s: 1.5 + rng() * 2.4 + -z * 0.035, speed: 0.25 + rng() * 0.35, wrap: 66, bob: rng() * 6 });
    }
    // cloud sea below
    for (let i = 0; i < seaCount; i++) {
      const z = 6 - rng() * 95;
      push({ x: (rng() * 2 - 1) * 85, y: -10.5 - rng() * 4.5, z, s: 6 + rng() * 6.5, speed: 0.12 + rng() * 0.16, wrap: 92, bob: rng() * 6, flat: 0.6 });
    }
    for (const m of this.meshes) m.count = m.userData.used;
    this.update(0, 0);
  }

  apply(v) {
    this.material.color.copy(v.cloud);
    this.material.emissive.copy(v.cloudGlow);
    this.material.emissiveIntensity = v.cloudGlowAmt;
  }

  update(t, dt) {
    const d = this.dummy;
    for (const c of this.items) {
      c.x += c.speed * dt;
      if (c.x > c.wrap) c.x = -c.wrap;
      d.position.set(c.x, c.y + Math.sin(t * 0.3 + c.bob) * 0.25, c.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(c.s, c.s * (c.flat ?? 0.85), c.s);
      d.updateMatrix();
      c.mesh.setMatrixAt(c.index, d.matrix);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}

const MOTE_VERT = /* glsl */ `
attribute float aPhase;
attribute float aSize;
uniform float uTime;
uniform float uPixel;
uniform float uScale;
varying float vAlpha;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.35 + aPhase * 6.0) * 0.6;
  p.y += mod(uTime * (0.12 + aPhase * 0.14) + aPhase * 9.0, 7.0) - 0.5;
  p.z += cos(uTime * 0.28 + aPhase * 4.0) * 0.6;
  vAlpha = (0.45 + 0.55 * sin(uTime * (1.2 + aPhase) + aPhase * 30.0)) * smoothstep(-0.5, 0.6, p.y) * smoothstep(6.5, 4.5, p.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixel * uScale / -mv.z;
}`;

const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(uColor, a * a * vAlpha * uOpacity);
}`;

/** Drifting pollen by day, fireflies by night. Animated entirely on the GPU. */
export class Motes {
  constructor(scene, { quality = 'high' } = {}) {
    const rng = mulberry32(5);
    const count = quality === 'low' ? 40 : 90;
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = 1.5 + rng() * 6.5;
      pos.set([Math.cos(a) * r, 0, Math.sin(a) * r * 0.8 - 0.5], i * 3);
      phase[i] = rng();
      size[i] = 26 + rng() * 40;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.uniforms = { uTime: { value: 0 }, uPixel: { value: 1 }, uScale: { value: 1 }, uColor: { value: new THREE.Color(0xfff1c0) }, uOpacity: { value: 0.5 } };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  apply(v) {
    this.uniforms.uColor.value.copy(v.accent).lerp(new THREE.Color(0xffffff), 0.45);
    this.uniforms.uOpacity.value = 0.35 + v.lamps * 0.45;
  }
  update(t, pixelRatio, viewHeight) {
    this.uniforms.uTime.value = t;
    this.uniforms.uPixel.value = pixelRatio;
    this.uniforms.uScale.value = viewHeight / 900;
  }
}
