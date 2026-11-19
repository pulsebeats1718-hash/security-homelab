/**
 * The toy surfaces every character is made of: premium collectible figures photographed in a
 * miniature world.
 *
 * A standard PBR material extended with:
 *   - a fresnel rim light (tinted by the environment so characters sit in the scene), brighter on
 *     the side of the silhouette that faces the sky's sun, like a real back light,
 *   - a per-character flash colour (damage / power-up feedback),
 *   - a per-character silhouette mode (locked characters in the collection),
 *   - a per-character aura (fever: a warm energy glow round the silhouette that the bloom spreads),
 *   - a shared lightning flash on the rims (the boss's strikes light every toy for a moment).
 *
 * Finishes (the `finish` option, or chosen from the roughness):
 *   gloss   lacquered plastic: a hard clear coat, little scattering (eyes, noses, buttons)
 *   vinyl   satin vinyl under a thin clear coat, a soft glow where light wraps past the terminator
 *   satin   painted, semi-matt vinyl
 *   fabric  felt and knit (scarves, jumpers): no coat, a velvety fuzz at grazing angles
 *   plush   flocked / plush: matt, very soft wrap, a bright fuzzy sheen round the edges
 *   metal   polished or brushed metal
 *
 * Tiers (toyFinish.level, set from the quality tier when a character is made):
 *   low     the original look (rim, a darker band at the feet): nothing added to its cost
 *   medium  + wrap lighting tinted like light scattered inside the material, the fuzz sheen,
 *           micro-roughness variation (no toy is perfectly even), contact occlusion where parts
 *           meet (each character's head, body and hands as analytic sphere occluders, plus the
 *           floor), a cheap clear-coat lobe (a crisp highlight and a fresnel sky reflection) and
 *           wet glass-bead eyes with a soft iris gradient
 *   high    the same with a real clear coat (MeshPhysicalMaterial) on vinyl and eyes
 */
import * as THREE from 'three';

/**
 * Rim light shared by all characters; the environment updates its colour per theme and its
 * direction (view space, towards the sky's sun) every frame. `strike` is a lightning flash (colour ×
 * strength) the boss adds to every toy's rim for an instant.
 */
export const rimShared = {
  color: { value: new THREE.Color(0xcfe4ff) },
  boost: { value: 1 },
  dir: { value: new THREE.Vector3(0, 0.4, -1).normalize() },
  strike: { value: new THREE.Color(0, 0, 0) },
};

/** 'high' gives new toy materials the clear coat. Set by the environment from the quality tier. */
export const toyFinish = { level: 'medium' };

const TIER = { low: 0, medium: 1, high: 2 };

/** Per finish: wrap (light past the terminator), fuzz (grazing sheen), coat (clear coat), micro (roughness variation). */
const FINISH = {
  gloss: { wrap: 0.2, fuzz: 0, coat: 1, micro: 0.05 },
  vinyl: { wrap: 0.32, fuzz: 0, coat: 0.6, micro: 0.09 },
  satin: { wrap: 0.4, fuzz: 0.18, coat: 0.18, micro: 0.08 },
  fabric: { wrap: 0.5, fuzz: 0.75, coat: 0, micro: 0.05 },
  plush: { wrap: 0.62, fuzz: 1.15, coat: 0, micro: 0.04 },
  metal: { wrap: 0.06, fuzz: 0, coat: 0.15, micro: 0.12 },
  glass: { wrap: 0, fuzz: 0, coat: 0, micro: 0 },
};

/** The finish a material gets: its own `finish` option, or one chosen from how it is made. */
export function finishOf(o) {
  if (o.finish && FINISH[o.finish]) return o.finish;
  if (o.transparent) return 'glass';
  if ((o.metal ?? 0) > 0.5) return 'metal';
  if (o.emissive) return 'gloss';
  const r = o.rough ?? 0.58;
  return r < 0.3 ? 'gloss' : r < 0.63 ? 'vinyl' : r < 0.73 ? 'satin' : 'fabric';
}

const HEADER = /* glsl */ `
uniform vec3 uRimColor;
uniform vec3 uRimDir;
uniform float uRimBoost;
uniform float uRimPower;
uniform float uRimStrength;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uSilhouette;
uniform vec3 uStrike;
uniform vec3 uAuraColor;
uniform float uAura;
uniform float uAuraT;
#if TOY_TIER > 0
uniform vec4 uToyOcc[4];
uniform vec4 uToySoft; // wrap, fuzz, coat, micro
#ifdef TOY_EYE
uniform vec3 uEyeTint;
#endif
varying vec3 vToyPos;
varying vec3 vToyLocal;
vec3 toyScatter = vec3(0.0);
vec3 toySheen = vec3(0.0);
float toyAO = 1.0;
#else
varying float vToyY;
#endif
`;

const VERT_HEADER = /* glsl */ `
#if TOY_TIER > 0
varying vec3 vToyPos;
varying vec3 vToyLocal;
#else
varying float vToyY;
#endif
`;

const BEGIN = /* glsl */ `
#ifdef TOY_BLUSH
transformed.xy *= 1.45;
#endif
`;

const VERT = /* glsl */ `
#if TOY_TIER > 0
vToyPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#if defined(TOY_EYE) || defined(TOY_BLUSH)
vToyLocal = transformed;
#else
// object space in world-sized units: the micro variation sticks to the part and keeps one scale
vToyLocal = transformed * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
#endif
#else
vToyY = (modelMatrix * vec4(transformed, 1.0)).y;
#endif
`;

// low: contact shading, a little darker right down at the feet, where the toy meets the ground.
// medium / high: the floor is one of the occluders instead (see OCCLUSION); eyes get their iris.
const COLOR = /* glsl */ `
#if TOY_TIER > 0
#ifdef TOY_EYE
{
  // a glass bead over a painted iris: deep at the top and rim, lit from below, a darker pupil
  vec2 e = vToyLocal.xy;
  float r = length(e);
  float lower = smoothstep(0.45, -0.9, e.y) * smoothstep(1.0, 0.55, r);
  vec3 iris = diffuseColor.rgb + uEyeTint * lower;
  iris *= mix(0.62, 1.0, smoothstep(1.0, 0.7, r));
  float pupil = smoothstep(0.42, 0.26, length(e - vec2(0.0, 0.1)));
  diffuseColor.rgb = mix(iris, diffuseColor.rgb * 0.45, pupil * 0.85);
}
#endif
#ifdef TOY_BLUSH
// airbrushed: full in the middle, fading out well past the old hard edge (the disc is drawn 1.45× wider)
diffuseColor.a = min(1.0, diffuseColor.a * 1.15 * smoothstep(1.45, 0.2, length(vToyLocal.xy)));
#endif
#else
diffuseColor.rgb *= mix(0.74, 1.0, smoothstep(0.0, 0.3, vToyY));
#endif
`;

// micro-roughness: the gloss of a real toy is never perfectly even (moulding, paint, handling)
const ROUGH = /* glsl */ `
#if TOY_TIER > 0
{
  vec3 q = vToyLocal * 21.0;
  float n = sin(q.x + 1.7 * sin(q.y * 1.31 + q.z * 0.7)) * sin(q.y * 1.13 + 1.9 * sin(q.z * 1.57 + q.x * 0.6)) * sin(q.z * 0.97 + 1.3 * sin(q.x * 1.21 - q.y));
  roughnessFactor = clamp(roughnessFactor + uToySoft.w * n, 0.04, 1.0);
}
#endif
`;

// the colour light takes on as it scatters inside the material (deeper and more saturated than the
// surface: like light through vinyl or felt) and the paler tint of fibres catching it
const SCATTER = /* glsl */ `
#if TOY_TIER > 0
{
  vec3 c = diffuseColor.rgb;
  float avg = max(dot(c, vec3(0.3333)), 0.02);
  toyScatter = clamp(mix(c * c / avg, c, 0.35), 0.0, 1.4) * (1.0 - metalnessFactor);
  toySheen = mix(c, vec3(avg) + 0.22, 0.55);
}
#endif
`;

// contact occlusion where parts meet: each occluder sphere hides cos·(r/d)² of the sky, and a crease
// darkens whatever touches it (a surface near the sphere's skin that does not face away from it: the
// line where a head sits on a body, a muzzle or ear on a head, a hand on an arm). The floor hides the
// lower half of the sky from surfaces near it that face down or out (the feet, the soles).
const OCCLUSION = /* glsl */ `
#if TOY_TIER > 0
{
  vec3 wn = inverseTransformDirection(normal, viewMatrix);
  float occ = 1.0;
  for (int i = 0; i < 4; i++) {
    vec4 s = uToyOcc[i];
    vec3 di = s.xyz - vToyPos;
    float l2 = max(dot(di, di), 1e-4);
    float il = inversesqrt(l2);
    float nl = dot(wn, di) * il;
    float sky = clamp(nl * s.w * s.w / l2, 0.0, 1.0);
    float crease = (1.0 - smoothstep(s.w * 0.9, s.w * 1.4, l2 * il)) * saturate(nl + 0.4);
    occ *= 1.0 - min(sky * 0.95 + crease * 0.75, 0.88);
  }
  float low = 1.0 - smoothstep(0.0, 0.42, vToyPos.y);
  occ *= 1.0 - low * (0.22 + 0.4 * saturate(-wn.y) + 0.12 * (1.0 - abs(wn.y)));
  toyAO = occ;
}
#endif
`;

const RIM = /* glsl */ `
float toyNV = saturate(dot(normalize(vViewPosition), normal));
float toyRim = pow(1.0 - toyNV, uRimPower);
// a back light: strongest on the edge that faces the sun's side, faint on the far edge
float toySide = max(0.12, 0.78 + 0.62 * dot(normal.xy, uRimDir.xy));
#if TOY_TIER > 0
totalEmissiveRadiance += uRimColor * (toyRim * toySide * uRimStrength * uRimBoost) * (0.35 + 0.65 * toyAO);
float toyY = vToyPos.y;
#else
totalEmissiveRadiance += uRimColor * (toyRim * toySide * uRimStrength * uRimBoost);
float toyY = vToyY;
#endif
// lightning: every toy's edges flash with it for an instant
totalEmissiveRadiance += uStrike * (toyRim * 1.6 + 0.08);
// fever: a warm energy glow round the silhouette, in bands that rise up the body
if (uAura > 0.0) {
  // a saturated edge of fire, not a wash over the paint (the character keeps its colours)
  float auraEdge = pow(1.0 - toyNV, 2.2);
  float auraWave = 0.7 + 0.3 * sin(toyY * 7.0 - uAuraT * 7.5) * sin(toyY * 3.1 - uAuraT * 4.3 + 1.0);
  totalEmissiveRadiance += uAuraColor * uAura * (auraEdge * 3.4 * auraWave + 0.015);
}
`;

// the lighting the finishes add, per light: wrap / scattering, the fuzz sheen and the coat's highlight
const LIGHTS = /* glsl */ `
#if TOY_TIER > 0
void RE_Direct_Toy(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  RE_Direct_Physical(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
  float d = dot(geometryNormal, directLight.direction);
  // light wraps a little past the terminator, coloured as it is inside the material
  float w = uToySoft.x;
  float wrapX = saturate((d + w) / (1.0 + w)) - saturate(d);
  reflectedLight.directDiffuse += directLight.color * (wrapX * RECIPROCAL_PI) * toyScatter;
  // fuzz: fibres catch the light at grazing angles, on the lit side
  if (uToySoft.y > 0.0) {
    float nv = saturate(dot(geometryNormal, geometryViewDir));
    float fz = pow(1.0 - nv, 3.0) * smoothstep(-0.35, 0.6, d);
    reflectedLight.directSpecular += directLight.color * toySheen * (fz * 0.7 * uToySoft.y);
  }
  // the clear coat's crisp highlight (where there is no real coat: medium, and lit plastic on high)
  if (uToySoft.z > 0.0 && d > 0.0) {
    vec3 hv = normalize(directLight.direction + geometryViewDir);
    float nh = saturate(dot(geometryNormal, hv));
    float lh = saturate(dot(directLight.direction, hv));
    float a2 = 0.0144;
    float dd = nh * nh * (a2 - 1.0) + 1.0;
    float D = a2 / (PI * dd * dd);
    float Fc = 0.04 + 0.96 * pow(1.0 - lh, 5.0);
    reflectedLight.directSpecular += directLight.color * (d * D * Fc * 0.25 / max(lh * lh, 0.1) * uToySoft.z);
  }
}
#undef RE_Direct
#define RE_Direct RE_Direct_Toy
#endif
`;

const AFTER_LIGHTS = /* glsl */ `
#if TOY_TIER > 0
reflectedLight.indirectDiffuse *= toyAO;
reflectedLight.indirectSpecular *= toyAO;
reflectedLight.directDiffuse *= mix(1.0, toyAO, 0.42);
reflectedLight.directSpecular *= mix(1.0, toyAO, 0.6);
#ifdef USE_CLEARCOAT
clearcoatSpecularIndirect *= toyAO;
clearcoatSpecularDirect *= mix(1.0, toyAO, 0.6);
#endif
// fibres facing the camera show their shadowed depths: felt and plush are a touch darker face-on
reflectedLight.directDiffuse *= 1.0 - uToySoft.y * 0.2 * toyNV;
#if NUM_HEMI_LIGHTS > 0
// the coat reflects the sky (bright above, the ground's colour below), strongest at grazing angles
if (uToySoft.z > 0.0) {
  vec3 rw = inverseTransformDirection(reflect(-normalize(vViewPosition), normal), viewMatrix);
  vec3 sky = hemisphereLights[0].skyColor;
  vec3 gnd = hemisphereLights[0].groundColor;
  vec3 env = mix(gnd * 0.55, sky, smoothstep(-0.3, 0.4, rw.y)) + sky * smoothstep(0.72, 0.98, rw.y) * 0.9;
  float Fr = 0.04 + 0.96 * pow(1.0 - toyNV, 5.0);
  reflectedLight.indirectSpecular += env * (Fr * uToySoft.z * 0.85 * toyAO);
}
#endif
#endif
`;

const FINAL = /* glsl */ `
outgoingLight = mix(outgoingLight, uFlashColor, uFlash);
outgoingLight = mix(outgoingLight, vec3(0.045, 0.04, 0.12) + uRimColor * toyRim * 0.22, uSilhouette);
`;

export function createFx() {
  return {
    flash: { value: 0 },
    flashColor: { value: new THREE.Color(1, 1, 1) },
    silhouette: { value: 0 },
    /** fever: strength 0…1, colour, and a clock for its rising waves */
    aura: { value: 0 },
    auraColor: { value: new THREE.Color(1, 0.45, 0.15) },
    auraT: { value: 0 },
    /** contact occluders (world space xyz, radius): head, body, hands — see Rig.updateOcclusion */
    occ: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  };
}

const _c = new THREE.Color();
const _hsl = { h: 0, s: 0, l: 0 };

/**
 * @param {number|string} color
 * @param {object} o  rough, metal, emissive, emissiveIntensity, rim, rimPower, transparent,
 *                    opacity, flat, side, depthWrite, finish (see FINISH), eye (a glass-bead eye)
 * @param {ReturnType<typeof createFx>} fx
 */
export function toyMaterial(color, o, fx) {
  const tier = TIER[toyFinish.level] ?? 1;
  const finish = finishOf(o);
  const F = FINISH[finish];
  const eye = !!o.eye && tier > 0;
  const blush = !!o.blush && tier > 0;
  let rough = o.rough ?? 0.58;
  if (finish === 'plush') rough = Math.max(rough, 0.82);
  // the clear coat: high quality only, on opaque, non-metal, unlit plastic with a coat to speak of
  const coatAmount = eye ? 1 : F.coat * (1 - THREE.MathUtils.smoothstep(rough, 0.5, 0.7));
  const coat = tier === 2 && !o.transparent && !((o.metal ?? 0) > 0.5) && !o.emissive && !o.flat && coatAmount > 0.05;
  const Mat = coat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const mat = new Mat({
    ...(coat ? { clearcoat: eye ? 1 : 0.22 + 0.4 * coatAmount, clearcoatRoughness: eye ? 0.03 : 0.2 } : {}),
    color,
    roughness: rough,
    metalness: o.metal ?? 0,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    flatShading: !!o.flat,
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
    depthWrite: o.depthWrite ?? true,
  });
  const uniforms = {
    uRimColor: rimShared.color,
    uRimDir: rimShared.dir,
    uRimBoost: rimShared.boost,
    uStrike: rimShared.strike,
    // flocking glows softly right round its edges: a wider, slightly stronger rim
    uRimPower: { value: o.rimPower ?? (finish === 'plush' && tier > 0 ? 1.65 : 2.4) },
    uRimStrength: { value: (o.rim ?? 0.42) * (finish === 'plush' && tier > 0 ? 1.2 : 1) },
    uFlash: fx.flash,
    uFlashColor: fx.flashColor,
    uSilhouette: fx.silhouette,
    uAura: fx.aura,
    uAuraColor: fx.auraColor,
    uAuraT: fx.auraT,
  };
  if (tier > 0) {
    uniforms.uToyOcc = fx.occ;
    // the coat is faked where there is no real one (medium; lit plastic and screens on high)
    uniforms.uToySoft = { value: new THREE.Vector4(F.wrap, F.fuzz, coat ? 0 : coatAmount, F.micro) };
    if (eye) {
      // the iris: the eye's own hue, lifted, glowing up from the bottom of the bead
      _c.set(color).getHSL(_hsl);
      _c.setHSL(_hsl.h, Math.max(0.4, _hsl.s), 0.26);
      uniforms.uEyeTint = { value: new THREE.Color().copy(_c).multiplyScalar(0.4) };
    }
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const defs = `#define TOY_TIER ${tier}\n${eye ? '#define TOY_EYE\n' : ''}${blush ? '#define TOY_BLUSH\n' : ''}`;
    shader.vertexShader = defs + shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEADER}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${BEGIN}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT}`);
    shader.fragmentShader = defs + shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${HEADER}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${ROUGH}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${SCATTER}`)
      .replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>\n${LIGHTS}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${OCCLUSION}\n${RIM}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${AFTER_LIGHTS}`)
      .replace('#include <opaque_fragment>', `${FINAL}\n#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `toy-v4-${tier}${eye ? '-eye' : ''}${blush ? '-blush' : ''}`;
  mat.userData.finish = finish;
  return mat;
}
