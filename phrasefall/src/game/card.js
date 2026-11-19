/**
 * ExpressionCard — the glowing tablet that carries an expression down from the sky.
 * One instance is reused for every expression.
 *
 * It is made like a real enamel badge: a bevelled frame (a bezel that catches the light along its
 * rounded edges) with the glossy enamel face set into it, a soft shadow inside the rim where the face
 * sits deeper. The face catches the sky's light with a slow sheen sweeping across it now and then. A
 * soft trail of light streams up behind it as it falls and its shadow gathers on the ground below as it
 * comes closer. Golden cards get a polished, shimmering gold frame, light rays turning behind them, a
 * brighter, quicker sheen and twinkling glitter that the bloom on high and medium quality turns into a
 * soft glow. A wrong answer sends the card wobbling down. The text is drawn flat, unlit and untouched by
 * any of it, so it stays crisp.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeGlowTexture } from '../world/sky.js';
import { clamp, ease } from '../core/utils.js';
import { GLOW_BLEND } from '../world/effects.js';

const W = 6;
const H = 1.7;
/** The frame's width round the face, its depth and the face's (the face sits a little behind the frame's front). */
const BORDER = 0.17;
const FRAME_DEPTH = 0.24;
const FACE_DEPTH = 0.17;
const TEX_W = 1280;
const TEX_H = 320;
const INK = '#1a1446';
const HINT_INK = '#5b4f99';
const DANGER = new THREE.Color(0xff5068);
const _white = new THREE.Color(0xffffff);
const BLANK_FILL = 'rgba(122, 92, 255, 0.16)';
const BLANK_INK = '#7a5cff';
/** Face colours for twist cards. */
const TWIST_FACE = { flip: 0xe4f8ee, build: 0xe3f1ff, gap: 0xf0e9ff, listen: 0xffeedf };

const font = (px, weight = 700) => `${weight} ${px}px "Fredoka Variable", "Fredoka", "Nunito Variable", system-ui, sans-serif`;

/** Greedy word wrap for the current canvas font. */
function wrap(g, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && g.measureText(next).width > maxW) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** A rounded rectangle centred on the origin, as a three Shape or Path. */
function roundedRect(path, w, h, r) {
  const x = -w / 2;
  const y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

/** The frame: a bezel, `border` wide, with softly bevelled edges inside and out. */
function bezelGeometry(w, h, r, border, depth) {
  const bevel = 0.05;
  const shape = roundedRect(new THREE.Shape(), w - bevel * 2, h - bevel * 2, r - bevel);
  shape.holes.push(roundedRect(new THREE.Path(), w - border * 2 + bevel * 2, h - border * 2 + bevel * 2, Math.max(0.05, r - border + bevel)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -depth / 2 + bevel);
  return g;
}

/** A soft rounded-rectangle shadow (for the ground under the card). */
let shadowTex = null;
function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.filter = 'blur(9px)';
  g.fillStyle = '#fff';
  roundRect(g, 26, 18, 204, 28, 14);
  g.fill();
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// the trail: a soft stream of light rising off the card as it falls
const TRAIL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
void main() {
  float y = vUv.y * 0.5 + 0.5; // 0 at the card, 1 at the tip
  float across = 1.0 - smoothstep(0.45, 1.0, abs(vUv.x));
  float strands = 0.72 + 0.28 * sin(vUv.x * 23.0 + uTime * 1.7) * sin(vUv.x * 9.0 - uTime * 1.1 + y * 3.0);
  float a = across * pow(1.0 - y, 1.6) * strands * uOpacity;
  gl_FragColor = vec4(uColor * (1.1 + (1.0 - y) * 0.8) * a, a * 0.35);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// golden cards: rays of light turning slowly behind the card
const RAYS_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv * vec2(1.0, 1.7);
  float r = length(p);
  float ang = atan(p.y, p.x);
  float rays = pow(abs(sin(ang * 7.0 + uTime * 0.35)), 5.0) * 0.75 + pow(abs(sin(ang * 4.0 - uTime * 0.22 + 0.8)), 9.0) * 0.55;
  float fall = smoothstep(1.0, 0.18, r);
  float a = (rays * fall * fall + exp(-r * r * 6.0) * 0.35) * uOpacity;
  gl_FragColor = vec4(uColor * 1.3 * a, a * 0.25);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class ExpressionCard {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    scene.add(this.group);

    this.accent = new THREE.Color(0xffc83d);
    // the sheen and (golden cards) the glitter, drawn on the face and the frame as light of their own
    this.finish = {
      uCardTime: { value: 0 },
      uSheen: { value: 0.3 },
      uGlitter: { value: 0 },
      uSheenColor: { value: new THREE.Color(1, 0.97, 0.9) },
      uFaceHalf: { value: new THREE.Vector2((W - BORDER * 2 + 0.06) / 2, (H - BORDER * 2 + 0.06) / 2) },
      uGold: { value: 0 },
    };
    this.frameMat = new THREE.MeshStandardMaterial({ color: 0xffc83d, roughness: 0.3, emissive: 0xffc83d, emissiveIntensity: 0.35 });
    this.frameMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.finish);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFramePos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFramePos = position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform float uCardTime;
uniform float uSheen;
uniform float uGold;
uniform vec3 uSheenColor;
varying vec3 vFramePos;`).replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  // light runs round the bezel: a band crossing it with the face's sheen, and on gold a shimmer
  float sweep = mix(-5.2, 5.2, smoothstep(0.0, 0.5, fract(uCardTime * 0.2)));
  float d = vFramePos.x + vFramePos.y * 0.8 - sweep;
  float band = exp(-d * d * 3.0);
  totalEmissiveRadiance += uSheenColor * band * uSheen * 0.9;
  float shimmer = pow(0.5 + 0.5 * sin(vFramePos.x * 3.1 - vFramePos.y * 2.0 + uCardTime * 2.4), 6.0);
  totalEmissiveRadiance += vec3(1.0, 0.86, 0.5) * shimmer * uGold * 0.7;
}`
      );
    };
    this.frameMat.customProgramCacheKey = () => 'pf-card-frame';
    // a little more of its own light and a little less of the sky's: the face keeps its cream colour
    // under a pink twilight or a blue night (the sky light tints everything else)
    this.faceMat = new THREE.MeshStandardMaterial({ color: 0xcfc6b6, roughness: 0.34, emissive: 0xfff1d6, emissiveIntensity: 0.62 });
    this.faceMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.finish);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCardPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCardPos = position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform float uCardTime;
uniform float uSheen;
uniform float uGlitter;
uniform vec3 uSheenColor;
uniform vec2 uFaceHalf;
varying vec3 vCardPos;
float cardRim() {
  // 0 in the middle of the face, 1 where it meets the frame
  vec2 q = abs(vCardPos.xy) - (uFaceHalf - 0.22);
  return smoothstep(0.0, 1.0, max(q.x, q.y) / 0.22);
}`).replace(
        '#include <color_fragment>',
        // enamel: lighter towards its top edge, like a softly curved, glazed tablet, and a soft shadow
        // inside the rim where the face sits deeper in its frame
        '#include <color_fragment>\ndiffuseColor.rgb *= (0.93 + 0.07 * smoothstep(-0.75, 0.75, vCardPos.y)) * (1.0 - 0.2 * cardRim());'
      ).replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  float front = smoothstep(0.02, 0.07, vCardPos.z);
  totalEmissiveRadiance *= 1.0 - 0.28 * cardRim();
  float glaze = smoothstep(0.3, 0.72, vCardPos.y);
  totalEmissiveRadiance += uSheenColor * glaze * glaze * 0.1 * front;
  // a diagonal band of light crosses the face in about two seconds, then rests
  float sweep = mix(-5.2, 5.2, smoothstep(0.0, 0.5, fract(uCardTime * 0.2)));
  float d = vCardPos.x + vCardPos.y * 0.8 - sweep;
  float band = exp(-d * d * 2.6) * 0.75 + exp(-d * d * 22.0) * 0.5;
  totalEmissiveRadiance += uSheenColor * band * uSheen * front;
  // glitter: tiny glints that come and go
  if (uGlitter > 0.0) {
    float g = sin(vCardPos.x * 57.0 + uCardTime * 2.9) * sin(vCardPos.y * 61.0 - uCardTime * 2.3) * sin((vCardPos.x - vCardPos.y) * 37.0 + uCardTime * 1.7);
    totalEmissiveRadiance += uSheenColor * pow(max(g, 0.0), 14.0) * uGlitter * front;
  }
}`
      );
    };
    this.faceMat.customProgramCacheKey = () => 'pf-card-face';
    const frame = new THREE.Mesh(bezelGeometry(W, H, 0.36, BORDER, FRAME_DEPTH), this.frameMat);
    frame.castShadow = true;
    // the face sits in the frame, a little behind its front edge
    const face = new THREE.Mesh(new RoundedBoxGeometry(W - BORDER * 2 + 0.06, H - BORDER * 2 + 0.06, FACE_DEPTH, 4, 0.07), this.faceMat);
    face.castShadow = true;

    this.canvas = document.createElement('canvas');
    this.canvas.width = TEX_W;
    this.canvas.height = TEX_H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.5, ((W - 0.5) * TEX_H) / TEX_W), new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false, depthWrite: false }));
    label.position.z = FACE_DEPTH / 2 + 0.006;
    label.renderOrder = 5;

    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffc83d, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.scale.set(W * 1.7, H * 3.2, 1);
    this.glow.position.z = -0.3;

    // little gems on the frame corners catch the light
    const gemGeo = new THREE.OctahedronGeometry(0.11, 0);
    this.gemMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.2, flatShading: true });
    this.gems = [];
    for (const sx of [-1, 1]) {
      const gem = new THREE.Mesh(gemGeo, this.gemMat);
      gem.position.set(sx * (W / 2 - 0.02), 0, 0.02);
      gem.scale.set(1, 1.5, 0.8);
      this.inner.add(gem);
      this.gems.push(gem);
    }

    // golden cards: light rays turning behind the card
    const plane = new THREE.PlaneGeometry(2, 2);
    this.raysU = { uColor: { value: new THREE.Color(0xffd77a) }, uOpacity: { value: 0 }, uTime: { value: 0 } };
    this.rays = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: this.raysU, vertexShader: QUAD_VERT, fragmentShader: RAYS_FRAG, transparent: true, depthWrite: false, ...GLOW_BLEND }));
    this.rays.scale.set(W * 0.78, W * 0.78, 1);
    this.rays.position.z = -0.45;
    this.rays.visible = false;
    this.golden = false;
    this.inner.add(this.rays, this.glow, frame, face, label);

    // a soft trail of light streaming up behind the card as it falls (in the group, so it stays upright)
    this.trailU = { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 }, uTime: { value: 0 } };
    this.trail = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: this.trailU, vertexShader: QUAD_VERT, fragmentShader: TRAIL_FRAG, transparent: true, depthWrite: false, ...GLOW_BLEND }));
    this.trail.position.z = -0.25;
    this.trail.renderOrder = -1;
    this.group.add(this.trail);

    // its shadow on the ground below, gathering as it comes closer
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x1a1030, transparent: true, opacity: 0, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    this.shadow.visible = false;
    scene.add(this.shadow);

    this.scale = 1;
    this.t = 0; // fall progress 0…1
    this.state = 'gone';
    this.age = 0;
    this.danger = 0;
    this.spawnY = 6;
    this.impactY = 2.6;
    this.z = 0.55;
    this.slamFrom = 0;
    this.slamT = 0;
    this.wob = 0;
    this.pos = this.group.position;
  }

  get halfWidth() {
    return (W / 2) * this.scale;
  }
  get halfHeight() {
    return (H / 2) * this.scale;
  }

  /**
   * Draw the expression, fitting it on one or two lines. A sense hint in brackets
   * ("pick up (a language)") goes on its own smaller, softer line underneath.
   * Twist cards: `kind` 'flip' / 'build' show a meaning, 'gap' a sentence with a
   * highlighted blank (up to three lines each), 'listen' a speaker.
   */
  _draw(text, kind = null) {
    const g = this.ctx;
    g.clearRect(0, 0, TEX_W, TEX_H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = INK;
    if (kind === 'listen') return this._drawListen();
    if (kind) return this._drawLong(text, kind === 'gap');
    const m = text.match(/^(.*\S)\s*\(([^()]+)\)$/);
    const main = m ? m[1] : text;
    const hint = m ? `(${m[2].trim()})` : '';
    const maxW = TEX_W - 110;
    let lines = [main];
    let size = hint ? 128 : 150;
    g.font = font(size);
    if (g.measureText(main).width > maxW && main.includes(' ') && main.length > 16) {
      // split at the space nearest the middle
      const mid = main.length / 2;
      let best = -1;
      for (let i = 0; i < main.length; i++) if (main[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
      lines = [main.slice(0, best), main.slice(best + 1)];
      size = hint ? 100 : 118;
    }
    for (;;) {
      g.font = font(size);
      const widest = Math.max(...lines.map((l) => g.measureText(l).width));
      if (widest <= maxW || size <= 56) break;
      size -= 4;
    }
    const lh = size * 1.06;
    const hintSize = hint ? Math.max(48, Math.round(size * 0.5)) : 0;
    const gap = hint ? size * 0.14 : 0;
    const blockH = lines.length * lh + gap + hintSize;
    const top = TEX_H / 2 - blockH / 2;
    lines.forEach((l, i) => g.fillText(l, TEX_W / 2, top + lh * (i + 0.5) + size * 0.04));
    if (hint) {
      g.font = font(hintSize, 600);
      g.fillStyle = HINT_INK;
      g.fillText(hint, TEX_W / 2, top + lines.length * lh + gap + hintSize / 2);
    }
    this.texture.needsUpdate = true;
  }

  /** A meaning or a sentence: the largest size that fits in at most three lines. A "___" becomes a coloured blank. */
  _drawLong(text, blank) {
    const g = this.ctx;
    const maxW = TEX_W - 120;
    let size = 92;
    let lines;
    for (;;) {
      g.font = font(size, 700);
      lines = wrap(g, text, maxW);
      if ((lines.length <= 2 && size <= 92) || (lines.length <= 3 && size <= 76) || size <= 46) break;
      size -= 4;
    }
    const lh = size * 1.12;
    const top = TEX_H / 2 - (lines.length * lh) / 2;
    lines.forEach((line, i) => {
      const y = top + lh * (i + 0.5) + size * 0.04;
      if (!blank || !line.includes('___')) {
        g.fillStyle = INK;
        g.fillText(line, TEX_W / 2, y);
        return;
      }
      // draw the line in pieces so the blank can stand out
      const parts = line.split('___');
      const blankW = size * 1.9;
      const widths = parts.map((p) => g.measureText(p).width);
      const total = widths.reduce((a, b) => a + b, 0) + blankW * (parts.length - 1);
      let x = TEX_W / 2 - total / 2;
      g.textAlign = 'left';
      parts.forEach((p, j) => {
        g.fillStyle = INK;
        g.fillText(p, x, y);
        x += widths[j];
        if (j < parts.length - 1) {
          g.fillStyle = BLANK_FILL;
          roundRect(g, x + size * 0.12, y - size * 0.5, blankW - size * 0.24, size * 0.98, size * 0.22);
          g.fill();
          g.fillStyle = BLANK_INK;
          g.fillRect(x + size * 0.22, y + size * 0.3, blankW - size * 0.44, Math.max(4, size * 0.07));
          x += blankW;
        }
      });
      g.textAlign = 'center';
    });
    this.texture.needsUpdate = true;
  }

  /** Listen cards: a speaker and its sound waves, and the word "Listen". */
  _drawListen() {
    const g = this.ctx;
    const cx = TEX_W / 2 - 170;
    const cy = TEX_H / 2;
    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(cx - 70, cy - 34);
    g.lineTo(cx - 30, cy - 34);
    g.lineTo(cx + 22, cy - 82);
    g.lineTo(cx + 22, cy + 82);
    g.lineTo(cx - 30, cy + 34);
    g.lineTo(cx - 70, cy + 34);
    g.closePath();
    g.fill();
    g.strokeStyle = INK;
    g.lineCap = 'round';
    g.lineWidth = 16;
    for (const r of [52, 92]) {
      g.beginPath();
      g.arc(cx + 30, cy, r, -0.85, 0.85);
      g.stroke();
    }
    g.font = font(120);
    g.textAlign = 'left';
    g.fillText('Listen', cx + 150, cy + 6);
    g.textAlign = 'center';
    this.texture.needsUpdate = true;
  }

  /** Bring a new expression in at the top of the fall zone. `golden`: a triple-points card; `kind`: a twist card's kind. */
  show(text, { scale, spawnY, impactY, accent, golden = false, kind = null }) {
    this._draw(text, kind);
    this.golden = golden;
    this.kind = kind;
    // golden: a rich gold face and a polished frame (the frame shimmers in update())
    this.frameMat.metalness = golden ? 0.7 : 0;
    this.frameMat.roughness = golden ? 0.2 : 0.3;
    this.finish.uSheen.value = golden ? 0.85 : 0.3;
    this.finish.uGlitter.value = golden ? 2.6 : 0;
    this.finish.uGold.value = golden ? 1 : 0;
    // twist cards: a soft tint of their own, so they read as different at a glance
    const face = golden ? 0xffdf86 : (kind && TWIST_FACE[kind]) || 0xfff6e3;
    this.faceMat.color.set(face).multiplyScalar(golden ? 1 : 0.8);
    this.faceMat.emissive.set(golden ? 0xffc94a : kind ? face : 0xfff1d6);
    this.faceMat.emissiveIntensity = golden ? 0.36 : 0.62;
    this.glow.scale.set(W * (golden ? 2.1 : 1.7), H * (golden ? 4 : 3.2), 1);
    this.rays.visible = golden;
    for (const gem of this.gems) gem.rotation.y = 0;
    this.scale = scale;
    this.spawnY = spawnY;
    this.impactY = impactY;
    this.accent.set(accent);
    this.t = 0;
    this.age = 0;
    this.danger = 0;
    this.wob = 0;
    this.state = 'in';
    this.group.visible = true;
    this.shadow.visible = true;
    this.group.position.set(0, spawnY, this.z);
    this.group.scale.setScalar(0.001);
    this.group.rotation.set(0, 0, 0);
    this._tint();
  }

  /** Stop falling (answered) — the card hangs where it is. */
  freeze() {
    if (this.state !== 'gone') this.state = 'frozen';
  }

  /** Accelerate into the character (wrong answer / time up), wobbling as it goes. */
  slam() {
    this.state = 'slam';
    this.slamFrom = this.group.position.y;
    this.slamT = 0;
    this.wob = 1;
  }

  hide() {
    this.state = 'gone';
    this.group.visible = false;
    this.shadow.visible = false;
    this.rays.visible = false;
  }

  _tint() {
    const d = this.danger;
    this.frameMat.color.copy(this.accent).lerp(DANGER, d);
    this.frameMat.emissive.copy(this.frameMat.color);
    this.glow.material.color.copy(this.frameMat.color);
    this.gemMat.emissive.copy(this.frameMat.color);
    this.trailU.uColor.value.copy(this.frameMat.color).lerp(_white, this.golden ? 0.12 : 0.2);
  }

  /**
   * @param {number} dt
   * @param {number} fallTime seconds for a full fall
   * @returns {'falling' | 'landed' | null}
   */
  update(dt, fallTime) {
    if (this.state === 'gone') return null;
    this.age += dt;
    this.finish.uCardTime.value = this.age * (this.golden ? 1.6 : 1) + 1.2;
    const g = this.group;
    const a = this.age;
    let result = null;
    let speed = 0;

    if (this.state === 'in' || this.state === 'fall') {
      this.t = Math.min(1, this.t + dt / fallTime);
      g.position.y = this.spawnY + (this.impactY - this.spawnY) * this.t;
      speed = fallTime > 0 && Number.isFinite(fallTime) ? (this.spawnY - this.impactY) / fallTime : 0;
      if (this.state === 'in' && a > 0.3) this.state = 'fall';
      if (this.t >= 1) result = 'landed';
      else result = 'falling';
    } else if (this.state === 'slam') {
      this.slamT += dt / 0.24;
      const u = Math.min(1, this.slamT);
      g.position.y = this.slamFrom + (this.impactY - this.slamFrom) * ease.inCubic(u);
      speed = 3 * (this.slamFrom - this.impactY) * u * u / 0.24;
      if (u >= 1) result = 'landed';
    }

    // pop in with a little overshoot; a wrong answer's wobble squashes it as it drops
    const pop = a < 0.3 ? ease.outBack(clamp(a / 0.3)) : 1;
    this.wob = Math.max(0, this.wob - dt * 3.2);
    const wob = this.wob * this.wob;
    const sq = Math.sin(a * 38) * 0.07 * wob;
    g.scale.set(this.scale * pop * (1 + sq), this.scale * pop * (1 - sq), this.scale * pop);

    // danger colour + tremble as it nears the ground
    const d = this.state === 'slam' ? 1 : clamp((this.t - 0.6) / 0.33);
    if (Math.abs(d - this.danger) > 0.01) {
      this.danger = d;
      this._tint();
    }
    const pulse = 0.5 + 0.5 * Math.sin(a * (5 + d * 9));
    if (this.golden) {
      // a slow shimmer, and the corner gems spin
      const shimmer = 0.5 + 0.5 * Math.sin(a * 3.2);
      // bright enough to bloom: the gold frame breathes a soft glow
      this.frameMat.emissiveIntensity = 0.9 + shimmer * 0.9 + d * 0.6;
      this.glow.material.opacity = 0.6 + shimmer * 0.25 + d * 0.2;
      this.gemMat.emissiveIntensity = 1.8 + shimmer * 1.8;
      for (const gem of this.gems) gem.rotation.y = a * 3;
      this.raysU.uTime.value = a;
      this.raysU.uOpacity.value = Math.min(1, a * 2.5) * (0.55 + 0.2 * shimmer) * (this.state === 'frozen' ? 0.6 : 1);
    } else {
      this.frameMat.emissiveIntensity = 0.32 + d * (0.5 + pulse * 0.6);
      this.glow.material.opacity = 0.42 + pulse * 0.1 + d * 0.3;
      this.gemMat.emissiveIntensity = 0.9;
    }
    const shake = d * d * 0.045;
    g.position.x = (Math.sin(a * 0.9) * 0.14 * (1 - d) + Math.sin(a * 47) * shake) * this.scale;
    this.inner.rotation.set(-0.05 + Math.sin(a * 1.1) * 0.035, Math.sin(a * 0.8) * 0.11, Math.sin(a * 1.3) * 0.028 + Math.sin(a * 53) * shake * 0.6 + Math.sin(a * 31) * 0.16 * wob);

    // the trail: longer the faster it falls, fading once it stops
    const falling = this.state === 'in' || this.state === 'fall' || this.state === 'slam';
    const len = 2.6 + Math.min(3, speed * 1.1) + (this.golden ? 1.2 : 0);
    const want = falling ? (this.golden ? 1 : 0.7) * Math.min(1, a * 3) : 0;
    const tu = this.trailU;
    tu.uOpacity.value += (want - tu.uOpacity.value) * Math.min(1, dt * 8);
    tu.uTime.value = a;
    this.trail.visible = tu.uOpacity.value > 0.01;
    this.trail.scale.set(W * 0.44, len / 2, 1);
    this.trail.position.y = H / 2 + len / 2 - 0.05;

    // the shadow on the ground: faint and wide high up, darker and tighter as the card comes down
    const near = clamp((this.spawnY - g.position.y) / Math.max(0.01, this.spawnY - this.impactY));
    const sh = this.shadow;
    sh.position.set(g.position.x, 0.025, this.z + 0.1);
    const spread = 1.35 - near * 0.4;
    sh.scale.set(W * this.scale * 0.95 * spread, H * this.scale * 1.15 * spread, 1);
    sh.material.opacity = (0.06 + near * near * 0.26) * pop;
    return result;
  }
}
