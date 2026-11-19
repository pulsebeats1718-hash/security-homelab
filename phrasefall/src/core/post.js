/**
 * PostFX — the "toy diorama" finish for the high and medium quality tiers. Low quality never builds
 * this: it keeps rendering straight to the screen.
 *
 *   scene   rendered once into a multisampled half-float target (linear HDR, no tone mapping yet)
 *   bloom   a soft threshold, then a dual-filter down / up chain starting at ½ (high) or ¼ (medium)
 *           resolution. The threshold is high, so only emissive and very bright things glow:
 *           golden cards, sparkles, fever, lightning, the sun, stars, lanterns.
 *   blur    high only, when the shot asks for it (menus): a ¼-resolution soft copy of the scene,
 *           mixed in towards the top and bottom of the screen — a tilt-shift miniature look
 *   final   ONE pass to the screen: tilt-shift mix, bloom, exposure and the same Neutral tone mapping
 *           as before, then the grade (lift / gamma / gain, vibrance, warm highlights and cool shadows),
 *           a soft vignette, sRGB and dithering against banding
 *
 * Grading and the output conversion share one pass on purpose: every full-screen pass costs
 * bandwidth on a phone, so the whole finish is one full-resolution read and write after the scene.
 */
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

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

// plain 4×4 box (four bilinear taps): the first step of the tilt-shift blur
const BOX = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
  s += texture2D(tSrc, vUv + vec2(1.0, -1.0) * uTexel).rgb;
  s += texture2D(tSrc, vUv + vec2(-1.0, 1.0) * uTexel).rgb;
  s += texture2D(tSrc, vUv + vec2(1.0, 1.0) * uTexel).rgb;
  gl_FragColor = vec4(s * 0.25, 1.0);
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

const FINAL = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tBlur;
uniform float uBloom;
uniform float uExposure;
uniform vec4 uTilt;      // amount, focus (uv y), sharp half-band, ramp
uniform vec3 uLift;
uniform vec3 uGamma;     // 1 / gamma
uniform vec3 uGain;
uniform float uVibrance;
uniform float uContrast;
uniform vec3 uShadowTint;
uniform vec3 uHighTint;
uniform vec4 uVignette;  // strength, aspect, inner, outer
uniform vec3 uVignetteColor;
varying vec2 vUv;

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

void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  #ifdef TILT
  float k = smoothstep(uTilt.z, uTilt.z + uTilt.w, abs(vUv.y - uTilt.y)) * uTilt.x;
  c = mix(c, texture2D(tBlur, vUv).rgb, k);
  #endif
  c += texture2D(tBloom, vUv).rgb * uBloom;
  c = toSRGB(clamp(neutral(c * uExposure), 0.0, 1.0));

  // the grade, in display space
  c = uGain * (c + uLift * (1.0 - c));
  c = pow(max(c, 0.0), uGamma);
  // a gentle S-curve: a little more depth in the shadows and sparkle in the highlights
  c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, 1.0 + uVibrance * (1.0 - sat));
  c += uShadowTint * (1.0 - l) * (1.0 - l) + uHighTint * l * l;

  // a soft vignette, tinted rather than black
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

/** The grade every post tier starts from; Environment.setGrade() nudges it per time of day. */
export const GRADE = {
  lift: [0.012, 0.008, 0.024],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.0, 1.0, 1.0],
  vibrance: 0.22,
  contrast: 0.2,
  shadowTint: [-0.006, 0.0, 0.016],
  highTint: [0.016, 0.006, -0.012],
  vignette: 0.32,
  vignetteColor: [0.34, 0.27, 0.48],
};

/**
 * Can this device run the post tiers? WebGL 2 with a renderable half-float format. MSAA on that
 * format is checked separately (samples()).
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

export class PostFX {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {{ samples: number, bloomDiv: number, bloomLevels: number, tilt: boolean }} tier
   */
  constructor(renderer, tier) {
    this.renderer = renderer;
    this.width = 1;
    this.height = 1;
    this.ok = true;
    /** bloom strength, threshold and knee (HDR, before exposure) */
    this.bloom = { strength: 0.7, threshold: 1.7, knee: 0.35 };
    /** the tilt-shift: amount (0 = off), focus height on screen (0 bottom … 1 top), sharp half-band, ramp */
    this.tilt = { amount: 0, focus: 0.5, band: 0.16, ramp: 0.3 };

    this.scene = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 0,
      depthBuffer: true,
      stencilBuffer: false,
      resolveDepthBuffer: false,
      storeMultisampledDepthBuffer: false,
    });
    this.scene.texture.name = 'pf-scene';
    this.levels = [];
    this.blurA = null;
    this.blurB = null;

    this.uPre = { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uCurve: { value: new THREE.Vector4() } };
    this.uDown = { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } };
    this.uUp = { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: 1 } };
    this.prefilter = pass(PREFILTER, this.uPre);
    this.box = pass(BOX, this.uDown);
    this.down = pass(DOWN, this.uDown);
    this.up = pass(UP, this.uUp, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    this.copyUp = pass(UP, this.uUp);

    const g = GRADE;
    this.uFinal = {
      tScene: { value: this.scene.texture },
      tBloom: { value: null },
      tBlur: { value: null },
      uBloom: { value: 0 },
      uExposure: { value: 1 },
      uTilt: { value: new THREE.Vector4() },
      uLift: { value: new THREE.Vector3(...g.lift) },
      uGamma: { value: new THREE.Vector3(...g.gamma.map((x) => 1 / x)) },
      uGain: { value: new THREE.Vector3(...g.gain) },
      uVibrance: { value: g.vibrance },
      uContrast: { value: g.contrast },
      uShadowTint: { value: new THREE.Vector3(...g.shadowTint) },
      uHighTint: { value: new THREE.Vector3(...g.highTint) },
      uVignette: { value: new THREE.Vector4(g.vignette, 1, 0.42, 0.98) },
      uVignetteColor: { value: new THREE.Vector3(...g.vignetteColor) },
    };
    this.final = pass(FINAL, this.uFinal);
    this.setTier(tier);
  }

  /** Change tier settings (samples, bloom resolution and levels, tilt-shift). */
  setTier(tier) {
    this.tier = tier;
    const samples = msaaSamples(this.renderer, tier.samples);
    if (samples !== this.scene.samples) {
      this.scene.samples = samples;
      this.scene.dispose(); // re-created with the new sample count on next use
    }
    for (const l of this.levels) l.dispose();
    this.levels = [];
    for (let i = 0; i < tier.bloomLevels; i++) this.levels.push(target());
    this.blurA?.dispose();
    this.blurB?.dispose();
    this.blurA = tier.tilt ? target() : null;
    this.blurB = tier.tilt ? target() : null;
    this.final.material.defines = tier.tilt ? { TILT: '' } : {};
    this.final.material.needsUpdate = true;
    this.uFinal.tBloom.value = this.levels[0].texture;
    this.uFinal.tBlur.value = this.blurA?.texture ?? this.levels[0].texture;
    this.setSize(this.width, this.height);
  }

  /** Drawing-buffer size in pixels. */
  setSize(width, height) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.scene.setSize(this.width, this.height);
    let w = Math.max(1, Math.round(this.width / this.tier.bloomDiv));
    let h = Math.max(1, Math.round(this.height / this.tier.bloomDiv));
    for (const l of this.levels) {
      l.setSize(w, h);
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
    this.blurA?.setSize(Math.max(1, Math.round(this.width / 4)), Math.max(1, Math.round(this.height / 4)));
    this.blurB?.setSize(Math.max(1, Math.round(this.width / 8)), Math.max(1, Math.round(this.height / 8)));
  }

  _draw(quad, rt, clear = true) {
    const r = this.renderer;
    r.setRenderTarget(rt);
    if (clear) r.clear(true, false, false);
    quad.render(r);
  }

  /** Render `scene` through the whole finish to the screen. */
  render(scene, camera) {
    const r = this.renderer;
    const autoClear = r.autoClear;
    r.setRenderTarget(this.scene);
    r.render(scene, camera);
    r.autoClear = false;

    // bloom: threshold + first downsample from the scene, the chain down, then back up
    const b = this.bloom;
    const src = this.scene.texture;
    this.uPre.tSrc.value = src;
    this.uPre.uTexel.value.set(1 / this.width, 1 / this.height);
    const knee = Math.max(1e-3, b.threshold * b.knee);
    this.uPre.uCurve.value.set(b.threshold, b.threshold - knee, knee * 2, 0.25 / knee);
    this._draw(this.prefilter, this.levels[0], false);
    for (let i = 1; i < this.levels.length; i++) {
      const from = this.levels[i - 1];
      this.uDown.tSrc.value = from.texture;
      this.uDown.uTexel.value.set(1 / from.width, 1 / from.height);
      this._draw(this.down, this.levels[i], false);
    }
    this.uUp.uWeight.value = 1;
    for (let i = this.levels.length - 1; i > 0; i--) {
      const from = this.levels[i];
      this.uUp.tSrc.value = from.texture;
      this.uUp.uTexel.value.set(1 / from.width, 1 / from.height);
      this._draw(this.up, this.levels[i - 1], false);
    }

    // tilt-shift source: a soft ¼-resolution copy of the scene (only while a shot asks for it)
    const t = this.tilt;
    const tilt = this.blurA && t.amount > 0.004;
    if (tilt) {
      // ¼ (a 4×4 box) → ⅛ (dual filter) → back to ¼ (tent): soft, and smooth when stretched
      this.uDown.tSrc.value = src;
      this.uDown.uTexel.value.set(1 / this.width, 1 / this.height);
      this._draw(this.box, this.blurA, false);
      this.uDown.tSrc.value = this.blurA.texture;
      this.uDown.uTexel.value.set(1 / this.blurA.width, 1 / this.blurA.height);
      this._draw(this.down, this.blurB, false);
      this.uUp.tSrc.value = this.blurB.texture;
      this.uUp.uTexel.value.set(1 / this.blurB.width, 1 / this.blurB.height);
      this._draw(this.copyUp, this.blurA, false);
    }

    const u = this.uFinal;
    u.uBloom.value = b.strength / this.levels.length;
    u.uExposure.value = r.toneMappingExposure;
    u.uTilt.value.set(tilt ? t.amount : 0, t.focus, t.band, t.ramp);
    u.uVignette.value.y = this.width / this.height;
    this._draw(this.final, null, false);
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
    for (const l of this.levels) l.dispose();
    this.blurA?.dispose();
    this.blurB?.dispose();
    for (const q of [this.prefilter, this.box, this.down, this.up, this.copyUp, this.final]) {
      q.material.dispose();
      q.dispose();
    }
  }
}
