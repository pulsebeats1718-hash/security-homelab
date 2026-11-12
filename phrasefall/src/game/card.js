/**
 * ExpressionCard — the glowing tablet that carries an expression down from the sky.
 * One instance is reused for every expression.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeGlowTexture } from '../world/sky.js';
import { clamp, ease } from '../core/utils.js';

const W = 6;
const H = 1.7;
const TEX_W = 1280;
const TEX_H = 320;
const INK = '#1a1446';
const DANGER = new THREE.Color(0xff5068);

export class ExpressionCard {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    scene.add(this.group);

    this.accent = new THREE.Color(0xffc83d);
    this.frameMat = new THREE.MeshStandardMaterial({ color: 0xffc83d, roughness: 0.4, emissive: 0xffc83d, emissiveIntensity: 0.35 });
    this.faceMat = new THREE.MeshStandardMaterial({ color: 0xfff6e3, roughness: 0.6, emissive: 0xfff1d6, emissiveIntensity: 0.5 });
    const frame = new THREE.Mesh(new RoundedBoxGeometry(W, H, 0.2, 5, 0.36), this.frameMat);
    frame.castShadow = true;
    const face = new THREE.Mesh(new RoundedBoxGeometry(W - 0.26, H - 0.26, 0.25, 5, 0.25), this.faceMat);

    this.canvas = document.createElement('canvas');
    this.canvas.width = TEX_W;
    this.canvas.height = TEX_H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.5, ((W - 0.5) * TEX_H) / TEX_W), new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false, depthWrite: false }));
    label.position.z = 0.131;
    label.renderOrder = 5;

    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffc83d, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.scale.set(W * 1.7, H * 3.2, 1);
    this.glow.position.z = -0.3;

    // little gems on the frame corners catch the light
    const gemGeo = new THREE.OctahedronGeometry(0.11, 0);
    this.gemMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.2, flatShading: true });
    for (const sx of [-1, 1]) {
      const gem = new THREE.Mesh(gemGeo, this.gemMat);
      gem.position.set(sx * (W / 2 - 0.02), 0, 0.02);
      gem.scale.set(1, 1.5, 0.8);
      this.inner.add(gem);
    }
    this.inner.add(this.glow, frame, face, label);

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
    this.pos = this.group.position;
  }

  get halfWidth() {
    return (W / 2) * this.scale;
  }
  get halfHeight() {
    return (H / 2) * this.scale;
  }

  /** Draw the expression, fitting it on one or two lines. */
  _draw(text) {
    const g = this.ctx;
    g.clearRect(0, 0, TEX_W, TEX_H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = INK;
    const font = (px) => `700 ${px}px "Fredoka Variable", "Fredoka", "Nunito Variable", system-ui, sans-serif`;
    const maxW = TEX_W - 110;
    let lines = [text];
    let size = 150;
    g.font = font(size);
    if (g.measureText(text).width > maxW && text.includes(' ') && text.length > 16) {
      // split at the space nearest the middle
      const mid = text.length / 2;
      let best = -1;
      for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
      lines = [text.slice(0, best), text.slice(best + 1)];
      size = 118;
    }
    for (;;) {
      g.font = font(size);
      const widest = Math.max(...lines.map((l) => g.measureText(l).width));
      if (widest <= maxW || size <= 56) break;
      size -= 4;
    }
    const lh = size * 1.06;
    const y0 = TEX_H / 2 - ((lines.length - 1) * lh) / 2 + size * 0.04;
    lines.forEach((l, i) => g.fillText(l, TEX_W / 2, y0 + i * lh));
    this.texture.needsUpdate = true;
  }

  /** Bring a new expression in at the top of the fall zone. */
  show(text, { scale, spawnY, impactY, accent }) {
    this._draw(text);
    this.scale = scale;
    this.spawnY = spawnY;
    this.impactY = impactY;
    this.accent.set(accent);
    this.t = 0;
    this.age = 0;
    this.danger = 0;
    this.state = 'in';
    this.group.visible = true;
    this.group.position.set(0, spawnY, this.z);
    this.group.scale.setScalar(0.001);
    this._tint();
  }

  /** Stop falling (answered) — the card hangs where it is. */
  freeze() {
    if (this.state !== 'gone') this.state = 'frozen';
  }

  /** Accelerate into the character (wrong answer / time up). */
  slam() {
    this.state = 'slam';
    this.slamFrom = this.group.position.y;
    this.slamT = 0;
  }

  hide() {
    this.state = 'gone';
    this.group.visible = false;
  }

  _tint() {
    const d = this.danger;
    this.frameMat.color.copy(this.accent).lerp(DANGER, d);
    this.frameMat.emissive.copy(this.frameMat.color);
    this.glow.material.color.copy(this.frameMat.color);
    this.gemMat.emissive.copy(this.frameMat.color);
  }

  /**
   * @param {number} dt
   * @param {number} fallTime seconds for a full fall
   * @returns {'falling' | 'landed' | null}
   */
  update(dt, fallTime) {
    if (this.state === 'gone') return null;
    this.age += dt;
    const g = this.group;
    const a = this.age;
    let result = null;

    if (this.state === 'in' || this.state === 'fall') {
      this.t = Math.min(1, this.t + dt / fallTime);
      g.position.y = this.spawnY + (this.impactY - this.spawnY) * this.t;
      if (this.state === 'in' && a > 0.3) this.state = 'fall';
      if (this.t >= 1) result = 'landed';
      else result = 'falling';
    } else if (this.state === 'slam') {
      this.slamT += dt / 0.24;
      const u = Math.min(1, this.slamT);
      g.position.y = this.slamFrom + (this.impactY - this.slamFrom) * ease.inCubic(u);
      if (u >= 1) result = 'landed';
    }

    // pop in with a little overshoot
    const pop = a < 0.3 ? ease.outBack(clamp(a / 0.3)) : 1;
    g.scale.setScalar(this.scale * pop);

    // danger colour + tremble as it nears the ground
    const d = this.state === 'slam' ? 1 : clamp((this.t - 0.6) / 0.33);
    if (Math.abs(d - this.danger) > 0.01) {
      this.danger = d;
      this._tint();
    }
    const pulse = 0.5 + 0.5 * Math.sin(a * (5 + d * 9));
    this.frameMat.emissiveIntensity = 0.32 + d * (0.5 + pulse * 0.6);
    this.glow.material.opacity = 0.42 + pulse * 0.1 + d * 0.3;
    const shake = d * d * 0.045;
    g.position.x = (Math.sin(a * 0.9) * 0.14 * (1 - d) + Math.sin(a * 47) * shake) * this.scale;
    this.inner.rotation.set(-0.05 + Math.sin(a * 1.1) * 0.035, Math.sin(a * 0.8) * 0.11, Math.sin(a * 1.3) * 0.028 + Math.sin(a * 53) * shake * 0.6);
    return result;
  }
}
