/**
 * Wildlife: now and then a little flock of birds crosses the sky behind the island — a loose,
 * shifting group, wings beating then gliding, the outer wing bending more than the inner like a
 * real wingbeat, banking gently as they go. Animated entirely on the GPU (one draw call); the CPU
 * only picks the next flight's path and start time. By day only, on medium and high quality.
 *
 * (Butterflies live with the seasons — seasons/weather.js; fireflies with the motes — clouds.js.)
 */
import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';

const BIRD_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aPart;   // 0 body, 1 inner wing, 2 outer wing
attribute float aSide;   // -1 left, +1 right (0 body)
attribute vec4 aBird;    // offset in the flock (x across, y up, z along), phase
uniform float uTime;
uniform float uT0;       // when this flight started
uniform float uDur;      // how long it lasts
uniform vec3 uFrom;
uniform vec3 uTo;
uniform float uArc;      // how high the path rises in the middle
uniform float uShow;
varying float vShade;
const float SIZE = 0.36;
void main() {
  float u = clamp((uTime - uT0) / uDur, 0.0, 1.0);
  float ph = aBird.w;
  // each bird keeps its own place in the flock, drifting about it
  float lag = aBird.z * 0.012;
  float uu = clamp(u - lag, 0.0, 1.0);
  vec3 dir = normalize(uTo - uFrom);
  vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), dir));
  vec3 c = mix(uFrom, uTo, uu) + vec3(0.0, sin(uu * 3.14159) * uArc, 0.0);
  c += side * (aBird.x + sin(uTime * 0.7 + ph * 5.0) * 0.18) + vec3(0.0, aBird.y + sin(uTime * 1.1 + ph * 3.0) * 0.12, 0.0);
  // wingbeats in bursts, then a glide with the wings held out
  float burst = smoothstep(-0.2, 0.4, sin(uTime * 0.9 + ph * 6.0));
  float beat = sin(uTime * 15.0 + ph * 9.0);
  float flap = mix(0.12, beat * 0.85, burst);
  vec3 p = position;
  if (aPart > 0.5) {
    // inner wing about the shoulder; the outer panel bends again at the wrist
    float a = flap;
    float x = abs(p.x);
    float wrist = 0.42 * SIZE;
    float y = x * sin(a);
    float r = x * cos(a);
    if (aPart > 1.5) {
      float a2 = a + flap * 0.6;
      y = wrist * sin(a) + (x - wrist) * sin(a2);
      r = wrist * cos(a) + (x - wrist) * cos(a2);
    }
    p.x = sign(p.x) * r;
    p.y += y;
  }
  // a little bank into the flock's drift
  float bank = sin(uTime * 0.7 + ph * 5.0) * 0.25;
  p.xy = vec2(p.x * cos(bank) - p.y * sin(bank), p.x * sin(bank) + p.y * cos(bank));
  // body axis along the flight: local z forward
  vec3 w = c + side * p.x + vec3(0.0, p.y, 0.0) + dir * p.z;
  vShade = aPart < 0.5 ? 0.8 : 1.0;
  vec4 mvPosition = viewMatrix * vec4(w, 1.0);
  // fade in and out at the ends of the flight
  float fade = smoothstep(0.0, 0.06, uu) * smoothstep(1.0, 0.94, uu) * uShow;
  mvPosition.xyz = mix(viewMatrix * vec4(c, 1.0), mvPosition, fade).xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const BIRD_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
varying float vShade;
void main() {
  gl_FragColor = vec4(uColor * vShade, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** One bird, about 0.55 across (SIZE in the shader): a slim body and two-panel wings (x across, y up, z forward). */
function birdGeometry() {
  const pos = [];
  const part = [];
  const side = [];
  const tri = (a, b, c, pt, s) => {
    pos.push(...a, ...b, ...c);
    part.push(pt, pt, pt);
    side.push(s, s, s);
  };
  // body: a thin diamond seen from above and from the side, with a little tail
  tri([0, 0.02, 0.22], [0.035, 0, 0], [0, 0, -0.2], 0, 0);
  tri([0, 0.02, 0.22], [0, 0, -0.2], [-0.035, 0, 0], 0, 0);
  tri([0, 0.02, 0.22], [0, -0.03, 0.02], [0, 0, -0.2], 0, 0);
  tri([0, 0, -0.15], [0.06, 0, -0.27], [-0.06, 0, -0.27], 0, 0);
  for (const s of [-1, 1]) {
    // inner wing (shoulder → wrist), outer wing (wrist → pointed tip, swept back)
    tri([0, 0, 0.07], [s * 0.42, 0, 0.04], [s * 0.42, 0, -0.07], 1, s);
    tri([0, 0, 0.07], [s * 0.42, 0, -0.07], [0, 0, -0.08], 1, s);
    tri([s * 0.42, 0, 0.04], [s * 0.78, 0, -0.12], [s * 0.42, 0, -0.07], 2, s);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos.map((v) => v * 0.36), 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  return g;
}

export class Wildlife {
  constructor(scene, { quality = 'high' } = {}) {
    this.scene = scene;
    this.rng = mulberry32(31337);
    this.mesh = null;
    this.day = 1;
    this.next = 9;
    this.flying = false;
    this.setQuality(quality);
  }

  _build() {
    const rng = this.rng;
    const n = 7;
    const geo = birdGeometry();
    const bird = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      // a loose, uneven V
      const k = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1);
      bird.set([k * 0.42 + (rng() - 0.5) * 0.25, (rng() - 0.5) * 0.3, Math.abs(k) * 0.9 + rng() * 0.6, rng()], i * 4);
    }
    geo.setAttribute('aBird', new THREE.InstancedBufferAttribute(bird, 4));
    geo.instanceCount = n;
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uT0: { value: -100 },
        uDur: { value: 20 },
        uFrom: { value: new THREE.Vector3() },
        uTo: { value: new THREE.Vector3() },
        uArc: { value: 0 },
        uShow: { value: 0 },
        uColor: { value: new THREE.Color(0x3a3f4c) },
      },
    ]);
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: BIRD_VERT, fragmentShader: BIRD_FRAG, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = 'birds';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  /** Birds on medium and high quality only. */
  setQuality(quality) {
    this.on = quality !== 'low';
    if (this.on && !this.mesh) this._build();
    if (this.mesh && !this.on) this.mesh.visible = false;
  }

  /** Theme values: birds fly by day (none once the stars are out); they take a little of the sky's colour. */
  apply(v) {
    this.day = Math.min(1, Math.max(0, 1 - (v.stars ?? 0) * 1.6));
    if (this.uniforms) this.uniforms.uColor.value.setRGB(0.16, 0.17, 0.21).lerp(v.hemiSky, 0.18);
  }

  _launch(t) {
    const rng = this.rng;
    const dir = rng() < 0.5 ? 1 : -1;
    const z = -14 - rng() * 16;
    const y = 4.5 + rng() * 5 + (-z - 14) * 0.12;
    const span = 34 + -z * 0.9;
    const u = this.uniforms;
    u.uFrom.value.set(-dir * span * 0.5, y, z + (rng() - 0.5) * 6);
    u.uTo.value.set(dir * span * 0.5, y + (rng() - 0.5) * 3, z + (rng() - 0.5) * 6);
    u.uArc.value = (rng() - 0.3) * 2.5;
    u.uDur.value = span / (2.4 + rng() * 1.2);
    u.uT0.value = t;
    this.flying = true;
    this.end = t + u.uDur.value + 0.5;
  }

  update(t) {
    if (!this.on || !this.mesh) return;
    const u = this.uniforms;
    u.uTime.value = t;
    if (!this.flying && t >= this.next && this.day > 0.5) this._launch(t);
    if (this.flying && t >= this.end) {
      this.flying = false;
      this.next = t + 14 + this.rng() * 22;
    }
    // a flight in the far past (fast-forwards, a long pause): start the schedule again from now
    if (this.next < t - 60) this.next = t + 4;
    u.uShow.value = this.day;
    this.mesh.visible = this.flying && this.day > 0.01;
  }
}
