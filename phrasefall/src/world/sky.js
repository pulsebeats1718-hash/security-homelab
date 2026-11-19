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
uniform float uDither;
uniform vec3 uGlow;
uniform float uGlowAmt;
uniform float uLow;
uniform vec3 uMid;
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
  vec3 S = normalize(uSunDir);
  // how close this direction is to the sun's side of the sky (by compass bearing only)
  float side = dot(normalize(d.xz + vec2(1e-4)), normalize(S.xz + vec2(1e-4)));
  float s = max(dot(d, S), 0.0);

  #ifdef SKY_HQ
  // high and medium quality: a sky shaped like the real one. Looking up through less air, the
  // horizon's pale colour gives way quickly to the zenith's; towards a low sun the warm band
  // stands taller. Blended in a gamma-like space so the middle stays clean (orange and blue
  // mixed straight go grey).
  float hh = max(h, 0.0);
  float sunward = max(side, 0.0);
  float airK = mix(7.5, 4.6, sunward * sunward * uLow);
  // horizon → a pale middle → zenith: a warm horizon under a blue sky passes through a soft, pale
  // band rather than purple (uMid is worked out on the CPU from the two)
  float up = 1.0 - exp(-hh * airK);
  vec3 col = h > 0.0
    ? (up < 0.5 ? mix(sqrt(uHorizon), uMid, up * 2.0) : mix(uMid, sqrt(uTop), up * 2.0 - 1.0))
    : mix(sqrt(uHorizon), sqrt(uBottom), smoothstep(0.0, -0.4, h));
  col *= col;
  // the bright, hazy band right on the horizon, a little warmer under the sun
  float band = exp(-abs(h) * 10.0);
  col = mix(col, uHorizon * (1.08 + 0.25 * sunward), band * 0.45);
  // the far side of the sky a touch deeper
  col *= 1.0 + 0.12 * side * (1.0 - smoothstep(0.0, 0.6, h));
  // sunrise and sunset: a glow along the horizon round the sun in the theme's sunset colour,
  // fading upwards through the sky's own colour
  float glow = exp(-hh * 12.0) * pow(sunward, 2.5) * uLow;
  col += uGlow * glow * uGlowAmt * 1.6;
  // light scattered forward by the air round the sun (Henyey–Greenstein, g = 0.76): a wide, soft
  // whitening that is stronger when the sun is low and its light crosses more haze
  float hg = 0.4224 / pow(1.5776 - 1.52 * s, 1.5);
  col += uSunColor * hg * (0.005 + 0.008 * uLow) * (0.25 + 0.75 * uSunDisc) * smoothstep(-0.12, 0.05, h);
  #else
  // horizon → zenith, blended in a gamma-like space so the middle of the gradient stays clean
  // (a straight mix of orange and blue goes grey)
  // (the gradient climbs quickly, so the band of sky the camera sees runs from the horizon's
  // colour into the zenith's)
  vec3 col = h > 0.0
    ? mix(sqrt(uHorizon), sqrt(uTop), pow(smoothstep(0.0, 0.6, h), 0.5))
    : mix(sqrt(uHorizon), sqrt(uBottom), smoothstep(0.0, -0.4, h));
  col *= col;

  // a luminous band along the horizon, brighter under the sun; the sky round the sun warmer and
  // lighter, the far side a touch deeper
  float band = exp(-abs(h) * 8.0);
  col = mix(col, uHorizon * (1.1 + 0.3 * max(side, 0.0)), band * 0.5);
  col *= 1.0 + 0.18 * side * (1.0 - smoothstep(0.0, 0.75, h));
  #endif

  // high wispy cirrus, cheap two-octave noise stretched sideways (only above the horizon)
  if (h > 0.02) {
    vec2 q = d.xz / (h + 0.35);
    float wisp = noise(q * vec2(1.4, 4.2) + vec2(uTime * 0.012, 0.0)) * 0.65 + noise(q * vec2(3.1, 9.0) - vec2(uTime * 0.02, 0.0)) * 0.35;
    wisp = smoothstep(0.52, 0.86, wisp) * smoothstep(0.02, 0.3, h) * 0.24;
    #ifdef SKY_HQ
    // lit from the sun's side: bright and warm towards a low sun, the sunset colour underneath
    vec3 lit = mix(uHorizon, vec3(1.0), 0.55) * (1.0 + 0.5 * pow(s, 3.0)) + uGlow * uGlowAmt * uLow * 1.2;
    col = mix(col, lit, wisp);
    #else
    col = mix(col, mix(uHorizon, vec3(1.0), 0.6) * (1.0 + 0.4 * max(side, 0.0)), wisp);
    #endif
  }

  // the sun: a crisp disc bright enough to glow, a corona, and a wide soft halo
  float disc = smoothstep(0.99945, 0.99975, s) * uSunDisc;
  #ifdef SKY_HQ
  col += uSunColor * (disc * 4.0 + pow(s, 700.0) * 1.1 * uSunDisc + pow(s, 64.0) * 0.22 * (0.3 + uSunDisc));
  #else
  col += uSunColor * (disc * 4.0 + pow(s, 700.0) * 1.1 * uSunDisc + pow(s, 64.0) * 0.3 * (0.3 + uSunDisc) + pow(s, 8.0) * 0.15 + pow(s, 2.5) * 0.06);
  #endif

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // straight to an 8-bit screen (low quality) a sky gradient bands: break it up with ±½ step of noise
  gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) * uDither / 255.0;
}`;

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uPixel;
varying float vTw;
varying vec3 vTint;
void main() {
  // scintillation: stars low in the sky (through more air) twinkle faster and deeper
  float low = 1.0 - smoothstep(0.05, 0.5, normalize(position).y);
  float rate = 1.2 + aPhase * 1.7 + low * 2.5;
  float tw = sin(uTime * rate + aPhase * 40.0) * 0.6 + sin(uTime * rate * 2.31 + aPhase * 17.0) * 0.4;
  vTw = 0.62 + (0.3 + 0.25 * low) * tw;
  // a little colour: most stars blue-white, some warm
  vTint = mix(vec3(0.82, 0.9, 1.0), vec3(1.0, 0.88, 0.72), step(0.72, fract(aPhase * 7.13)));
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w;
  gl_PointSize = aSize * uPixel * (0.75 + 0.5 * vTw);
}`;

const STAR_FRAG = /* glsl */ `
uniform float uOpacity;
varying float vTw;
varying vec3 vTint;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float a = smoothstep(0.5, 0.0, r);
  float core = smoothstep(0.16, 0.0, r);
  a = a * a * max(vTw, 0.0) * uOpacity;
  // a hot core: the brightest stars twinkle into a little glow
  gl_FragColor = vec4(vTint * (1.0 + core * vTw * 1.6), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
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
float hash1(float n) { return fract(sin(n) * 43758.5453); }
float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash1(i), hash1(i + 1.0), f);
}
void main() {
  float x = vUv.x;
  float v = vUv.y;
  // fine vertical rays drifting along the curtain, over broader folds that brighten and fade
  float rays = noise1(x * 140.0 + uTime * 0.9) * 0.45 + noise1(x * 47.0 - uTime * 0.35) * 0.35 + noise1(x * 9.0 + uTime * 0.12) * 0.2;
  rays = 0.3 + 0.7 * rays;
  // the lower border wanders a little; the light is brightest just above it and fades upwards
  float edge = 0.1 + 0.07 * noise1(x * 6.0 + uTime * 0.1);
  float above = v - edge;
  float body = smoothstep(-0.05, 0.02, above) * exp(-max(above, 0.0) * 2.4);
  float ends = smoothstep(0.0, 0.14, x) * smoothstep(1.0, 0.86, x);
  float pulse = 0.78 + 0.22 * sin(uTime * 0.6 + x * 11.0);
  // green low down, shading through teal into violet at the top, with a brighter lower border
  vec3 col = mix(uColorA, uColorB, smoothstep(0.12, 0.85, v));
  col += uColorA * exp(-abs(above) * 22.0) * 0.6;
  gl_FragColor = vec4(col, body * rays * ends * pulse * uOpacity);
}`;

const SHOOT_VERT = /* glsl */ `
attribute float aT;    // 0 at the tail … 1 at the head
attribute float aSide; // −1 / +1 across the streak
uniform vec3 uFrom;
uniform vec3 uTo;
uniform float uP;      // how far the head has travelled along the path (0…1)
uniform float uLen;    // the tail's length, as a share of the path
varying float vT;
varying float vSide;
vec3 at(float t) { return normalize(mix(uFrom, uTo, clamp(t, 0.0, 1.0))) * 270.0; }
void main() {
  float head = min(uP, 1.0);
  float tail = max(0.0, uP - uLen);
  vec4 mv = modelViewMatrix * vec4(at(mix(tail, head, aT)), 1.0);
  vec3 a = (modelViewMatrix * vec4(at(tail), 1.0)).xyz;
  vec3 b = (modelViewMatrix * vec4(at(head), 1.0)).xyz;
  vec3 along = normalize(b - a + vec3(1e-4, 0.0, 0.0));
  vec3 across = normalize(cross(along, vec3(0.0, 0.0, 1.0)));
  mv.xyz += across * aSide * (0.18 + 0.42 * aT);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w;
  vT = aT;
  vSide = aSide;
}`;

const SHOOT_FRAG = /* glsl */ `
uniform float uFade;
varying float vT;
varying float vSide;
void main() {
  float across = 1.0 - abs(vSide);
  float a = vT * vT * across * across * uFade;
  gl_FragColor = vec4(vec3(1.0, 0.96, 0.88) * (1.0 + vT * vT * 2.5), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** A streak of light across the night sky now and then, somewhere the camera is looking. */
class ShootingStar {
  constructor(group) {
    const SEG = 10;
    const pos = new Float32Array((SEG + 1) * 2 * 3);
    const t = new Float32Array((SEG + 1) * 2);
    const side = new Float32Array((SEG + 1) * 2);
    const index = [];
    for (let i = 0; i <= SEG; i++) {
      for (let k = 0; k < 2; k++) {
        t[i * 2 + k] = i / SEG;
        side[i * 2 + k] = k ? 1 : -1;
      }
      if (i < SEG) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    geo.setIndex(index);
    this.u = { uFrom: { value: new THREE.Vector3(0, 0.3, -1) }, uTo: { value: new THREE.Vector3(0.2, 0.2, -1) }, uP: { value: 0 }, uLen: { value: 0.35 }, uFade: { value: 0 } };
    // depth-tested at the far plane: clouds, islands and the falling card all hide it
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: SHOOT_VERT, fragmentShader: SHOOT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -8.5;
    this.mesh.visible = false;
    group.add(this.mesh);
    this.rng = mulberry32(2024); // its own stream: the game's Math.random is left alone
    this.wait = 3 + this.rng() * 6;
    this.p = -1;
    this.dur = 0.8;
  }

  /** `night` 0…1: how starry the sky is; the camera, to put the streak where it is looking. */
  update(dt, night, camera, still) {
    const u = this.u;
    if (this.p < 0) {
      this.mesh.visible = false;
      if (night < 0.5 || still) return;
      this.wait -= dt;
      if (this.wait > 0) return;
      // somewhere in the upper part of the view (picked on screen, so it is always in sight),
      // heading down and to one side
      const rng = this.rng;
      const sx = (rng() - 0.5) * 1.2;
      const sy = 0.3 + rng() * 0.5;
      const way = rng() < 0.5 ? -1 : 1;
      const ex = sx + way * (0.25 + rng() * 0.25);
      const ey = sy - 0.15 - rng() * 0.15;
      u.uFrom.value.set(sx, sy, 0.5).unproject(camera).sub(camera.position).normalize();
      u.uTo.value.set(ex, ey, 0.5).unproject(camera).sub(camera.position).normalize();
      u.uLen.value = 0.3 + rng() * 0.15;
      this.dur = 0.65 + rng() * 0.35;
      this.p = 0;
      this.wait = 7 + rng() * 11;
    }
    this.p += dt / this.dur;
    const end = 1 + u.uLen.value;
    if (this.p >= end) {
      this.p = -1;
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    u.uP.value = this.p;
    // in quickly, out as the tail burns away
    u.uFade.value = Math.min(1, this.p * 6) * Math.min(1, (end - this.p) * 3) * Math.min(1, night * 1.4 - 0.4);
  }
}

const _h = new THREE.Vector3();
const _t = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

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
      uDither: { value: 1 },
      uGlow: { value: new THREE.Color() },
      uGlowAmt: { value: 0 },
      uLow: { value: 0 },
      uMid: { value: new THREE.Vector3() },
    };
    this.domeMat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), this.domeMat);
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
    // (no depth written: to the post finish's lens the moon is part of the sky, so it stays crisp;
    // clouds and islands in front still hide it)
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xf2f4ff, fog: false, transparent: true, depthWrite: false });
    const disc = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), moonMat);
    const craterMat = new THREE.MeshBasicMaterial({ color: 0xd4dbf5, fog: false, transparent: true, depthWrite: false });
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
    this.shooting = new ShootingStar(this.group);
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
    // the gradient's middle stop (in the shader's square-root space): halfway between horizon and
    // zenith, drawn towards a pale, warm white the more their hues clash (an orange horizon under a
    // blue sky), as a real sky passes through pale light rather than purple; similar hues (midday
    // blues) barely change
    const hz = _h.set(Math.sqrt(v.skyHorizon.r), Math.sqrt(v.skyHorizon.g), Math.sqrt(v.skyHorizon.b));
    const tp = _t.set(Math.sqrt(v.skyTop.r), Math.sqrt(v.skyTop.g), Math.sqrt(v.skyTop.b));
    const clash = Math.min(1, Math.max(0, 1 - _a.copy(hz).normalize().dot(_b.copy(tp).normalize())) * 4);
    const mid = u.uMid.value.copy(hz).lerp(tp, 0.5);
    const ml = 0.2126 * mid.x + 0.7152 * mid.y + 0.0722 * mid.z;
    mid.lerp(_a.set(1, 0.96, 0.9).multiplyScalar(ml), clash * 0.6).multiplyScalar(1 + clash * 0.1);
    // the sunset glow along the horizon: strongest with the sun on the horizon, gone by midday
    u.uGlow.value.copy(v.cloudGlow);
    u.uGlowAmt.value = v.cloudGlowAmt;
    u.uLow.value = Math.max(0, 1 - Math.max(0, sunDir.y) * 2.5) * (0.35 + 0.65 * Math.min(1, v.sunDisc * 2)) * (1 - Math.min(1, v.stars ?? 0) * 0.7);
    this.starUniforms.uOpacity.value = v.stars;
    this.stars.visible = v.stars > 0.01;
    this.moon.visible = v.moon > 0.01;
    for (const m of this.moonMats) m.opacity = v.moon;
    this.moonHalo.material.opacity = 0.5 * v.moon;
    this.aurora.visible = v.aurora > 0.01;
    for (const a of this.auroraUniforms) a.uOpacity.value = v.aurora * 0.55;
  }

  /**
   * Straight to the screen (low quality) the sky dithers itself; through the post finish (which
   * dithers everything, and adds real sun shafts) it gets the fuller sky.
   */
  setFinish(post) {
    this.uniforms.uDither.value = post ? 0 : 1;
    if (this._hq !== post) {
      // the fuller sky (shaped gradient, sunset glow, the sun's halo) goes with the post finish
      this._hq = post;
      this.domeMat.defines = post ? { SKY_HQ: '' } : {};
      this.domeMat.needsUpdate = true;
    }
  }

  /** `still`: reduced motion (no shooting stars). */
  update(t, camera, pixelRatio, dt = 0, still = false) {
    this.shooting.update(dt, this.starUniforms.uOpacity.value, camera, still);
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
