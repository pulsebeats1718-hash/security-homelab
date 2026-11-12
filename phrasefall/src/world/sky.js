/** Sky dome, sun, stars, moon and aurora. Everything here is far away and unlit. */
import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // always at the far plane
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunDisc;
uniform float uTime;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0
    ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.85, h), 0.62))
    : mix(uHorizon, uBottom, smoothstep(0.0, -0.45, h));

  // soft band of haze sitting on the horizon
  col = mix(col, uHorizon, exp(-abs(h) * 7.0) * 0.45);

  // high wispy cirrus, cheap two-octave noise stretched sideways
  vec2 q = d.xz / (abs(h) + 0.35);
  float wisp = noise(q * vec2(1.4, 4.2) + vec2(uTime * 0.012, 0.0)) * 0.65 + noise(q * vec2(3.1, 9.0) - vec2(uTime * 0.02, 0.0)) * 0.35;
  wisp = smoothstep(0.52, 0.86, wisp) * smoothstep(0.02, 0.3, h) * 0.22;
  col = mix(col, mix(uHorizon, vec3(1.0), 0.55), wisp);

  // sun: crisp disc, tight bloom, wide glow
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  float disc = smoothstep(0.99945, 0.99975, sd) * uSunDisc;
  col += uSunColor * (disc * 0.9 + pow(sd, 260.0) * 0.4 * (0.3 + uSunDisc) + pow(sd, 24.0) * 0.2 + pow(sd, 5.0) * 0.1);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uPixel;
varying float vTw;
void main() {
  vTw = 0.6 + 0.4 * sin(uTime * (1.2 + aPhase * 1.7) + aPhase * 40.0);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w;
  gl_PointSize = aSize * uPixel * (0.75 + 0.5 * vTw);
}`;

const STAR_FRAG = /* glsl */ `
uniform float uOpacity;
varying float vTw;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float a = smoothstep(0.5, 0.0, r);
  a = a * a * vTw * uOpacity;
  gl_FragColor = vec4(vec3(0.9, 0.95, 1.0), a);
}`;

const AURORA_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += sin(p.x * 0.09 + uTime * 0.22) * 7.0 + sin(p.x * 0.23 - uTime * 0.31) * 2.5;
  p.y += sin(p.x * 0.12 + uTime * 0.17) * 2.0 * uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const AURORA_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec2 vUv;
void main() {
  float x = vUv.x * 46.0;
  float rays = 0.55 + 0.45 * sin(x + sin(vUv.x * 9.0 + uTime * 0.4) * 3.0 + uTime * 0.5);
  rays *= 0.7 + 0.3 * sin(x * 2.7 - uTime * 0.8);
  float v = vUv.y;
  float body = smoothstep(0.0, 0.12, v) * pow(1.0 - v, 1.6);
  float ends = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  vec3 col = mix(uColorA, uColorB, smoothstep(0.1, 0.9, v));
  gl_FragColor = vec4(col, body * rays * ends * uOpacity);
}`;

export class Sky {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'sky';
    scene.add(this.group);

    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.3) },
      uSunColor: { value: new THREE.Color() },
      uSunDisc: { value: 1 },
      uTime: { value: 0 },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(300, 32, 20),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false })
    );
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.group.add(dome);

    // stars
    const rng = mulberry32(7);
    const COUNT = 520;
    const pos = new Float32Array(COUNT * 3);
    const size = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const u = rng() * 2 - 1;
      const th = rng() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.04;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 280, y * 280, Math.sin(th) * r * 280], i * 3);
      size[i] = 1.4 + Math.pow(rng(), 4) * 4.2;
      phase[i] = rng();
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    sg.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.starUniforms = { uTime: this.uniforms.uTime, uOpacity: { value: 0 }, uPixel: { value: 1 } };
    this.stars = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({ uniforms: this.starUniforms, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false })
    );
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    // moon
    this.moon = new THREE.Group();
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xf2f4ff, fog: false, transparent: true });
    const disc = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), moonMat);
    const craterMat = new THREE.MeshBasicMaterial({ color: 0xd4dbf5, fog: false, transparent: true });
    [[-2, 2.2, 1.6], [2.4, -1.2, 1.1], [0.4, -3.2, 0.9], [3, 2.8, 0.7]].forEach(([x, y, r]) => {
      const c = new THREE.Mesh(new THREE.CircleGeometry(r, 16), craterMat);
      c.position.set(x, y, 6.6);
      this.moon.add(c);
    });
    const haloTex = makeGlowTexture();
    this.moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0x9fb8ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.moonHalo.scale.setScalar(70);
    this.moon.add(disc, this.moonHalo);
    this.moon.position.set(-58, 78, -150);
    this.moon.lookAt(0, 10, 0);
    this.moonMats = [moonMat, craterMat];
    this.group.add(this.moon);

    // aurora curtains
    this.auroraUniforms = [];
    this.aurora = new THREE.Group();
    [
      { z: -150, y: 48, w: 260, h: 70, a: 0x48ffb0, b: 0x7a6bff, rot: 0.08 },
      { z: -175, y: 62, w: 300, h: 80, a: 0x3fe0ff, b: 0xc86bff, rot: -0.12 },
    ].forEach((c, i) => {
      const u = { uTime: this.uniforms.uTime, uOpacity: { value: 0 }, uColorA: { value: new THREE.Color(c.a) }, uColorB: { value: new THREE.Color(c.b) } };
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(c.w, c.h, 48, 1),
        new THREE.ShaderMaterial({ uniforms: u, vertexShader: AURORA_VERT, fragmentShader: AURORA_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })
      );
      mesh.position.set(i === 0 ? 20 : -30, c.y, c.z);
      mesh.rotation.set(0.25, c.rot, 0);
      mesh.renderOrder = -8;
      this.aurora.add(mesh);
      this.auroraUniforms.push(u);
    });
    this.group.add(this.aurora);
  }

  /** Apply interpolated theme values. `v` holds THREE.Color / number per key. */
  apply(v, sunDir) {
    const u = this.uniforms;
    u.uTop.value.copy(v.skyTop);
    u.uHorizon.value.copy(v.skyHorizon);
    u.uBottom.value.copy(v.skyBottom);
    u.uSunColor.value.copy(v.sunColor);
    u.uSunDisc.value = v.sunDisc;
    u.uSunDir.value.copy(sunDir);
    this.starUniforms.uOpacity.value = v.stars;
    this.stars.visible = v.stars > 0.01;
    this.moon.visible = v.moon > 0.01;
    for (const m of this.moonMats) m.opacity = v.moon;
    this.moonHalo.material.opacity = 0.5 * v.moon;
    this.aurora.visible = v.aurora > 0.01;
    for (const a of this.auroraUniforms) a.uOpacity.value = v.aurora * 0.55;
  }

  update(t, camera, pixelRatio) {
    this.uniforms.uTime.value = t;
    this.starUniforms.uPixel.value = pixelRatio;
    this.group.position.copy(camera.position); // the sky never gets closer
    this.group.position.y = 0;
  }
}

let glowTex = null;
/** Soft radial glow shared by halos, lamps and effects. */
export function makeGlowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
