/**
 * City surfaces — procedural patterns for the cities' buildings and streets, drawn once into small
 * tiling canvases and laid onto the merged dioramas in world space (the Batch keeps no UVs, so the
 * pattern is projected from each fragment's rest position: walls by their run and height, flat
 * surfaces from above). No extra geometry: a whole wall of brick is still one soft box.
 *
 *   PATTERNS          brick, stone (ashlar), render (stucco), slate, tile (terracotta), paving,
 *                     tarmac, wood (boards), office / flats (window grids for the far towers)
 *   cityMaterials(d)  the pattern materials for a Diorama, keyed like its own materials
 *                     ('brick', 'stone' …) plus 'glowGlass' (sash-window glass that reflects the
 *                     sky and lights up at night). On low quality every pattern key falls back to
 *                     the plain matte material and the glass to the place's glow material, so the
 *                     cheapest tier draws exactly what it drew before.
 *   K(d)              the material key to use for a pattern on this tier ('matte' on low)
 *
 * Pattern texels: R albedo (0.5 = the vertex colour), G joint (mortar, grout, gaps: the material's
 * joint colour), B window (0 = wall; otherwise glass, and the order in which it lights at night).
 */
import * as THREE from 'three';
import { popMaterial, STAGGER } from '../kit.js';

const SIZE = 256;

/** A tiny seeded random stream (patterns are the same on every device). */
function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 4294967296;
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * Draw a pattern into SIZE × SIZE RGB data with fill(rect) calls. `fn(put, rng)` paints with
 * put(x, y, w, h, r, g, b) (wrapping round the edges, so every tile joins seamlessly).
 */
function bake(seed, fn) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 3] = 255;
  }
  const rng = rand(seed);
  const put = (x, y, w, h, r, g, b) => {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = Math.round(x + w);
    const y1 = Math.round(y + h);
    for (let yy = y0; yy < y1; yy++) {
      const row = ((yy % SIZE) + SIZE) % SIZE;
      for (let xx = x0; xx < x1; xx++) {
        const i = (row * SIZE + (((xx % SIZE) + SIZE) % SIZE)) * 4;
        if (r != null) data[i] = clamp255(r);
        if (g != null) data[i + 1] = clamp255(g);
        if (b != null) data[i + 2] = clamp255(b);
      }
    }
  };
  /** fine grain over everything (keeps large flat areas from looking like plastic) */
  const grain = (amt) => {
    for (let i = 0; i < data.length; i += 4) data[i] = clamp255(data[i] + (rng() - 0.5) * amt);
  };
  fn(put, rng, grain);
  return data;
}

/** Each pattern: how many tiles per world unit (u along the wall, v up it) and how to draw one tile. */
const RECIPES = {
  // London stock brick: stretcher bond, 8 courses × 4 bricks per tile, each brick its own shade
  brick: {
    scale: [1.9, 3.4],
    draw: (put, rng, grain) => {
      const cw = SIZE / 4;
      const ch = SIZE / 8;
      put(0, 0, SIZE, SIZE, 128, 255, 0);
      for (let row = 0; row < 8; row++) {
        const off = row % 2 ? cw / 2 : 0;
        for (let k = 0; k < 5; k++) {
          const v = 128 + (rng() - 0.5) * 70 + (rng() < 0.12 ? -34 : 0) + (rng() < 0.08 ? 30 : 0);
          put(off + k * cw + 3, row * ch + 3, cw - 6, ch - 6, v, 0, 0);
          // a darker burnt end now and then
          if (rng() < 0.25) put(off + k * cw + 3, row * ch + 3, 6, ch - 6, v - 30, 0, 0);
        }
      }
      grain(26);
    },
  },
  // Portland-ish ashlar: big blocks, thin joints
  stone: {
    scale: [0.9, 1.7],
    draw: (put, rng, grain) => {
      const cw = SIZE / 2;
      const ch = SIZE / 4;
      put(0, 0, SIZE, SIZE, 128, 210, 0);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? cw / 2 : 0;
        for (let k = 0; k < 3; k++) put(off + k * cw + 2, row * ch + 2, cw - 4, ch - 4, 128 + (rng() - 0.5) * 26, 0, 0);
      }
      grain(22);
    },
  },
  // painted stucco: almost smooth, faint weathered patches
  render: {
    scale: [0.9, 1.3],
    draw: (put, rng, grain) => {
      for (let i = 0; i < 40; i++) put(rng() * SIZE, rng() * SIZE, 20 + rng() * 60, 10 + rng() * 40, 128 + (rng() - 0.5) * 14, null, null);
      grain(10);
    },
  },
  // natural slate: rows of slightly ragged slates with dark gaps
  slate: {
    scale: [3.2, 5.5],
    draw: (put, rng, grain) => {
      const cw = SIZE / 8;
      const ch = SIZE / 8;
      put(0, 0, SIZE, SIZE, 90, 200, 0);
      for (let row = 0; row < 8; row++) {
        const off = row % 2 ? cw / 2 : 0;
        for (let k = 0; k < 9; k++) put(off + k * cw + 2, row * ch + 3, cw - 4, ch - 3 - rng() * 3, 128 + (rng() - 0.5) * 50, 0, 0);
      }
      grain(30);
    },
  },
  // terracotta roof tiles: rounded rows, light on the crowns
  tile: {
    scale: [3.0, 5.0],
    draw: (put, rng, grain) => {
      const cw = SIZE / 8;
      const ch = SIZE / 8;
      put(0, 0, SIZE, SIZE, 70, 160, 0);
      for (let row = 0; row < 8; row++) {
        for (let k = 0; k < 8; k++) {
          const v = 128 + (rng() - 0.5) * 40;
          put(k * cw + 2, row * ch + 2, cw - 4, ch - 4, v - 18, 0, 0);
          put(k * cw + cw * 0.3, row * ch + 2, cw * 0.4, ch - 6, v + 22, 0, 0);
        }
      }
      grain(20);
    },
  },
  // square paving flags with grout lines
  paving: {
    scale: [1.6, 1.6],
    draw: (put, rng, grain) => {
      const c = SIZE / 4;
      put(0, 0, SIZE, SIZE, 128, 230, 0);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) put(i * c + 3, j * c + 3, c - 6, c - 6, 128 + (rng() - 0.5) * 34, 0, 0);
      grain(30);
    },
  },
  // tarmac: speckled aggregate, a few repaired patches
  tarmac: {
    scale: [0.8, 0.8],
    draw: (put, rng, grain) => {
      for (let i = 0; i < 6; i++) put(rng() * SIZE, rng() * SIZE, 30 + rng() * 60, 20 + rng() * 50, 112 + rng() * 30, null, null);
      for (let i = 0; i < 2600; i++) put(rng() * SIZE, rng() * SIZE, 1 + rng() * 2, 1 + rng() * 2, 70 + rng() * 120, null, null);
      grain(30);
    },
  },
  // vertical boards (shopfronts, sheds, jetties)
  wood: {
    scale: [3.0, 0.6],
    draw: (put, rng, grain) => {
      const cw = SIZE / 8;
      for (let k = 0; k < 8; k++) {
        const v = 128 + (rng() - 0.5) * 40;
        put(k * cw, 0, cw, SIZE, v, 0, 0);
        for (let i = 0; i < 10; i++) put(k * cw + 2 + rng() * (cw - 6), rng() * SIZE, 1.5, 20 + rng() * 60, v - 18, null, null);
        put(k * cw, 0, 3, SIZE, null, 200, null);
      }
      grain(18);
    },
  },
  // far office towers: ribbon windows between spandrels, mullions; every pane its own lighting order
  // (a tile is 4 storeys of 0.42 and 8 bays of 0.25)
  office: {
    scale: [0.5, 0.6],
    draw: (put, rng, grain) => {
      put(0, 0, SIZE, SIZE, 128, 0, 0);
      const rows = 4;
      const cols = 8;
      const ch = SIZE / rows;
      const cw = SIZE / cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) put(c * cw + 3, r * ch + ch * 0.32, cw - 6, ch * 0.6, 90 + rng() * 60, 0, 6 + rng() * 249);
      }
      grain(12);
    },
  },
  // far flats and warehouses: punched windows in the wall (a tile is 4 storeys of 0.5, 4 bays of 0.4)
  flats: {
    scale: [0.625, 0.5],
    draw: (put, rng, grain) => {
      put(0, 0, SIZE, SIZE, 128, 0, 0);
      const rows = 4;
      const cols = 4;
      const ch = SIZE / rows;
      const cw = SIZE / cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          put(c * cw + cw * 0.22, r * ch + ch * 0.2, cw * 0.56, ch * 0.62, 70 + rng() * 50, 0, 6 + rng() * 249);
          put(c * cw + cw * 0.18, r * ch + ch * 0.84, cw * 0.64, ch * 0.06, 175, 0, 0);
        }
      }
      grain(22);
    },
  },
};

/** Pattern names (keys of the city materials). */
export const PATTERNS = Object.keys(RECIPES);

const textures = new Map();
function patternTexture(name) {
  let t = textures.get(name);
  if (!t) {
    const data = bake(name.length * 977 + name.charCodeAt(0) * 131, RECIPES[name].draw);
    t = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    textures.set(name, t);
  }
  return t;
}

// ── the shader patch ──────────────────────────────────────────────────────
const VERT_PARS = /* glsl */ `
varying vec3 vPatP;
varying vec3 vPatN;
`;
// the rest position, scaled with the pop (so the pattern grows with its building) but not bobbing
const VERT_MAIN = /* glsl */ `
{
  float pfPatD = aPop.w - 2.0 * floor(aPop.w * 0.5 + 0.001);
  float pfPatU = clamp((uPop - pfPatD * ${STAGGER.toFixed(3)}) / ${(1 - STAGGER).toFixed(3)}, 0.0, 1.0);
  float pfPatT = pfPatU - 1.0;
  float pfPatK = 1.0 + 2.70158 * pfPatT * pfPatT * pfPatT + 1.70158 * pfPatT * pfPatT;
  vPatP = (modelMatrix * vec4(aPop.xyz + (position - aPop.xyz) * pfPatK, 1.0)).xyz;
  vPatN = normalize(mat3(modelMatrix) * normal);
}
`;
const FRAG_PARS = /* glsl */ `
uniform sampler2D uPat;
uniform vec2 uPatScale;
uniform vec3 uPatJoint;
uniform vec3 uPatGlass;
uniform float uPatTop;
uniform float uPatLamps;
varying vec3 vPatP;
varying vec3 vPatN;
vec4 pfPat = vec4(0.5, 0.0, 0.0, 1.0);
float pfPatGlass = 0.0;
`;
const FRAG_COLOR = /* glsl */ `
{
  vec3 pn = normalize(vPatN);
  float flat = step(0.7, abs(pn.y));
  vec2 pt = normalize(vec2(pn.z, -pn.x) + vec2(1e-4, 0.0));
  vec2 puv = mix(vec2(dot(vPatP.xz, pt), vPatP.y), vPatP.xz, flat);
  pfPat = mix(texture2D(uPat, puv * uPatScale), vec4(0.5, 0.0, 0.0, 1.0), flat * (1.0 - uPatTop));
  pfPatGlass = step(0.015, pfPat.b);
  vec3 pc = diffuseColor.rgb * (0.3 + 1.4 * pfPat.r);
  pc = mix(pc, uPatJoint, pfPat.g);
  diffuseColor.rgb = mix(pc, uPatGlass * (0.55 + 0.9 * pfPat.r), pfPatGlass);
}
`;
const FRAG_ROUGH = /* glsl */ `
roughnessFactor = mix(roughnessFactor, 0.16, pfPatGlass);
`;
const FRAG_METAL = /* glsl */ `
metalnessFactor = mix(metalnessFactor, 0.5, pfPatGlass);
`;
// windows light up one by one as the theme's lamps come on (B = each pane's turn)
const FRAG_EMISSIVE = /* glsl */ `
totalEmissiveRadiance += vec3(1.0, 0.7, 0.38) * pfPatGlass * smoothstep(pfPat.b, pfPat.b + 0.1, uPatLamps * 0.95) * (0.5 + 1.5 * min(uPatLamps, 1.0));
`;

/**
 * A pattern material for a Diorama: its vertex colours tinted by the pattern, joints in `joint`,
 * window panes (office / flats) in `glass`. `top`: also on flat tops (paving, roofs seen from above).
 */
function patternMaterial(u, depth, name, { roughness = 0.88, joint = 0xd9d2c4, glass = 0x46546a, top = true, scale = 1 } = {}) {
  const mat = popMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness }), u, { anim: true, season: true });
  const s = RECIPES[name].scale;
  const uniforms = {
    uPat: { value: patternTexture(name) },
    uPatScale: { value: new THREE.Vector2(s[0] * scale, s[1] * scale) },
    uPatJoint: { value: new THREE.Color(joint) },
    uPatGlass: { value: new THREE.Color(glass) },
    uPatTop: { value: top ? 1 : 0 },
    uPatLamps: u.uLamps,
  };
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base.call(mat, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${FRAG_METAL}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`);
  };
  const key = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => `${key.call(mat)}|city-pattern`;
  mat.userData.depth = depth;
  mat.userData.pattern = name;
  return mat;
}

/** Window glass for the near buildings: dark, glossy, reflecting the sky; lit at night like the glow parts. */
function glassMaterial(u) {
  const mat = popMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.1 }), u, { anim: true, glow: true });
  const key = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => `${key.call(mat)}|city-glass`;
  return mat;
}

/** Joint colours and finishes per pattern. */
const FINISH = {
  brick: { joint: 0xd8cfbd, roughness: 0.92 },
  stone: { joint: 0xb9b1a2, roughness: 0.9 },
  render: { joint: 0xb8b2a8, roughness: 0.85 },
  slate: { joint: 0x2b2f38, roughness: 0.7 },
  tile: { joint: 0x6b3a28, roughness: 0.8 },
  paving: { joint: 0x8f8a82, roughness: 0.95 },
  tarmac: { joint: 0x3a3c42, roughness: 0.96 },
  wood: { joint: 0x3b2a20, roughness: 0.8 },
  office: { joint: 0x9aa4b0, roughness: 0.7, glass: 0x3e5470, top: false },
  flats: { joint: 0x8a8378, roughness: 0.9, glass: 0x3a4250, top: false },
};

/**
 * The city materials for a Diorama `d` (its uniforms, its shadow depth material, its tier).
 * Merge the result into d.mats. Low quality maps every key back to the plain materials.
 */
export function cityMaterials(d) {
  const out = {};
  if (d.low) {
    for (const name of PATTERNS) out[name] = d.mats.matte;
    out.glowGlass = d.mats.glow;
    return out;
  }
  const depth = d.mats.matte.userData.depth;
  for (const name of PATTERNS) out[name] = patternMaterial(d.u, depth, name, FINISH[name]);
  out.glowGlass = glassMaterial(d.u);
  return out;
}

/**
 * Pattern key → the key to build with on this Diorama's tier: the pattern on medium and high, and
 * the place's own matte / glow on low (no new meshes or draw calls there).
 */
export function K(d) {
  const k = {};
  for (const name of PATTERNS) k[name] = d.low ? 'matte' : name;
  k.glass = d.low ? 'glow' : 'glowGlass';
  return k;
}
