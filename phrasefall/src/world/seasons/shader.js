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
};

/** Season weights (spring, summer, autumn, winter) shared by every patched material. */
export const SEASON_U = { uSeason: { value: new THREE.Vector4(0, 0, 1, 0) } };

const lin = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

const VERT_PARS = /* glsl */ `
varying vec3 vPfWorld;
varying float vPfKind;
varying vec3 vPfAnchor;
#ifdef PF_GRASS_ATTR
attribute float aGrass;
varying float vPfGrass;
#endif
#ifdef PF_TIP
varying float vPfTip;
#endif
`;

const VERT_MAIN = /* glsl */ `
{
  vec4 pfW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  pfW = instanceMatrix * pfW;
  #endif
  pfW = modelMatrix * pfW;
  vPfWorld = pfW.xyz;
  #ifdef PF_KIND_ATTR
  vPfKind = floor(aPop.w * 0.5 + 0.001);
  vPfAnchor = aPop.xyz;
  #else
  vPfKind = float(PF_KIND);
  vPfAnchor = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  #ifdef PF_GRASS_ATTR
  vPfGrass = aGrass;
  #endif
  #ifdef PF_TIP
  vPfTip = position.y;
  #endif
}
`;

const FRAG_PARS = /* glsl */ `
uniform vec4 uSeason;
varying vec3 vPfWorld;
varying float vPfKind;
varying vec3 vPfAnchor;
#ifdef PF_GRASS_ATTR
varying float vPfGrass;
#endif
#ifdef PF_TIP
varying float vPfTip;
#endif
float pfHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float pfWobble(vec3 p) { return 0.5 + 0.25 * sin(p.x * 1.7 + sin(p.z * 1.3 + p.y)) + 0.25 * sin(p.z * 1.9 + sin(p.y * 2.1 + p.x * 0.7)); }
vec3 pfAutumn(float i) {
  return i < 1.0 ? ${lin(0xd9482b)} : i < 2.0 ? ${lin(0xf08a24)} : i < 3.0 ? ${lin(0xf4c43a)} : ${lin(0xb5562a)};
}
`;

// runs after <normal_fragment_maps>: `normal` is the view-space normal, diffuseColor is set
const FRAG_MAIN = /* glsl */ `
if (dot(uSeason, uSeason) > 0.0) {
  float k = vPfKind;
  vec3 c = diffuseColor.rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float up = normalize((vec4(normal, 0.0) * viewMatrix).xyz).y;
  float h = pfHash(floor(vPfAnchor * 2.0 + 0.5));
  float n = pfWobble(vPfWorld * 1.15);
  float green = clamp((c.g - max(c.r, c.b)) * 7.0, 0.0, 1.0);
  float water = clamp((c.b - max(c.r, c.g) * 1.08) * 9.0, 0.0, 1.0);
  bool leafy = k > 0.5 && k < 1.5;
  bool ground = (k > 2.5 && k < 3.5) || k > 6.5;
  float grass = green;
  #ifdef PF_GRASS_ATTR
  grass *= vPfGrass;
  #endif
  if (k > 7.5) grass = 1.0;

  // spring: fresher, brighter greens and blossom on about half the trees
  if (uSeason.x > 0.0 && (leafy || ground || k > 1.5 && k < 2.5)) {
    float g = leafy ? 1.0 : grass;
    c = mix(c, c * vec3(0.82, 1.14, 0.62) + vec3(0.015, 0.05, 0.0), uSeason.x * g);
    if (leafy && h < 0.55) {
      float bloom = smoothstep(0.6, 0.68, pfWobble(vPfWorld * 4.7 + h * 13.0));
      c = mix(c, h < 0.3 ? ${lin(0xffb8d2)} : ${lin(0xfff2f6)}, uSeason.x * bloom * 0.9);
    }
  }
  // autumn: a colour per tree, blended across the canopy; warmer grass
  if (uSeason.z > 0.0) {
    if (leafy || (k > 4.5 && k < 5.5)) {
      float i = floor(h * 4.0);
      vec3 a = mix(pfAutumn(i), pfAutumn(mod(i + 1.0, 4.0)), smoothstep(0.35, 0.75, n));
      c = mix(c, a * clamp(lum / 0.3, 0.55, 1.25), uSeason.z);
    } else if (ground || k > 7.5) {
      c = mix(c, c * vec3(1.32, 1.02, 0.6) + vec3(0.02, 0.008, 0.0), uSeason.z * grass * (k > 7.5 ? 0.9 : 0.65));
    }
  }
  #ifdef PF_SAND
  // summer: sand around the dais
  if (uSeason.y > 0.0) {
    vec2 q = vec2(vPfWorld.x, vPfWorld.z / 0.82);
    float th = atan(q.y, q.x);
    float edge = 3.25 + 0.22 * sin(th * 3.0 + 1.3) + 0.13 * sin(th * 7.0 + 0.4);
    float sand = smoothstep(edge + 0.16, edge - 0.16, length(q)) * smoothstep(-0.25, -0.05, vPfWorld.y);
    vec3 sc = mix(${lin(0xf1d6a0)}, ${lin(0xf8e4b6)}, n);
    c = mix(c, sc, uSeason.y * sand);
  }
  #endif
  // winter: snow on whatever faces up, a frosty cast on the rest, ice on water
  if (uSeason.w > 0.0 && k < 5.5 || uSeason.w > 0.0 && k > 6.5) {
    float lo = leafy || (k > 1.5 && k < 2.5) || (k > 4.5 && k < 5.5) ? 0.12 : ground ? 0.18 : 0.5;
    float snow = smoothstep(lo, lo + 0.3, up + (n - 0.5) * 0.3);
    if (k > 7.5) snow = smoothstep(0.0, 0.4, vPfTip) * 0.9;
    if (k > 3.5 && k < 4.5) { c = mix(c, ${lin(0xb7dcea)}, uSeason.w * 0.65); snow = 0.0; }
    if (ground) snow *= 1.0 - water;
    c = mix(c, vec3(lum) * vec3(0.9, 0.97, 1.1), uSeason.w * 0.28);
    c = mix(c, ${lin(0xf2f6fc)} * (0.93 + 0.07 * n), uSeason.w * snow);
    roughnessFactor = mix(roughnessFactor, 0.95, uSeason.w * snow);
  }
  diffuseColor.rgb = c;
}
`;

/**
 * Add the season look to a shader inside onBeforeCompile. opts: { kind } (a KIND, as a define) or
 * { kindAttr: true } (from aPop.w), { sand } (summer sand: the island turf), { grassAttr } (the turf's
 * aGrass attribute), { tip } (grass blades: frost on the tips).
 */
export function seasonShader(shader, opts = {}) {
  Object.assign(shader.uniforms, SEASON_U);
  const defs = [opts.kindAttr ? '#define PF_KIND_ATTR' : `#define PF_KIND ${opts.kind ?? KIND.GENERIC}`, opts.sand ? '#define PF_SAND' : '', opts.grassAttr ? '#define PF_GRASS_ATTR' : '', opts.tip ? '#define PF_TIP' : ''].join('\n');
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${defs}\n${VERT_PARS}`).replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${defs}\n${FRAG_PARS}`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_MAIN}`);
}

/** Season cache key fragment for customProgramCacheKey. */
export const seasonKey = (opts = {}) => `s${opts.kindAttr ? 'a' : opts.kind ?? 0}${opts.sand ? 's' : ''}${opts.grassAttr ? 'g' : ''}${opts.tip ? 't' : ''}`;

/** Give a plain material the season look (Home's far islands, the island turf). */
export function seasonMaterial(mat, opts = {}) {
  const before = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    before?.call(mat, shader, renderer);
    seasonShader(shader, opts);
  };
  const key = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => `${key ? key.call(mat) : ''}|${seasonKey(opts)}`;
  return mat;
}
