/**
 * Stage — renderer, scene, camera and the frame loop.
 *
 * The camera is driven by "shots": { focus, yaw, pitch, span, ox, oy }.
 *   focus   world point the camera looks at
 *   yaw     orbit angle around the focus (0 = straight on)
 *   pitch   elevation angle
 *   span    world units visible across the full viewport height (zoom)
 *   ox, oy  where the focus sits on screen, in CSS px from the centre (+x right, +y down)
 * Screens ask for a shot and the stage glides between them, so moving through
 * the menus feels like one continuous camera move rather than page changes.
 */
import * as THREE from 'three';
import { clamp, ease, lerp } from './utils.js';

const QUALITY = {
  high: { maxPixelRatio: 2, shadow: 2048 },
  medium: { maxPixelRatio: 1.5, shadow: 1024 },
  low: { maxPixelRatio: 1, shadow: 0 },
};

const SHOT_KEYS = ['fx', 'fy', 'fz', 'yaw', 'pitch', 'span', 'ox', 'oy', 'drift'];
const FOV = 32;

export function autoQuality() {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const small = Math.min(screen.width, screen.height) < 500;
  if (coarse) return cores <= 4 && small ? 'low' : 'medium';
  return cores <= 2 ? 'medium' : 'high';
}

export class Stage {
  constructor(canvas, { quality = 'auto', adaptive = true, resScale = 1 } = {}) {
    this.canvas = canvas;
    this.qualityName = quality === 'auto' ? autoQuality() : quality;
    this.quality = QUALITY[this.qualityName] ?? QUALITY.medium;
    this.adaptive = adaptive;

    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false }));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x1b1440, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 700);
    this.scene.add(this.camera);

    this.width = 1;
    this.height = 1;
    this.resScale = resScale;
    this.pixelRatio = 1;
    this.time = 0;
    this.paused = false;
    this.running = false;
    this.listeners = [];
    this.resizeListeners = [];

    this.shot = { fx: 0, fy: 1, fz: 0, yaw: 0, pitch: 0.1, span: 6, ox: 0, oy: 0, drift: 0 };
    this._from = { ...this.shot };
    this._to = { ...this.shot };
    this._tweenT = 1;
    this._tweenDur = 1;
    this._shake = 0;
    this._shakeDur = 0.3;
    this._shakeAmt = 0;
    this.reduceMotion = false;
    this._focus = new THREE.Vector3();

    this._frameMs = 16;
    this._adaptT = 0;
    this._last = 0;
    this._loop = this._loop.bind(this);

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this.resize);
    this.resize();
  }

  setQuality(name) {
    this.qualityName = name === 'auto' ? autoQuality() : name;
    this.quality = QUALITY[this.qualityName] ?? QUALITY.medium;
    if (this.adaptive) this.resScale = 1;
    this.resize();
    for (const fn of this.resizeListeners) fn(this);
  }

  onUpdate(fn) {
    this.listeners.push(fn);
  }

  onResize(fn) {
    this.resizeListeners.push(fn);
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.width = w;
    this.height = h;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio) * this.resScale;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const fn of this.resizeListeners) fn(this);
  }

  // ── camera shots ────────────────────────────────────────────────────────
  /** Glide to a shot over `seconds` (0 = cut). */
  setShot(target, seconds = 0.9) {
    const to = { ...this._to, ...target };
    if (seconds <= 0) {
      Object.assign(this.shot, to);
      this._to = to;
      this._tweenT = 1;
      return;
    }
    this._from = { ...this.shot };
    this._to = to;
    this._tweenT = 0;
    this._tweenDur = seconds;
  }

  /** Screen shake in CSS px. */
  shake(amount = 10, seconds = 0.35) {
    if (this.reduceMotion) amount *= 0.2;
    this._shakeAmt = amount;
    this._shakeDur = seconds;
    this._shake = seconds;
  }

  _applyCamera(dt) {
    if (this._tweenT < 1) {
      this._tweenT = Math.min(1, this._tweenT + dt / this._tweenDur);
      const e = ease.inOutCubic(this._tweenT);
      for (const k of SHOT_KEYS) this.shot[k] = lerp(this._from[k], this._to[k], e);
    }
    const s = this.shot;
    const t = this.time;
    const drift = this.reduceMotion ? 0 : s.drift;
    const yaw = s.yaw + Math.sin(t * 0.21) * 0.07 * drift;
    const pitch = s.pitch + Math.sin(t * 0.17 + 1) * 0.015 * drift;
    const dist = s.span / (2 * Math.tan((FOV * Math.PI) / 360));
    const f = this._focus.set(s.fx, s.fy + Math.sin(t * 0.33) * 0.03 * drift, s.fz);
    this.camera.position.set(f.x + Math.sin(yaw) * Math.cos(pitch) * dist, f.y + Math.sin(pitch) * dist, f.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    this.camera.lookAt(f);

    let sx = 0;
    let sy = 0;
    if (this._shake > 0) {
      this._shake = Math.max(0, this._shake - dt);
      const k = (this._shake / this._shakeDur) ** 2 * this._shakeAmt;
      sx = Math.sin(t * 71) * k;
      sy = Math.cos(t * 93) * k;
    }
    this.camera.setViewOffset(this.width, this.height, -s.ox - sx, -s.oy - sy, this.width, this.height);
  }

  /** Project a world position to CSS pixels. */
  toScreen(v, out = { x: 0, y: 0, visible: true }) {
    const p = _v.copy(v).project(this.camera);
    out.x = (p.x * 0.5 + 0.5) * this.width;
    out.y = (-p.y * 0.5 + 0.5) * this.height;
    out.visible = p.z < 1;
    return out;
  }

  /** Visible world width / height at the focus distance for the current target shot. */
  worldPerPixel(span = this._to.span) {
    return span / this.height;
  }

  // ── loop ────────────────────────────────────────────────────────────────
  /** Advance the simulation without rendering (automated tests, slow machines). */
  fastForward(seconds, step = 1 / 30) {
    for (let t = 0; t < seconds; t += step) {
      this.time += step;
      for (const fn of this.listeners) fn(step, this.time);
      this._applyCamera(step);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    requestAnimationFrame(this._loop);
  }

  _loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this._loop);
    const raw = (now - this._last) / 1000;
    this._last = now;
    if (document.hidden) return;
    const dt = clamp(raw, 0, 0.05);
    this.time += dt;
    for (const fn of this.listeners) fn(dt, this.time);
    this._applyCamera(dt);
    this.renderer.render(this.scene, this.camera);

    if (this.adaptive && raw < 0.25) {
      // dynamic resolution: trade sharpness for a steady frame rate on weak GPUs
      this._frameMs = lerp(this._frameMs, raw * 1000, 0.08);
      this._adaptT += raw;
      if (this._adaptT > 1.5) {
        this._adaptT = 0;
        const before = this.resScale;
        if (this._frameMs > 24 && this.resScale > 0.55) this.resScale = Math.max(0.55, this.resScale - 0.12);
        else if (this._frameMs < 13.5 && this.resScale < 1) this.resScale = Math.min(1, this.resScale + 0.06);
        if (before !== this.resScale) {
          this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio) * this.resScale;
          this.renderer.setPixelRatio(this.pixelRatio);
          this.renderer.setSize(this.width, this.height, false);
        }
      }
    }
  }
}

const _v = new THREE.Vector3();
