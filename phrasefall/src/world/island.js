/**
 * The floating island the game is played on: land, the stone dais the character stands on,
 * stepping stones, the streak ring with its gems, grass, flowers and the crystals underneath.
 * Everything that changes from place to place (trees, lamps, buildings, distant islands …)
 * lives in src/world/places/; a place can also reshape the turf with `setGround`.
 *
 * On medium and high quality the island is a living miniature: a lawn of grass blades swaying in
 * the wind (grass.js), turf with natural variation and a worn path, flagstones with real stone in
 * them, cloud shadows drifting over it all, and birds and butterflies about (wildlife.js). Low
 * draws it as it always has.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/utils.js';
import { Batch, UNIT, ISLAND, makeLand, rim, popK, std } from './places/kit.js';
import { KIND, SEASON_U, NOISE_GLSL, WIND_GLSL, CLOUD_GLSL, seasonMaterial, detailFor, setSeasonDetail, setTurfFeatures } from './seasons/shader.js';
import { Grass } from './grass.js';
import { Wildlife } from './wildlife.js';

/**
 * The island's random stream (seed 42) is shared with the Home Island dressing, which takes the
 * first 40 draws (places/home.js); skipping them keeps every stone, tuft and flower where it has
 * always been. `seedDraws` tells Home where the island's draws end.
 */
export const HOME_DRAWS = 40;

/** [x, z, size] of the stepping stones leading to the dais (seasonal props keep clear of them). */
export const STEPPING_STONES = [[0.2, 2.3, 0.42], [-0.3, 3.1, 0.36], [0.35, 3.85, 0.32], [-2.3, 0.9, 0.3], [2.4, 1.1, 0.34]];
/** The worn path from the front of the dais over the stepping stones ([x, z] points): the turf and the grass follow it. */
export const PATH = [[0, 1.62], [0.2, 2.3], [-0.3, 3.1], [0.35, 3.85], [0.28, 4.75]];

const GROUND_TIME = 0.9;
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();

/**
 * A flagstone (medium and high): an irregular, hand-cut outline with a softly rounded top edge,
 * in the unit size of UNIT.cyl (radius ≈ 1, height 1, centred), so it takes the same transform.
 */
function flagstone(seed) {
  const r = mulberry32(seed * 7919 + 13);
  const p1 = r() * 6.28;
  const p2 = r() * 6.28;
  const p3 = r() * 6.28;
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const rad = 0.93 + 0.06 * Math.sin(a * 3 + p1) + 0.035 * Math.sin(a * 5 + p2) + 0.02 * Math.sin(a * 9 + p3);
    pts.push(new THREE.Vector2(Math.cos(a) * rad, Math.sin(a) * rad));
  }
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.55, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.08, bevelSegments: 2, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -0.33, 0);
  geo.deleteAttribute('uv');
  return geo;
}

/**
 * Real stone for the dais and the stepping stones (medium and high): grain, weathered blotches,
 * the dais laid as a round centre stone and two rings of flagstones (the streak ring hides the
 * outer joint), each slab its own shade, dark joints, dirt and a little moss low down where the
 * stone meets the lawn, a polished middle where the characters stand, and the cloud shadows.
 */
const STONE_GLSL = /* glsl */ `
{
  vec2 sp = vStoneW.xz;
  float r = length(sp);
  float sn = pfNoise(sp * 11.0 + 4.0);
  float sm = pfNoise(sp * 2.7 + 1.3);
  vec3 sc = diffuseColor.rgb;
  float joint = 0.0;
  float outer = 0.0;
  if (r < 1.75) {
    float a = atan(sp.y, sp.x);
    float ring = r < 0.56 ? 0.0 : r < 1.22 ? 1.0 : 2.0;
    float nSl = ring < 0.5 ? 1.0 : ring < 1.5 ? 7.0 : 13.0;
    float u = (a / 6.2831853 + 0.5) * nSl + ring * 0.37;
    float slab = fract(sin((floor(u) + ring * 17.0) * 12.9898) * 43758.5453);
    float dj = ring < 0.5 ? 9.0 : (0.5 - abs(fract(u) - 0.5)) * 6.2831853 * r / nSl;
    float d = min(dj, min(abs(r - 0.56), abs(r - 1.22))) + (sn - 0.5) * 0.008;
    joint = 1.0 - smoothstep(0.004, 0.013, d);
    sc *= mix(0.92, 1.06, slab) * mix(vec3(1.02, 0.99, 0.95), vec3(0.97, 0.99, 1.03), fract(slab * 7.31));
    // the slabs' arrises are a touch paler, worn by feet
    sc *= 1.0 + 0.06 * (1.0 - smoothstep(0.012, 0.045, d)) * (1.0 - joint);
    outer = smoothstep(1.3, 1.68, r);
  }
  sc *= 0.9 + 0.13 * sm;
  sc *= 0.93 + 0.12 * sn;
  // dirt and a little moss low down, where the stone meets the lawn
  float low = clamp(smoothstep(-0.03, -0.17, vStoneW.y) * 0.85 + outer * 0.3, 0.0, 1.0) * (0.55 + 0.45 * sm);
  sc = mix(sc, sc * ${'${MOSS}'}, low);
  sc = mix(sc, sc * 0.5, joint);
  diffuseColor.rgb = sc;
  roughnessFactor = mix(roughnessFactor, 0.62, (1.0 - smoothstep(0.2, 1.1, r)) * (1.0 - joint));
  pfCloud = pfCloudLight(vStoneW, uPfTime, uPfCloud);
}
`;

function stoneMaterial(mat, detailRef) {
  const moss = new THREE.Color(0xb7c29a);
  const glsl = STONE_GLSL.replace('${MOSS}', `vec3(${moss.r.toFixed(4)}, ${moss.g.toFixed(4)}, ${moss.b.toFixed(4)})`);
  mat.onBeforeCompile = (shader) => {
    if (!detailRef.value) return;
    Object.assign(shader.uniforms, SEASON_U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStoneW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvStoneW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vStoneW;\nuniform float uPfTime;\nuniform float uPfCloud;\nfloat pfCloud = 1.0;\n${NOISE_GLSL}\n${CLOUD_GLSL}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${glsl}`)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= pfCloud;\nreflectedLight.directSpecular *= pfCloud;');
  };
  mat.customProgramCacheKey = () => `pf-stone-${detailRef.value}`;
  return mat;
}

export class Island {
  constructor(scene, { quality = 'high' } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'island';
    scene.add(this.group);
    this.quality = quality;
    // the surface detail of every scenery material (turf, foliage, cloud shadows …) follows the tier
    this.detail = { value: detailFor(quality) };
    setSeasonDetail(this.detail.value);
    setTurfFeatures(STEPPING_STONES, PATH);
    const seeded = mulberry32(42);
    let draws = 0;
    const rng = () => (draws++, seeded());
    while (draws < HOME_DRAWS) rng();

    const mats = (this.mats = {
      // the turf takes the season look: warmer in autumn, fresher in spring, sand round the dais in summer, snow in winter
      grass: seasonMaterial(std(0xffffff, { vertexColors: true, roughness: 1 }), { kind: KIND.TURF, sand: true, grassAttr: true }),
      rock: std(0xffffff, { vertexColors: true, flatShading: true }),
      stone: stoneMaterial(std(0xdcd3c3, { roughness: 0.85 }), this.detail),
    });

    const { radius: RADIUS, depth: DEPTH } = ISLAND;
    const land = makeLand(RADIUS, DEPTH, 6.3, mats);
    land.position.y = ISLAND.top;
    this.group.add(land);
    this.land = land;
    const turfGeo = land.children[0].geometry;
    turfGeo.setAttribute('aGrass', new THREE.BufferAttribute(new Float32Array(turfGeo.attributes.position.count).fill(1), 1));
    // the turf is drawn after everything standing on it, so whatever covers it is never shaded twice
    land.children[0].renderOrder = 1;

    const onLand = (x, z) => Math.hypot(x, z / DEPTH) < RADIUS * rim(Math.atan2(z / DEPTH, x)) * 0.9;

    // the stone dais the character stands on, with stepping stones leading to it
    const b = new Batch();
    const dais = new THREE.Mesh(new THREE.LatheGeometry([[1.68, -0.2], [1.66, -0.09], [1.6, -0.025], [1.5, 0], [0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 48), mats.stone);
    dais.receiveShadow = true;
    this.group.add(dais);
    const cut = this.detail.value > 0;
    STEPPING_STONES.forEach(([x, z, s], i) => b.add('stone', cut ? flagstone(i) : UNIT.cyl, x, -0.07, z, s, 0.08, s * 0.82, 0, rng() * 3, 0));
    b.build(mats, this.group, true);

    // ── streak ring set into the dais ─────────────────────────────────────
    this.ringMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, emissive: 0xffc83d, emissiveIntensity: 0.25, roughness: 0.5 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.035, 8, 64), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.004;
    this.group.add(ring);
    this.gems = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + ((i - 2) / 5) * Math.PI * 0.9;
      const mat = new THREE.MeshStandardMaterial({ color: 0x6e675f, emissive: 0xffc83d, emissiveIntensity: 0, roughness: 0.35 });
      const gem = new THREE.Mesh(UNIT.crystal, mat);
      gem.scale.set(0.085, 0.05, 0.085);
      gem.position.set(Math.cos(a) * 1.22, 0.02, Math.sin(a) * 1.22);
      this.group.add(gem);
      this.gems.push({ mesh: gem, mat, level: 0, target: 0 });
    }
    this.ringLevel = 0;
    this.ringTarget = 0;
    this.ringPulse = 0;

    // ── grass tufts with wind (low quality; on medium and high the lawn replaces them, and their
    //    spots grow taller tussocks in it) ─────────────────────────────────────────────────────
    const blade = new THREE.ConeGeometry(0.04, 0.3, 4);
    blade.translate(0, 0.15, 0);
    const tuftGeo = mergeGeometries([blade, blade.clone().rotateZ(0.45).translate(0.05, 0, 0), blade.clone().rotateZ(-0.4).translate(-0.05, 0, 0.02)], false);
    const tuftCount = quality === 'low' ? 60 : 130;
    this.windUniform = { value: 0 };
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    tuftMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = this.windUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float sway = sin(uWind * 1.9 + instanceMatrix[3].x * 1.3 + instanceMatrix[3].z * 0.9) * 0.09 + sin(uWind * 3.1 + instanceMatrix[3].z * 2.0) * 0.04;
          transformed.x += sway * position.y * 3.0;`);
    };
    seasonMaterial(tuftMat, { kind: KIND.TUFT, tip: true });
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const tussocks = [];
    let placed = 0;
    let guard = 0;
    while (placed < tuftCount && guard++ < 4000) {
      const x = (rng() * 2 - 1) * RADIUS * 1.05;
      const z = (rng() * 2 - 1) * RADIUS * DEPTH;
      if (!onLand(x, z) || Math.hypot(x, z) < 1.9) continue;
      const s = 0.5 + rng() * 0.55;
      dummy.position.set(x, -0.08, z);
      dummy.rotation.set(0, rng() * 6, 0);
      dummy.scale.set(s, s * (0.8 + rng() * 0.5), s);
      dummy.updateMatrix();
      tufts.setMatrixAt(placed, dummy.matrix);
      tufts.setColorAt(placed, col.setHSL(0.31 + rng() * 0.05, 0.62, 0.3 + rng() * 0.1));
      tussocks.push([x, z, s]);
      placed++;
    }
    tufts.count = placed;
    tufts.receiveShadow = true;
    this.group.add(tufts);
    this.tufts = tufts;
    this.tussocks = tussocks;

    // ── flowers ───────────────────────────────────────────────────────────
    const flowerCount = quality === 'low' ? 24 : 54;
    const stemGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.2, 5);
    stemGeo.translate(0, 0.1, 0);
    const headGeo = new THREE.SphereGeometry(0.065, 8, 6);
    headGeo.scale(1, 0.7, 1);
    headGeo.translate(0, 0.21, 0);
    // the wild flowers nod in the same breeze as the grass (stems and heads share the motion; with
    // detail, the gusts rolling over the lawn bow them too)
    const detail = this.detail;
    const flowerWind = (mat, key) => {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWind = this.windUniform;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nuniform float uWind;\n${detail.value ? WIND_GLSL : ''}`).replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float sway = sin(uWind * 1.7 + instanceMatrix[3].x * 1.1 + instanceMatrix[3].z * 0.8) * 0.07 + sin(uWind * 2.9 + instanceMatrix[3].z * 1.9) * 0.03;
          transformed.x += sway * position.y * 1.6;
          ${detail.value ? 'transformed.xz += PF_WIND * (pfGust(instanceMatrix[3].xz, uWind) * 0.22 * position.y);' : ''}`
        );
      };
      mat.customProgramCacheKey = () => `${key}-${detail.value ? 1 : 0}`;
      return mat;
    };
    this.flowerMats = [flowerWind(std(0x3fa65c), 'pf-wild-stem'), flowerWind(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), 'pf-wild-head')];
    const stems = new THREE.InstancedMesh(stemGeo, this.flowerMats[0], flowerCount);
    const heads = new THREE.InstancedMesh(headGeo, this.flowerMats[1], flowerCount);
    const palette = [0xffffff, 0xffe066, 0xff9ec4, 0xb9a6ff, 0xfff1a8];
    placed = 0;
    guard = 0;
    while (placed < flowerCount && guard++ < 3000) {
      const x = (rng() * 2 - 1) * RADIUS;
      const z = (rng() * 2 - 1) * RADIUS * DEPTH;
      if (!onLand(x, z) || Math.hypot(x, z) < 2.0) continue;
      const s = 0.8 + rng() * 0.7;
      dummy.position.set(x, -0.08, z);
      dummy.rotation.set((rng() - 0.5) * 0.3, rng() * 6, (rng() - 0.5) * 0.3);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      stems.setMatrixAt(placed, dummy.matrix);
      heads.setMatrixAt(placed, dummy.matrix);
      heads.setColorAt(placed, col.setHex(palette[(rng() * palette.length) | 0]));
      placed++;
    }
    stems.count = heads.count = placed;
    this.group.add(stems, heads);

    // ── crystals glowing under the island ─────────────────────────────────
    this.crystalMat = new THREE.MeshStandardMaterial({ color: 0x3fa9e8, emissive: 0x2f9dff, emissiveIntensity: 0.9, roughness: 0.25, flatShading: true });
    const cb = new Batch();
    [[-2.6, -2.2, 1.2, 0.5], [1.9, -2.9, 0.9, 0.42], [3.6, -1.6, -0.6, 0.36], [-0.4, -3.9, 1.6, 0.44], [-3.9, -1.5, -0.4, 0.32], [0.9, -4.9, 0.4, 0.3]].forEach(([x, y, z, s]) => {
      cb.add('crystal', UNIT.crystal, x, y, z, s * 0.42, s * 1.5, s * 0.42, 0.3 * (rng() - 0.5) + Math.PI, 0, 0.5 * (rng() - 0.5));
      cb.add('crystal', UNIT.crystal, x + s * 0.5, y + 0.1, z + 0.1, s * 0.26, s * 0.9, s * 0.26, Math.PI + 0.3, 0, -0.5);
    });
    cb.build({ crystal: this.crystalMat }, this.group, false);

    /** where the island's random draws end — Home's distant islands continue the stream from here */
    this.seedDraws = draws;

    // ── ground the places (and seasons) can reshape ───────────────────────
    const turf = turfGeo.attributes.color;
    const instanced = (mesh, flowers = false) => ({ mesh, flowers, base: mesh.instanceMatrix.array.slice(0, mesh.count * 16), n: mesh.count, level: new Float32Array(mesh.count).fill(1), from: new Float32Array(mesh.count).fill(1), to: new Float32Array(mesh.count).fill(1), delay: Float32Array.from({ length: mesh.count }, (_, i) => ((i * 0.618) % 1) * 0.35) });
    const grassAttr = turfGeo.attributes.aGrass;
    this.ground = {
      turf,
      turfPos: turfGeo.attributes.position,
      base: turf.array.slice(),
      from: turf.array.slice(),
      to: turf.array.slice(),
      grass: grassAttr,
      grassFrom: grassAttr.array.slice(),
      grassTo: grassAttr.array.slice(),
      sets: [instanced(tufts), { ...instanced(stems, true), twin: heads }],
      t: 1,
      place: null,
      season: null,
    };

    // ── the living miniature (medium and high) ─────────────────────────────
    this.grass = null;
    this.wildlife = new Wildlife(scene, { quality });
    this._lawn(quality);
  }

  /** The lawn for a tier: built (or rebuilt for a new tier) on medium and high, hidden on low. */
  _lawn(quality) {
    const want = quality !== 'low';
    if (want && this.grass?.quality !== quality) {
      const old = this.grass;
      if (old) {
        this.group.remove(old.mesh);
        old.mesh.geometry.dispose();
        old.material.dispose();
      }
      this.grass = new Grass({ quality, stones: STEPPING_STONES, path: PATH, tussocks: this.tussocks });
      this.group.add(this.grass.mesh);
      if (old) this.grass.clearings = old.clearings;
      this.grass.setGround(this.ground.place, true);
    }
    if (this.grass) this.grass.mesh.visible = want;
    this.tufts.visible = !want;
  }

  /**
   * Re-read the quality tier at run time (Settings): the surface detail of the scenery, the lawn,
   * the wildlife. The boot tier is set by the constructor.
   */
  setQuality(quality) {
    if (quality === this.quality) return;
    this.quality = quality;
    this.detail.value = detailFor(quality);
    setSeasonDetail(this.detail.value);
    this.mats.stone.needsUpdate = true;
    for (const m of this.flowerMats) m.needsUpdate = true;
    this._lawn(quality);
    this.wildlife.setQuality(quality);
  }

  /**
   * Let a place reshape the turf: `spec.keep(x, z)` false hides the grass tufts and flowers there,
   * `spec.tint(color, x, y, z)` recolours the grass top (land space; the top sits at y ≈ 0) and
   * `spec.sand(x, z)` (0…1) says where it is no longer grass (for the season look).
   * `null` restores the plain island. Blends over ~0.9 s unless `instant`.
   */
  setGround(spec, instant = false) {
    this.ground.place = spec ?? null;
    this._refreshGround(instant, true);
    this.grass?.setGround(this.ground.place, instant);
  }

  /** The season's say over the grass: { keepTufts(x, z), keepFlowers(x, z) } or null. */
  setSeasonGround(spec, instant = false) {
    this.ground.season = spec ?? null;
    this._refreshGround(instant, false);
  }

  /** Circles { x, z, r } the lawn keeps off (garden decorations standing on it). */
  setClearings(list, instant = false) {
    this.grass?.setClearings(list, instant);
  }

  _refreshGround(instant, recolour) {
    const g = this.ground;
    const spec = g.place;
    const season = g.season;
    const p = g.turfPos;
    g.from.set(g.turf.array);
    g.grassFrom.set(g.grass.array);
    if (recolour) {
      const c = new THREE.Color();
      g.to.set(g.base);
      g.grassTo.fill(1);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const z = p.getZ(i);
        if (spec?.tint) {
          c.fromArray(g.base, i * 3);
          spec.tint(c, x, p.getY(i), z);
          c.toArray(g.to, i * 3);
        }
        if (spec?.sand) g.grassTo[i] = 1 - spec.sand(x, z);
      }
    }
    for (const set of g.sets) {
      set.from.set(set.level);
      const seasonKeep = set.flowers ? season?.keepFlowers : season?.keepTufts;
      for (let i = 0; i < set.n; i++) {
        const x = set.base[i * 16 + 12];
        const z = set.base[i * 16 + 14];
        set.to[i] = (!spec?.keep || spec.keep(x, z)) && (!seasonKeep || seasonKeep(x, z)) ? 1 : 0;
      }
    }
    g.t = instant ? 1 : 0;
    this._groundStep(instant ? 1 : 0);
  }

  _groundStep(t) {
    const g = this.ground;
    const e = t >= 1 ? 1 : t * t * (3 - 2 * t);
    const arr = g.turf.array;
    const gr = g.grass.array;
    if (e === 1) {
      arr.set(g.to);
      gr.set(g.grassTo);
    } else {
      for (let i = 0; i < arr.length; i++) arr[i] = g.from[i] + (g.to[i] - g.from[i]) * e;
      for (let i = 0; i < gr.length; i++) gr[i] = g.grassFrom[i] + (g.grassTo[i] - g.grassFrom[i]) * e;
    }
    g.turf.needsUpdate = true;
    g.grass.needsUpdate = true;
    for (const set of g.sets) {
      const im = set.mesh.instanceMatrix.array;
      for (let i = 0; i < set.n; i++) {
        const u = t >= 1 ? 1 : Math.min(1, Math.max(0, (t - set.delay[i]) / (1 - 0.35)));
        const lv = set.from[i] + (set.to[i] - set.from[i]) * u;
        set.level[i] = lv;
        const k = lv >= 1 ? 1 : lv <= 0 ? 0 : set.to[i] > set.from[i] ? popK(lv) : lv;
        if (k === 1) {
          for (let j = 0; j < 16; j++) im[i * 16 + j] = set.base[i * 16 + j];
        } else {
          _m.fromArray(set.base, i * 16).scale(_s.set(k, k, k)).toArray(im, i * 16);
        }
      }
      set.mesh.instanceMatrix.needsUpdate = true;
      if (set.twin) {
        set.twin.instanceMatrix.array.set(im.subarray(0, set.n * 16));
        set.twin.instanceMatrix.needsUpdate = true;
      }
    }
  }

  /** Light up the dais: `streak` consecutive correct answers. */
  setStreak(streak) {
    const lit = streak <= 0 ? 0 : ((streak - 1) % 5) + 1;
    this.gems.forEach((g, i) => (g.target = i < lit ? 1 : 0));
    this.ringTarget = Math.min(1, streak / 10);
  }

  pulseRing(amount = 1) {
    this.ringPulse = Math.max(this.ringPulse, amount);
  }

  setAccent(color) {
    this.ringMat.emissive.copy(color);
    for (const g of this.gems) g.mat.emissive.copy(color);
  }

  apply(v) {
    this.crystalMat.emissiveIntensity = 0.7 + v.lamps * 1.3;
    this.setAccent(v.accent);
    // cloud shadows by day only (they fade out through dusk)
    SEASON_U.uPfCloud.value = 0.3 * Math.min(1, Math.max(0, 1 - (v.stars ?? 0) * 1.4));
    this.wildlife.apply(v);
  }

  update(t, dt) {
    this.windUniform.value = t;
    if (this.ground.t < 1) {
      this.ground.t = Math.min(1, this.ground.t + dt / GROUND_TIME);
      this._groundStep(this.ground.t);
    }
    this.grass?.update(t, dt);
    this.wildlife.update(t, dt);
    this.ringPulse = Math.max(0, this.ringPulse - dt * 1.6);
    this.ringLevel += (this.ringTarget - this.ringLevel) * Math.min(1, dt * 4);
    this.ringMat.emissiveIntensity = 0.22 + this.ringLevel * 1.5 + this.ringPulse * 3 + Math.sin(t * 2.4) * 0.06;
    for (const g of this.gems) {
      g.level += (g.target - g.level) * Math.min(1, dt * 9);
      g.mat.emissiveIntensity = g.level * 2.6 + this.ringPulse * 2;
      const s = 1 + g.level * 0.35;
      g.mesh.scale.set(0.085 * s, 0.05 * s, 0.085 * s);
    }
  }
}
