/**
 * Atmosphere — a little aerial perspective for every fogged material, by patching three's fog
 * chunks once at start-up (no extra uniforms, passes or draw calls):
 *
 *   distance  the theme's exponential fog, as before
 *   depth     haze gathers below the island, so the cloud sea and the undersides of the far
 *             islands sink softly into it and the island floats over a deep, airy drop; it
 *             follows each theme's fog density (mistier at dawn and dusk than at noon)
 *
 * Custom shaders that do their own fog (halos, weather) are untouched.
 */
import * as THREE from 'three';

let patched = false;

export function patchAtmosphere() {
  if (patched) return;
  patched = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying float vFogY;
#endif
`;
  C.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  // world height of this vertex (view space back to world: the view matrix is a rotation + shift)
  vFogY = ((mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix)).y;
#endif
`;
  C.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying float vFogY;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif
`;
  C.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  // haze below the island: thicker the deeper and the farther away (and, through the theme's fog
  // density, mistier at dawn and dusk than at noon)
  #ifdef FOG_EXP2
    float fogLowK = fogDensity * 5.6;
  #else
    float fogLowK = 0.06;
  #endif
  float fogLow = max( - 2.0 - vFogY, 0.0 ) * fogLowK * smoothstep( 8.0, 32.0, vFogDepth );
  fogFactor = 1.0 - ( 1.0 - fogFactor ) * exp( - fogLow );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`;
}
