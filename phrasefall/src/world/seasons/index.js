/**
 * Seasons — the island's dressing for spring, summer, autumn and winter. The lead's season logic
 * (src/data/seasons.js) decides which one; this makes the world look it, in every place and at
 * every time of day:
 *
 *   look       the scenery shader (seasons/shader.js): autumn colours, spring greens and blossom,
 *              winter snow on everything facing up, summer sand around the dais
 *   light      a per-season tint of the time-of-day theme (warm summer sun, frosty winter …)
 *   particles  falling leaves, snow and petals; butterflies in spring (seasons/weather.js)
 *   dressing   leaf litter, sprouting flowers, a snowman, a beach set (seasons/dressing.js)
 *
 * Changing season blends everything over SEASON_TIME seconds. The season survives place changes:
 * each place gets its own dressing, built the first time it is needed.
 */
import * as THREE from 'three';
import { SEASON_U, sandEdge } from './shader.js';
import { Weather, Butterflies } from './weather.js';
import { Dressing } from './dressing.js';

export const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_TIME = 1.6;

/** Per-season light: colour multipliers (lerped in by the season's weight) and intensity changes. */
const LIGHT = {
  spring: { tint: { sunLight: 0xfffcf2, hemiSky: 0xf4fff2, hemiGround: 0xeeffe0, fog: 0xf6fff6 }, sun: 1.04, hemi: 1.03, exposure: 0.02, fog: 1 },
  summer: { tint: { sunLight: 0xfff0d4, hemiSky: 0xfff7ea, hemiGround: 0xfff0d6, fog: 0xfff4e6, skyTop: 0xf2f8ff }, sun: 1.14, hemi: 1.06, exposure: 0.05, fog: 1 },
  autumn: { tint: { sunLight: 0xffeacf, hemiSky: 0xfff3e6, hemiGround: 0xffe2c2, fog: 0xfff0e2 }, sun: 1, hemi: 1, exposure: 0, fog: 1 },
  winter: { tint: { sunLight: 0xe8f0ff, hemiSky: 0xedf3ff, hemiGround: 0xe6eeff, fog: 0xeef4ff, skyHorizon: 0xf2f6ff, skyBottom: 0xf2f6ff }, sun: 0.95, hemi: 1.1, exposure: 0.045, fog: 1.12 },
};
for (const l of Object.values(LIGHT)) for (const key of Object.keys(l.tint)) l.tint[key] = new THREE.Color(l.tint[key]);

const GROUND = {
  spring: null,
  summer: { keepTufts: (x, z) => sandEdge(x, z) > 0.1, keepFlowers: (x, z) => sandEdge(x, z) > 0.1 },
  autumn: null,
  winter: { keepTufts: (x, z) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 < 0.3, keepFlowers: () => false },
};

const _c = new THREE.Color();
const _white = new THREE.Color(1, 1, 1);

export class Seasons {
  constructor(scene, island, places, quality) {
    this.island = island;
    this.places = places;
    this.quality = quality;
    this.current = 'autumn';
    this.w = { spring: 0, summer: 0, autumn: 1, winter: 0 };
    this.springT = 10;
    this.weather = new Weather(scene, quality);
    this.butterflies = new Butterflies(scene, quality);
    /** place entry → { season → Dressing } */
    this.dressings = new Map();
    this.light = new THREE.Color(1, 1, 1);
    this._sync();
  }

  /** Change season. Unknown ids mean autumn. Blends over ~1.6 s unless instant. */
  set(id, { instant = false } = {}) {
    if (!SEASON_IDS.includes(id)) id = 'autumn';
    if (id === 'spring' && (this.current !== 'spring' || instant)) this.springT = instant ? 4 : 0;
    this.current = id;
    if (instant) for (const k of SEASON_IDS) this.w[k] = k === id ? 1 : 0;
    this.island.setSeasonGround(GROUND[id], instant);
    this._sync();
  }

  /** True while a season blend is under way (the environment then re-applies the light). */
  get blending() {
    return SEASON_IDS.some((k) => this.w[k] !== (k === this.current ? 1 : 0));
  }

  _sync() {
    const w = this.w;
    SEASON_U.uSeason.value.set(w.spring, w.summer, w.autumn, w.winter);
    this.weather.setAmounts(w.autumn, w.winter, w.spring);
    this.butterflies.setAmount(w.spring);
  }

  update(t, dt, stage) {
    const step = dt / SEASON_TIME;
    for (const k of SEASON_IDS) {
      const target = k === this.current ? 1 : 0;
      this.w[k] = target > this.w[k] ? Math.min(target, this.w[k] + step) : Math.max(target, this.w[k] - step);
    }
    this.springT += dt;
    this._sync();
    this.weather.update(t, stage);
    this.butterflies.update(t);

    // each visible place wears the dressing of every season that is showing
    for (const e of this.places.entries.values()) {
      let set = this.dressings.get(e);
      for (const k of SEASON_IDS) {
        const show = e.p * smooth(this.w[k]);
        let d = set?.[k];
        if (!d && show > 0) {
          if (!set) this.dressings.set(e, (set = {}));
          d = set[k] = new Dressing(k, e.place, e.id, this.quality);
          e.place.group.add(d.group);
        }
        if (!d) continue;
        d.setPop(show);
        if (show > 0) d.update(t, this.springT);
      }
    }
  }

  /** The theme values `v`, tinted for the season, into `out` (same shape as v). */
  tint(v, out) {
    for (const key of Object.keys(v)) {
      if (v[key]?.isColor) (out[key] ??= new THREE.Color()).copy(v[key]);
      else out[key] = v[key];
    }
    for (const k of SEASON_IDS) {
      const w = this.w[k];
      if (w <= 0) continue;
      const l = LIGHT[k];
      for (const [key, c] of Object.entries(l.tint)) out[key].multiply(_c.copy(_white).lerp(c, w));
      out.sunIntensity *= 1 + (l.sun - 1) * w;
      out.hemiIntensity *= 1 + (l.hemi - 1) * w;
      out.exposure += l.exposure * w;
      out.fogDensity *= 1 + (l.fog - 1) * w;
    }
    // particles and butterflies are unlit: give them the scene's light
    this.light.copy(out.hemiSky).multiplyScalar(out.hemiIntensity * 0.55).add(_c.copy(out.sunLight).multiplyScalar(out.sunIntensity * 0.2));
    const m = Math.max(this.light.r, this.light.g, this.light.b);
    if (m > 1.05) this.light.multiplyScalar(1.05 / m);
    this.weather.apply(out, this.light);
    this.butterflies.apply(this.light);
    return out;
  }
}

const smooth = (x) => x * x * (3 - 2 * x);
