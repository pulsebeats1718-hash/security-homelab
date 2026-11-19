/**
 * The lawn: a carpet of grass blades over the island's turf (medium and high quality; low keeps
 * the island's few tufts). One instanced mesh, one draw call: each instance is a little clump of
 * blades, and the vertex shader does everything that moves or changes —
 *
 *   wind     gusts rolling across the field in long waves (the same breeze leans the trees and
 *            nods the flowers: seasons/shader.js WIND_GLSL) plus a flutter of each blade; bent
 *            blades show their paler side, so the waves read as light travelling over the grass
 *   colour   from the turf right under each clump (the same patches of damp and dry ground),
 *            darker deep in the sward, tips lighter and a little sun-bleached; light glows
 *            through the blades when they are backlit; cloud shadows drift over them
 *   seasons  fresh in spring; drier tips in summer and none on the beach round the dais; golden
 *            in autumn; in winter most of it is under the snow, a few frosted tips poking through
 *   places   a place says where grass grows (Island.setGround: no grass on streets, pavements or
 *            beaches); after a change the old lawn shrinks away and the new one grows in, staggered
 *   clearing decorations keep it off their footprints (setClearings)
 *
 * The blades never grow on the dais, the stepping stones or the worn path between them, and are
 * shorter near the dais (a trampled stage edge) and at the island's rim.
 */
import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';
import { ISLAND, groundY, islandR, grassColor } from './places/kit.js';
import { SEASON_U, NOISE_GLSL, WIND_GLSL, CLOUD_GLSL, SAND_GLSL, TURF_TONES, seasonDetail } from './seasons/shader.js';

/** Per tier: grid cell (one clump per cell), blades per clump, segments per blade. */
const TIERS = {
  high: { cell: 0.128, blades: 4, segs: 3 },
  medium: { cell: 0.19, blades: 3, segs: 2 },
};
const GROW_TIME = 1.1;

const lin = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

// the same value noise as the turf shader's (NOISE_GLSL), so a clump takes the colour of the ground under it
const fract = (v) => v - Math.floor(v);
function hash2(x, y) {
  let a = fract(x * 0.1031);
  let b = fract(y * 0.1031);
  let c = fract(x * 0.1031);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d;
  b += d;
  c += d;
  return fract((a + b) * c);
}
function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const wx = x - ix;
  const wy = y - iy;
  const ux = wx * wx * (3 - 2 * wx);
  const uy = wy * wy * (3 - 2 * wy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** One clump of blades in unit form: y is the height fraction (0 … 1), x/z the layout (scaled per instance). */
function clumpGeometry(blades, segs, rng) {
  const pos = [];
  const nrm = [];
  const blade = [];
  const index = [];
  for (let k = 0; k < blades; k++) {
    const a = (k / blades) * Math.PI * 2 + rng() * 1.2;
    const off = k === 0 ? 0.008 : 0.02 + rng() * 0.028;
    const ox = Math.cos(a) * off;
    const oz = Math.sin(a) * off;
    // each blade faces its own way and leans outwards, curving over towards the tip
    const face = rng() * Math.PI;
    const wx = Math.cos(face);
    const wz = Math.sin(face);
    const lean = 0.1 + rng() * 0.22;
    const lx = Math.cos(a) * lean;
    const lz = Math.sin(a) * lean;
    const w = 0.016 + rng() * 0.008;
    const rnd = rng();
    const base = pos.length / 3;
    const ring = (t, half) => {
      const cx = ox + lx * t * t;
      const cz = oz + lz * t * t;
      pos.push(cx - wx * half, t, cz - wz * half, cx + wx * half, t, cz + wz * half);
      // the blade's face normal, tipped back a little against its lean
      for (let i = 0; i < 2; i++) nrm.push(-wz, 0.35, wx);
      blade.push(t, rnd, t, rnd);
    };
    for (let j = 0; j < segs; j++) {
      const t = j / segs;
      ring(t, w * (1 - t * 0.55));
    }
    // the tip
    pos.push(ox + lx, 1, oz + lz);
    nrm.push(-wz, 0.35, wx);
    blade.push(1, rnd);
    for (let j = 0; j < segs - 1; j++) {
      const i = base + j * 2;
      index.push(i, i + 1, i + 3, i, i + 3, i + 2);
    }
    const last = base + (segs - 1) * 2;
    index.push(last, last + 1, last + 2);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aBlade', new THREE.Float32BufferAttribute(blade, 2));
  g.setIndex(index);
  return g;
}

const VERT_PARS = /* glsl */ `
attribute vec2 aBlade;  // height fraction along the blade, a random number per blade
attribute vec4 iPos;    // clump base x, y, z, turn
attribute vec4 iShape;  // height, spread, seed, dryness
attribute vec3 iCol;    // the turf's colour under the clump
attribute vec2 iVis;    // shown before / after the last ground change (0 … 1)
uniform vec4 uSeason;
uniform float uPfTime;
uniform float uPfCloud;
uniform float uGroundT;
varying vec3 vGrassCol;
varying float vGrassT;
varying float vGrassCloud;
${NOISE_GLSL}
${WIND_GLSL}
${CLOUD_GLSL}
${SAND_GLSL}
`;

// after <beginnormal_vertex>: everything per clump and per blade, then the normal
const VERT_NORMAL = /* glsl */ `
float gT = aBlade.x;
float gR = aBlade.y;
float gSeed = iShape.z;
float gCos = cos(iPos.w);
float gSin = sin(iPos.w);
mat2 gRot = mat2(gCos, gSin, -gSin, gCos);
// how much of it shows: the place (growing in or out after a change), summer's beach, winter's snow
float gU = clamp((uGroundT - gSeed * 0.4) / 0.6, 0.0, 1.0);
float gVis = mix(iVis.x, iVis.y, gU * gU * (3.0 - 2.0 * gU));
gVis *= mix(1.0, smoothstep(-0.04, 0.34, pfSandEdge(iPos.xz)), uSeason.y);
gVis *= mix(1.0, step(fract(gSeed * 7.13 + gR * 0.61), 0.3) * 0.42, uSeason.w);
float gH = iShape.x * gVis * (0.6 + 0.8 * gR * gR);
// the wind: gusts rolling across the field, a flutter of each blade
float gGust = pfGust(iPos.xz, uPfTime);
float gFl = sin(uPfTime * (2.4 + gR * 1.7) + gSeed * 37.0 + gR * 11.0 + dot(iPos.xz, vec2(1.3, 0.7)));
float gBend = 0.14 + 0.6 * gGust + 0.08 * gFl;
vec2 gDir = normalize(PF_WIND + vec2(-0.34, 0.94) * (0.35 * gFl));
// lit like the ground under it, with a hint of the blade's own facing; tipped over as it bends
vec2 gNxz = gRot * objectNormal.xz;
objectNormal = normalize(mix(vec3(gNxz.x, objectNormal.y, gNxz.y), vec3(0.0, 1.0, 0.0), 0.6) + vec3(gDir.x, 0.0, gDir.y) * (gBend * gT * 0.5));
`;

// after <begin_vertex>
const VERT_POS = /* glsl */ `
{
  vec2 gXZ = gRot * (position.xz * iShape.y) * min(1.0, gVis * 4.0);
  float gB = gBend * gT * gT;
  transformed = vec3(iPos.x + gXZ.x + gDir.x * gB * gH, iPos.y + gH * (gT - 0.5 * gBend * gB * gT), iPos.z + gXZ.y + gDir.y * gB * gH);

  // colour: the turf's, darker deep in the sward, lighter towards the tips
  vec3 c = iCol * mix(vec3(0.9, 0.97, 0.86), vec3(1.08, 1.05, 0.86), fract(gSeed * 13.7 + gR * 3.1));
  c = mix(c, c * vec3(1.16, 1.08, 0.66), iShape.w * 0.55);
  c = mix(vec3(dot(c, vec3(0.3, 0.59, 0.11))), c, 0.8);
  vec3 tip = c * vec3(1.12, 1.1, 0.9) + vec3(0.01, 0.01, 0.0);
  c = mix(c * 0.42, tip, smoothstep(0.0, 1.0, gT));
  // seasons: fresh in spring, sun-dried tips in summer, golden in autumn, frost in winter
  c = mix(c, c * vec3(0.84, 1.14, 0.66) + vec3(0.012, 0.045, 0.0), uSeason.x);
  c = mix(c, c * mix(vec3(1.04, 1.02, 0.9), vec3(1.22, 1.08, 0.66), gT * gT), uSeason.y * 0.75);
  c = mix(c, c * vec3(1.42, 1.0, 0.5) + vec3(0.025, 0.01, 0.0), uSeason.z * 0.9);
  c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))) * vec3(0.9, 0.97, 1.1), uSeason.w * 0.3);
  c = mix(c, ${lin(0xe6ecf6)}, uSeason.w * smoothstep(0.3, 1.0, gT) * 0.85);
  // a gust bends the blades over to show their paler side
  c *= 1.0 + 0.2 * gGust * gT;
  vGrassCol = c;
  vGrassT = gT;
  vGrassCloud = pfCloudLight(iPos.xyz, uPfTime, uPfCloud);
}
`;

const FRAG_PARS = /* glsl */ `
varying vec3 vGrassCol;
varying float vGrassT;
varying float vGrassCloud;
`;

/** A one-tap (hardware-filtered) shadow for the blades: the five-tap soft shadow is wasted on grass. */
function cheapShadows(chunk) {
  const out = chunk.replace(/shadow = \(\s*texture\( shadowMap, vec3\( shadowCoord\.xy \+ vogelDiskSample\( 0[\s\S]*?\) \* 0\.2;/, 'shadow = texture( shadowMap, vec3( shadowCoord.xy, shadowCoord.z ) );');
  return out;
}

export class Grass {
  /**
   * @param {object} o  quality ('high' | 'medium'), stones ([x, z, size]), path ([[x, z] …]),
   *                    tussocks ([x, z, size]: spots where the grass grows taller)
   */
  constructor({ quality = 'high', stones = [], path = [], tussocks = [] } = {}) {
    const tier = TIERS[quality] ?? TIERS.medium;
    this.quality = quality;
    const rng = mulberry32(9071);
    const geo = clumpGeometry(tier.blades, tier.segs, mulberry32(77));

    // ── where the clumps grow ───────────────────────────────────────────────
    const { radius: R, depth: D } = ISLAND;
    const pathD = (x, z) => {
      let best = Infinity;
      for (let i = 1; i < path.length; i++) {
        const [ax, az] = path[i - 1];
        const [bx, bz] = path[i];
        const px = x - ax;
        const pz = z - az;
        const vx = bx - ax;
        const vz = bz - az;
        const h = Math.max(0, Math.min(1, (px * vx + pz * vz) / (vx * vx + vz * vz)));
        best = Math.min(best, Math.hypot(px - vx * h, pz - vz * h));
      }
      return best;
    };
    const spots = [];
    const cell = tier.cell;
    for (let gx = -R * 1.05; gx <= R * 1.05; gx += cell) {
      for (let gz = -R * D * 1.05; gz <= R * D * 1.05; gz += cell) {
        const x = gx + (rng() - 0.5) * cell * 0.95;
        const z = gz + (rng() - 0.5) * cell * 0.95;
        const t = rng();
        const ir = islandR(x, z);
        const r = Math.hypot(x, z);
        if (ir > 0.962 || r < 1.72 + t * 0.06) continue;
        if (stones.some(([sx, sz, s]) => Math.hypot(x - sx, (z - sz) * 1.15) < s * 1.02)) continue;
        const pd = pathD(x, z);
        // the worn path: trampled short and thin, a few bare patches in the middle
        if (pd < 0.45 && t < 0.62 - pd) continue;
        // a little thinner at the back of the island, which the camera mostly sees edge-on
        if (z < -3.2 && t > 0.82) continue;
        spots.push([x, z, t, pd, ir, r]);
      }
    }
    // the island's old tufts stand on as taller tussocks (not on the path or the stones)
    for (const [x, z, s] of tussocks) {
      if (pathD(x, z) < 0.6 || stones.some(([sx, sz, ss]) => Math.hypot(x - sx, (z - sz) * 1.15) < ss * 1.1)) continue;
      spots.push([x, z, -s, 9, islandR(x, z), Math.hypot(x, z)]);
    }

    const n = spots.length;
    const iPos = new Float32Array(n * 4);
    const iShape = new Float32Array(n * 4);
    const iCol = new Float32Array(n * 3);
    const iVis = new Float32Array(n * 2).fill(1);
    const c = new THREE.Color();
    const damp = new THREE.Color(TURF_TONES.damp);
    const dry = new THREE.Color(TURF_TONES.dry);
    const detail = seasonDetail();
    spots.forEach(([x, z, t, pd, ir, r], i) => {
      const tall = t < 0;
      iPos.set([x, groundY(x, z) - 0.012, z, rng() * Math.PI * 2], i * 4);
      // taller in lush patches and out towards the rim, shorter on the trampled edge of the stage,
      // by the path and right at the rim
      const lush = noise2(x * 0.42 + 3.1, z * 0.42 + 3.1);
      let h = 0.13 + 0.13 * noise2(x * 0.9 + 1.7, z * 0.9 - 4.2) + 0.06 * (1 - lush);
      h *= 0.7 + 0.3 * Math.min(1, (r - 1.7) / 1.2);
      h *= 0.32 + 0.68 * Math.min(1, Math.max(0, (pd - 0.08) / 0.55));
      h *= ir > 0.92 ? 0.75 : 1;
      if (tall) h = 0.27 + -t * 0.16;
      iShape.set([h, tall ? 1.6 : 0.85 + rng() * 0.4, rng(), Math.max(0, Math.min(1, (lush - 0.35) * 1.6))], i * 4);
      // the turf's own colour and variation at this spot (kit.grassColor and the turf shader)
      grassColor(c, x, 0, z, R, D);
      const n2 = noise2(x * 1.65 + 11.3, z * 1.65 + 11.3);
      const k1 = Math.min(1, Math.max(0, (lush - 0.25) / 0.55));
      const s1 = k1 * k1 * (3 - 2 * k1);
      // damp and dry patches and the mottling, as on the turf under it
      const mr = damp.r + (dry.r - damp.r) * s1;
      const mg = damp.g + (dry.g - damp.g) * s1;
      const mb = damp.b + (dry.b - damp.b) * s1;
      const mot = 0.86 + 0.26 * n2;
      const v = 0.9;
      c.r *= (1 + (mr - 1) * v) * (1 + (mot - 1) * v);
      c.g *= (1 + (mg - 1) * v) * (1 + (mot - 1) * v);
      c.b *= (1 + (mb - 1) * v) * (1 + (mot - 1) * v);
      if (detail > 1) {
        const n3 = noise2(x * 6.1 + 5.7, z * 6.1 + 5.7);
        c.multiplyScalar(1 + (0.9 + 0.2 * n3 - 1) * v);
      }
      c.toArray(iCol, i * 3);
    });
    this.base = { x: Float32Array.from(spots, (s) => s[0]), z: Float32Array.from(spots, (s) => s[1]), col: iCol.slice() };
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 4));
    geo.setAttribute('iShape', new THREE.InstancedBufferAttribute(iShape, 4));
    this.colAttr = new THREE.InstancedBufferAttribute(iCol, 3);
    this.visAttr = new THREE.InstancedBufferAttribute(iVis, 2);
    geo.setAttribute('iCol', this.colAttr);
    geo.setAttribute('iVis', this.visAttr);
    geo.instanceCount = n;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), R * 1.1);
    geo.boundingBox = new THREE.Box3(new THREE.Vector3(-R * 1.1, -0.5, -R), new THREE.Vector3(R * 1.1, 0.6, R));
    this.count = n;

    // ── the material: a Lambert surface whose vertex shader does the work ──────
    this.u = { uGroundT: { value: 1 } };
    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, SEASON_U, this.u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${VERT_NORMAL}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_POS}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
        .replace('#include <shadowmap_pars_fragment>', cheapShadows(THREE.ShaderChunk.shadowmap_pars_fragment))
        .replace('#include <color_fragment>', 'diffuseColor.rgb = vGrassCol;')
        // the grass is lit like the ground it grows from (both sides alike: no flipped back faces)
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize( vNormal );')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          #if NUM_DIR_LIGHTS > 0
          {
            // light glowing through the blades when they are backlit
            vec3 gV = normalize( vViewPosition );
            vec3 gTr = vec3( 0.0 );
            for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
              float b = max( dot( - gV, directionalLights[ i ].direction ), 0.0 );
              gTr += directionalLights[ i ].color * ( b * b );
            }
            totalEmissiveRadiance += gTr * diffuseColor.rgb * ( 0.04 + 0.2 * vGrassT ) * vGrassCloud;
          }
          #endif`
        )
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= vGrassCloud;');
    };
    mat.customProgramCacheKey = () => `pf-grass-${tier.segs}`;
    this.material = mat;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = 'grass';
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    // drawn after the props and characters that stand in it (opaque draws go by material, not by
    // depth), and before the turf, so hidden blades and hidden turf are rejected before shading
    this.mesh.renderOrder = 0.5;

    this.t = 1;
    this.place = null;
    this.clearings = [];
  }

  /** Where grass may grow, from the place's ground spec (keep, sand, tint) and the decorations' clearings. */
  _keep(x, z) {
    const spec = this.place;
    if (spec?.keep && !spec.keep(x, z)) return 0;
    let v = 1;
    if (spec?.sand) v = Math.max(0, 1 - spec.sand(x, z) * 1.6);
    for (const cl of this.clearings) {
      const d = Math.hypot(x - cl.x, z - cl.z);
      if (d < cl.r + 0.06) return 0;
    }
    return v;
  }

  _refresh(instant) {
    const vis = this.visAttr.array;
    const e = this._shown();
    const { x, z, col } = this.base;
    const spec = this.place;
    const c = new THREE.Color();
    const cols = this.colAttr.array;
    for (let i = 0; i < this.count; i++) {
      vis[i * 2] = instant ? 0 : e(i);
      vis[i * 2 + 1] = this._keep(x[i], z[i]);
      c.fromArray(col, i * 3);
      if (spec?.tint) spec.tint(c, x[i], 0, z[i]);
      c.toArray(cols, i * 3);
    }
    this.visAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.t = instant ? 1 : 0;
    this.u.uGroundT.value = this.t;
  }

  /** How much of instance i shows right now (mid-change included). */
  _shown() {
    const vis = this.visAttr.array;
    const sh = this.mesh.geometry.attributes.iShape.array;
    const g = this.t;
    return (i) => {
      const u = Math.min(1, Math.max(0, (g - sh[i * 4 + 2] * 0.4) / 0.6));
      return vis[i * 2] + (vis[i * 2 + 1] - vis[i * 2]) * u * u * (3 - 2 * u);
    };
  }

  /** The place's ground spec (Island.setGround); grows the change in over ~1 s unless instant. */
  setGround(spec, instant = false) {
    this.place = spec ?? null;
    this._refresh(instant);
  }

  /** Circles { x, z, r } the grass keeps off (decorations standing on the lawn). */
  setClearings(list, instant = false) {
    this.clearings = list ?? [];
    this._refresh(instant);
  }

  update(t, dt) {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / GROW_TIME);
      this.u.uGroundT.value = this.t;
    }
  }
}
