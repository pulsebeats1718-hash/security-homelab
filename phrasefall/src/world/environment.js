/**
 * Environment — lights, sky, island, clouds and the theme system that blends
 * between times of day as the player climbs through the stages, plus the place
 * the island has travelled to (Home Island, London, New York, Sydney) and the
 * season it is dressed for (spring, summer, autumn, winter).
 */
import * as THREE from 'three';
import { THEMES, COLOR_KEYS, NUMBER_KEYS } from './themes.js';
import { SkyLight } from './skylight.js';
import { patchAtmosphere } from './atmosphere.js';
import { Sky, makeGlowTexture } from './sky.js';
import { Island } from './island.js';
import { Places } from './places/index.js';
import { Seasons } from './seasons/index.js';
import { Clouds, Motes } from './clouds.js';
import { rimShared, toyFinish } from '../characters/kit/materials.js';
import { ease, lerp } from '../core/utils.js';

patchAtmosphere();

/** Where the shadow-casting scenery lives: the island's top and what stands on it (radius, depth, height). */
const SHADOW_SPACE = { r: 7.0, depth: 0.86, low: -0.5, high: 6.5 };

const dirFrom = ([az, el], out) => {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
};

export class Environment {
  constructor(stage) {
    this.stage = stage;
    const scene = stage.scene;
    const q = stage.qualityName;

    toyFinish.level = q; // characters made from now on get the finish of this tier
    scene.fog = new THREE.FogExp2(0xffd9c0, 0.011);
    // image-based light from a gradient sky in the theme's colours (rebuilt when the colours settle)
    this.skyLight = new SkyLight(stage.renderer);
    this._envDue = true;
    this._envMid = false;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.8);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.castShadow = stage.quality.shadow > 0;
    if (stage.quality.shadow) this.sun.shadow.mapSize.set(stage.quality.shadow, stage.quality.shadow);
    Object.assign(this.sun.shadow.camera, { left: -9, right: 9, top: 10, bottom: -8, near: 1, far: 70 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = stage.quality.shadowRadius ?? 1;
    scene.add(this.sun, this.sun.target);

    this.rim = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(this.rim, this.rim.target);

    this.sky = new Sky(scene);
    this.island = new Island(scene, { quality: q });
    this.places = new Places(scene, this.island, { quality: q });
    this.seasons = new Seasons(scene, this.island, this.places, q);
    this.clouds = new Clouds(scene, { quality: q });
    this.motes = new Motes(scene, { quality: q });

    // soft contact shadow under the character: the only shadow when real shadows are off, and a
    // touch of ambient occlusion that grounds the toy on the dais when they are on
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 24),
      new THREE.MeshBasicMaterial({ map: makeGlowTexture(), color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.012;
    this._blobLook();
    scene.add(this.blob);

    this.themeName = 'sunrise';
    this.v = {};
    /** the theme values tinted for the season (what the lights, sky and scenery actually use) */
    this.vs = {};
    this._from = {};
    this._to = THEMES.sunrise;
    this._mix = 1;
    this._dur = 1;
    this._sunDir = new THREE.Vector3();
    this._skySun = new THREE.Vector3();
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    for (const k of COLOR_KEYS) this.v[k] = new THREE.Color(THEMES.sunrise[k]);
    for (const k of NUMBER_KEYS) this.v[k] = THEMES.sunrise[k];
    dirFrom(THEMES.sunrise.sun, this._sunDir);
    dirFrom(THEMES.sunrise.skySun, this._skySun);
    this._fromSun = this._sunDir.clone();
    this._fromSky = this._skySun.clone();
    this._rimView = new THREE.Vector3();
    this._apply();
    this.setPlace('home', { instant: true });
  }

  _blobLook() {
    const shadows = this.stage.quality.shadow > 0;
    this.blob.material.opacity = shadows ? 0.2 : 0.38;
    this.blob.scale.setScalar(shadows ? 0.82 : 1);
  }

  /**
   * Fit the sun's shadow camera tightly round the island for the current sun direction, so its
   * texels are spent where the characters and props are (crisper contact shadows), with the depth
   * range only as deep as the scenery.
   */
  _fitShadow() {
    const cam = this.sun.shadow.camera;
    // the shadow camera's own axes (it sits out along the sun direction looking back at the origin)
    const z = _a.copy(this._sunDir).normalize();
    const x = _b.set(0, 1, 0).cross(z).normalize();
    const y = _c3.copy(z).cross(x);
    const { r, depth, low, high } = SHADOW_SPACE;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      for (const h of [low, high]) {
        _p.set(Math.cos(a) * r, h, Math.sin(a) * r * depth);
        const px = _p.dot(x);
        const py = _p.dot(y);
        const pz = _p.dot(z);
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
        z0 = Math.min(z0, pz);
        z1 = Math.max(z1, pz);
      }
    }
    const d = 32; // the sun sits 32 units out along its direction: depth along the view is d − p·z
    Object.assign(cam, { left: x0 - 0.3, right: x1 + 0.3, top: y1 + 0.3, bottom: y0 - 0.3, near: Math.max(0.5, d - z1 - 1.5), far: d - z0 + 1.5 });
    cam.updateProjectionMatrix();
  }

  /**
   * Move the island to a place (ids in src/data/places.js; unknown ids mean home). Each place is
   * built the first time it is visited. Not instant: a ~1.1 s celebration — the old scenery sinks
   * away and the new one pops up. Safe to call repeatedly or mid-transition.
   */
  setPlace(id, { instant = false } = {}) {
    this.places.set(id, { instant });
  }

  /** Id of the current place. */
  get place() {
    return this.places.current;
  }

  /**
   * Optional: build a place and compile its shaders ahead of time without showing it, so the first
   * trip there starts without a hitch (building a city takes ~0.1 s on a desktop, more on phones).
   */
  preparePlace(id) {
    const e = this.places.prepare(id);
    if (e) this.stage.compile(e.place.group);
  }

  /**
   * Dress the world for a season: 'spring' | 'summer' | 'autumn' | 'winter' (unknown ids mean
   * autumn). Not instant: blends over ~1.6 s. Safe to call repeatedly, before or after setPlace;
   * the season stays when the place changes.
   */
  setSeason(season, { instant = false } = {}) {
    this.seasons.set(season, { instant });
    if (instant) {
      this._envDue = true;
      this._apply();
    }
  }

  /** Id of the current season. */
  get season() {
    return this.seasons.current;
  }

  /**
   * Let the current place spawn its ambient particles (petals, leaves, steam …). Call once a frame.
   * (The season's own particles — leaves, snow, petals, butterflies — run by themselves on the GPU.)
   */
  ambient(fx, dt, quality = this.stage.qualityName) {
    this.places.ambient(fx, dt, quality, this.seasons.current);
  }

  /** Blend to a theme over `seconds`. */
  setTheme(name, seconds = 2.6) {
    const to = THEMES[name];
    if (!to) return;
    this.themeName = name;
    if (seconds <= 0) {
      for (const k of COLOR_KEYS) this.v[k].set(to[k]);
      for (const k of NUMBER_KEYS) this.v[k] = to[k];
      dirFrom(to.sun, this._sunDir);
      dirFrom(to.skySun, this._skySun);
      this._to = to;
      this._mix = 1;
      this._envDue = true;
      this._apply();
      return;
    }
    for (const k of COLOR_KEYS) this._from[k] = this.v[k].clone();
    for (const k of NUMBER_KEYS) this._from[k] = this.v[k];
    this._fromSun.copy(this._sunDir);
    this._fromSky.copy(this._skySun);
    this._to = to;
    this._mix = 0;
    this._dur = seconds;
    this._envMid = false;
  }

  /** Re-read the stage quality (shadows on / off, shadow resolution and softness). */
  setQuality() {
    toyFinish.level = this.stage.qualityName;
    const size = this.stage.quality.shadow;
    this.sun.castShadow = size > 0;
    this.sun.shadow.radius = this.stage.quality.shadowRadius ?? 1;
    this._blobLook();
    if (size && this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this._apply(); // fog colour and grade depend on whether the post finish is on
  }

  /** Temporarily brighten / dim everything (game-over desaturation, flashes). */
  setDim(amount) {
    this.dim = amount;
  }

  /** Rebuild the sky's image-based light from the current (season-tinted) colours, if they changed. */
  _env() {
    this.stage.scene.environment = this.skyLight.update(this.vs, this._skySun);
    this._envDue = false;
  }

  /** The post finish's grade follows the time of day: warmer at golden hour, cooler and deeper at night. */
  _grade() {
    const post = this.stage.post;
    if (!post) return;
    const v = this.vs;
    const night = Math.min(1, v.stars ?? 0);
    const warm = Math.max(0, (v.cloudGlowAmt ?? 0) - 0.12) * (1 - night);
    const u = post.uFinal;
    u.uHighTint.value.set(0.016 + warm * 0.03, 0.006 + warm * 0.008, -0.012 - warm * 0.02);
    u.uShadowTint.value.set(-0.006 - night * 0.004, 0.0, 0.016 + night * 0.018);
    u.uVibrance.value = 0.22 + warm * 0.12 - night * 0.05;
    u.uContrast.value = 0.2 - night * 0.12;
    u.uLift.value.set(0.012, 0.008 + night * 0.008, 0.024 + night * 0.02);
    u.uVignette.value.x = 0.32 + night * 0.06;
    post.bloom.strength = 0.7 + night * 0.25;
  }

  _apply() {
    const v = this.seasons.tint(this.v, this.vs);
    const scene = this.stage.scene;
    const dim = 1 - (this.dim ?? 0) * 0.45;
    scene.fog.color.copy(v.fog);
    // three mixes fog in after the output conversion when drawing straight to the screen, so the
    // themes' fog colours were tuned as if sRGB: the linear post path gets the same look from this
    if (this.stage.postActive) scene.fog.color.convertSRGBToLinear();
    scene.fog.density = v.fogDensity;
    if (this._envDue || !scene.environment) this._env();
    // the sky light carries the sky's own brightness: scale it so a night sky still gives a soft
    // moonlit fill (and a bright noon sky does not flood everything)
    const envLum = 0.4 * lum(v.skyTop) + 0.4 * lum(v.skyHorizon) + 0.2 * lum(v.hemiGround);
    scene.environmentIntensity = v.env * dim * Math.min(14, Math.max(0.8, ENV_LEVEL / Math.max(envLum, 1e-3)));
    this.stage.renderer.toneMappingExposure = v.exposure * dim;
    this.hemi.color.copy(v.hemiSky);
    this.hemi.groundColor.copy(v.hemiGround);
    this.hemi.intensity = v.hemiIntensity;
    this.sun.color.copy(v.sunLight);
    this.sun.intensity = v.sunIntensity;
    this.sun.position.copy(this._sunDir).multiplyScalar(32);
    this.sun.target.position.set(0, 0, 0);
    this.rim.color.copy(v.rim);
    this.rim.intensity = v.rimIntensity;
    this.rim.position.copy(this._skySun).multiplyScalar(30).setY(Math.max(6, this._skySun.y * 30));
    rimShared.color.value.copy(v.rim);
    rimShared.boost.value = 1.3; // the rim is directional now (bright on the sun's side): a touch more of it
    this._fitShadow();
    this._grade();
    this.sky.apply(v, this._skySun);
    this.island.apply(v);
    this.places.apply(v);
    this.clouds.apply(v, this._sunDir, this._skySun);
    this.motes.apply(v);
  }

  update(dt, t) {
    const seasonBlend = this.seasons.blending;
    let dirty = seasonBlend;
    if (this._mix < 1) {
      this._mix = Math.min(1, this._mix + dt / this._dur);
      const e = ease.inOutCubic(this._mix);
      const to = this._to;
      const c = _c;
      for (const k of COLOR_KEYS) this.v[k].copy(this._from[k]).lerp(c.set(to[k]), e);
      for (const k of NUMBER_KEYS) this.v[k] = lerp(this._from[k], to[k], e);
      this._sunDir.copy(this._fromSun).lerp(dirFrom(to.sun, this._a), e).normalize();
      this._skySun.copy(this._fromSky).lerp(dirFrom(to.skySun, this._b), e).normalize();
      dirty = true;
      // the sky light is rebuilt half-way through a blend and once it settles, never every frame
      if (!this._envMid && this._mix >= 0.5) {
        this._envMid = true;
        this._envDue = true;
      }
      if (this._mix >= 1) this._envDue = true;
    } else if (this._dimApplied !== this.dim) {
      this._dimApplied = this.dim;
      dirty = true;
    }
    if (this._postWas !== this.stage.postActive) {
      this._postWas = this.stage.postActive;
      dirty = true;
    }
    this.seasons.update(t, dt, this.stage);
    if (seasonBlend && !this.seasons.blending) this._envDue = true;
    if (dirty) this._apply();
    else if (this._envDue) this._env();
    // the characters' rim light comes from the sky's sun side: hand them its direction in view space
    rimShared.dir.value.copy(this._skySun).transformDirection(this.stage.camera.matrixWorldInverse);
    this.sky.setDither(!this.stage.postActive);
    this.sky.update(t, this.stage.camera, this.stage.pixelRatio);
    this.island.update(t, dt);
    this.places.update(t, dt);
    this.clouds.update(t, dt);
    this.motes.update(t, this.stage.pixelRatio, this.stage.height);
  }
}

const _c = new THREE.Color();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c3 = new THREE.Vector3();
const _p = new THREE.Vector3();
/** How bright the sky light is on average (the themes' `env` values then scale it, as before). */
const ENV_LEVEL = 0.95;
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
