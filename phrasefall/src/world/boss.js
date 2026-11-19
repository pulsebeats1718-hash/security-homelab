/**
 * Boss storm clouds: at the end of each stage of a classic game a grumpy cloud rolls in
 * above the island and throws a quick volley of cards (see game.js). Hit it enough times
 * and it cheers up, turns white and floats away; otherwise it chuckles and drifts off.
 * Five of them, one per stage, each a little stormier. Original, all-ages, toy-like.
 *
 * The storm: rain falls from it on to the island and splashes there; now and then lightning
 * strikes the island behind the character, lighting up the whole view and the edges of every toy
 * for an instant. Beaten, the sun bursts through in rays of light and a rainbow arcs over the island.
 * (The rain, the lightning and the rays need the effects, handed over with attach().)
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, ease } from '../core/utils.js';
import { makeGlowTexture } from './sky.js';
import { rimShared } from '../characters/kit/materials.js';
import { GLOW_BLEND } from './effects.js';

export const BOSSES = [
  { name: 'Grumble', color: 0x9aa3b8, bolt: 0xffd54a },
  { name: 'Drizzle', color: 0x7f9dc4, bolt: 0xbfe8ff },
  { name: 'Thunderbumble', color: 0x8c79c9, bolt: 0xffd54a },
  { name: 'Gloomsby', color: 0x5f5a9e, bolt: 0xff9ad1 },
  { name: 'The Great Muddle', color: 0x4a3f7a, bolt: 0xffc83d },
];

const WHITE = new THREE.Color(0xffffff);

/** A puffy cloud: overlapping spheres merged into one mesh. */
function cloudGeometry() {
  const puffs = [
    [0, 0, 0, 1],
    [-0.95, -0.15, 0.05, 0.75],
    [0.95, -0.12, 0.05, 0.78],
    [-0.5, 0.45, -0.1, 0.72],
    [0.55, 0.42, -0.08, 0.7],
    [-1.6, -0.3, -0.05, 0.5],
    [1.6, -0.28, -0.05, 0.52],
    [0, -0.45, 0.25, 0.7],
  ];
  return mergeGeometries(puffs.map(([x, y, z, r]) => new THREE.SphereGeometry(r, 18, 14).translate(x, y, z)));
}

/** A zigzag lightning bolt, chunky with soft bevelled edges like a toy. */
function boltGeometry() {
  const s = new THREE.Shape();
  [[0, 0], [0.22, 0], [0.08, -0.32], [0.26, -0.32], [-0.08, -0.82], [0.02, -0.42], [-0.16, -0.42]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.018, bevelSegments: 2 }).translate(-0.05, 0, -0.025);
}

/**
 * The storm cloud's look on top of the standard material: a darker, heavier underside, a silver
 * lining round the edge and the light of its own lightning flashing inside it.
 */
function stormMaterial(u) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x9aa3b8, roughness: 0.92, emissive: 0x2a2850, emissiveIntensity: 0.25 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vStorm;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvStorm = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uStormRim;\nuniform vec3 uStormFlash;\nvarying vec3 vStorm;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.6, 1.0, smoothstep(-0.75, 0.75, vStorm.y));')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float stormFres = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 2.6);
totalEmissiveRadiance += uStormRim * stormFres * smoothstep(-0.6, 0.5, vStorm.y);
totalEmissiveRadiance += uStormFlash * (0.25 + 0.75 * smoothstep(0.5, -0.7, vStorm.y));`
      );
  };
  mat.customProgramCacheKey = () => 'pf-storm';
  return mat;
}

const RAIN_MAX = 150;

// rain: streaks falling from the cloud to the island (all on the GPU: no per-frame work for the CPU)
const RAIN_VERT = /* glsl */ `
attribute vec3 iSeed; // x and z across the cloud, phase
uniform vec3 uOrigin;
uniform vec2 uSpread;
uniform float uTop;
uniform float uGround;
uniform float uTime;
uniform float uSpeed;
uniform float uWidth;
varying vec2 vUv;
varying float vFade;
void main() {
  float fall = uTop - uGround;
  float f = fract(uTime * uSpeed / fall + iSeed.z);
  vec3 p = vec3(uOrigin.x + (iSeed.x * 2.0 - 1.0) * uSpread.x, uTop - f * fall, uOrigin.z + (iSeed.y * 2.0 - 1.0) * uSpread.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec2 dir = normalize((viewMatrix * vec4(0.0, -1.0, 0.0, 0.0)).xy + vec2(1e-5));
  vec2 side = vec2(dir.y, -dir.x);
  float len = uSpeed * 0.045;
  mv.xy += side * position.x * uWidth + dir * (position.y * len * 0.5 - len * 0.5);
  gl_Position = projectionMatrix * mv;
  vUv = position.xy;
  vFade = smoothstep(0.0, 0.08, f) * smoothstep(1.0, 0.9, f);
}`;
const RAIN_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
varying float vFade;
void main() {
  float a = (1.0 - smoothstep(0.2, 1.0, abs(vUv.x))) * (0.35 + 0.65 * smoothstep(-1.0, 1.0, vUv.y)) * vFade * uOpacity;
  gl_FragColor = vec4(uColor * a, a * 0.55);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// splashes: a little ring and a crown of droplets where each drop lands, just as it lands
const SPLASH_VERT = /* glsl */ `
attribute vec3 iSeed;
uniform vec3 uOrigin;
uniform vec2 uSpread;
uniform float uTop;
uniform float uGround;
uniform float uTime;
uniform float uSpeed;
uniform float uSize;
varying vec2 vUv;
varying float vAge;
void main() {
  float fall = uTop - uGround;
  float f = fract(uTime * uSpeed / fall + iSeed.z);
  // the drop that has just landed: the splash lives for the first part of the next drop's fall
  vAge = f / 0.12;
  vec3 p = vec3(uOrigin.x + (iSeed.x * 2.0 - 1.0) * uSpread.x, uGround + 0.03, uOrigin.z + (iSeed.y * 2.0 - 1.0) * uSpread.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * uSize * vec2(1.0, 0.55);
  gl_Position = vAge < 1.0 ? projectionMatrix * mv : vec4(0.0, 0.0, 2.0, 1.0);
  vUv = position.xy;
}`;
const SPLASH_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
varying float vAge;
void main() {
  vec2 q = vUv * vec2(1.0, 1.0 / 0.55);
  float r = length(vec2(vUv.x, vUv.y * 2.4));
  float ringR = 0.25 + vAge * 0.7;
  float ring = exp(-pow((r - ringR) / 0.07, 2.0)) * (1.0 - vAge);
  // droplets thrown up and out
  float drops = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i) - 1.0;
    vec2 c = vec2(fi * 0.35 * (0.4 + vAge), 0.25 + vAge * 1.2 - vAge * vAge * 1.3);
    drops += exp(-dot(vUv - c, vUv - c) * 260.0);
  }
  float a = (ring + drops * (1.0 - vAge)) * uOpacity;
  gl_FragColor = vec4(uColor * a, a * 0.5);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// a lightning bolt: a bright white core with the bolt's colour round it
const BOLT_VERT = /* glsl */ `
attribute float aAcross;
varying float vAcross;
void main() {
  vAcross = aAcross;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BOLT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAcross;
void main() {
  float x = abs(vAcross);
  float core = smoothstep(0.42, 0.0, x);
  float glow = smoothstep(1.0, 0.0, x);
  vec3 col = mix(uColor * 1.8, vec3(3.2), core);
  float a = (glow * glow * 0.8 + core) * uOpacity;
  gl_FragColor = vec4(col * a, a * 0.3);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// the rainbow after the storm: soft pastel bands, fading out at its feet
const RAINBOW_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec2 vUv2;
void main() {
  float r = length(vUv2);
  float t = (r - 0.78) / 0.22;
  if (t < 0.0 || t > 1.0) discard;
  vec3 c = clamp(abs(mod(t * 0.85 * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  c = mix(c, vec3(1.0), 0.28);
  float edge = smoothstep(0.0, 0.18, t) * smoothstep(1.0, 0.82, t);
  float feet = smoothstep(0.0, 0.35, vUv2.y / r);
  gl_FragColor = vec4(c, edge * feet * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const RAINBOW_VERT = /* glsl */ `
varying vec2 vUv2;
void main() {
  vUv2 = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BOLT_POINTS = 14;
const _bv = new THREE.Vector3();
const _bd = new THREE.Vector3();
const _bs = new THREE.Vector3();
const _bc = new THREE.Vector3();

/** A camera-facing zigzag ribbon through `points` into the bolt geometry (from `start` vertex pair). */
function ribbon(geo, points, width, camera, start) {
  const pos = geo.attributes.position;
  camera.getWorldPosition(_bc);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[Math.min(points.length - 1, i + 1)];
    const o = points[Math.max(0, i - 1)];
    _bd.copy(q).sub(o).normalize();
    _bv.copy(_bc).sub(p).normalize();
    _bs.crossVectors(_bd, _bv).normalize();
    const w = width * (1 - (i / (points.length - 1)) * 0.55);
    pos.setXYZ(start + i * 2, p.x + _bs.x * w, p.y + _bs.y * w, p.z + _bs.z * w);
    pos.setXYZ(start + i * 2 + 1, p.x - _bs.x * w, p.y - _bs.y * w, p.z - _bs.z * w);
  }
  pos.needsUpdate = true;
}

export class Boss {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.body = new THREE.Group();
    this.group.add(this.body);

    this.storm = { uStormRim: { value: new THREE.Color(0, 0, 0) }, uStormFlash: { value: new THREE.Color(0, 0, 0) } };
    this.mat = stormMaterial(this.storm);
    const cloud = new THREE.Mesh(cloudGeometry(), this.mat);
    cloud.castShadow = true;
    this.body.add(cloud);

    // the face
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d1838, roughness: 0.35 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), white);
      eye.scale.set(1, 1.1, 0.6);
      eye.position.set(sx * 0.34, 0.12, 0.88);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), dark);
      pupil.position.set(0, -0.02, 0.15);
      // a catchlight, so the eyes look wet and alive
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), glintMat);
      glint.position.set(0.035, 0.045, 0.085);
      pupil.add(glint);
      eye.add(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.08), dark);
      brow.position.set(sx * 0.34, 0.42, 0.9);
      brow.rotation.z = sx * -0.42; // cross: an angry frown
      this.body.add(eye, brow);
      this.eyes.push({ eye, pupil, brow, sx });
    }
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 8, 16, Math.PI), dark);
    this.mouth.position.set(0, -0.22, 0.95);
    this.body.add(this.mouth);

    // lightning underneath
    this.boltMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0xffd54a, emissiveIntensity: 1.2, roughness: 0.4 });
    const bg = boltGeometry();
    this.glowMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffd54a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.bolts = [-0.7, 0.75].map((x, i) => {
      const b = new THREE.Mesh(bg, this.boltMat);
      b.position.set(x, -0.75, 0.3);
      b.rotation.z = i ? -0.25 : 0.2;
      // a halo of light round each bolt that flares when it strikes
      const glow = new THREE.Sprite(this.glowMat);
      glow.position.set(0.04, -0.4, -0.05);
      glow.scale.set(0.9, 1.3, 1);
      b.add(glow);
      this.body.add(b);
      return b;
    });
    this.strike = 0; // 1 → 0 over a lightning flash
    this.strikeN = 0;
    this.strikeT = 1.2;
    this._flash = new THREE.Color();

    this.state = 'off'; // off | in | idle | won | gone
    this.t = 0;
    this.stateT = 0;
    this.shakeT = 0;
    this.leanT = 0;
    this.laughT = 0;
    this.flash = 0;
    this.base = new THREE.Vector3(0, 6, -2);
    this.scale = 1;
    this.def = BOSSES[0];

    // ── the storm: rain, splashes, lightning, and the rainbow after it ───────
    this.fx = null;
    this.stage = null;
    const quad = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
    const seeds = new Float32Array(RAIN_MAX * 3);
    let k = 7;
    const rnd = () => ((k = (k * 16807) % 2147483647), (k - 1) / 2147483646);
    for (let i = 0; i < RAIN_MAX * 3; i++) seeds[i] = rnd();
    const instanced = () => {
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(quad, 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seeds, 3));
      g.instanceCount = RAIN_MAX;
      return g;
    };
    this.rainU = {
      uOrigin: { value: new THREE.Vector3() },
      uSpread: { value: new THREE.Vector2(1.3, 0.45) },
      uTop: { value: 6 },
      uGround: { value: 0.02 },
      uTime: { value: 0 },
      uSpeed: { value: 7.5 },
      uWidth: { value: 0.016 },
      uSize: { value: 0.16 },
      uColor: { value: new THREE.Color(0xa9cdf5) },
      uOpacity: { value: 0 },
    };
    const rainMat = (vertexShader, fragmentShader) => new THREE.ShaderMaterial({ uniforms: this.rainU, vertexShader, fragmentShader, transparent: true, depthWrite: false, ...GLOW_BLEND });
    this.rain = new THREE.Mesh(instanced(), rainMat(RAIN_VERT, RAIN_FRAG));
    this.splash = new THREE.Mesh(instanced(), rainMat(SPLASH_VERT, SPLASH_FRAG));
    for (const m of [this.rain, this.splash]) {
      m.frustumCulled = false;
      m.visible = false;
      m.renderOrder = 3;
      scene.add(m);
    }
    this.rainLevel = 0;

    const n = BOLT_POINTS + 7;
    const boltGeo = new THREE.BufferGeometry();
    boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    boltGeo.setAttribute('aAcross', new THREE.BufferAttribute(new Float32Array(n * 2).map((_, i) => (i % 2 ? -1 : 1)), 1));
    const index = [];
    const strip = (from, count) => {
      for (let i = 0; i < count - 1; i++) {
        const a0 = (from + i) * 2;
        index.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
      }
    };
    strip(0, BOLT_POINTS);
    strip(BOLT_POINTS, 7);
    boltGeo.setIndex(index);
    this.boltU = { uColor: { value: new THREE.Color(0xffd54a) }, uOpacity: { value: 0 } };
    this.bolt = new THREE.Mesh(boltGeo, new THREE.ShaderMaterial({ uniforms: this.boltU, vertexShader: BOLT_VERT, fragmentShader: BOLT_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, ...GLOW_BLEND }));
    this.bolt.frustumCulled = false;
    this.bolt.visible = false;
    this.bolt.renderOrder = 4;
    scene.add(this.bolt);
    this.boltLife = 0;
    this.nextBolt = 1.4;
    this.strikeRim = 0;
    this._boltColor = new THREE.Color();
    this._rimColor = new THREE.Color();

    this.rainbowU = { uOpacity: { value: 0 } };
    this.rainbow = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 72, 1, 0, Math.PI), new THREE.ShaderMaterial({ uniforms: this.rainbowU, vertexShader: RAINBOW_VERT, fragmentShader: RAINBOW_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.rainbow.visible = false;
    this.rainbow.renderOrder = -2;
    scene.add(this.rainbow);
    this.clearT = -1;
  }

  /** Hand the boss the effects (flashes, sparks, rays) and the stage (the camera, the quality tier). */
  attach(fx, stage) {
    this.fx = fx;
    this.stage = stage;
    fx.warm?.push(this.group, this.rain, this.splash, this.bolt, this.rainbow);
  }

  /** A lightning strike on the island now (also comes by itself every few seconds while stormy). */
  strikeNow() {
    if (this.fx && (this.state === 'in' || this.state === 'idle')) this._strike();
  }

  _strike() {
    const s = this.scale;
    const g = this.group.position;
    const fx = this.fx;
    const camera = this.stage.camera;
    // from under the cloud, zigzagging down to the island behind the character
    const top = _bv.set(g.x + (Math.random() - 0.5) * 1.6 * s, g.y - 0.55 * s, g.z + 0.3);
    const end = new THREE.Vector3(top.x + (Math.random() - 0.5) * 1.6, 0.04, g.z + (Math.random() - 0.5) * 0.5);
    const pts = [];
    let jag = 0;
    for (let i = 0; i < BOLT_POINTS; i++) {
      const u = i / (BOLT_POINTS - 1);
      jag += (Math.random() - 0.5) * 0.5;
      jag *= 0.75;
      const wiggle = i === 0 || i === BOLT_POINTS - 1 ? 0 : (Math.random() - 0.5) * 0.42 + jag;
      pts.push(new THREE.Vector3(top.x + (end.x - top.x) * u + wiggle, top.y + (end.y - top.y) * u, top.z + (end.z - top.z) * u + wiggle * 0.3));
    }
    // a short branch forking off part-way down
    const from = pts[4 + ((Math.random() * 3) | 0)];
    const side = Math.random() < 0.5 ? -1 : 1;
    const branch = [];
    for (let i = 0; i < 7; i++) {
      const u = i / 6;
      branch.push(new THREE.Vector3(from.x + side * u * 0.9 + (Math.random() - 0.5) * 0.18 * (i ? 1 : 0), from.y - u * 1.3, from.z + (Math.random() - 0.5) * 0.1 * (i ? 1 : 0)));
    }
    ribbon(this.bolt.geometry, pts, 0.11 * s + 0.04, camera, 0);
    ribbon(this.bolt.geometry, branch, 0.065 * s + 0.025, camera, BOLT_POINTS * 2);
    this.bolt.visible = true;
    this.boltLife = 0.3;
    this.boltU.uColor.value.set(this.def.bolt);
    this.strike = 1;
    // the whole view lights up for an instant, and every toy's edges with it
    const low = this.stage.qualityName === 'low';
    this._boltColor.set(this.def.bolt).lerp(WHITE, 0.55);
    fx.flash(this._boltColor, low ? 0.16 : 0.24, 0.24);
    this.strikeRim = 1;
    this._rimColor.copy(this._boltColor);
    fx.burst(end, { count: fx.n(14), color: this.def.bolt, color2: 0xffffff, speed: 4.2, size: 0.8, life: 0.45, gravity: 7, up: 1.8, stars: 0.2 });
    fx.ring(end.setY(0.06), { color: this._boltColor.getHex(), from: 0.2, to: 1.6, life: 0.4, flat: true, opacity: 0.8, width: 0.08 });
    fx.puff(end.setY(0.15), { count: fx.n(4), color: 0xc9c3d6, size: 0.4, life: 0.7, speed: 1.2, up: 0.4, spread: 0.3, alpha: 0.5 });
  }

  /** The storm's own clock: rain, lightning, the rainbow (they outlive the cloud by a moment). */
  _storm(dt, t) {
    const stormy = this.state === 'in' || this.state === 'idle';
    const tier = this.stage?.qualityName ?? 'medium';
    // rain eases in and out with the storm
    this.rainLevel += ((stormy ? 1 : 0) - this.rainLevel) * Math.min(1, dt * (stormy ? 1.6 : 3));
    const raining = this.rainLevel > 0.01;
    this.rain.visible = raining;
    this.splash.visible = raining && tier !== 'low';
    if (raining) {
      const u = this.rainU;
      const g = this.group.position;
      const s = this.scale;
      u.uOrigin.value.copy(g);
      u.uTop.value = g.y - 0.5 * s;
      u.uSpread.value.set(1.35 * s, 0.45 * s);
      u.uTime.value = t;
      u.uOpacity.value = this.rainLevel * 0.6;
      this.rain.geometry.instanceCount = tier === 'high' ? RAIN_MAX : tier === 'medium' ? 90 : 40;
      this.splash.geometry.instanceCount = tier === 'high' ? RAIN_MAX : 70;
    }
    // lightning
    if (this.fx && stormy && this.state === 'idle') {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 2.6 + Math.random() * 2.4;
        this._strike();
      }
    }
    if (this.boltLife > 0) {
      this.boltLife -= dt;
      const k = Math.max(0, this.boltLife / 0.3);
      // a quick double flicker
      this.boltU.uOpacity.value = k > 0.55 ? 1 : k > 0.4 ? 0.25 : k * 2;
      if (this.boltLife <= 0) this.bolt.visible = false;
    }
    if (this.strikeRim > 0) {
      this.strikeRim = Math.max(0, this.strikeRim - dt * 3.5);
      rimShared.strike.value.copy(this._rimColor).multiplyScalar(this.strikeRim * this.strikeRim * 0.9);
    } else if (rimShared.strike.value.r + rimShared.strike.value.g + rimShared.strike.value.b > 0) rimShared.strike.value.setRGB(0, 0, 0);
    // the rainbow: in, a moment, out
    if (this.clearT >= 0) {
      this.clearT += dt;
      const c = this.clearT;
      const a = c < 0.4 ? 0 : c < 1.1 ? (c - 0.4) / 0.7 : c < 2.8 ? 1 : Math.max(0, 1 - (c - 2.8) / 1.2);
      this.rainbowU.uOpacity.value = a * 0.55;
      this.rainbow.visible = a > 0;
      if (c > 4.1) {
        this.clearT = -1;
        this.rainbow.visible = false;
      }
    }
  }

  get name() {
    return this.def.name;
  }

  /** Roll in above the island at `pos` (world), sized `scale`, as the boss of stage index `stage`. */
  show(stage, pos, scale = 1) {
    this.def = BOSSES[Math.min(stage, BOSSES.length - 1)];
    this.mat.color.set(this.def.color);
    this.boltMat.color.set(this.def.bolt);
    this.boltMat.emissive.set(this.def.bolt);
    this.glowMat.color.set(this.def.bolt);
    this.strikeT = 0.6;
    this.nextBolt = 1.2;
    this.base.copy(pos);
    this.scale = scale;
    this.state = 'in';
    this.stateT = 0;
    this.mouth.rotation.z = 0; // frown (the arc opens downwards)
    this.mouth.position.y = -0.22;
    for (const e of this.eyes) e.brow.rotation.z = e.sx * -0.42;
    for (const b of this.bolts) b.visible = true;
    this.group.visible = true;
  }

  /** Lean forward to throw a card. */
  throw() {
    this.leanT = 0.45;
  }
  /** A card hit it: shudder and flash. */
  hit() {
    this.shakeT = 0.42;
    this.flash = 1;
  }
  /** A card got through: a little laugh. */
  laugh() {
    this.laughT = 0.7;
  }
  /** Beaten: it cheers up, turns white and floats away. */
  defeat() {
    this.state = 'won';
    this.stateT = 0;
    this.mouth.rotation.z = Math.PI; // smile
    this.mouth.position.y = -0.12;
    for (const e of this.eyes) e.brow.rotation.z = e.sx * 0.15;
    for (const b of this.bolts) b.visible = false;
    this.bolt.visible = false;
    this.boltLife = 0;
    // the sun bursts through: rays of light from the cloud, a warm wash over everything, a rainbow
    const fx = this.fx;
    if (fx) {
      const g = this.group.position;
      fx.burstRays(g, { color: 0xfff0c0, size: 7.5 * this.scale, life: 2.6, opacity: 0.85, spin: 0.22, count: 18 });
      fx.flash(0xfff2d0, 0.26, 0.8);
      fx.burst(g, { count: fx.n(26), color: 0xfff3c4, color2: 0xffd45e, speed: 3.2, size: 0.9, life: 1.6, gravity: 0.9, drag: 1.4, spread: 1.6 * this.scale, up: 0.2, stars: 0.55 });
      this.strikeRim = 1;
      this._rimColor.set(0xffe3a8).multiplyScalar(0.7);
      this.rainbow.position.set(0, -0.6, this.base.z - 2.2);
      this.rainbow.scale.setScalar(Math.max(4, this.base.y * 0.95));
      this.clearT = 0;
    }
  }
  /** Not beaten: it drifts off, chuckling. */
  escape() {
    this.state = 'gone';
    this.stateT = 0;
    this.laughT = 1.2;
  }
  hide() {
    this._off();
    this.rainLevel = 0;
    this.rain.visible = this.splash.visible = this.bolt.visible = this.rainbow.visible = false;
    this.boltLife = 0;
    this.clearT = -1;
    this.strikeRim = 0;
    rimShared.strike.value.setRGB(0, 0, 0);
  }

  /** The cloud has gone (the storm's rain, flash and rainbow finish on their own). */
  _off() {
    this.state = 'off';
    this.group.visible = false;
  }

  /** World position of the cloud's middle (for effects). */
  get position() {
    return this.group.position;
  }

  update(dt, t) {
    this._storm(dt, t);
    if (this.state === 'off') return;
    this.t = t;
    this.stateT += dt;
    const g = this.group;
    const s = this.scale;
    let y = this.base.y + Math.sin(t * 1.6) * 0.12 * s;
    let x = this.base.x + Math.sin(t * 0.7) * 0.25 * s;
    let k = s;
    let alpha = 1;
    if (this.state === 'in') {
      const u = clamp(this.stateT / 0.9);
      k = s * ease.outBack(u);
      y += (1 - ease.outCubic(u)) * 2.5 * s;
      if (u >= 1) this.state = 'idle';
    } else if (this.state === 'won') {
      const u = clamp(this.stateT / 1.8);
      this.mat.color.lerp(WHITE, Math.min(1, dt * 3));
      y += ease.inCubic(u) * 4 * s;
      k = s * (1 - ease.inCubic(u) * 0.6);
      if (u >= 1) this._off();
    } else if (this.state === 'gone') {
      const u = clamp(this.stateT / 1.5);
      y += ease.inCubic(u) * 3.5 * s;
      x += ease.inCubic(u) * 4 * s;
      if (u >= 1) this._off();
    }
    if (this.laughT > 0) {
      this.laughT -= dt;
      y += Math.abs(Math.sin(this.laughT * 22)) * 0.12 * s;
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      x += Math.sin(this.shakeT * 70) * 0.12 * s * (this.shakeT / 0.42);
    }
    g.position.set(x, y, this.base.z);
    g.scale.setScalar(Math.max(0.001, k));
    // lean to throw
    if (this.leanT > 0) this.leanT -= dt;
    const lean = this.leanT > 0 ? Math.sin((1 - this.leanT / 0.45) * Math.PI) * 0.35 : 0;
    this.body.rotation.set(lean, Math.sin(t * 0.9) * 0.12, Math.sin(t * 1.3) * 0.05);
    // flash white when hit, lightning flickers
    this.flash = Math.max(0, this.flash - dt * 3.5);
    this.mat.emissive.setRGB(0.16 + this.flash * 0.8, 0.16 + this.flash * 0.8, 0.31 + this.flash * 0.7);
    // now and then a strike: the bolts flare (a quick double flicker) and light the cloud from inside
    const stormy = this.state !== 'won';
    this.strikeT -= dt;
    if (this.strikeT <= 0 && stormy) {
      this.strikeN++;
      this.strikeT = 1.3 + ((this.strikeN * 0.618) % 1) * 1.9;
      this.strike = 1;
    }
    this.strike = Math.max(0, this.strike - dt * 3.2);
    const flick = this.strike > 0 ? this.strike * (Math.sin(this.strike * 26) > -0.2 ? 1 : 0.25) : 0;
    const hum = (Math.sin(t * 23) > 0.6 ? 0.5 : 0) + Math.sin(t * 7) * 0.15;
    this.boltMat.emissiveIntensity = 1.3 + hum + flick * 4.5;
    this.glowMat.opacity = stormy ? 0.22 + hum * 0.2 + flick * 0.75 : 0;
    this._flash.set(this.def.bolt);
    this.storm.uStormFlash.value.copy(this._flash).multiplyScalar(stormy ? flick * 0.55 : 0);
    this.storm.uStormRim.value.setRGB(0.32, 0.34, 0.45).lerp(this._flash, 0.25).multiplyScalar(stormy ? 1 : 1.6);
    for (const e of this.eyes) e.pupil.position.x = Math.sin(t * 0.8) * 0.05;
    void alpha;
  }
}
