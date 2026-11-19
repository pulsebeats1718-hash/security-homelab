/**
 * Stylised puffy clouds: a drifting middle layer and a soft "sea" far below the islands.
 *
 * Their look is hand-made rather than PBR (and cheaper than it): a wide, soft terminator like light
 * through cotton wool, cooler and darker undersides, a sky-tinted shadow side, a silver lining where
 * the sun is behind them, and the theme's sunset glow.
 */
import * as THREE from 'three';

const CLOUD_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vN;
varying vec3 vView;
varying float vH;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vView = cameraPosition - wp.xyz;
  vH = clamp(position.y * 0.62 + 0.45, 0.0, 1.0); // 0 at the flat base, 1 at the top of the puffs
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const CLOUD_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uSunDir;
uniform vec3 uRimDir;
uniform vec3 uRim;
uniform vec3 uGlow;
varying vec3 vN;
varying vec3 vView;
varying float vH;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(vView);
  // each puff reads as a soft ball: a clear but gentle terminator, light pooling on the tops
  float wrap = clamp((dot(n, uSunDir) + 0.35) / 1.35, 0.0, 1.0);
  wrap = wrap * wrap * (3.0 - 2.0 * wrap);
  float top = smoothstep(0.0, 0.75, vH);
  vec3 col = mix(uShade, uLit, wrap * (0.6 + 0.4 * top) + 0.12 * max(n.y, 0.0));
  col *= 0.9 + 0.1 * top;
  // undersides catch warm light bounced up from the sunlit cloud sea below
  col += uLit * max(-n.y, 0.0) * 0.16;
  // silver lining: the rims light up where the sun is behind the cloud
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col += uRim * fres * (0.3 + 0.7 * max(dot(-v, uRimDir), 0.0)) * (0.6 + 0.4 * top);
  col += uGlow * (0.45 + 0.55 * fres);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
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
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uLit: { value: new THREE.Color(1, 1, 1) },
        uShade: { value: new THREE.Color(0.5, 0.55, 0.7) },
        uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.4).normalize() },
        uRimDir: { value: new THREE.Vector3(0, 0.1, -1) },
        uRim: { value: new THREE.Color(0, 0, 0) },
        uGlow: { value: new THREE.Color(0, 0, 0) },
      },
    ]);
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, fog: true });
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
      // distinct puffs with sky between them (sized so even the far ones never fill the view); the
      // nearer ones sit lower, so the sky above the island stays open
      push({ x: (rng() * 2 - 1) * 60, y: -3 + rng() * (9 + (-z - 10) * 0.21), z, s: 1.1 + rng() * 1.7 + -z * 0.024, speed: 0.25 + rng() * 0.35, wrap: 66, bob: rng() * 6 });
    }
    // cloud sea below
    for (let i = 0; i < seaCount; i++) {
      const z = 6 - rng() * 95;
      push({ x: (rng() * 2 - 1) * 85, y: -10.5 - rng() * 4.5, z, s: 6 + rng() * 6.5, speed: 0.12 + rng() * 0.16, wrap: 92, bob: rng() * 6, flat: 0.6 });
    }
    for (const m of this.meshes) m.count = m.userData.used;
    this.update(0, 0);
  }

  /** Theme values (season-tinted), the key light's direction and the sky sun's (the back light). */
  apply(v, sunDir, skySun) {
    const u = this.uniforms;
    // lit side: the sun plus the sky; shade side: the sky's own colour, cool and soft
    u.uLit.value.copy(v.sunLight).multiplyScalar(v.sunIntensity * 0.4).add(_c.copy(v.hemiSky).multiplyScalar(v.hemiIntensity * 0.45)).multiply(v.cloud);
    u.uShade.value.copy(v.hemiSky).multiplyScalar(v.hemiIntensity * 0.6).add(_c.copy(v.skyHorizon).multiplyScalar(0.3)).multiply(v.cloud);
    u.uRim.value.copy(v.rim).multiplyScalar(0.25 + v.rimIntensity * 0.3);
    u.uGlow.value.copy(v.cloudGlow).multiplyScalar(v.cloudGlowAmt * 0.8);
    if (sunDir) u.uSunDir.value.copy(sunDir).normalize();
    if (skySun) u.uRimDir.value.copy(skySun).normalize();
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

const _c = new THREE.Color();

const MOTE_VERT = /* glsl */ `
attribute float aPhase;
attribute float aSize;
uniform float uTime;
uniform float uPixel;
uniform float uScale;
uniform float uNight;
varying float vAlpha;
varying float vGlow;
void main() {
  vec3 p = position;
  // by day: dust and pollen drifting slowly up through the light; by night: fireflies, wandering
  // in loose loops and blinking
  float wander = mix(0.6, 1.1, uNight);
  p.x += sin(uTime * 0.35 + aPhase * 6.0) * wander + sin(uTime * 0.9 + aPhase * 17.0) * 0.18 * uNight;
  p.y += mod(uTime * (0.12 + aPhase * 0.14) * (1.0 - 0.6 * uNight) + aPhase * 9.0, 7.0) - 0.5;
  p.z += cos(uTime * 0.28 + aPhase * 4.0) * wander;
  float twinkle = 0.45 + 0.55 * sin(uTime * (1.2 + aPhase) + aPhase * 30.0);
  float blink = pow(max(sin(uTime * (0.9 + aPhase * 0.8) + aPhase * 40.0), 0.0), 4.0);
  vGlow = blink * uNight;
  vAlpha = mix(twinkle, 0.15 + blink, uNight) * smoothstep(-0.5, 0.6, p.y) * smoothstep(6.5, 4.5, p.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixel * uScale * mix(0.75, 0.85, uNight) / -mv.z;
}`;

const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
varying float vGlow;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r);
  float core = smoothstep(0.14, 0.0, r);
  // a firefly's bright heart (it blooms on high and medium quality)
  gl_FragColor = vec4(uColor * (1.0 + core * vGlow * 3.0), a * a * vAlpha * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const _day = new THREE.Color(0xfff4d6);
const _fly = new THREE.Color(0xd9ff8a);

/** Drifting motes of dust and pollen by day, blinking fireflies by night. Animated entirely on the GPU. */
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
    this.uniforms = { uTime: { value: 0 }, uPixel: { value: 1 }, uScale: { value: 1 }, uNight: { value: 0 }, uColor: { value: new THREE.Color(0xfff1c0) }, uOpacity: { value: 0.5 } };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  apply(v) {
    // night comes with the lamps: warm green fireflies; by day, motes in the theme's warm light
    const night = Math.min(1, Math.max(0, (v.lamps - 0.3) / 0.7));
    this.uniforms.uNight.value = night;
    this.uniforms.uColor.value.copy(_day).lerp(v.accent, 0.25).lerp(_fly, night);
    this.uniforms.uOpacity.value = 0.32 + night * 0.6;
  }
  update(t, pixelRatio, viewHeight) {
    this.uniforms.uTime.value = t;
    this.uniforms.uPixel.value = pixelRatio;
    this.uniforms.uScale.value = viewHeight / 900;
  }
}
