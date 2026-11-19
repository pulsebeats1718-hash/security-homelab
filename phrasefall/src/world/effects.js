/**
 * Effects — pooled particles so feedback never allocates mid-game, made to feel physical.
 *
 *   sparks    additive glowing particles drawn as camera-facing quads that stretch along their motion
 *             (a camera's shutter: fast sparks are streaks, slow ones round glints); a negative size
 *             makes a four-pointed twinkle star instead. One draw call for all of them. A spark can
 *             also home in on a point (glitter flying to the score).
 *   shards    little tumbling blocks of enamel with gravity (shattered cards, ice)
 *   foil      confetti and petals: thin double-sided pieces that tumble and flutter as paper does
 *             (flat pieces catch the air, edge-on pieces slip through and glide), the foil catching
 *             the sun in bright glints as it turns
 *   puffs     soft, dull clouds (a wrong answer's thud, dust), lit from above, normally blended
 *   rings     soft expanding shockwaves (flat on the ground, or facing the camera)
 *   rays      a burst of light rays (celebrations)
 *   flash     a moment of light over the whole view (lightning, sunlight breaking through)
 *   shot      the projectile a character fires at an expression
 *   dizzy     stars circling a dazed character's head
 *
 * The quality tier scales the counts the director (juice.js) asks for, not these pools.
 */
import * as THREE from 'three';
import { makeGlowTexture } from './sky.js';
import { G } from '../characters/kit/geo.js';

const SPARK_MAX = 560;
const SHARD_MAX = 110;
const FOIL_MAX = 260;
const PUFF_MAX = 40;
const RING_MAX = 8;
const RAYS_MAX = 4;
/** World size of a spark per unit of its `size` (keeps the old point sprites' look at the game's lens). */
const SPARK_WORLD = 0.0956;

// ── sparks: streaks and twinkles ─────────────────────────────────────────────
const SPARK_VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec3 iColor;
attribute float iSize;
attribute float iLife;
uniform float uShutter;
uniform float uTime;
varying vec3 vColor;
varying float vLife;
varying vec2 vUv;
varying float vStar;
varying float vStretch;
varying float vTwinkle;
void main() {
  vColor = iColor;
  vLife = iLife;
  if (iLife <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  float star = step(iSize, 0.0);
  vStar = star;
  float hw = abs(iSize) * (0.35 + 0.65 * iLife) * 0.5;
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  vec2 v2 = (modelViewMatrix * vec4(iVel, 0.0)).xy;
  float speed = length(v2);
  vec2 dir = speed > 1e-4 ? v2 / speed : vec2(0.0, 1.0);
  // the shutter: a streak behind the spark as long as the distance it covers while the shutter is open
  float len = speed * uShutter * (1.0 - star);
  float id = float(gl_InstanceID);
  if (star > 0.5) {
    float a = id * 2.399 + uTime * (0.6 + fract(id * 0.618) * 1.4);
    dir = vec2(cos(a), sin(a));
    hw *= 1.9;
  }
  vec2 perp = vec2(-dir.y, dir.x);
  mv.xy += perp * position.x * hw + dir * (position.y * (hw + len * 0.5) - len * 0.5);
  gl_Position = projectionMatrix * mv;
  vUv = position.xy;
  vStretch = 1.0 + len * 0.5 / max(hw, 1e-4);
  vTwinkle = 0.65 + 0.35 * sin(uTime * (13.0 + fract(id * 0.37) * 11.0) + id);
}`;

const SPARK_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vLife;
varying vec2 vUv;
varying float vStar;
varying float vStretch;
varying float vTwinkle;
void main() {
  float fade = smoothstep(0.0, 0.25, vLife);
  vec3 col;
  float a;
  if (vStar > 0.5) {
    vec2 p = vUv;
    float r = length(p);
    float rays = max(exp(-abs(p.x) * 16.0) * exp(-abs(p.y) * 2.4), exp(-abs(p.y) * 16.0) * exp(-abs(p.x) * 2.4));
    float core = exp(-r * r * 26.0);
    float glow = exp(-r * r * 5.0) * 0.35;
    a = (rays * 0.95 + core + glow) * fade * vTwinkle * smoothstep(1.0, 0.7, r);
    col = vColor * (0.75 + core * 0.9);
  } else {
    // a capsule along the motion, brightest at the head
    float y = vUv.y * vStretch;
    float d = length(vec2(vUv.x, max(abs(y) - (vStretch - 1.0), 0.0)));
    float glow = smoothstep(1.0, 0.0, d);
    float core = smoothstep(0.32, 0.0, d);
    float head = mix(0.35, 1.0, smoothstep(-vStretch, vStretch * 0.6, y));
    a = (glow * glow * 0.7 + core) * fade * head / mix(1.0, vStretch, 0.45);
    col = vColor * (0.7 + core * 0.8);
  }
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ── rings: a soft band of light ──────────────────────────────────────────────
const RING_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const RING_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uWidth;
uniform float uFill;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float band = exp(-pow((r - 0.84) / uWidth, 2.0));
  float inner = smoothstep(0.84, 0.0, r) * uFill;
  float a = (band + inner * 0.22) * uOpacity * smoothstep(1.0, 0.94, r);
  gl_FragColor = vec4(uColor * (1.0 + band * 0.6), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ── rays: a burst of light ───────────────────────────────────────────────────
const RAYS_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uSpin;
uniform float uCount;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float ang = atan(vUv.y, vUv.x);
  float rays = pow(abs(sin(ang * uCount * 0.5 + uSpin)), 6.0) * 0.8 + pow(abs(sin(ang * uCount * 0.25 - uSpin * 0.7 + 1.3)), 10.0) * 0.6;
  float fall = smoothstep(1.0, 0.05, r);
  float core = exp(-r * r * 18.0);
  float a = (rays * fall * fall + core * 0.9 + fall * 0.12) * uOpacity;
  gl_FragColor = vec4(uColor * (1.0 + core), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ── puffs: soft dull clouds, lit from above ──────────────────────────────────
const PUFF_VERT = /* glsl */ `
attribute vec4 iData; // x, y, z, size
attribute vec4 iLook; // r, g, b, alpha
attribute float iSeed;
varying vec2 vUv;
varying vec4 vLook;
varying float vSeed;
void main() {
  vLook = iLook;
  vSeed = iSeed;
  vUv = position.xy;
  if (iLook.a <= 0.001) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec4 mv = modelViewMatrix * vec4(iData.xyz, 1.0);
  mv.xy += position.xy * iData.w;
  gl_Position = projectionMatrix * mv;
}`;
const PUFF_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec4 vLook;
varying float vSeed;
void main() {
  float r = length(vUv);
  float ang = atan(vUv.y, vUv.x);
  // a lumpy cotton-wool edge
  float edge = 0.86 - 0.1 * (sin(ang * 5.0 + vSeed * 6.0) * 0.5 + 0.5) - 0.06 * sin(ang * 9.0 - vSeed * 3.0);
  float body = smoothstep(edge, edge - 0.32, r);
  // lit from above: brighter on top, a soft shadowed underside
  float shade = 0.78 + 0.3 * vUv.y - 0.12 * r;
  gl_FragColor = vec4(vLook.rgb * shade, body * vLook.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ── foil: confetti that catches the light ────────────────────────────────────
/** A lit, double-sided piece: the sun's glint flashes off it as it turns (strength per instance). */
function foilMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.25, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlint;\nvarying float vGlint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlint = aGlint;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlint;').replace(
      '#include <emissivemap_fragment>',
      // a little light of their own, in their own colour: confetti stays bright in the shade
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.1;'
    ).replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
{
  // the glint: the sun mirrored in the foil for the instant the piece faces it just so
  vec3 rv = reflect(-normalize(vViewPosition), normal);
  float g = pow(saturate(dot(rv, directionalLights[0].direction)), 40.0);
  reflectedLight.directSpecular += directionalLights[0].color * (diffuseColor.rgb * 0.6 + 0.4) * g * 2.2 * vGlint;
}
#endif`
    );
  };
  mat.customProgramCacheKey = () => 'pf-foil';
  return mat;
}

const _c = new THREE.Color();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const QUAD = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
const QUAD_INDEX = [0, 1, 2, 0, 2, 3];

/** An instanced camera-facing quad with the given per-instance attributes. */
function quadInstances(count, attrs) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(QUAD, 3));
  geo.setIndex(QUAD_INDEX);
  for (const [name, size] of Object.entries(attrs)) {
    geo.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(count * size), size).setUsage(THREE.DynamicDrawUsage));
  }
  geo.instanceCount = count;
  return geo;
}

export class Effects {
  constructor(stage) {
    this.stage = stage;
    const scene = stage.scene;
    this.time = 0;

    // ── sparks ────────────────────────────────────────────────────────────
    const sgeo = quadInstances(SPARK_MAX, { iPos: 3, iVel: 3, iColor: 3, iSize: 1, iLife: 1 });
    const A = sgeo.attributes;
    this.sp = {
      pos: A.iPos.array,
      vel: A.iVel.array,
      col: A.iColor.array,
      size: A.iSize.array,
      life: A.iLife.array,
      max: new Float32Array(SPARK_MAX),
      grav: new Float32Array(SPARK_MAX),
      drag: new Float32Array(SPARK_MAX),
      // homing (glitter flying to the score): target, delay before it turns, and on
      home: new Float32Array(SPARK_MAX * 3),
      homeT: new Float32Array(SPARK_MAX),
      homing: new Uint8Array(SPARK_MAX),
      head: 0,
    };
    this.sparkUniforms = { uShutter: { value: 1 / 45 }, uTime: { value: 0 } };
    this.sparks = new THREE.Mesh(
      sgeo,
      new THREE.ShaderMaterial({ uniforms: this.sparkUniforms, vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 20;
    this.sparks.visible = false;
    scene.add(this.sparks);

    // ── shards (enamel pieces of a card) ──────────────────────────────────
    const shardMat = foilMaterial();
    shardMat.side = THREE.FrontSide;
    shardMat.roughness = 0.42;
    shardMat.metalness = 0;

    const shardGeo = new THREE.BoxGeometry(1, 1, 1);
    shardGeo.setAttribute('aGlint', new THREE.InstancedBufferAttribute(new Float32Array(SHARD_MAX).fill(0.45), 1));
    this.shardMesh = new THREE.InstancedMesh(shardGeo, shardMat, SHARD_MAX);
    this.shardMesh.frustumCulled = false;
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shards = [];
    for (let i = 0; i < SHARD_MAX; i++) {
      this.shards.push({ index: i, life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: new THREE.Vector3(), grav: 14 });
      this.shardMesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
      this.shardMesh.setColorAt(i, _c.set(0xffffff));
    }
    this.shardHead = 0;
    this.shardMesh.visible = false;
    scene.add(this.shardMesh);

    // ── foil: confetti and petals ─────────────────────────────────────────
    const foilGeo = new THREE.PlaneGeometry(1, 1);
    this.foilGlint = new THREE.InstancedBufferAttribute(new Float32Array(FOIL_MAX), 1).setUsage(THREE.DynamicDrawUsage);
    foilGeo.setAttribute('aGlint', this.foilGlint);
    this.foilMesh = new THREE.InstancedMesh(foilGeo, foilMaterial(), FOIL_MAX);
    this.foilMesh.frustumCulled = false;
    this.foilMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.foil = [];
    for (let i = 0; i < FOIL_MAX; i++) {
      this.foil.push({ index: i, life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), s: new THREE.Vector3(), grav: 6, glide: 1, phase: 0, rest: 0, petal: false });
      this.foilMesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
      this.foilMesh.setColorAt(i, _c.set(0xffffff));
    }
    this.foilHead = 0;
    this.foilMesh.visible = false;
    scene.add(this.foilMesh);

    // ── puffs ─────────────────────────────────────────────────────────────
    const pgeo = quadInstances(PUFF_MAX, { iData: 4, iLook: 4, iSeed: 1 });
    this.pf = { data: pgeo.attributes.iData.array, look: pgeo.attributes.iLook.array, seed: pgeo.attributes.iSeed.array, list: [], head: 0 };
    for (let i = 0; i < PUFF_MAX; i++) this.pf.list.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), size: 1, grow: 1, alpha: 1, color: new THREE.Color() });
    this.puffs = new THREE.Mesh(pgeo, new THREE.ShaderMaterial({ vertexShader: PUFF_VERT, fragmentShader: PUFF_FRAG, transparent: true, depthWrite: false }));
    this.puffs.frustumCulled = false;
    this.puffs.renderOrder = 18;
    this.puffs.visible = false;
    scene.add(this.puffs);

    // ── rings ─────────────────────────────────────────────────────────────
    this.rings = [];
    const plane = new THREE.PlaneGeometry(2, 2);
    for (let i = 0; i < RING_MAX; i++) {
      const u = { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 }, uWidth: { value: 0.07 }, uFill: { value: 0 } };
      const mesh = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: u, vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      mesh.visible = false;
      mesh.renderOrder = 19;
      scene.add(mesh);
      this.rings.push({ mesh, u, life: 0, max: 1, from: 0.2, to: 3, flat: false, opacity: 1 });
    }

    // ── light rays ────────────────────────────────────────────────────────
    this.rays = [];
    for (let i = 0; i < RAYS_MAX; i++) {
      const u = { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 }, uSpin: { value: 0 }, uCount: { value: 14 } };
      const mesh = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: u, vertexShader: RING_VERT, fragmentShader: RAYS_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      mesh.visible = false;
      mesh.renderOrder = 17;
      scene.add(mesh);
      this.rays.push({ mesh, u, life: 0, max: 1, size: 3, spin: 0.3, opacity: 1, follow: null });
    }

    // ── flash: a quad just in front of the camera ─────────────────────────
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
    this.flashQuad = new THREE.Mesh(plane, this.flashMat);
    this.flashQuad.frustumCulled = false;
    this.flashQuad.renderOrder = 999;
    this.flashQuad.visible = false;
    this.flashQuad.position.z = -1;
    stage.camera.add(this.flashQuad);
    this.flashState = { t: 0, dur: 0.2, strength: 0, color: new THREE.Color() };

    // ── projectile ────────────────────────────────────────────────────────
    const shotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.shot = {
      group: new THREE.Group(),
      meshes: {
        orb: new THREE.Mesh(G.sphere(16), shotMat),
        ball: new THREE.Mesh(G.sphere(16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })),
        star: new THREE.Mesh(G.star(1, 0.45, 4, 0.3), shotMat),
        bolt: new THREE.Mesh(G.capsule(0.35, 2.4, 8), shotMat),
      },
      halo: new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })),
      active: false,
      t: 0,
      dur: 0.2,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      ctrl: new THREE.Vector3(),
      color: new THREE.Color(),
      style: 'orb',
      onHit: null,
      mat: shotMat,
      last: new THREE.Vector3(),
    };
    for (const m of Object.values(this.shot.meshes)) {
      m.visible = false;
      this.shot.group.add(m);
    }
    this.shot.group.add(this.shot.halo);
    this.shot.group.visible = false;
    scene.add(this.shot.group);

    // ── dizzy stars ───────────────────────────────────────────────────────
    this.dizzy = { group: new THREE.Group(), on: false, t: 0, level: 0 };
    const starMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb300, emissiveIntensity: 0.9, roughness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(G.star(0.13, 0.058, 5, 0.05), starMat);
      this.dizzy.group.add(star);
    }
    this.dizzy.group.visible = false;
    scene.add(this.dizzy.group);
  }

  /** The quality tier now: 'high' | 'medium' | 'low'. */
  get tier() {
    return this.stage.qualityName;
  }
  /** Scale a particle count for the tier (high a little more, low a lot less). */
  n(count) {
    const k = this.tier === 'high' ? 1.25 : this.tier === 'low' ? 0.45 : 1;
    return Math.max(1, Math.round(count * k));
  }

  // ── sparks ──────────────────────────────────────────────────────────────
  /** One spark. `size` < 0 makes it a twinkling four-pointed star. Returns its index. */
  spark(x, y, z, vx, vy, vz, color, size = 0.5, life = 0.6, gravity = 0, drag = 1.5) {
    const sp = this.sp;
    const i = sp.head;
    sp.head = (sp.head + 1) % SPARK_MAX;
    const j = i * 3;
    sp.pos[j] = x;
    sp.pos[j + 1] = y;
    sp.pos[j + 2] = z;
    sp.vel[j] = vx;
    sp.vel[j + 1] = vy;
    sp.vel[j + 2] = vz;
    _c.set(color);
    sp.col[j] = _c.r;
    sp.col[j + 1] = _c.g;
    sp.col[j + 2] = _c.b;
    sp.size[i] = size * SPARK_WORLD;
    sp.life[i] = 1;
    sp.max[i] = life;
    sp.grav[i] = gravity;
    sp.drag[i] = drag;
    sp.homing[i] = 0;
    this.sparks.visible = true;
    return i;
  }

  /** Radial burst of sparks. `stars`: the share that are twinkle stars. */
  burst(pos, { count = 24, color = 0xffffff, color2 = null, speed = 5, size = 0.5, life = 0.7, gravity = 5, drag = 2.2, spread = 0.2, up = 1, stars = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(Math.random() * 2 - 1);
      const sp = speed * (0.35 + Math.random() * 0.65);
      const col = color2 && Math.random() < 0.45 ? color2 : color;
      const star = stars > 0 && Math.random() < stars;
      this.spark(
        pos.x + (Math.random() - 0.5) * spread,
        pos.y + (Math.random() - 0.5) * spread,
        pos.z + (Math.random() - 0.5) * spread,
        Math.sin(b) * Math.cos(a) * sp,
        Math.cos(b) * sp * 0.8 + up,
        Math.sin(b) * Math.sin(a) * sp * 0.6,
        col,
        size * (0.5 + Math.random() * 0.8) * (star ? -1 : 1),
        life * (0.6 + Math.random() * 0.6),
        gravity,
        drag
      );
    }
  }

  /** Sparks spread across a horizontal span (the width of a card). */
  line(pos, halfWidth, { count = 20, color = 0xffffff, color2 = null, speed = 4, size = 0.45, life = 0.7, gravity = 6, stars = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const col = color2 && Math.random() < 0.45 ? color2 : color;
      const star = stars > 0 && Math.random() < stars;
      this.spark(pos.x + (Math.random() * 2 - 1) * halfWidth, pos.y + (Math.random() - 0.5) * 0.5, pos.z + 0.1, (Math.random() - 0.5) * speed * 1.6, (Math.random() - 0.2) * speed, (Math.random() - 0.5) * speed * 0.5, col, size * (0.5 + Math.random() * 0.8) * (star ? -1 : 1), life * (0.6 + Math.random() * 0.6), gravity, 2);
    }
  }

  /**
   * Glitter that bursts from `from` (spread over `halfWidth`) and then flies to `to` (the score):
   * each piece turns after a short delay and accelerates home, vanishing as it arrives.
   */
  glitter(from, to, halfWidth, { count = 24, colors = [0xffffff, 0xffe08a], size = 0.5, speed = 4, delay = 0.16, stars = 0.35 } = {}) {
    const sp = this.sp;
    for (let n = 0; n < count; n++) {
      const star = Math.random() < stars;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      const i = this.spark(
        from.x + (Math.random() * 2 - 1) * halfWidth,
        from.y + (Math.random() - 0.5) * 0.5,
        from.z + 0.15,
        Math.cos(a) * s,
        Math.sin(a) * s * 0.8 + 1.2,
        (Math.random() - 0.3) * s * 0.4,
        colors[(Math.random() * colors.length) | 0],
        size * (0.55 + Math.random() * 0.7) * (star ? -1 : 1),
        2.2,
        0,
        2.6
      );
      sp.homing[i] = 1;
      sp.homeT[i] = delay * (0.6 + Math.random() * 0.9);
      sp.home[i * 3] = to.x + (Math.random() - 0.5) * 0.25;
      sp.home[i * 3 + 1] = to.y + (Math.random() - 0.5) * 0.15;
      sp.home[i * 3 + 2] = to.z;
    }
  }

  /** Twinkle stars spiralling up round a point (sparkles round a character). */
  swirl(center, { count = 12, radius = 0.75, height = 1.8, color = 0xffffff, color2 = 0xffe08a, size = 0.7, life = 1.1, spin = 3.2, rise = 1.4 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const r = radius * (0.85 + Math.random() * 0.3);
      const y = center.y + Math.random() * height;
      // tangential velocity (round the character) plus a rise
      const tv = spin * r;
      this.spark(center.x + Math.cos(a) * r, y, center.z + Math.sin(a) * r * 0.8, -Math.sin(a) * tv, rise * (0.6 + Math.random() * 0.8), Math.cos(a) * tv * 0.8, Math.random() < 0.5 ? color : color2, -size * (0.6 + Math.random() * 0.6), life * (0.7 + Math.random() * 0.5), -0.4, 1.4);
    }
  }

  // ── shards ──────────────────────────────────────────────────────────────
  _shard() {
    const s = this.shards[this.shardHead];
    this.shardHead = (this.shardHead + 1) % SHARD_MAX;
    return s;
  }

  /** Shatter something `halfWidth` wide into tumbling pieces. */
  shatter(pos, halfWidth, halfHeight, { count = 22, colors = [0xfff6e3], speed = 6, size = 0.3, down = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const s = this._shard();
      const fx = Math.random() * 2 - 1;
      const fy = Math.random() * 2 - 1;
      s.p.set(pos.x + fx * halfWidth, pos.y + fy * halfHeight, pos.z);
      s.v.set(fx * speed * (0.5 + Math.random() * 0.6), (fy * 0.6 + 0.7) * speed * (0.4 + Math.random() * 0.6) - down, (Math.random() - 0.3) * speed * 0.5);
      s.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      s.w.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
      const sz = size * (0.5 + Math.random());
      s.s.set(sz, sz * (0.5 + Math.random() * 0.7), sz * 0.3);
      s.life = s.max = 0.75 + Math.random() * 0.45;
      s.grav = 17;
      this.shardMesh.setColorAt(s.index, _c.set(colors[(Math.random() * colors.length) | 0]));
    }
    this.shardMesh.instanceColor.needsUpdate = true;
    this.shardMesh.visible = true;
  }

  // ── foil ────────────────────────────────────────────────────────────────
  _foil() {
    const s = this.foil[this.foilHead];
    this.foilHead = (this.foilHead + 1) % FOIL_MAX;
    return s;
  }

  /** Celebration confetti thrown up over a point: foil pieces that flutter down and catch the light. */
  confetti(pos, { count = 46, spread = 3.2, colors = [0xffc83d, 0xff5d73, 0x3ddbb4, 0x5cc8ff, 0x8f7bff, 0xfff6e3], up = 1, glint = 1 } = {}) {
    for (let i = 0; i < count; i++) {
      const s = this._foil();
      s.p.set(pos.x + (Math.random() - 0.5) * 0.6, pos.y, pos.z + (Math.random() - 0.5) * 0.6);
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * spread;
      s.v.set(Math.cos(a) * sp, (5.5 + Math.random() * 4.5) * up, Math.sin(a) * sp * 0.6);
      s.q.setFromEuler(_e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      s.w.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10);
      const sz = 0.11 + Math.random() * 0.08;
      s.s.set(sz, sz * (1.5 + Math.random() * 0.6), 1);
      s.life = s.max = 2.1 + Math.random() * 1.0;
      s.grav = 7;
      s.glide = 0.9 + Math.random() * 0.8;
      s.phase = Math.random() * 6.28;
      s.rest = 0;
      s.petal = false;
      this.foilGlint.array[s.index] = glint * (0.7 + Math.random() * 0.6);
      this.foilMesh.setColorAt(s.index, _c.set(colors[(Math.random() * colors.length) | 0]));
    }
    this.foilMesh.instanceColor.needsUpdate = true;
    this.foilGlint.needsUpdate = true;
    this.foilMesh.visible = true;
  }

  /** A single drifting blossom petal (ambient life around the island): matt, no glint. */
  petal(x, y, z, color = 0xffb3cf) {
    const s = this._foil();
    s.p.set(x, y, z);
    s.v.set(0.5 + Math.random() * 0.9, -0.2, (Math.random() - 0.3) * 0.6);
    s.q.setFromEuler(_e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    s.w.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
    const sz = 0.07 + Math.random() * 0.04;
    s.s.set(sz, sz * 1.3, 1);
    s.life = s.max = 5 + Math.random() * 2;
    s.grav = 1.1;
    s.glide = 0.5;
    s.phase = Math.random() * 6.28;
    s.rest = 0;
    s.petal = true;
    this.foilGlint.array[s.index] = 0.08;
    this.foilGlint.needsUpdate = true;
    this.foilMesh.setColorAt(s.index, _c.set(color));
    this.foilMesh.instanceColor.needsUpdate = true;
    this.foilMesh.visible = true;
  }

  // ── puffs ───────────────────────────────────────────────────────────────
  /** A soft, dull cloud of `count` puffs (a thud, dust, smoke). */
  puff(pos, { count = 8, color = 0xb8b0c8, size = 0.5, life = 0.7, speed = 1.4, up = 0.5, spread = 0.3, alpha = 0.75, grow = 1.8 } = {}) {
    const P = this.pf;
    for (let i = 0; i < count; i++) {
      const p = P.list[P.head];
      const k = P.head;
      P.head = (P.head + 1) % PUFF_MAX;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      p.p.set(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread * 0.6, pos.z + (Math.random() - 0.5) * spread * 0.5);
      p.v.set(Math.cos(a) * s, Math.abs(Math.sin(a)) * s * 0.5 + up, (Math.random() - 0.5) * s * 0.4);
      p.size = size * (0.6 + Math.random() * 0.6);
      p.grow = grow;
      p.alpha = alpha * (0.7 + Math.random() * 0.3);
      p.life = p.max = life * (0.75 + Math.random() * 0.5);
      p.color.set(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
      P.seed[k] = Math.random() * 10;
    }
    this.puffs.geometry.attributes.iSeed.needsUpdate = true;
    this.puffs.visible = true;
  }

  // ── rings ───────────────────────────────────────────────────────────────
  /** A soft shockwave. `width` sets how soft the band is; `fill` a faint glow inside it. */
  ring(pos, { color = 0xffffff, from = 0.3, to = 3.2, life = 0.45, flat = false, opacity = 0.9, width = 0.07, fill = 0.4 } = {}) {
    const r = this.rings.find((x) => x.life <= 0) ?? this.rings.reduce((a, b) => (a.life < b.life ? a : b));
    r.life = r.max = life;
    r.from = from;
    r.to = to;
    r.flat = flat;
    r.opacity = opacity;
    r.u.uColor.value.set(color);
    r.u.uWidth.value = width;
    r.u.uFill.value = fill;
    r.mesh.position.copy(pos);
    r.mesh.visible = true;
  }

  // ── rays ────────────────────────────────────────────────────────────────
  /** A burst of light rays behind `pos` (an Object3D to follow, or a point). */
  burstRays(pos, { color = 0xfff1c4, size = 3, life = 1.4, opacity = 0.7, spin = 0.35, count = 14 } = {}) {
    const r = this.rays.find((x) => x.life <= 0) ?? this.rays.reduce((a, b) => (a.life < b.life ? a : b));
    r.life = r.max = life;
    r.size = size;
    r.spin = spin;
    r.opacity = opacity;
    r.follow = pos.isObject3D ? pos : null;
    if (!r.follow) r.mesh.position.copy(pos);
    r.u.uColor.value.set(color);
    r.u.uCount.value = count;
    r.u.uSpin.value = Math.random() * 6;
    r.mesh.visible = true;
  }

  // ── flash ───────────────────────────────────────────────────────────────
  /** Light over the whole view for a moment (additive, so it never hides what is behind it). */
  flash(color = 0xffffff, strength = 0.25, dur = 0.22) {
    const f = this.flashState;
    if (f.t > 0 && f.strength * (f.t / f.dur) > strength) return;
    f.color.set(color);
    f.strength = strength * (this.stage.reduceMotion ? 0.35 : 1);
    f.dur = dur;
    f.t = dur;
    this.flashQuad.visible = true;
  }

  /** Compile every effect shader up front so the first burst never stutters. */
  prewarm(renderer, scene, camera) {
    const hidden = [this.shot.group, this.dizzy.group, this.sparks, this.shardMesh, this.foilMesh, this.puffs, this.flashQuad, ...this.rings.map((r) => r.mesh), ...this.rays.map((r) => r.mesh), ...Object.values(this.shot.meshes)];
    const was = hidden.map((o) => o.visible);
    hidden.forEach((o) => (o.visible = true));
    if (this.stage.compile) this.stage.compile(scene, scene); // for the target the frames really render into
    else renderer.compile(scene, camera);
    hidden.forEach((o, i) => (o.visible = was[i]));
  }

  // ── projectile ──────────────────────────────────────────────────────────
  /** Fire a projectile from → to. onHit runs on arrival. */
  fire(from, to, { color = 0xffffff, style = 'orb', dur = 0.17, size = 0.2, onHit = null } = {}) {
    const s = this.shot;
    s.from.copy(from);
    s.to.copy(to);
    s.ctrl.copy(from).lerp(to, 0.5);
    s.ctrl.x += (from.x - to.x) * 0.35 + (Math.random() - 0.5) * 0.8;
    s.ctrl.z += 0.9;
    s.color.set(color);
    s.style = style;
    s.t = 0;
    s.dur = dur;
    s.size = size;
    s.onHit = onHit;
    s.active = true;
    s.group.visible = true;
    s.last.copy(from);
    for (const [k, m] of Object.entries(s.meshes)) m.visible = k === style;
    s.mat.color.copy(s.color).lerp(_c.set(0xffffff), 0.55);
    if (style === 'ball') s.meshes.ball.material.color.copy(s.color).lerp(_c.set(0xffffff), 0.75);
    const m = s.meshes[style] ?? s.meshes.orb;
    m.scale.setScalar(style === 'bolt' ? size * 0.55 : style === 'star' ? size * 1.5 : size);
    s.halo.material.color.copy(s.color);
    s.halo.scale.setScalar(size * 9);
    s.group.position.copy(from);
  }

  // ── dizzy stars ─────────────────────────────────────────────────────────
  setDizzy(on) {
    this.dizzy.on = on;
    if (on) this.dizzy.group.visible = true;
  }

  // ── update ──────────────────────────────────────────────────────────────
  update(dt, t, dizzyAnchor) {
    this.time = t;
    this.sparkUniforms.uTime.value = t;
    const cam = this.stage.camera;

    // sparks
    const sp = this.sp;
    let any = false;
    if (this.sparks.visible) {
      for (let i = 0; i < SPARK_MAX; i++) {
        if (sp.life[i] <= 0) continue;
        any = true;
        sp.life[i] -= dt / sp.max[i];
        if (sp.life[i] <= 0) {
          sp.life[i] = 0;
          continue;
        }
        const j = i * 3;
        if (sp.homing[i] && (sp.homeT[i] -= dt) <= 0) {
          // fly home: steer hard towards the target, faster the longer it flies; gone on arrival
          const dx = sp.home[j] - sp.pos[j];
          const dy = sp.home[j + 1] - sp.pos[j + 1];
          const dz = sp.home[j + 2] - sp.pos[j + 2];
          const d = Math.hypot(dx, dy, dz);
          if (d < 0.22 || sp.homeT[i] < -1.6) {
            sp.life[i] = 0;
            continue;
          }
          const want = Math.min(26, 7 + -sp.homeT[i] * 30);
          const k = Math.min(1, dt * 9);
          sp.vel[j] += (dx / d * want - sp.vel[j]) * k;
          sp.vel[j + 1] += (dy / d * want - sp.vel[j + 1]) * k;
          sp.vel[j + 2] += (dz / d * want - sp.vel[j + 2]) * k;
          sp.life[i] = Math.max(sp.life[i], 0.4);
        } else {
          const k = Math.max(0, 1 - sp.drag[i] * dt);
          sp.vel[j] *= k;
          sp.vel[j + 1] = sp.vel[j + 1] * k - sp.grav[i] * dt;
          sp.vel[j + 2] *= k;
        }
        sp.pos[j] += sp.vel[j] * dt;
        sp.pos[j + 1] += sp.vel[j + 1] * dt;
        sp.pos[j + 2] += sp.vel[j + 2] * dt;
      }
      const a = this.sparks.geometry.attributes;
      a.iPos.needsUpdate = a.iVel.needsUpdate = a.iColor.needsUpdate = a.iSize.needsUpdate = a.iLife.needsUpdate = true;
      if (!any) this.sparks.visible = false;
    }

    // shards
    if (this.shardMesh.visible) {
      let moved = false;
      for (const s of this.shards) {
        if (s.life <= 0) continue;
        moved = true;
        s.life -= dt;
        if (s.life <= 0) {
          this.shardMesh.setMatrixAt(s.index, _m.makeScale(0, 0, 0));
          continue;
        }
        s.v.y -= s.grav * dt;
        s.p.addScaledVector(s.v, dt);
        if (s.p.y < 0.03 && s.v.y < 0 && Math.abs(s.p.x) < 6 && Math.abs(s.p.z) < 5) {
          s.p.y = 0.03;
          s.v.y *= -0.32;
          s.v.x *= 0.6;
          s.v.z *= 0.6;
          s.w.multiplyScalar(0.5);
        }
        s.r.addScaledVector(s.w, dt);
        const fade = Math.min(1, s.life / 0.25);
        _q.setFromEuler(_e.set(s.r.x, s.r.y, s.r.z));
        this.shardMesh.setMatrixAt(s.index, _m.compose(s.p, _q, _s.copy(s.s).multiplyScalar(fade)));
      }
      this.shardMesh.instanceMatrix.needsUpdate = true;
      if (!moved) this.shardMesh.visible = false;
    }

    // foil: paper physics — flat pieces catch the air, edge-on pieces slip through and glide sideways
    if (this.foilMesh.visible) {
      let moved = false;
      for (const s of this.foil) {
        if (s.life <= 0) continue;
        moved = true;
        s.life -= dt;
        if (s.life <= 0) {
          this.foilMesh.setMatrixAt(s.index, _m.makeScale(0, 0, 0));
          continue;
        }
        if (s.rest > 0) {
          // lying on the ground: settles, then fades
          s.rest += dt;
        } else {
          _n.set(0, 0, 1).applyQuaternion(s.q);
          const flat = Math.abs(_n.y);
          const drag = 0.7 + 3.6 * flat;
          s.v.y -= s.grav * dt;
          const kd = Math.max(0, 1 - drag * dt);
          s.v.y *= kd;
          // petals ride the breeze; confetti loses its throw to the air
          const kh = s.petal ? 0.15 : 0.6 + flat;
          s.v.x *= Math.max(0, 1 - kh * dt);
          s.v.z *= Math.max(0, 1 - kh * dt);
          // the glide: falling air pushes a tilted piece along its tilt
          const fall = Math.max(0, -s.v.y);
          const sign = _n.y >= 0 ? 1 : -1;
          s.v.x += _n.x * sign * fall * s.glide * 1.4 * dt;
          s.v.z += _n.z * sign * fall * s.glide * 0.8 * dt;
          // the flutter: a rocking torque that keeps flipping pieces over as they fall
          const rock = Math.sin(t * 6.5 + s.phase) * (2 + fall * 3) * s.glide;
          s.w.x += rock * dt * 6;
          s.w.multiplyScalar(Math.max(0, 1 - 0.8 * dt));
          s.p.addScaledVector(s.v, dt);
          _q.setFromEuler(_e.set(s.w.x * dt, s.w.y * dt, s.w.z * dt));
          s.q.multiply(_q);
          if (s.p.y < 0.025 && s.v.y < 0 && Math.abs(s.p.x) < 6.2 && Math.abs(s.p.z) < 5.2) {
            // landed: lie flat where it fell
            s.p.y = 0.02;
            s.rest = 0.001;
            _q.setFromAxisAngle(_up, Math.random() * 6.28);
            s.q.setFromEuler(_e.set(-Math.PI / 2, 0, 0)).premultiply(_q);
            s.life = Math.min(s.life, 0.9);
          }
        }
        const fade = Math.min(1, s.life / 0.3);
        this.foilMesh.setMatrixAt(s.index, _m.compose(s.p, s.q, _s.copy(s.s).multiplyScalar(fade)));
      }
      this.foilMesh.instanceMatrix.needsUpdate = true;
      if (!moved) this.foilMesh.visible = false;
    }

    // puffs: drift, swell and thin out
    if (this.puffs.visible) {
      const P = this.pf;
      let alive = false;
      for (let i = 0; i < PUFF_MAX; i++) {
        const p = P.list[i];
        const k = i * 4;
        if (p.life <= 0) {
          P.look[k + 3] = 0;
          continue;
        }
        alive = true;
        p.life -= dt;
        const u = 1 - Math.max(0, p.life) / p.max;
        p.v.multiplyScalar(Math.max(0, 1 - 3.2 * dt));
        p.v.y += 0.3 * dt;
        p.p.addScaledVector(p.v, dt);
        P.data[k] = p.p.x;
        P.data[k + 1] = p.p.y;
        P.data[k + 2] = p.p.z;
        P.data[k + 3] = p.size * (0.55 + (1 - Math.pow(1 - u, 2.2)) * p.grow * 0.6);
        P.look[k] = p.color.r;
        P.look[k + 1] = p.color.g;
        P.look[k + 2] = p.color.b;
        P.look[k + 3] = p.life > 0 ? p.alpha * Math.min(1, u * 8) * (1 - u) * (1 - u) : 0;
      }
      const a = this.puffs.geometry.attributes;
      a.iData.needsUpdate = a.iLook.needsUpdate = true;
      if (!alive) this.puffs.visible = false;
    }

    // rings
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const u = 1 - Math.max(0, r.life) / r.max;
      const e = 1 - Math.pow(1 - u, 3);
      r.mesh.scale.setScalar(r.from + (r.to - r.from) * e);
      r.u.uOpacity.value = (1 - u) * (1 - u * 0.4) * r.opacity * Math.min(1, u * 12);
      if (r.flat) r.mesh.rotation.set(-Math.PI / 2, 0, 0);
      else r.mesh.quaternion.copy(cam.quaternion);
      if (r.life <= 0) r.mesh.visible = false;
    }

    // rays
    for (const r of this.rays) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const u = 1 - Math.max(0, r.life) / r.max;
      if (r.follow) r.follow.getWorldPosition(r.mesh.position);
      r.mesh.quaternion.copy(cam.quaternion);
      r.mesh.scale.setScalar(r.size * (0.45 + 0.55 * (1 - Math.pow(1 - Math.min(1, u * 2.5), 3))));
      r.u.uSpin.value += dt * r.spin;
      r.u.uOpacity.value = r.opacity * Math.min(1, u * 7) * Math.pow(1 - u, 1.4);
      if (r.life <= 0) r.mesh.visible = false;
    }

    // flash: sized to fill the view at 1 unit in front of the camera
    const f = this.flashState;
    if (f.t > 0) {
      f.t = Math.max(0, f.t - dt);
      const k = f.t / f.dur;
      const h = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * 1.05;
      this.flashQuad.scale.set(h * cam.aspect * 0.8 + 0.2, h * 0.8 + 0.2, 1);
      this.flashMat.color.copy(f.color).multiplyScalar(f.strength * k * k);
      this.flashMat.opacity = 1;
      if (f.t <= 0) this.flashQuad.visible = false;
    }

    // projectile (quadratic arc with a sparkling, streaking tail)
    const s = this.shot;
    if (s.active) {
      s.t += dt;
      const u = Math.min(1, s.t / s.dur);
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      _v.set(a * s.from.x + b * s.ctrl.x + c * s.to.x, a * s.from.y + b * s.ctrl.y + c * s.to.y, a * s.from.z + b * s.ctrl.z + c * s.to.z);
      const g = s.group;
      const m = s.meshes[s.style] ?? s.meshes.orb;
      if (s.style === 'bolt') {
        _s.copy(_v).sub(g.position).normalize();
        m.quaternion.setFromUnitVectors(_up, _s.lengthSq() > 0 ? _s : _up);
      } else if (s.style === 'star') {
        m.rotation.z += dt * 30;
      } else {
        m.rotation.x += dt * 14;
      }
      g.position.copy(_v);
      // the tail inherits a little of the shot's speed, so it streaks
      _w.copy(_v).sub(s.last).multiplyScalar(dt > 0 ? 0.35 / dt : 0);
      s.last.copy(_v);
      for (let i = 0; i < 3; i++) {
        this.spark(_v.x + (Math.random() - 0.5) * 0.25, _v.y + (Math.random() - 0.5) * 0.25, _v.z, (Math.random() - 0.5) * 1.5 + _w.x, (Math.random() - 0.5) * 1.5 + _w.y, _w.z, i === 0 ? 0xffffff : s.color, 0.4 + Math.random() * 0.3, 0.3 + Math.random() * 0.2, 0, 3);
      }
      if (u >= 1) {
        s.active = false;
        g.visible = false;
        const cb = s.onHit;
        s.onHit = null;
        cb?.();
      }
    }

    // dizzy stars
    const d = this.dizzy;
    d.level += ((d.on ? 1 : 0) - d.level) * Math.min(1, dt * 8);
    if (d.level < 0.02 && !d.on) d.group.visible = false;
    if (d.group.visible && dizzyAnchor) {
      d.t += dt;
      d.group.position.copy(dizzyAnchor);
      d.group.children.forEach((star, i) => {
        const a = d.t * 3.6 + (i / 3) * Math.PI * 2;
        star.position.set(Math.cos(a) * 0.52, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.3);
        star.rotation.set(0.3, a * 1.5, 0);
        star.scale.setScalar(d.level);
      });
    }
  }
}
