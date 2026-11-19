/**
 * The season look, as a patch for the scenery materials (no extra draw calls):
 *
 *   autumn  foliage turns red / orange / gold / rust (a colour per tree, blended across the
 *           canopy); grass warms up
 *   winter  snow settles on everything that faces up — ground, roofs, tree tops — and the rest
 *           turns a little frosty; water ices over
 *   spring  fresh, bright greens; blossom on some of the trees
 *   summer  sand around the dais (the island turf only)
 *
 * On medium and high quality the same patch also draws the miniature's surface detail
 * (setSeasonDetail; low stays exactly as it was):
 *
 *   turf     natural variation (damp, lush patches and drier ones, mottling), a worn path of
 *            flattened grass and bare soil along the stepping stones, a soft mossy edge where the
 *            lawn meets the dais and the stones
 *   foliage  clumps of leaves: lumpy shading with darker gaps, light shining through the leaves
 *            when they are backlit, darker inner foliage (occlusion baked by the Batch, kit.js)
 *   clouds   soft cloud shadows drifting slowly over the island (direct sunlight only)
 *   wind     gusts rolling across the island lean the trees in step with the grass (grass.js)
 *
 * Every patched material reads the same uniforms (SEASON_U), so a season blend is one uniform
 * update. A surface's kind says how it reacts; pop materials carry it in aPop.w
 * (delay + 2 · kind), others get it as a define.
 */
import * as THREE from 'three';

export const KIND = {
  GENERIC: 0, // buildings, props, rocks: snow on top
  FOLIAGE: 1, // leaves: autumn colours, spring freshness and blossom, snow caps
  EVERGREEN: 2, // pines: snow caps only
  GROUND: 3, // distant land tops: warmer / fresher grass, snow (painted water stays clear)
  WATER: 4, // ices over in winter
  BLOSSOM: 5, // Home's pink tree: autumn colours and snow, pink otherwise
  PLAIN: 6, // never changes
  TURF: 7, // the main island's turf: GROUND plus the summer sand around the dais
  TUFT: 8, // grass blades: golden in autumn, frosted tips in winter
  PAVED: 9, // roads and pavements: a patchy dusting of snow, so they still read as streets
};

/** Summer's sand around the dais: radius (in x; z is squashed like the island) and edge wobble. */
export const SAND = { r: 3.95, a: 0.26, b: 0.14 };
/** Signed distance (roughly) from summer's sand edge: negative on the sand. */
export const sandEdge = (x, z) => {
  const qz = z / 0.82;
  const th = Math.atan2(qz, x);
  return Math.hypot(x, qz) - (SAND.r + SAND.a * Math.sin(th * 3 + 1.3) + SAND.b * Math.sin(th * 7 + 0.4));
};

/**
 * Season weights (spring, summer, autumn, winter) shared by every patched material, plus the clock
 * (wind sway, water sparkle), how bright the sparkle is in the current light and how strong the
 * cloud shadows are (0 at night).
 */
export const SEASON_U = { uSeason: { value: new THREE.Vector4(0, 0, 1, 0) }, uPfTime: { value: 0 }, uPfGlint: { value: 1 }, uPfCloud: { value: 0 } };

// ── surface detail per quality tier ─────────────────────────────────────────
/** 0 low (the plain look: nothing extra is compiled in), 1 medium, 2 high. */
let DETAIL = 2;
/** Every material wearing the season look (recompiled when the detail level changes). */
const MATERIALS = new Set();
export const detailFor = (quality) => (quality === 'low' ? 0 : quality === 'medium' ? 1 : 2);
export const seasonDetail = () => DETAIL;
/** Set the surface detail (0…2) for every scenery material, built or still to come. */
export function setSeasonDetail(level) {
  if (level === DETAIL) return;
  DETAIL = level;
  for (const m of MATERIALS) m.needsUpdate = true;
}
/** Remember a material that wears the season look (popMaterial and seasonMaterial do this). */
export const trackSeasonMaterial = (mat) => MATERIALS.add(mat);

/** The turf's natural variation: damp, lusher patches and drier ones (colour multipliers; the grass matches them). */
export const TURF_TONES = { damp: 0xd2ecd8, dry: 0xfff0c4 };

/** The island's own features for the turf detail: the stepping stones [x, z, size] and the worn path [[x, z] …]. */
let FEATURES = null;
export function setTurfFeatures(stones, path) {
  FEATURES = { stones, path };
}

const lin = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};
const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);

// ── shared GLSL (the grass, garden and wildlife use it too) ──────────────────
/** Cheap 2D / 3D value noise; pfNoised returns the value (0…1) and its gradient. */
export const NOISE_GLSL = /* glsl */ `
float pfHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float pfNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 w = fract(p);
  vec2 u = w * w * (3.0 - 2.0 * w);
  return mix(mix(pfHash(i), pfHash(i + vec2(1.0, 0.0)), u.x), mix(pfHash(i + vec2(0.0, 1.0)), pfHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

const NOISE3_GLSL = /* glsl */ `
float pfHash3(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec4 pfNoised(vec3 x) {
  vec3 i = floor(x);
  vec3 w = fract(x);
  vec3 u = w * w * (3.0 - 2.0 * w);
  vec3 du = 6.0 * w * (1.0 - w);
  float a = pfHash3(i);
  float b = pfHash3(i + vec3(1.0, 0.0, 0.0));
  float c = pfHash3(i + vec3(0.0, 1.0, 0.0));
  float d = pfHash3(i + vec3(1.0, 1.0, 0.0));
  float e = pfHash3(i + vec3(0.0, 0.0, 1.0));
  float f = pfHash3(i + vec3(1.0, 0.0, 1.0));
  float g = pfHash3(i + vec3(0.0, 1.0, 1.0));
  float h = pfHash3(i + vec3(1.0, 1.0, 1.0));
  float k1 = b - a;
  float k2 = c - a;
  float k3 = e - a;
  float k4 = a - b - c + d;
  float k5 = a - c - e + g;
  float k6 = a - b - e + f;
  float k7 = -a + b + c - d + e - f - g + h;
  return vec4(a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z,
    du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y));
}
`;

/**
 * Cellular noise for leaf clusters (a 2×2×2 search: cheap, and the clusters' centres are kept
 * well inside their cells so it rarely misses the nearest): returns the distances to the nearest
 * and second-nearest centre; pfCellDir is the vector from the nearest centre to p. Needs pfHash3.
 */
const CELLS_GLSL = /* glsl */ `
vec3 pfCellDir = vec3(0.0);
vec2 pfCells(vec3 p) {
  vec3 pi = floor(p);
  vec3 pf = fract(p);
  vec3 o = step(0.5, pf) - 1.0;
  float f1 = 9.0;
  float f2 = 9.0;
  for (int i = 0; i < 8; i++) {
    vec3 cc = o + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    float hh = pfHash3(pi + cc);
    vec3 d = cc + 0.2 + 0.6 * fract(hh * vec3(1.0, 7.131, 13.719) + vec3(0.0, 0.31, 0.57)) - pf;
    float dd = dot(d, d);
    if (dd < f1) {
      f2 = f1;
      f1 = dd;
      pfCellDir = -d;
    } else if (dd < f2) {
      f2 = dd;
    }
  }
  return vec2(sqrt(f1), sqrt(f2));
}
`;

/**
 * The cheap leaf grain (medium quality): 2D cellular noise (a 2×2 search) on the world plane
 * facing the surface's main axis; where that axis changes the grain jumps, unseen in a random
 * grain. Returns F1, F2; pfCellDir2 is the vector from the nearest centre to p (in that plane).
 */
const CELLS2_GLSL = /* glsl */ `
vec2 pfCellDir2 = vec2(0.0);
vec2 pfCells2(vec2 p) {
  vec2 pi = floor(p);
  vec2 pf = fract(p);
  vec2 o = step(0.5, pf) - 1.0;
  float f1 = 9.0;
  float f2 = 9.0;
  for (int i = 0; i < 4; i++) {
    vec2 cc = o + vec2(float(i & 1), float(i >> 1));
    float hh = pfHash(pi + cc);
    vec2 d = cc + 0.2 + 0.6 * fract(hh * vec2(1.0, 7.131) + vec2(0.0, 0.31)) - pf;
    float dd = dot(d, d);
    if (dd < f1) {
      f2 = f1;
      f1 = dd;
      pfCellDir2 = -d;
    } else if (dd < f2) {
      f2 = dd;
    }
  }
  return vec2(sqrt(f1), sqrt(f2));
}
`;

/**
 * The breeze: gusts rolling across the island in long waves, travelling along PF_WIND
 * (world xz, the seasons clock) → 0…1. Shared by the grass, the trees and the wild flowers.
 */
export const WIND_GLSL = /* glsl */ `
const vec2 PF_WIND = vec2(0.94, -0.34);
float pfGust(vec2 p, float t) {
  float w = dot(p, PF_WIND) * 0.42 - t * 1.3 + 0.9 * sin(dot(p, vec2(0.34, 0.94)) * 0.33 + t * 0.23);
  float g = 0.5 + 0.5 * sin(w);
  return g * g * (0.62 + 0.38 * sin(t * 0.29 + p.x * 0.05));
}
`;

/** Soft cloud shadows drifting over the island (1 lit … lower in a shadow); needs NOISE_GLSL. */
export const CLOUD_GLSL = /* glsl */ `
float pfCloudLight(vec3 w, float t, float strength) {
  // only over the island and just round it (the stage round the character stays in the sun)
  float r = length(w.xz);
  if (r < 2.3 || r > 13.0 || strength <= 0.0) return 1.0;
  float n = pfNoise(w.xz * 0.105 - t * vec2(0.026, -0.009));
  return 1.0 - strength * smoothstep(0.45, 0.68, n) * smoothstep(2.3, 3.8, r);
}
`;

/** Summer's sand edge in GLSL (negative on the sand), the same as sandEdge. */
export const SAND_GLSL = /* glsl */ `
float pfSandEdge(vec2 p) {
  vec2 q = vec2(p.x, p.y / 0.82);
  float th = atan(q.y, q.x);
  return length(q) - (${SAND.r.toFixed(2)} + ${SAND.a.toFixed(2)} * sin(th * 3.0 + 1.3) + ${SAND.b.toFixed(2)} * sin(th * 7.0 + 0.4));
}
`;

const VERT_PARS = () => /* glsl */ `
uniform float uPfTime;
varying vec3 vPfWorld;
varying float vPfKind;
varying float vPfAO;
varying float vPfHash;
#ifdef PF_GRASS_ATTR
attribute float aGrass;
varying float vPfGrass;
#endif
#ifdef PF_TIP
varying float vPfTip;
#endif
#ifdef PF_OCC
attribute float aPfOcc;
varying float vPfOcc;
#endif
#if PF_DETAIL > 0
uniform float uPfCloud;
varying float vPfLandY;
varying float vPfCloud;
${WIND_GLSL}
${NOISE_GLSL}
${CLOUD_GLSL}
#endif
`;

// wind: leaves and blossom sway gently, more the higher above their prop's base (before the pop
// animation, so a tree popping up sways with it); with detail, the gusts that roll across the
// grass lean them a little too
const VERT_SWAY = /* glsl */ `
{
  #ifdef PF_KIND_ATTR
  float pfSK = floor(aPop.w * 0.5 + 0.001);
  vec3 pfSA = aPop.xyz;
  #else
  float pfSK = float(PF_KIND);
  vec3 pfSA = vec3(0.0);
  #endif
  #if PF_DETAIL > 0
  // height above the land's (or prop's) base, before any pop or bob (the islands' cut edges)
  vPfLandY = transformed.y - pfSA.y;
  #endif
  if ((pfSK > 0.5 && pfSK < 2.5) || (pfSK > 4.5 && pfSK < 5.5)) {
    float pfH = max(transformed.y - pfSA.y, 0.0);
    float pfPh = uPfTime * 1.25 + pfSA.x * 0.37 + pfSA.z * 0.23;
    transformed.x += (sin(pfPh) * 0.6 + sin(pfPh * 2.3 + 1.7) * 0.25) * 0.012 * pfH;
    transformed.z += cos(pfPh * 0.8 + 0.6) * 0.006 * pfH;
    #if PF_DETAIL > 0
    transformed.xz += PF_WIND * (pfGust(pfSA.xz, uPfTime - 0.35) * 0.017 * pfH);
    #endif
  }
}
`;

const VERT_MAIN = /* glsl */ `
{
  vec4 pfW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  pfW = instanceMatrix * pfW;
  #endif
  pfW = modelMatrix * pfW;
  vPfWorld = pfW.xyz;
  // a random number per prop (from its anchor): every vertex of a prop gets exactly the same one
  #ifdef PF_KIND_ATTR
  vPfKind = floor(aPop.w * 0.5 + 0.001);
  vec3 pfA = aPop.xyz;
  #else
  vPfKind = float(PF_KIND);
  vec3 pfA = vec3(modelMatrix[3].x, 0.0, modelMatrix[3].z); // not y: floating islands bob
  #endif
  vPfHash = fract(sin(dot(pfA, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  // height above the prop's base, for the contact shading
  #ifdef PF_KIND_ATTR
  vPfAO = pfW.y - (modelMatrix * vec4(aPop.xyz, 1.0)).y;
  #else
  vPfAO = pfW.y - modelMatrix[3].y;
  #endif
  #ifdef PF_GRASS_ATTR
  vPfGrass = aGrass;
  #endif
  #ifdef PF_TIP
  vPfTip = position.y;
  #endif
  #ifdef PF_OCC
  vPfOcc = aPfOcc;
  #endif
  #if PF_DETAIL > 0
  // cloud shadows are several units across: worked out per vertex
  vPfCloud = pfCloudLight(pfW.xyz, uPfTime, uPfCloud);
  #endif
}
`;

const FRAG_PARS = () => /* glsl */ `
uniform vec4 uSeason;
uniform float uPfTime;
uniform float uPfGlint;
uniform float uPfCloud;
vec3 pfGlint = vec3(0.0);
float pfCloud = 1.0;
varying vec3 vPfWorld;
varying float vPfKind;
varying float vPfAO;
varying float vPfHash;
#ifdef PF_GRASS_ATTR
varying float vPfGrass;
#endif
#ifdef PF_TIP
varying float vPfTip;
#endif
#ifdef PF_OCC
varying float vPfOcc;
#endif
#if PF_DETAIL > 0
varying float vPfLandY;
varying float vPfCloud;
#endif
float pfWobble(vec3 p) { return 0.5 + 0.25 * sin(p.x * 1.7 + sin(p.z * 1.3 + p.y)) + 0.25 * sin(p.z * 1.9 + sin(p.y * 2.1 + p.x * 0.7)); }
vec3 pfAutumn(float i) {
  return i < 1.0 ? ${lin(0xd9482b)} : i < 2.0 ? ${lin(0xf08a24)} : i < 3.0 ? ${lin(0xf4c43a)} : ${lin(0xb5562a)};
}
#if PF_DETAIL > 0
${NOISE_GLSL}
${NOISE3_GLSL}
${CELLS_GLSL}
${CELLS2_GLSL}
float pfSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
#endif
`;

/** The island turf's own features (GLSL): distance to the worn path and to the nearest stepping stone's edge. */
function featuresGLSL() {
  const path = FEATURES?.path ?? [];
  const stones = FEATURES?.stones ?? [];
  const segs = [];
  for (let i = 1; i < path.length; i++) segs.push(`pfSeg(gp, vec2(${f(path[i - 1][0])}, ${f(path[i - 1][1])}), vec2(${f(path[i][0])}, ${f(path[i][1])}))`);
  const pathD = segs.length ? segs.reduce((a, b) => `min(${a}, ${b})`) : '99.0';
  const stoneD = stones.length ? stones.map(([x, z, s]) => `length((gp - vec2(${f(x)}, ${f(z)})) * vec2(1.0, 1.15)) - ${f(+(s * 0.98).toFixed(3))}`).reduce((a, b) => `min(${a}, ${b})`) : '99.0';
  return { pathD, stoneD };
}

// runs after <normal_fragment_maps>: `normal` is the view-space normal, diffuseColor is set
const FRAG_MAIN = () => {
  const { pathD, stoneD } = featuresGLSL();
  return /* glsl */ `
if (dot(uSeason, uSeason) > 0.0) {
  // a kind given as a define is a constant: the branches for other kinds compile away
  #ifdef PF_KIND_ATTR
  float k = vPfKind;
  #else
  const float k = float(PF_KIND);
  #endif
  vec3 c = diffuseColor.rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float h = clamp(vPfHash, 0.0, 0.9999);
  bool leafy = k > 0.5 && k < 1.5;
  bool ground = (k > 2.5 && k < 3.5) || k > 6.5;
  #if PF_DETAIL > 0
  // clumps of leaves: lumpy shading and darker gaps between the clumps (before the snow, which
  // settles on the lumps)
  bool pfFoliage = (k > 0.5 && k < 2.5) || (k > 4.5 && k < 5.5);
  float pfClump = 0.5;
  if (pfFoliage) {
    // leaf clusters: little domes, each lit on its own, with dark creases between them; on high
    // quality the bigger clumps they gather in swell gently too
    #if PF_DETAIL > 1
    vec2 pfF = pfCells(vPfWorld * 12.0 + h * 37.0);
    vec3 pfG = -pfCellDir * 0.75;
    #else
    vec3 pfNW = abs((vec4(normal, 0.0) * viewMatrix).xyz);
    vec3 pfQ = vPfWorld * 12.0 + h * 37.0;
    vec3 pfU = pfNW.x > pfNW.y && pfNW.x > pfNW.z ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 pfV = pfNW.z > pfNW.y && pfNW.z > pfNW.x ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
    vec2 pfF = pfCells2(vec2(dot(pfQ, pfU), dot(pfQ, pfV)));
    vec3 pfG = -(pfU * pfCellDir2.x + pfV * pfCellDir2.y) * 0.75;
    #endif
    float pfLeaf = 1.0 - smoothstep(0.05, 0.7, pfF.x);
    // the bigger clumps the clusters gather in: a soft, cheap swell of light and shade
    float pfBig = pfWobble(vPfWorld * 2.3 + h * 19.0);
    pfClump = smoothstep(0.25, 0.75, pfBig) * 0.5 + pfLeaf * 0.5;
    vec3 pfGv = mat3(viewMatrix) * pfG;
    normal = normalize(normal - (pfGv - dot(pfGv, normal) * normal));
  }
  #endif
  float up = normalize((vec4(normal, 0.0) * viewMatrix).xyz).y;
  float n = pfWobble(vPfWorld * 1.15);
  float green = clamp((c.g - max(c.r, c.b)) * 7.0, 0.0, 1.0);
  float water = clamp((c.b - max(c.r, c.g) * 1.08) * 9.0, 0.0, 1.0);
  float grass = green;
  #ifdef PF_GRASS_ATTR
  grass *= vPfGrass;
  #endif
  if (k > 7.5) grass = 1.0;

  #if PF_DETAIL > 0
  // the turf: natural variation — damp, lusher patches and drier yellow-green ones, mottling
  if ((k > 2.5 && k < 3.5) || (k > 6.5 && k < 7.5)) {
    vec2 gp = vPfWorld.xz;
    float n1 = pfNoise(gp * 0.42 + 3.1);
    float n2 = pfNoise(gp * 1.65 + 11.3);
    float gw = grass * 0.9;
    c *= mix(vec3(1.0), mix(${lin(TURF_TONES.damp)}, ${lin(TURF_TONES.dry)}, smoothstep(0.25, 0.8, n1)), gw);
    c *= mix(1.0, 0.86 + 0.26 * n2, gw);
    float n3 = n2;
    #ifdef PF_SAND
    // the main island: a worn path of flattened, paler grass and bare soil along the stepping
    // stones, and dark, mossy ground hugging the dais and the stones (only worked out round them)
    if (abs(gp.x) < 2.95 && gp.y > 0.45 || dot(gp, gp) < 4.4) {
      n3 = pfNoise(gp * 6.1 + 5.7);
      float pd = ${pathD} + (n2 - 0.5) * 0.3;
      float worn = smoothstep(0.6, 0.15, pd) * gw;
      c = mix(c, c * vec3(1.08, 1.05, 0.8), worn * 0.75);
      float soil = smoothstep(0.5, 0.78, n3 * 0.5 + n2 * 0.3 + smoothstep(0.4, 0.0, pd) * 0.35) * smoothstep(0.45, 0.12, pd);
      c = mix(c, mix(${lin(0x9a7f5c)}, ${lin(0xb59c78)}, n1), soil * gw * 0.85);
      float edge = smoothstep(0.24, 0.0, ${stoneD} + (n2 - 0.5) * 0.08);
      edge = max(edge, smoothstep(2.02, 1.66, length(gp) + (n2 - 0.5) * 0.1));
      c = mix(c, c * mix(${lin(0xa9c39a)}, ${lin(0xc2b096)}, n3), edge * gw);
    }
    #endif
    // a floating island's cut edge (this one and the distant ones): the turf's fringe over a band
    // of dark soil and roots, down to the rock (vPfLandY: height below the land's top)
    if (vPfLandY < -0.08) {
      float cut = smoothstep(0.02, -0.06, vPfLandY + 0.17 + (n2 - 0.5) * 0.12 + (n3 - 0.5) * 0.05);
      vec3 soilC = mix(${lin(0x4a3424)}, ${lin(0x6b4c33)}, n2) * (0.8 + 0.35 * n3);
      soilC = mix(soilC, ${lin(0x8b6a48)}, smoothstep(0.62, 0.8, pfNoise(vec2(atan(gp.y, gp.x) * 40.0, vPfLandY * 3.0))) * 0.6);
      c = mix(c, soilC, cut);
    }
  }
  #endif

  // spring: fresher, brighter greens and blossom on about half the trees
  if (uSeason.x > 0.0 && (leafy || ground || k > 1.5 && k < 2.5)) {
    float g = leafy ? 1.0 : grass;
    c = mix(c, c * vec3(0.82, 1.14, 0.62) + vec3(0.015, 0.05, 0.0), uSeason.x * g);
    if (leafy) {
      // soft clusters of blossom over the canopy: pink on some trees, white on others, more or less of it
      vec3 bp = vPfWorld * 4.2 + h * 17.0;
      float lo = 0.56 + fract(h * 7.31) * 0.14;
      float bloom = smoothstep(lo, lo + 0.1, pfWobble(bp) * 0.6 + pfWobble(bp * 2.3 + 3.1) * 0.4);
      c = mix(c, h < 0.45 ? ${lin(0xffb8d2)} : ${lin(0xfff0f5)}, uSeason.x * bloom * 0.95);
    }
  }
  // autumn: a colour per tree, blended across the canopy; warmer grass
  if (uSeason.z > 0.0) {
    if (leafy || (k > 4.5 && k < 5.5)) {
      float i = floor(h * 4.0);
      vec3 a = mix(pfAutumn(i), pfAutumn(mod(i + 1.0, 4.0)), smoothstep(0.35, 0.75, n));
      c = mix(c, a * clamp(lum / 0.3, 0.55, 1.25), uSeason.z);
    } else if (ground || k > 7.5) {
      c = mix(c, c * vec3(1.42, 1.0, 0.52) + vec3(0.025, 0.01, 0.0), uSeason.z * grass * (k > 7.5 ? 0.95 : 0.8));
    }
  }
  #ifdef PF_SAND
  // summer: a sandy beach around the dais, damp and darker at its edge
  if (uSeason.y > 0.0) {
    vec2 q = vec2(vPfWorld.x, vPfWorld.z / 0.82);
    float th = atan(q.y, q.x);
    float d = length(q) - (${SAND.r.toFixed(2)} + ${SAND.a.toFixed(2)} * sin(th * 3.0 + 1.3) + ${SAND.b.toFixed(2)} * sin(th * 7.0 + 0.4));
    float sand = smoothstep(0.12, -0.12, d) * smoothstep(-0.25, -0.05, vPfWorld.y);
    vec3 sc = mix(${lin(0xf0cf8e)}, ${lin(0xf8e3b2)}, smoothstep(0.3, 0.7, pfWobble(vPfWorld * 3.1)));
    sc = mix(sc, ${lin(0xdcb578)}, smoothstep(-0.55, -0.05, d) * 0.6);
    #if PF_DETAIL > 0
    // ripples and a scatter of darker grains in the sand
    sc *= 0.94 + 0.1 * pfNoise(vPfWorld.xz * vec2(7.0, 2.4) + vec2(sin(vPfWorld.z * 2.0), 0.0));
    #endif
    c = mix(c, sc, uSeason.y * sand);
  }
  #endif
  #if PF_DETAIL > 0
  // the leaf clumps' light and shade (gaps deeper and a little bluer, clump tops warmer)
  if (pfFoliage) {
    c *= mix(vec3(0.6, 0.65, 0.7), vec3(1.08, 1.06, 0.97), pfClump);
  }
  #endif
  // winter: snow on whatever faces up, a frosty cast on the rest, ice on water
  if (uSeason.w > 0.0 && (k < 5.5 || k > 6.5)) {
    float lo = leafy || (k > 1.5 && k < 2.5) || (k > 4.5 && k < 5.5) ? 0.12 : ground ? -0.75 : 0.5;
    float snow = smoothstep(lo, lo + 0.3, up + (n - 0.5) * 0.3);
    if (k > 8.5) snow *= smoothstep(0.4, 0.62, pfWobble(vPfWorld * 2.6) * 0.7 + pfWobble(vPfWorld * 7.0) * 0.3);
    #ifdef PF_TIP
    snow = smoothstep(0.04, 0.3, vPfTip) * 0.85;
    #endif
    if (k > 3.5 && k < 4.5) { c = mix(c, ${lin(0xb7dcea)}, uSeason.w * 0.65); snow = 0.0; }
    if (ground) snow *= 1.0 - water;
    c = mix(c, vec3(lum) * vec3(0.9, 0.97, 1.1), uSeason.w * 0.28);
    c = mix(c, ${lin(0xe6ecf6)} * (0.93 + 0.07 * n), uSeason.w * snow);
    #ifdef STANDARD
    roughnessFactor = mix(roughnessFactor, 0.95, uSeason.w * snow);
    #endif
  }
  #if PF_DETAIL > 0
  #ifdef STANDARD
  // open water: smooth enough to mirror the sky at a glancing angle, its body a little deeper
  if (k > 3.5 && k < 4.5) {
    float open = 1.0 - uSeason.w;
    roughnessFactor = mix(roughnessFactor, 0.1, open);
    c *= 1.0 - 0.18 * open;
  }
  #endif
  #endif
  // water sparkle: little glints of sun dancing on open water (not on ice)
  float pfWet = (k > 3.5 && k < 4.5) ? 1.0 : (ground ? water : 0.0);
  if (pfWet > 0.01 && up > 0.6) {
    vec2 gp = vPfWorld.xz * 12.0;
    float gt = uPfTime;
    float g = sin(gp.x * 1.7 + gt * 1.9 + sin(gp.y * 1.3 - gt * 0.7) * 2.0) * sin(gp.y * 2.1 - gt * 1.4 + sin(gp.x * 0.9 + gt * 0.6) * 2.0);
    pfGlint = vec3(1.0, 0.96, 0.86) * pow(max(g, 0.0), 22.0) * 3.2 * pfWet * uPfGlint * (1.0 - uSeason.w) * smoothstep(0.6, 0.95, up);
  }
  // contact shading: props darken softly where they meet the ground (a cheap ambient occlusion
  // that sits them in the diorama instead of on it)
  if (k < 2.5 || (k > 4.5 && k < 6.5)) c *= mix(0.6, 1.0, smoothstep(-0.02, 0.5, vPfAO));
  #ifdef PF_OCC
  // inner foliage, deep in the canopy, darker (baked by the Batch)
  c *= 1.0 - 0.62 * clamp(vPfOcc, 0.0, 1.0);
  #endif
  #if PF_DETAIL > 0
  #if NUM_DIR_LIGHTS > 0
  // leaves glow where the light comes through them from behind, most at the thin edges
  if (pfFoliage) {
    vec3 pfV = normalize(vViewPosition);
    float pfEdge = 1.0 - abs(dot(normal, pfV));
    vec3 pfT = vec3(0.0);
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
      float b = max(dot(-pfV, directionalLights[i].direction), 0.0);
      pfT += directionalLights[i].color * (b * b * b);
    }
    float pfThin = (0.16 + 0.5 * pfEdge * pfEdge) * (0.55 + 0.45 * smoothstep(0.3, 0.8, pfClump));
    #ifdef PF_OCC
    pfThin *= 1.0 - clamp(vPfOcc, 0.0, 1.0);
    #endif
    pfGlint += pfT * c * pfThin * (1.0 - uSeason.w * 0.7);
  }
  #endif
  // cloud shadows (applied to the direct light, after the lights)
  pfCloud = vPfCloud;
  #endif
  diffuseColor.rgb = c;
}
`;
};

/**
 * Add the season look to a shader inside onBeforeCompile. opts: { kind } (a KIND, as a define) or
 * { kindAttr: true } (from aPop.w), { sand } (summer sand: the island turf), { grassAttr } (the turf's
 * aGrass attribute), { tip } (grass blades: frost on the tips), { occ } (the geometry carries the
 * Batch's baked foliage occlusion, aPfOcc).
 */
export function seasonShader(shader, opts = {}) {
  Object.assign(shader.uniforms, SEASON_U);
  const defs = [
    opts.kindAttr ? '#define PF_KIND_ATTR' : `#define PF_KIND ${opts.kind ?? KIND.GENERIC}`,
    opts.sand ? '#define PF_SAND' : '',
    opts.grassAttr ? '#define PF_GRASS_ATTR' : '',
    opts.tip ? '#define PF_TIP' : '',
    opts.occ ? '#define PF_OCC' : '',
    `#define PF_DETAIL ${DETAIL}`,
  ].join('\n');
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${defs}\n${VERT_PARS()}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_SWAY}`)
    .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${defs}\n${FRAG_PARS()}`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_MAIN()}`)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += pfGlint;');
  if (DETAIL > 0) {
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= pfCloud;\nreflectedLight.directSpecular *= pfCloud;');
  }
}

/** Season cache key fragment for customProgramCacheKey. */
export const seasonKey = (opts = {}) => `s${opts.kindAttr ? 'a' : opts.kind ?? 0}${opts.sand ? 's' : ''}${opts.grassAttr ? 'g' : ''}${opts.tip ? 't' : ''}${opts.occ ? 'o' : ''}d${DETAIL}`;

/** Give a plain material the season look (Home's far islands, the island turf). */
export function seasonMaterial(mat, opts = {}) {
  const before = mat.onBeforeCompile;
  const baseKey = mat.customProgramCacheKey(); // includes any earlier patch (e.g. the grass wind)
  const options = () => ({ ...opts, occ: opts.occ ?? !!mat.userData.pfOcc });
  mat.onBeforeCompile = (shader, renderer) => {
    before?.call(mat, shader, renderer);
    seasonShader(shader, options());
  };
  mat.customProgramCacheKey = () => `${baseKey}|${seasonKey(options())}`;
  mat.userData.pfKind = opts.kind ?? KIND.GENERIC; // the Batch treats leaf-kind spheres as foliage clumps
  trackSeasonMaterial(mat);
  return mat;
}
