/**
 * PostFX — the "realistic miniature" lens for the high and medium quality tiers. Low quality never
 * builds this: it keeps rendering straight to the screen.
 *
 *   scene   rendered once into a multisampled half-float target (linear HDR, no tone mapping yet); its
 *           depth is resolved into a texture as well, for the passes that need to know how far away
 *           each pixel is
 *   ao      contact shadows (screen-space ambient occlusion from the depth alone): a spiral of samples
 *           at ½ (high) or ¼ (medium) resolution, then a depth-aware blur. It darkens creases and
 *           contacts only (under the character, round the dais, between buildings), never open ground
 *   dof     depth of field from the same depth, at ¼ resolution: a gathered disc blur whose size follows
 *           a thin lens. In play only the far background softens (everything from the character to the
 *           back of the play area, the falling card included, stays sharp); menus open the aperture
 *           wide for the tilt-shift miniature look (foreground and background both soft)
 *   rays    sun shafts: the visible sky round the sun, blurred radially towards it at ¼ (high) or ⅛
 *           (medium) resolution, so the light streams past clouds, trees and the character. Added to
 *           distant things only, never over the character or the card
 *   bloom   a soft threshold, then a dual-filter down / up chain starting at ½ (high) or ¼ (medium)
 *           resolution. The threshold is high, so only emissive and very bright things glow
 *   final   ONE pass to the screen: contact shadows, depth of field, sun shafts and the warm haze round a
 *           low sun, bloom, white balance and exposure, Neutral tone mapping, then a gentle photographic
 *           grade (lift / gamma / gain, a soft S-curve, saturation), lens vignetting, sRGB and dithering
 *
 * Every full-screen pass costs bandwidth on a phone, so everything that can run at reduced resolution
 * does, and the whole finish is one full-resolution read and write after the scene.
 */
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** Linear distance from the camera for a depth-buffer value (the camera's near · far, far − near, far). */
const DEPTH = /* glsl */ `
uniform sampler2D tDepth;
uniform vec3 uNF;
float viewDist(float d) { return uNF.x / (uNF.z - d * uNF.y); }
float distAt(vec2 uv) { return viewDist(texture2D(tDepth, uv).r); }
`;

/** The circle of confusion (signed, in full-resolution pixels: + behind the focus, − in front). */
const COC = /* glsl */ `
uniform vec4 uCoc;  // focus distance, far scale, far dead band, near scale
uniform vec2 uCoc2; // near dead band, largest blur
float cocOf(float z) {
  float k = 1.0 - uCoc.x / z;
  float far = max(k - uCoc.z, 0.0) * uCoc.y;
  float near = max(-k - uCoc2.x, 0.0) * uCoc.w;
  return clamp(far - near, -uCoc2.y, uCoc2.y);
}
`;

// threshold + first downsample: four bilinear taps (a 4×4 box), each weighted 1 / (1 + luma) so a
// single bright pixel cannot flicker as it moves (Karis average), then a soft-knee threshold
const PREFILTER = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform vec4 uCurve; // threshold, threshold - knee, 2 · knee, 0.25 / knee
varying vec2 vUv;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
  vec3 a = texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
  vec3 b = texture2D(tSrc, vUv + vec2(1.0, -1.0) * uTexel).rgb;
  vec3 c = texture2D(tSrc, vUv + vec2(-1.0, 1.0) * uTexel).rgb;
  vec3 d = texture2D(tSrc, vUv + vec2(1.0, 1.0) * uTexel).rgb;
  float wa = 1.0 / (1.0 + luma(a));
  float wb = 1.0 / (1.0 + luma(b));
  float wc = 1.0 / (1.0 + luma(c));
  float wd = 1.0 / (1.0 + luma(d));
  vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
  float br = max(col.r, max(col.g, col.b));
  float rq = clamp(br - uCurve.y, 0.0, uCurve.z);
  rq = uCurve.w * rq * rq;
  col *= max(rq, br - uCurve.x) / max(br, 1e-4);
  gl_FragColor = vec4(min(col, vec3(24.0)), 1.0);
}`;

// dual-filter downsample: the centre and four diagonal bilinear taps
const DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
  s += texture2D(tSrc, vUv + vec2(1.0, -1.0) * uTexel).rgb;
  s += texture2D(tSrc, vUv + vec2(-1.0, 1.0) * uTexel).rgb;
  s += texture2D(tSrc, vUv + vec2(1.0, 1.0) * uTexel).rgb;
  gl_FragColor = vec4(s * 0.125, 1.0);
}`;

// 3×3 tent upsample, added onto the next larger level (additive blending)
const UP = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uWeight;
varying vec2 vUv;
void main() {
  vec2 t = uTexel;
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += (texture2D(tSrc, vUv + vec2(-t.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, -t.y)).rgb + texture2D(tSrc, vUv + vec2(0.0, t.y)).rgb) * 2.0;
  s += texture2D(tSrc, vUv + vec2(-t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb + texture2D(tSrc, vUv + vec2(t.x, t.y)).rgb;
  gl_FragColor = vec4(s * (uWeight / 16.0), 1.0);
}`;

/**
 * Contact shadows: for each pixel, a spiral of depth samples within a world-space radius; each sample
 * above the surface's tangent plane (the normal comes from the neighbouring depths, taking the
 * smoother side so edges stay clean) occludes in proportion to its angle, fading out with distance.
 * Output: occlusion (1 = open) and the pixel's distance, for the depth-aware blur and upsample.
 */
const AO = /* glsl */ `
${DEPTH}
uniform vec4 uProj;      // projection [0][0], [1][1], [2][0], [2][1] (the shot's view offset included)
uniform vec2 uTexel;     // one AO-resolution texel, in uv
uniform vec4 uAO;        // radius (world), pixels per world unit at distance 1, intensity, bias
varying vec2 vUv;
vec3 viewPos(vec2 uv, float z) { return vec3((uv * 2.0 - 1.0 + uProj.zw) / uProj.xy * z, -z); }
vec3 posAt(vec2 uv) { return viewPos(uv, distAt(uv)); }
void main() {
  float d = texture2D(tDepth, vUv).r;
  float z = viewDist(d);
  if (d > 0.99999) { gl_FragColor = vec4(1.0, z, 0.0, 1.0); return; }
  vec3 P = viewPos(vUv, z);
  vec3 pr = posAt(vUv + vec2(uTexel.x, 0.0));
  vec3 pl = posAt(vUv - vec2(uTexel.x, 0.0));
  vec3 pu = posAt(vUv + vec2(0.0, uTexel.y));
  vec3 pd = posAt(vUv - vec2(0.0, uTexel.y));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy));
  float R = uAO.x;
  float rPx = min(R * uAO.y / z, MAX_PX);
  float ao = 1.0;
  if (rPx > 1.0) {
    // a 4×4 ordered rotation per pixel: the blur after this pass averages it away
    vec2 q = mod(floor(gl_FragCoord.xy), 4.0);
    float spin = (q.x * 4.0 + q.y + 0.5) / 16.0;
    spin = fract(spin * 3.0 + q.x * 0.17) * 6.2831853;
    float sum = 0.0;
    float R2 = R * R;
    for (int i = 0; i < SAMPLES; i++) {
      float a = (float(i) + 0.5) / float(SAMPLES);
      float th = a * TURNS * 6.2831853 + spin;
      vec2 uv = vUv + vec2(cos(th), sin(th)) * (a * rPx) * uTexel;
      vec3 v = posAt(uv) - P;
      float vv = dot(v, v);
      float cosA = dot(v, N) * inversesqrt(vv + 1e-6);
      sum += max(cosA - uAO.w, 0.0) * max(1.0 - vv / R2, 0.0);
    }
    ao = max(0.0, 1.0 - sum * uAO.z / float(SAMPLES));
  }
  gl_FragColor = vec4(ao, z, 0.0, 1.0);
}`;

// depth-aware 5-tap blur of the occlusion along one axis (run twice: across, then down)
const AO_BLUR = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec2 c = texture2D(tSrc, vUv).rg;
  float sum = c.r;
  float wsum = 1.0;
  float k = 1.0 / (c.g * c.g * 0.0025 + 1e-4);
  for (int i = -2; i <= 2; i++) {
    if (i == 0) continue;
    vec2 s = texture2D(tSrc, vUv + uDir * float(i)).rg;
    float dz = s.g - c.g;
    float w = exp(-dz * dz * k) * (i == -2 || i == 2 ? 0.6 : 1.0);
    sum += s.r * w;
    wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, c.g, 0.0, 1.0);
}`;

/**
 * Depth of field, step 1 (at the blur's resolution): the scene, box-filtered (favouring the more
 * blurred pixels, so the sharp subject's colour does not halo into the background), and the circle
 * of confusion in the blur's own pixels.
 */
const DOF_PREP = /* glsl */ `
${DEPTH}
${COC}
uniform sampler2D tScene;
uniform vec2 uTexel; // full-resolution texel
uniform float uDiv;
varying vec2 vUv;
// the sky is left out of the lens (stars, moon and sun stay crisp): a code above any real blur
const float SKY = 1000.0;
float cocAt(vec2 uv) {
  float d = texture2D(tDepth, uv).r;
  return d > 0.99999 ? SKY : cocOf(viewDist(d)) / uDiv;
}
void main() {
  vec2 o = uTexel * (uDiv * 0.25);
  vec2 u0 = vUv + vec2(-o.x, -o.y);
  vec2 u1 = vUv + vec2(o.x, -o.y);
  vec2 u2 = vUv + vec2(-o.x, o.y);
  vec2 u3 = vUv + vec2(o.x, o.y);
  vec4 c = vec4(cocAt(u0), cocAt(u1), cocAt(u2), cocAt(u3));
  vec4 sky = step(SKY, c);
  vec4 w = mix(abs(c), vec4(0.0), sky) + 0.25;
  vec3 col = texture2D(tScene, u0).rgb * w.x + texture2D(tScene, u1).rgb * w.y + texture2D(tScene, u2).rgb * w.z + texture2D(tScene, u3).rgb * w.w;
  col /= w.x + w.y + w.z + w.w;
  // the block's blur is that of its farthest pixel behind the focus and its nearest in front of it;
  // all sky stays sky
  vec4 cs = mix(c, vec4(-SKY), sky);
  float far = max(max(cs.x, cs.y), max(cs.z, cs.w));
  float near = min(min(c.x, c.y), min(c.z, c.w));
  float coc = -near > far ? near : far;
  if (sky.x * sky.y * sky.z * sky.w > 0.5) coc = SKY;
  gl_FragColor = vec4(min(col, vec3(32.0)), coc);
}`;

/**
 * Depth of field, step 2: gather a disc of samples (a golden-angle spiral). A sample counts if its own
 * blur reaches this pixel; a sample behind this pixel may not spread further than this pixel's own
 * blur, so the background never smears over a sharper foreground.
 */
const DOF = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uMaxR;
varying vec2 vUv;
void main() {
  vec4 c0 = texture2D(tSrc, vUv);
  float r0 = c0.a > 999.0 ? 0.0 : abs(c0.a);
  vec3 col = c0.rgb;
  float tot = 1.0;
  float cov = 0.0;
  float spin = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853;
  for (int i = 0; i < TAPS; i++) {
    float a = float(i) * 2.39996323 + spin;
    float r = sqrt((float(i) + 0.5) / float(TAPS)) * uMaxR;
    vec4 s = texture2D(tSrc, vUv + vec2(cos(a), sin(a)) * r * uTexel);
    float sr = s.a > 999.0 ? 0.0 : abs(s.a);
    bool behind = s.a > c0.a;
    if (behind) sr = min(sr, r0 * 2.0);
    float m = smoothstep(r - 0.6, r + 0.6, sr);
    col += mix(col / tot, s.rgb, m);
    tot += 1.0;
    // how much of this pixel is covered by the blur of things in front of it (soft edges over sharper ground)
    if (!behind) cov += m;
  }
  gl_FragColor = vec4(col / tot, cov / float(TAPS));
}`;

/** Sun shafts, step 1: the open sky, brightest round the sun (cloud, trees and the island block it). */
const RAYS_MASK = /* glsl */ `
${DEPTH}
uniform sampler2D tScene;
uniform vec2 uTexel; // full-resolution texel
uniform vec3 uSun;   // sun position in uv, aspect
varying vec2 vUv;
void main() {
  vec2 o = uTexel * 0.5;
  float sky = 0.0;
  sky += step(0.99999, texture2D(tDepth, vUv + vec2(-o.x, -o.y)).r);
  sky += step(0.99999, texture2D(tDepth, vUv + vec2(o.x, -o.y)).r);
  sky += step(0.99999, texture2D(tDepth, vUv + vec2(-o.x, o.y)).r);
  sky += step(0.99999, texture2D(tDepth, vUv + vec2(o.x, o.y)).r);
  vec3 c = texture2D(tScene, vUv).rgb;
  vec2 d = (vUv - uSun.xy) * vec2(uSun.z, 1.0);
  float glow = exp(-dot(d, d) * 22.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(c * (sky * 0.25) * glow * smoothstep(0.6, 2.4, l), 1.0);
}`;

/** Sun shafts, step 2 (run twice, the second finer): blur along the line towards the sun. */
const RAYS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec3 uSun;    // sun position in uv, the share of the way to the sun this pass covers
uniform float uDecay;
varying vec2 vUv;
void main() {
  vec2 step = (uSun.xy - vUv) * (uSun.z / float(TAPS));
  vec2 uv = vUv;
  vec3 acc = vec3(0.0);
  float w = 1.0;
  float wsum = 0.0;
  for (int i = 0; i < TAPS; i++) {
    acc += texture2D(tSrc, uv).rgb * w;
    wsum += w;
    w *= uDecay;
    uv += step;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}`;

const FINAL = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform vec3 uWB;        // white balance, linear gains
uniform vec3 uLift;
uniform vec3 uGamma;     // 1 / gamma
uniform vec3 uGain;
uniform float uSaturation;
uniform float uVibrance;
uniform float uContrast;
uniform vec3 uShadowTint;
uniform vec3 uHighTint;
uniform vec4 uVignette;  // strength, aspect, inner, outer
uniform vec3 uVignetteColor;
varying vec2 vUv;

#ifdef DEPTHFX
${DEPTH}
#endif
#ifdef AO
uniform sampler2D tAO;
uniform vec3 uAOInfo; // texture width, height, strength
#endif
#ifdef DOF
${COC}
uniform sampler2D tDOF;
#endif
#ifdef RAYS
uniform sampler2D tRays;
uniform vec3 uRaysColor;
uniform vec2 uGate;      // shafts and haze fade in between these distances
uniform vec4 uHaze;      // the sun's direction in view space, strength
uniform vec3 uHazeColor;
uniform vec4 uProj;
#endif

// Khronos PBR Neutral, exactly as three applies it when rendering straight to the screen
vec3 neutral(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(0.0031308, c));
}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

#ifdef AO
// the occlusion, upsampled with care for edges: of the four nearest texels, those at this pixel's depth count
float aoAt(vec2 uv, float z) {
  vec2 size = uAOInfo.xy;
  #ifdef AO_JOINT
  vec2 p = uv * size - 0.5;
  vec2 f = fract(p);
  vec2 b = (floor(p) + 0.5) / size;
  vec2 t = 1.0 / size;
  vec2 s0 = texture2D(tAO, b).rg;
  vec2 s1 = texture2D(tAO, b + vec2(t.x, 0.0)).rg;
  vec2 s2 = texture2D(tAO, b + vec2(0.0, t.y)).rg;
  vec2 s3 = texture2D(tAO, b + t).rg;
  vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  vec4 dz = abs(vec4(s0.y, s1.y, s2.y, s3.y) - z) / z;
  w *= 1.0 / (1.0 + dz * dz * 4000.0);
  float ws = w.x + w.y + w.z + w.w;
  return ws > 1e-4 ? dot(w, vec4(s0.x, s1.x, s2.x, s3.x)) / ws : 1.0;
  #else
  vec2 s = texture2D(tAO, uv).rg;
  return mix(s.x, 1.0, smoothstep(0.04, 0.12, abs(s.y - z) / z));
  #endif
}
#endif

void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  #ifdef DEPTHFX
  float z = distAt(vUv);
  #endif
  #ifdef AO
  c *= mix(1.0, aoAt(vUv, z), uAOInfo.z);
  #endif
  #ifdef DOF
  {
    float coc = z > uNF.z * 0.999 ? 0.0 : abs(cocOf(z));
    vec4 blur = texture2D(tDOF, vUv);
    c = mix(c, blur.rgb, max(smoothstep(0.4, 3.0, coc), clamp(blur.a * 3.0, 0.0, 1.0)));
  }
  #endif
  #ifdef RAYS
  {
    float gate = smoothstep(uGate.x, uGate.y, z);
    // the haze round a low sun: light scattered forward by the air, deeper the farther away
    vec3 dir = normalize(vec3((vUv * 2.0 - 1.0 + uProj.zw) / uProj.xy, -1.0));
    float mu = max(dot(dir, uHaze.xyz), 0.0);
    float phase = mu * mu * mu * mu;
    phase = phase * phase * 0.7 + phase * 0.3;
    float air = (1.0 - exp(-z * 0.012)) * step(z, uNF.z * 0.98);
    c += uHazeColor * (phase * air * uHaze.w * gate);
    c += texture2D(tRays, vUv).rgb * uRaysColor * gate;
  }
  #endif
  c += texture2D(tBloom, vUv).rgb * uBloom;
  c = toSRGB(clamp(neutral(c * uWB * uExposure), 0.0, 1.0));

  // the grade, in display space
  c = uGain * (c + uLift * (1.0 - c));
  c = pow(max(c, 0.0), uGamma);
  // a gentle S-curve: a little more depth in the shadows and sparkle in the highlights
  c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, uSaturation + uVibrance * (1.0 - sat));
  c += uShadowTint * (1.0 - l) * (1.0 - l) + uHighTint * l * l;

  // lens vignetting: a soft, slightly warm fall-off towards the corners
  vec2 q = (vUv - 0.5) * vec2(uVignette.y, 1.0);
  float v = smoothstep(uVignette.z, uVignette.w, length(q)) * uVignette.x;
  c = mix(c, c * uVignetteColor, v);

  // triangular dither of ±1 step: no banding in the sky or the vignette
  float n = ign(gl_FragCoord.xy) + ign(gl_FragCoord.xy + vec2(31.0, 17.0)) - 1.0;
  gl_FragColor = vec4(c + n / 255.0, 1.0);
}`;

const pass = (fragmentShader, uniforms, o = {}) =>
  new FullScreenQuad(new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...o }));

const target = (o = {}) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false, ...o });

/** The grade every post tier starts from; the environment sets it per time of day (Environment._grade). */
export const GRADE = {
  wb: [1, 1, 1],
  lift: [0.006, 0.006, 0.012],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.0, 1.0, 1.0],
  saturation: 1.0,
  vibrance: 0.1,
  contrast: 0.14,
  shadowTint: [-0.006, 0.0, 0.014],
  highTint: [0.012, 0.005, -0.01],
  vignette: 0.3,
  vignetteColor: [0.62, 0.58, 0.56],
};

/**
 * Can this device run the post tiers? WebGL 2 with a renderable half-float format. MSAA on that
 * format is checked separately (msaaSamples): without it the finish stays off, so edges never
 * lose the antialiasing the plain screen has.
 */
export function postSupported(renderer) {
  return renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
}

/** The MSAA sample count this device allows on a half-float target, at most `want`. */
function msaaSamples(renderer, want) {
  const gl = renderer.getContext();
  try {
    const list = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES);
    let best = 0;
    for (const s of list ?? []) if (s <= want && s > best) best = s;
    return best;
  } catch {
    return 0;
  }
}

const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3();

export class PostFX {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {{ samples: number, bloomDiv: number, bloomLevels: number,
   *           ao?: { div: number, samples: number }, dof?: { div: number, taps: number },
   *           rays?: { div: number, taps: number } }} tier
   */
  constructor(renderer, tier) {
    this.renderer = renderer;
    this.width = 1;
    this.height = 1;
    this.ok = true;
    /** bloom strength, threshold and knee (HDR, before exposure) */
    this.bloom = { strength: 0.7, threshold: 1.7, knee: 0.35 };
    /**
     * Depth of field, set by the stage from the shot each frame. focus: distance to the subject;
     * tilt (0…1): the miniature look (a wide-open lens, foreground and background soft); far:
     * how much the far background softens in play; back: how far behind the subject stays sharp.
     */
    this.dof = { focus: 12, tilt: 0, far: 1, back: 3.8 };
    /** contact shadows: radius (world units), intensity, strength of the darkening */
    this.ao = { radius: 0.75, intensity: 2.4, strength: 0.9 };
    /** sun shafts and the haze round a low sun (set per time of day by the environment) */
    this.rays = { amount: 0, haze: 0, color: new THREE.Color(1, 0.85, 0.6), hazeColor: new THREE.Color(1, 0.8, 0.6), dir: new THREE.Vector3(0, 0.1, -1) };
    /** for debugging and measuring: switch single effects off */
    this.enable = { ao: true, dof: true, rays: true };

    this.depth = new THREE.DepthTexture(1, 1);
    this.depth.type = THREE.UnsignedIntType;
    this.scene = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 0,
      depthBuffer: true,
      stencilBuffer: false,
      depthTexture: this.depth,
      resolveDepthBuffer: false,
      storeMultisampledDepthBuffer: false,
    });
    this.scene.texture.name = 'pf-scene';
    this.levels = [];
    this.aoA = this.aoB = this.dofA = this.dofB = this.raysA = this.raysB = null;

    const depthU = () => ({ tDepth: { value: this.depth }, uNF: { value: this._nf } });
    this._nf = new THREE.Vector3(1, 1, 1);
    this._proj = new THREE.Vector4(1, 1, 0, 0);
    this._coc = new THREE.Vector4();
    this._coc2 = new THREE.Vector2();
    this._sun = new THREE.Vector3();

    this.uPre = { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uCurve: { value: new THREE.Vector4() } };
    this.uDown = { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } };
    this.uUp = { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: 1 } };
    this.prefilter = pass(PREFILTER, this.uPre);
    this.down = pass(DOWN, this.uDown);
    this.up = pass(UP, this.uUp, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });

    this.uAO = { ...depthU(), uProj: { value: this._proj }, uTexel: { value: new THREE.Vector2() }, uAO: { value: new THREE.Vector4() } };
    this.aoPass = pass(AO, this.uAO);
    this.uAOBlur = { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } };
    this.aoBlur = pass(AO_BLUR, this.uAOBlur);

    this.uDofPrep = { ...depthU(), tScene: { value: this.scene.texture }, uTexel: { value: new THREE.Vector2() }, uDiv: { value: 4 }, uCoc: { value: this._coc }, uCoc2: { value: this._coc2 } };
    this.dofPrep = pass(DOF_PREP, this.uDofPrep);
    this.uDof = { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uMaxR: { value: 4 } };
    this.dofPass = pass(DOF, this.uDof);

    this.uRaysMask = { ...depthU(), tScene: { value: this.scene.texture }, uTexel: { value: new THREE.Vector2() }, uSun: { value: this._sun } };
    this.raysMask = pass(RAYS_MASK, this.uRaysMask);
    this.uRays = { tSrc: { value: null }, uSun: { value: new THREE.Vector3() }, uDecay: { value: 0.96 } };
    this.raysPass = pass(RAYS, this.uRays);

    const g = GRADE;
    this.uFinal = {
      ...depthU(),
      tScene: { value: this.scene.texture },
      tBloom: { value: null },
      tAO: { value: null },
      uAOInfo: { value: new THREE.Vector3(1, 1, 0) },
      tDOF: { value: null },
      uCoc: { value: this._coc },
      uCoc2: { value: this._coc2 },
      tRays: { value: null },
      uRaysColor: { value: new THREE.Color() },
      uGate: { value: new THREE.Vector2(20, 40) },
      uHaze: { value: new THREE.Vector4() },
      uHazeColor: { value: new THREE.Color() },
      uProj: { value: this._proj },
      uBloom: { value: 0 },
      uExposure: { value: 1 },
      uWB: { value: new THREE.Vector3(...g.wb) },
      uLift: { value: new THREE.Vector3(...g.lift) },
      uGamma: { value: new THREE.Vector3(...g.gamma.map((x) => 1 / x)) },
      uGain: { value: new THREE.Vector3(...g.gain) },
      uSaturation: { value: g.saturation },
      uVibrance: { value: g.vibrance },
      uContrast: { value: g.contrast },
      uShadowTint: { value: new THREE.Vector3(...g.shadowTint) },
      uHighTint: { value: new THREE.Vector3(...g.highTint) },
      uVignette: { value: new THREE.Vector4(g.vignette, 1, 0.38, 1.02) },
      uVignetteColor: { value: new THREE.Vector3(...g.vignetteColor) },
    };
    this.final = pass(FINAL, this.uFinal);
    this.setTier(tier);
  }

  /** Change tier settings (samples, bloom resolution and levels, which depth effects run and how finely). */
  setTier(tier) {
    this.tier = tier;
    const samples = msaaSamples(this.renderer, tier.samples);
    this.ok = samples > 0;
    if (samples !== this.scene.samples) {
      this.scene.samples = samples;
      this.scene.dispose(); // re-created with the new sample count on next use
    }
    for (const l of this.levels) l.dispose();
    this.levels = [];
    for (let i = 0; i < tier.bloomLevels; i++) this.levels.push(target());
    for (const k of ['aoA', 'aoB', 'dofA', 'dofB', 'raysA', 'raysB']) {
      this[k]?.dispose();
      this[k] = null;
    }
    const defines = {};
    if (tier.ao) {
      this.aoA = target();
      this.aoB = target();
      this.aoPass.material.defines = { SAMPLES: tier.ao.samples, TURNS: '7.0', MAX_PX: (tier.ao.maxPx ?? 24).toFixed(1) };
      this.aoPass.material.needsUpdate = true;
      defines.AO = '';
      if (tier.ao.joint) defines.AO_JOINT = '';
    }
    if (tier.dof) {
      this.dofA = target();
      this.dofB = target();
      this.dofPass.material.defines = { TAPS: tier.dof.taps };
      this.dofPass.material.needsUpdate = true;
      defines.DOF = '';
    }
    if (tier.rays) {
      this.raysA = target();
      this.raysB = target();
      this.raysPass.material.defines = { TAPS: tier.rays.taps };
      this.raysPass.material.needsUpdate = true;
      defines.RAYS = '';
    }
    if (tier.ao || tier.dof || tier.rays) defines.DEPTHFX = '';
    this.final.material.defines = defines;
    this.final.material.needsUpdate = true;
    this.uFinal.tBloom.value = this.levels[0].texture;
    this.uFinal.tAO.value = this.aoB?.texture ?? null;
    this.uFinal.tDOF.value = this.dofB?.texture ?? null;
    this.uFinal.tRays.value = this.raysA?.texture ?? null;
    this.setSize(this.width, this.height);
  }

  /** Drawing-buffer size in pixels. */
  setSize(width, height) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.scene.setSize(this.width, this.height);
    const t = this.tier;
    const div = (n) => [Math.max(1, Math.round(this.width / n)), Math.max(1, Math.round(this.height / n))];
    let [w, h] = div(t.bloomDiv);
    for (const l of this.levels) {
      l.setSize(w, h);
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
    if (t.ao) {
      this.aoA.setSize(...div(t.ao.div));
      this.aoB.setSize(...div(t.ao.div));
    }
    if (t.dof) {
      this.dofA.setSize(...div(t.dof.div));
      this.dofB.setSize(...div(t.dof.div));
    }
    if (t.rays) {
      this.raysA.setSize(...div(t.rays.div));
      this.raysB.setSize(...div(t.rays.div));
    }
  }

  _draw(quad, rt) {
    this.renderer.setRenderTarget(rt);
    quad.render(this.renderer);
  }

  /** Camera constants the depth passes share: linear depth, the projection (with the shot's view offset). */
  _camera(camera) {
    const n = camera.near;
    const f = camera.far;
    this._nf.set(n * f, f - n, f);
    const e = camera.projectionMatrix.elements;
    this._proj.set(e[0], e[5], e[8], e[9]);
  }

  /**
   * The thin lens for this frame (circles of confusion in full-resolution pixels), from the shot's
   * focus and tilt. In play the lens is focused on the back of the play area, so the subject, the
   * card and a boss in front of it all stay sharp and only the far side softens; the menus' miniature
   * look focuses on the subject itself with a wide aperture, so the foreground softens too.
   */
  _lens() {
    const d = this.dof;
    const px = this.height / 915; // tuned on a 915 px tall phone screen; scales with the resolution
    const t = Math.min(1, Math.max(0, d.tilt));
    const zf = Math.max(1, d.focus);
    // far side: a lens focused at zf + back blurs a point at z by A · (1 − (zf + back) / z). On the
    // menus the sharp zone reaches 5 units behind the subject, so a city's street front and its signs
    // stay readable; the back rows soften only a little and the distant skyline and sky stay soft
    const zfar = zf + d.back * (1 - t) + 5.0 * t;
    const A = (13 * d.far * (1 - t) + 16 * t) * px;
    const band = 1 - zf / zfar;
    // near side (menus only), sharp to 0.6 units in front of the subject
    const zfront = Math.max(0.5, zf - 0.6);
    const B = 34 * t * px;
    this._coc.set(zf, (A * zfar) / zf, band, (B * zfront) / zf);
    this._coc2.set(zf / zfront - 1, (12 + 4 * t) * px);
    return A + B > 0.01;
  }

  /** Where the sun is on screen (uv), or null when it is behind the camera. */
  _sunUV(camera) {
    const r = this.rays;
    _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    if (_fwd.dot(r.dir) < 0.05) return null;
    _v.copy(r.dir).multiplyScalar(400).add(camera.position).project(camera);
    return [_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5];
  }

  /** Render `scene` through the whole finish to the screen. */
  render(scene, camera) {
    const r = this.renderer;
    const t = this.tier;
    const autoClear = r.autoClear;
    const en = this.enable;
    this.scene.resolveDepthBuffer = !!(t.ao || t.dof || t.rays);
    r.setRenderTarget(this.scene);
    r.render(scene, camera); // (this also brings the camera's matrices up to date)
    r.autoClear = false;
    this._camera(camera);
    const lens = t.dof && en.dof && this._lens();
    const sun = t.rays && en.rays && this.rays.amount > 0.004 ? this._sunUV(camera) : null;
    const ao = t.ao && en.ao && this.ao.strength > 0.004;

    // bloom: threshold + first downsample from the scene, the chain down, then back up
    const b = this.bloom;
    const src = this.scene.texture;
    this.uPre.tSrc.value = src;
    this.uPre.uTexel.value.set(1 / this.width, 1 / this.height);
    const knee = Math.max(1e-3, b.threshold * b.knee);
    this.uPre.uCurve.value.set(b.threshold, b.threshold - knee, knee * 2, 0.25 / knee);
    this._draw(this.prefilter, this.levels[0]);
    for (let i = 1; i < this.levels.length; i++) {
      const from = this.levels[i - 1];
      this.uDown.tSrc.value = from.texture;
      this.uDown.uTexel.value.set(1 / from.width, 1 / from.height);
      this._draw(this.down, this.levels[i]);
    }
    this.uUp.uWeight.value = 1;
    for (let i = this.levels.length - 1; i > 0; i--) {
      const from = this.levels[i];
      this.uUp.tSrc.value = from.texture;
      this.uUp.uTexel.value.set(1 / from.width, 1 / from.height);
      this._draw(this.up, this.levels[i - 1]);
    }

    const u = this.uFinal;
    // contact shadows
    if (ao) {
      const a = this.ao;
      const A = this.aoA;
      this.uAO.uTexel.value.set(1 / A.width, 1 / A.height);
      // AO pixels per world unit at distance 1: half the viewport height over tan(fov / 2)
      this.uAO.uAO.value.set(a.radius, this._proj.y * 0.5 * A.height, a.intensity, 0.08);
      this._draw(this.aoPass, A);
      this.uAOBlur.tSrc.value = A.texture;
      this.uAOBlur.uDir.value.set(1 / A.width, 0);
      this._draw(this.aoBlur, this.aoB);
      this.uAOBlur.tSrc.value = this.aoB.texture;
      this.uAOBlur.uDir.value.set(0, 1 / A.height);
      this._draw(this.aoBlur, A);
      u.tAO.value = A.texture;
      u.uAOInfo.value.set(A.width, A.height, a.strength);
    } else if (t.ao) u.uAOInfo.value.z = 0;

    // depth of field
    if (t.dof) {
      if (lens) {
        const D = this.dofA;
        this.uDofPrep.uTexel.value.set(1 / this.width, 1 / this.height);
        this.uDofPrep.uDiv.value = t.dof.div;
        this._draw(this.dofPrep, D);
        this.uDof.tSrc.value = D.texture;
        this.uDof.uTexel.value.set(1 / D.width, 1 / D.height);
        this.uDof.uMaxR.value = this._coc2.y / t.dof.div;
        this._draw(this.dofPass, this.dofB);
      } else this._coc.set(1e6, 0, 0, 0); // nothing blurs
    }

    // sun shafts
    if (t.rays) {
      const R = this.rays;
      if (sun) {
        this._sun.set(sun[0], sun[1], this.width / this.height);
        this.uRaysMask.uTexel.value.set(1 / this.width, 1 / this.height);
        this._draw(this.raysMask, this.raysA);
        this.uRays.tSrc.value = this.raysA.texture;
        this.uRays.uSun.value.set(sun[0], sun[1], 0.75);
        this._draw(this.raysPass, this.raysB);
        this.uRays.tSrc.value = this.raysB.texture;
        this.uRays.uSun.value.set(sun[0], sun[1], 0.75 / t.rays.taps);
        this._draw(this.raysPass, this.raysA);
        u.uRaysColor.value.copy(R.color).multiplyScalar(R.amount);
      } else u.uRaysColor.value.setScalar(0);
      // the haze: the sun's direction in view space
      _v.copy(R.dir).transformDirection(camera.matrixWorldInverse);
      u.uHaze.value.set(_v.x, _v.y, _v.z, R.haze);
      u.uHazeColor.value.copy(R.hazeColor);
      const zf = this.dof.focus;
      u.uGate.value.set(zf + 2.5, zf + 14);
    }

    u.uBloom.value = b.strength / this.levels.length;
    u.uExposure.value = r.toneMappingExposure;
    u.uVignette.value.y = this.width / this.height;
    this._draw(this.final, null);
    r.autoClear = autoClear;
  }

  /** Is the multisampled half-float target complete on this device? (checked once, after the first frame) */
  check() {
    const r = this.renderer;
    const gl = r.getContext();
    r.setRenderTarget(this.scene);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    r.setRenderTarget(null);
    this.ok = status === gl.FRAMEBUFFER_COMPLETE;
    return this.ok;
  }

  dispose() {
    this.scene.dispose();
    this.depth.dispose();
    for (const l of this.levels) l.dispose();
    for (const k of ['aoA', 'aoB', 'dofA', 'dofB', 'raysA', 'raysB']) this[k]?.dispose();
    for (const q of [this.prefilter, this.down, this.up, this.aoPass, this.aoBlur, this.dofPrep, this.dofPass, this.raysMask, this.raysPass, this.final]) {
      q.material.dispose();
      q.dispose();
    }
  }
}
