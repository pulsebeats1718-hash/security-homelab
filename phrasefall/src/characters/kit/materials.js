/**
 * The "vinyl toy" surface used by every character.
 *
 * A standard PBR material extended with:
 *   - a fresnel rim light (tinted by the environment so characters sit in the scene), brighter on
 *     the side of the silhouette that faces the sky's sun, like a real back light,
 *   - a per-character flash colour (damage / power-up feedback),
 *   - a per-character silhouette mode (locked characters in the collection).
 * On high quality (toyFinish.level) the plastic gets a thin glossy clear coat over the soft base:
 * the satin-and-lacquer look of a designer vinyl toy.
 */
import * as THREE from 'three';

/**
 * Rim light shared by all characters; the environment updates its colour per theme and its
 * direction (view space, towards the sky's sun) every frame.
 */
export const rimShared = { color: { value: new THREE.Color(0xcfe4ff) }, boost: { value: 1 }, dir: { value: new THREE.Vector3(0, 0.4, -1).normalize() } };

/** 'high' gives new toy materials the clear coat. Set by the environment from the quality tier. */
export const toyFinish = { level: 'medium' };

const HEADER = /* glsl */ `
uniform vec3 uRimColor;
uniform vec3 uRimDir;
uniform float uRimBoost;
uniform float uRimPower;
uniform float uRimStrength;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uSilhouette;
`;

// contact shading: a little darker right down at the feet, where the toy meets the ground
const FEET = /* glsl */ `
diffuseColor.rgb *= mix(0.74, 1.0, smoothstep(0.0, 0.3, vToyY));
`;

const RIM = /* glsl */ `
float toyRim = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), uRimPower);
// a back light: strongest on the edge that faces the sun's side, faint on the far edge
float toySide = max(0.12, 0.78 + 0.62 * dot(normal.xy, uRimDir.xy));
totalEmissiveRadiance += uRimColor * (toyRim * toySide * uRimStrength * uRimBoost);
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
  };
}

/**
 * @param {number|string} color
 * @param {object} o  rough, metal, emissive, emissiveIntensity, rim, rimPower, transparent,
 *                    opacity, flat, side, depthWrite
 * @param {ReturnType<typeof createFx>} fx
 */
export function toyMaterial(color, o, fx) {
  // the clear coat: high quality only, and only on opaque, non-metal, unlit plastic
  const coat = toyFinish.level === 'high' && !o.transparent && !((o.metal ?? 0) > 0.5) && !o.emissive && !o.flat;
  const Mat = coat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const mat = new Mat({
    ...(coat ? { clearcoat: 0.45, clearcoatRoughness: 0.26 } : {}),
    color,
    roughness: o.rough ?? 0.58,
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
    uRimPower: { value: o.rimPower ?? 2.4 },
    uRimStrength: { value: o.rim ?? 0.42 },
    uFlash: fx.flash,
    uFlashColor: fx.flashColor,
    uSilhouette: fx.silhouette,
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vToyY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvToyY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${HEADER}\nvarying float vToyY;`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FEET}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${RIM}`)
      .replace('#include <opaque_fragment>', `${FINAL}\n#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'toy-v3';
  return mat;
}
