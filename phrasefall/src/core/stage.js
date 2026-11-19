/**
 * Stage — renderer, scene, camera and the frame loop.
 *
 * The camera is driven by "shots": { focus, yaw, pitch, span, ox, oy }.
 *   focus   world point the camera looks at
 *   yaw     orbit angle around the focus (0 = straight on)
 *   pitch   elevation angle
 *   span    world units visible across the full viewport height (zoom)
 *   ox, oy  where the focus sits on screen, in CSS px from the centre (+x right, +y down)
 *   tilt    (optional, 0…1) how much tilt-shift blur the shot wants — menus use it for a
 *           miniature look; high quality only, and a shot that leaves it out gets none
 * Screens ask for a shot and the stage glides between them, so moving through
 * the menus feels like one continuous camera move rather than page changes.
 *
 * Quality tiers: high and medium render through PostFX (core/post.js: MSAA HDR target, bloom,
 * grading; tilt-shift on high); low renders straight to the screen as it always has.
 */
import * as THREE from 'three';
import { clamp, ease, lerp } from './utils.js';
import { PostFX, postSupported } from './post.js';

export const QUALITY = {
  high: { maxPixelRatio: 2, shadow: 2048, shadowRadius: 3.2, post: { samples: 4, bloomDiv: 2, bloomLevels: 5, tilt: true } },
  medium: { maxPixelRatio: 1.5, shadow: 1024, shadowRadius: 1.6, post: { samples: 4, bloomDiv: 4, bloomLevels: 4, tilt: false } },
  low: { maxPixelRatio: 1, shadow: 0, shadowRadius: 1, post: null },
};

const SHOT_KEYS = ['fx', 'fy', 'fz', 'yaw', 'pitch', 'span', 'ox', 'oy', 'drift', 'tilt'];
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

    this.shot = { fx: 0, fy: 1, fz: 0, yaw: 0, pitch: 0.1, span: 6, ox: 0, oy: 0, drift: 0, tilt: 0 };
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

    /** the high / medium finish (null on low, or where the device cannot run it) */
    this.post = null;
    this._postChecked = false;
    this._syncPost();

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
    this._syncPost();
    this.resize();
    for (const fn of this.resizeListeners) fn(this);
  }

  /** Build, retune or drop the post finish for the current tier. */
  _syncPost() {
    const tier = this.quality.post;
    if (!tier || !postSupported(this.renderer)) {
      this.post?.dispose();
      this.post = null;
      return;
    }
    if (this.post) this.post.setTier(tier);
    else this.post = new PostFX(this.renderer, tier);
    this._postChecked = false;
  }

  /** True when frames go through the post finish (the scene then renders linear, untone-mapped). */
  get postActive() {
    return !!this.post?.ok;
  }

  /**
   * Compile the shaders `object` needs ahead of time, for the target the scene really renders into
   * (tone mapping and output colour space are part of a program, so they must match).
   */
  compile(object, scene = this.scene) {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.postActive ? this.post.scene : null);
    r.compile(object, this.camera, scene);
    r.setRenderTarget(prev);
  }

  /** Render one frame of the scene (through the finish on high / medium). */
  renderFrame() {
    const post = this.post;
    if (post?.ok) {
      post.tilt.amount = this.shot.tilt;
      if (post.tilt.amount > 0.004) {
        // keep the focus band on the shot's subject wherever the shot puts it on screen
        const p = _v.copy(this._focus).project(this.camera);
        post.tilt.focus = clamp(p.y * 0.5 + 0.5, 0.15, 0.85);
        // the sharp band covers the character (about 2.6 units tall) whatever the zoom
        post.tilt.band = clamp(1.3 / this.shot.span, 0.1, 0.4);
      }
      post.render(this.scene, this.camera);
      if (!this._postChecked) {
        // a device that cannot multisample a half-float target falls back to the direct path
        this._postChecked = true;
        if (!post.check()) {
          console.warn('Phrasefall: post-processing is not available on this device; rendering directly.');
          post.dispose();
          this.post = null;
          for (const fn of this.resizeListeners) fn(this);
        }
      }
      return;
    }
    this.renderer.render(this.scene, this.camera);
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
    this._sizePost();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const fn of this.resizeListeners) fn(this);
  }

  _sizePost() {
    if (!this.post) return;
    const size = this.renderer.getDrawingBufferSize(_size);
    this.post.setSize(size.x, size.y);
  }

  // ── camera shots ────────────────────────────────────────────────────────
  /** Glide to a shot over `seconds` (0 = cut). */
  setShot(target, seconds = 0.9) {
    const to = { ...this._to, ...target, tilt: target.tilt ?? 0 };
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
    this.renderFrame();

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
          this._sizePost();
        }
      }
    }
  }
}

const _v = new THREE.Vector3();
const _size = new THREE.Vector2();
