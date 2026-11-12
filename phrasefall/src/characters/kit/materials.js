/**
 * The "vinyl toy" surface used by every character.
 *
 * A standard PBR material extended with:
 *   - a fresnel rim light (tinted by the environment so characters sit in the scene),
 *   - a per-character flash colour (damage / power-up feedback),
 *   - a per-character silhouette mode (locked characters in the collection).
 */
import * as THREE from 'three';

/** Rim-light colour shared by all characters; the environment updates it per theme. */
export const rimShared = { color: { value: new THREE.Color(0xcfe4ff) }, boost: { value: 1 } };

const HEADER = /* glsl */ `
uniform vec3 uRimColor;
uniform float uRimBoost;
uniform float uRimPower;
uniform float uRimStrength;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uSilhouette;
`;

const RIM = /* glsl */ `
float toyRim = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), uRimPower);
totalEmissiveRadiance += uRimColor * (toyRim * uRimStrength * uRimBoost);
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
  const mat = new THREE.MeshStandardMaterial({
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
    uRimBoost: rimShared.boost,
    uRimPower: { value: o.rimPower ?? 2.4 },
    uRimStrength: { value: o.rim ?? 0.42 },
    uFlash: fx.flash,
    uFlashColor: fx.flashColor,
    uSilhouette: fx.silhouette,
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${HEADER}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${RIM}`)
      .replace('#include <opaque_fragment>', `${FINAL}\n#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'toy-v1';
  return mat;
}
