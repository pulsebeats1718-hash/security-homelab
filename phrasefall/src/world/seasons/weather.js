/**
 * Season particles, animated entirely on the GPU (no per-frame CPU work, one draw call each):
 *
 *   Weather      autumn leaves tumbling, winter snow, spring petals — all in one Points cloud;
 *                each kind fades in with its season's weight
 *   Butterflies  a few butterflies fluttering behind the dais in spring
 *
 * Everything stays behind the falling card (z < −1.4), apart from a thin fringe far out to the
 * sides in front, so it never covers the card or the character.
 */
import * as THREE from 'three';
import { mulberry32 } from '../../core/utils.js';

const lin = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

const WEATHER_VERT = /* glsl */ `
attribute vec4 aSeed;  // phase, speed, size, share (which part of the kind shows first)
attribute float aKind; // 0 leaf, 1 snow, 2 petal
uniform float uTime;
uniform vec3 uAmount;  // leaves, snow, petals: 0…1
uniform float uScale;  // pixels across a 1-unit thing 1 unit away
uniform float uFog;
varying vec3 vColor;
varying float vAlpha;
varying float vAngle;
varying float vFlip;
varying float vKind;
const float TOP = 15.0;
const float H = 19.0;
void main() {
  float kind = aKind;
  bool snow = kind > 0.5 && kind < 1.5;
  float amount = kind < 0.5 ? uAmount.x : snow ? uAmount.y : uAmount.z;
  float on = step(aSeed.w, amount);
  float fall = kind < 0.5 ? 0.85 : snow ? 0.62 : 0.55;
  float y = TOP - mod(uTime * fall * aSeed.y + aSeed.x * H, H);
  float swayF = snow ? 0.55 : 0.9;
  float swayA = kind < 0.5 ? 1.1 : snow ? 0.35 : 0.9;
  vec3 p = position;
  p.x = mod(p.x + uTime * (snow ? 0.12 : 0.3) + 24.0, 48.0) - 24.0;
  p.x += sin(uTime * swayF * (0.7 + aSeed.y * 0.4) + aSeed.x * 40.0) * swayA;
  p.z += cos(uTime * swayF * 0.6 + aSeed.x * 23.0) * swayA * 0.4;
  p.y = y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float fade = smoothstep(-4.0, -2.0, y) * smoothstep(TOP, TOP - 2.0, y) * smoothstep(24.0, 21.0, abs(p.x));
  gl_PointSize = min(72.0, on * fade * aSeed.z * uScale / max(0.5, -mv.z));
  vAngle = aSeed.x * 6.283 + uTime * (snow ? 0.2 : 1.3 + aSeed.y) * (fract(aSeed.x * 7.0) < 0.5 ? -1.0 : 1.0);
  vFlip = snow ? 1.0 : 0.22 + 0.78 * abs(cos(uTime * (1.1 + aSeed.y * 0.8) + aSeed.x * 9.0));
  float r = fract(aSeed.x * 13.37);
  vColor = kind < 0.5 ? (r < 0.3 ? ${lin(0xe0502c)} : r < 0.55 ? ${lin(0xf29a2e)} : r < 0.8 ? ${lin(0xf4c83e)} : ${lin(0xa9572c)})
         : snow ? vec3(1.0) : (r < 0.55 ? ${lin(0xffb7d0)} : ${lin(0xfff0f5)});
  float d = uFog * mv.z;
  vAlpha = exp(-d * d);
  vKind = kind;
}`;

const WEATHER_FRAG = /* glsl */ `
uniform vec3 uLight;
varying vec3 vColor;
varying float vAlpha;
varying float vAngle;
varying float vFlip;
varying float vKind;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float ca = cos(vAngle);
  float sa = sin(vAngle);
  q = vec2(q.x * ca - q.y * sa, q.x * sa + q.y * ca);
  vec3 col = vColor;
  float a = 1.0;
  if (vKind > 0.5 && vKind < 1.5) {
    a = smoothstep(0.5, 0.12, length(q)) * 0.95;
  } else {
    q.x /= vFlip;
    if (vKind < 0.5) {
      // a leaf: pointed at both ends, a slightly wavy edge and a darker midrib
      float t = clamp(abs(q.y) * 2.1, 0.0, 1.0);
      float w = 0.27 * (1.0 - t * t) * (1.0 + 0.18 * sin(q.y * 30.0));
      if (abs(q.x) > w) discard;
      if (abs(q.x) < 0.022) col *= 0.72;
    } else {
      // a petal: a soft teardrop
      vec2 e = vec2(q.x * 1.6, q.y + 0.06);
      if (length(e) > 0.34 + q.y * 0.12) discard;
      col = mix(col, vec3(1.0), smoothstep(0.3, 0.0, length(e)) * 0.25);
    }
  }
  gl_FragColor = vec4(col * uLight, a * vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** The three falling things, each shown in proportion to its season's weight. */
export class Weather {
  constructor(scene, quality) {
    const low = quality === 'low';
    const counts = [low ? 90 : 170, low ? 420 : 860, low ? 70 : 140];
    const rng = mulberry32(2024);
    const n = counts[0] + counts[1] + counts[2];
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 4);
    const kind = new Float32Array(n);
    let i = 0;
    counts.forEach((count, k) => {
      for (let j = 0; j < count; j++, i++) {
        let x;
        let z;
        if (rng() < 0.12) {
          // a thin fringe in front of the card plane, well out to the sides
          x = (rng() < 0.5 ? -1 : 1) * (3.8 + rng() * 11);
          z = 1.5 + rng() * 4.5;
        } else {
          x = (rng() * 2 - 1) * 24;
          z = -1.4 - Math.pow(rng(), 0.8) * 34;
        }
        pos.set([x, 0, z], i * 3);
        const size = k === 0 ? 0.2 + rng() * 0.12 : k === 1 ? 0.06 + rng() * 0.08 : 0.13 + rng() * 0.07;
        seed.set([rng(), 0.6 + rng() * 0.8, size, (j + 0.5) / count], i * 4);
        kind[i] = k;
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    this.uniforms = { uTime: { value: 0 }, uAmount: { value: new THREE.Vector3() }, uScale: { value: 600 }, uFog: { value: 0.011 }, uLight: { value: new THREE.Color(1, 1, 1) } };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: WEATHER_VERT, fragmentShader: WEATHER_FRAG, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.points.name = 'weather';
    this.points.visible = false;
    scene.add(this.points);
  }

  /** leaves, snow, petals: 0…1 each */
  setAmounts(leaves, snow, petals) {
    this.uniforms.uAmount.value.set(leaves, snow, petals);
    this.points.visible = leaves + snow + petals > 0.001;
  }

  apply(v, light) {
    this.uniforms.uFog.value = v.fogDensity;
    this.uniforms.uLight.value.copy(light);
  }

  update(t, stage) {
    this.uniforms.uTime.value = t;
    this.uniforms.uScale.value = (stage.height * stage.pixelRatio) / (2 * Math.tan((stage.camera.fov * Math.PI) / 360));
  }
}

const FLY_VERT = /* glsl */ `
attribute float aWing;  // −1 left wing, +1 right wing, 0 body
attribute vec4 aPath;   // centre xyz, phase
attribute vec4 aRange;  // radius x, y, z, speed
uniform float uTime;
uniform float uAmount;
varying vec3 vColor;
void main() {
  float t = uTime * aRange.w + aPath.w;
  vec3 c = aPath.xyz + vec3(sin(t) * aRange.x, sin(t * 2.3 + 1.0) * aRange.y, sin(t * 0.7 + 2.0) * aRange.z);
  vec3 v = vec3(cos(t) * aRange.x, 2.3 * cos(t * 2.3 + 1.0) * aRange.y, 0.7 * cos(t * 0.7 + 2.0) * aRange.z);
  float yaw = atan(v.x, v.z);
  float flap = (sin(uTime * 15.0 + aPath.w * 7.0) * 0.85 + 0.25) * aWing;
  vec3 p = position;
  p.xy = vec2(p.x * cos(flap) - p.y * sin(flap), p.x * sin(flap) + p.y * cos(flap));
  p *= uAmount;
  p.xz = vec2(p.x * cos(yaw) + p.z * sin(yaw), -p.x * sin(yaw) + p.z * cos(yaw));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(c + p, 1.0);
  vColor = abs(aWing) > 0.5 ? instanceColor : vec3(0.08, 0.07, 0.07);
}`;

const FLY_FRAG = /* glsl */ `
uniform vec3 uLight;
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor * uLight, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Butterflies: two wings on each side flapping, looping lazily around a point behind the dais. */
export class Butterflies {
  constructor(scene, quality) {
    // one butterfly: a body and four wing panels (flat, double sided), wingspan ≈ 0.5
    const wing = (s) => [
      [0, 0, 0.06, s * 0.27, 0, 0.17, s * 0.3, 0, -0.03],
      [0, 0, 0.06, s * 0.3, 0, -0.03, 0, 0, -0.03],
      [0, 0, -0.03, s * 0.21, 0, -0.06, s * 0.14, 0, -0.2],
      [0, 0, -0.03, s * 0.14, 0, -0.2, 0, 0, -0.1],
    ];
    const pos = [];
    const side = [];
    for (const s of [-1, 1]) {
      for (const tri of wing(s)) {
        pos.push(...tri);
        side.push(s, s, s);
      }
    }
    // the body: a thin double-sided diamond
    for (const tri of [[0, 0.015, 0.1, 0.02, 0, -0.02, 0, 0.015, -0.16], [0, 0.015, 0.1, 0, 0.015, -0.16, -0.02, 0, -0.02]]) {
      pos.push(...tri);
      side.push(0, 0, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aWing', new THREE.Float32BufferAttribute(side.map((s) => s * 1.0), 1));
    const n = quality === 'low' ? 2 : 4;
    const paths = [
      [-2.7, 1.6, -2.9, 0.3, 1.2, 0.35, 0.7, 0.55],
      [2.9, 1.9, -3.4, 2.1, 1.0, 0.4, 0.6, 0.48],
      [-1.2, 2.5, -4.5, 4.0, 1.4, 0.3, 0.5, 0.42],
      [3.8, 1.3, -2.2, 5.3, 0.8, 0.3, 0.45, 0.6],
    ].slice(0, n);
    geo.setAttribute('aPath', new THREE.InstancedBufferAttribute(new Float32Array(paths.flatMap((p) => p.slice(0, 4))), 4));
    geo.setAttribute('aRange', new THREE.InstancedBufferAttribute(new Float32Array(paths.flatMap((p) => p.slice(4))), 4));
    this.uniforms = { uTime: { value: 0 }, uAmount: { value: 0 }, uLight: { value: new THREE.Color(1, 1, 1) } };
    this.mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: FLY_VERT, fragmentShader: FLY_FRAG, side: THREE.DoubleSide }), n);
    const cols = [0xffd23f, 0xffffff, 0x6ec6ff, 0xff9a3c];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.mesh.setMatrixAt(i, new THREE.Matrix4());
      this.mesh.setColorAt(i, c.set(cols[i]));
    }
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.name = 'butterflies';
    scene.add(this.mesh);
  }

  setAmount(a) {
    this.uniforms.uAmount.value = a;
    this.mesh.visible = a > 0.001;
  }

  apply(light) {
    this.uniforms.uLight.value.copy(light).multiplyScalar(1.1);
  }

  update(t) {
    this.uniforms.uTime.value = t;
  }
}
