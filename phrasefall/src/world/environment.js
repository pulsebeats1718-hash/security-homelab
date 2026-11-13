/**
 * Environment — lights, sky, island, clouds and the theme system that blends
 * between times of day as the player climbs through the stages, plus the place
 * the island has travelled to (Home Island, London, New York, Sydney).
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { THEMES, COLOR_KEYS, NUMBER_KEYS } from './themes.js';
import { Sky, makeGlowTexture } from './sky.js';
import { Island } from './island.js';
import { Places } from './places/index.js';
import { Clouds, Motes } from './clouds.js';
import { rimShared } from '../characters/kit/materials.js';
import { ease, lerp } from '../core/utils.js';

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

    scene.fog = new THREE.FogExp2(0xffd9c0, 0.011);
    const pmrem = new THREE.PMREMGenerator(stage.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.8);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.castShadow = stage.quality.shadow > 0;
    if (stage.quality.shadow) this.sun.shadow.mapSize.set(stage.quality.shadow, stage.quality.shadow);
    Object.assign(this.sun.shadow.camera, { left: -9, right: 9, top: 10, bottom: -8, near: 1, far: 70 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.035;
    scene.add(this.sun, this.sun.target);

    this.rim = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(this.rim, this.rim.target);

    this.sky = new Sky(scene);
    this.island = new Island(scene, { quality: q });
    this.places = new Places(scene, this.island, { quality: q });
    this.clouds = new Clouds(scene, { quality: q });
    this.motes = new Motes(scene, { quality: q });

    // soft contact shadow for when real shadows are switched off
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 24),
      new THREE.MeshBasicMaterial({ map: makeGlowTexture(), color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.012;
    this.blob.visible = stage.quality.shadow === 0;
    scene.add(this.blob);

    this.themeName = 'sunrise';
    this.v = {};
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
    this._apply();
    this.setPlace('home', { instant: true });
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
    if (e) this.stage.renderer.compile(e.place.group, this.stage.camera, this.stage.scene);
  }

  /** Let the current place spawn its ambient particles (petals, leaves, steam …). Call once a frame. */
  ambient(fx, dt, quality = this.stage.qualityName) {
    this.places.ambient(fx, dt, quality);
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
  }

  /** Re-read the stage quality (shadows on / off, shadow resolution). */
  setQuality() {
    const size = this.stage.quality.shadow;
    this.sun.castShadow = size > 0;
    this.blob.visible = size === 0;
    if (size && this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  /** Temporarily brighten / dim everything (game-over desaturation, flashes). */
  setDim(amount) {
    this.dim = amount;
  }

  _apply() {
    const v = this.v;
    const scene = this.stage.scene;
    const dim = 1 - (this.dim ?? 0) * 0.45;
    scene.fog.color.copy(v.fog);
    scene.fog.density = v.fogDensity;
    scene.environmentIntensity = v.env * dim;
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
    this.sky.apply(v, this._skySun);
    this.island.apply(v);
    this.places.apply(v);
    this.clouds.apply(v);
    this.motes.apply(v);
  }

  update(dt, t) {
    if (this._mix < 1) {
      this._mix = Math.min(1, this._mix + dt / this._dur);
      const e = ease.inOutCubic(this._mix);
      const to = this._to;
      const c = _c;
      for (const k of COLOR_KEYS) this.v[k].copy(this._from[k]).lerp(c.set(to[k]), e);
      for (const k of NUMBER_KEYS) this.v[k] = lerp(this._from[k], to[k], e);
      this._sunDir.copy(this._fromSun).lerp(dirFrom(to.sun, this._a), e).normalize();
      this._skySun.copy(this._fromSky).lerp(dirFrom(to.skySun, this._b), e).normalize();
      this._apply();
    } else if (this._dimApplied !== this.dim) {
      this._dimApplied = this.dim;
      this._apply();
    }
    this.sky.update(t, this.stage.camera, this.stage.pixelRatio);
    this.island.update(t, dt);
    this.places.update(t, dt);
    this.clouds.update(t, dt);
    this.motes.update(t, this.stage.pixelRatio, this.stage.height);
  }
}

const _c = new THREE.Color();
