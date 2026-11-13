/**
 * Places — the scenery the island travels through as the player levels up (ids and names live
 * in src/data/places.js). Each place dresses the island and replaces the distant islands with
 * its own floating chunks. Places are built the first time they are visited and then kept.
 *
 * Switching is a short celebration: the old props bulge and sink away, the new ones pop up
 * with a little overshoot, nearest first, the distant chunks last (≈1.1 s in all).
 *
 * A place exposes: group, ground (see Island.setGround), props ([{x, y, z, delay, far}]),
 * setPop(p), apply(v), update(t, dt), ambient(fx, dt, quality).
 */
import * as THREE from 'three';
import { PLACES } from '../../data/places.js';
import { STAGGER } from './kit.js';
import { Home } from './home.js';
import { London } from './london.js';
import { NewYork } from './newyork.js';
import { Sydney } from './sydney.js';

const BUILDERS = {
  home: (island, q) => new Home(island, q),
  london: (island, q) => new London(island, q),
  newyork: (island, q) => new NewYork(island, q),
  sydney: (island, q) => new Sydney(island, q),
};

/** Ids of places that have scenery (every entry of PLACES should). */
export const PLACE_IDS = PLACES.map((p) => p.id).filter((id) => BUILDERS[id]);

const RISE = 0.82; // seconds for a place to pop in
const FALL = 0.5; // … and to sink away
const HOLD = 0.2; // the new place waits this long while the old one starts sinking

export class Places {
  constructor(scene, island, { quality = 'high' } = {}) {
    this.island = island;
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.name = 'places';
    scene.add(this.group);
    this.entries = new Map();
    this.current = 'home';
    this.v = null;
  }

  _entry(id) {
    let e = this.entries.get(id);
    if (!e) {
      const place = BUILDERS[id](this.island, this.quality);
      place.props?.sort((a, b) => a.delay - b.delay);
      place.group.visible = false;
      place.setPop(0);
      if (this.v) place.apply(this.v);
      this.group.add(place.group);
      e = { id, place, p: 0, target: 0, hold: 0, sparkled: 0 };
      this.entries.set(id, e);
    }
    return e;
  }

  _setP(e, p) {
    e.p = p;
    e.place.setPop(p);
    e.place.group.visible = p > 0;
  }

  /** Switch scenery. Unknown ids fall back to home. */
  set(id, { instant = false } = {}) {
    if (!BUILDERS[id]) id = 'home';
    const next = this._entry(id);
    let busy = false;
    for (const e of this.entries.values()) {
      if (e === next) continue;
      if (e.p > 0.02) busy = true;
      e.target = 0;
      e.hold = 0;
      if (instant) this._setP(e, 0);
    }
    if (instant) {
      next.hold = 0;
      this._setP(next, 1);
      next.sparkled = Infinity;
    } else if (next.target !== 1) {
      next.hold = busy && next.p < 0.05 ? HOLD : 0;
      if (next.p < 0.05) next.sparkled = 0;
    }
    next.target = 1;
    this.current = id;
    this.island.setGround(next.place.ground, instant);
  }

  /** Build a place now without showing it (e.g. while the player looks at the place picker). */
  prepare(id) {
    return BUILDERS[id] ? this._entry(id) : null;
  }

  apply(v) {
    this.v = v;
    for (const e of this.entries.values()) e.place.apply(v);
  }

  update(t, dt) {
    for (const e of this.entries.values()) {
      if (e.hold > 0) e.hold -= dt;
      else if (e.p !== e.target) {
        const p = e.target > e.p ? Math.min(e.target, e.p + dt / RISE) : Math.max(e.target, e.p - dt / FALL);
        this._setP(e, p);
      }
      if (e.place.group.visible) e.place.update(t, dt);
    }
  }

  /** Ambient particles of the current place, plus a puff of sparkles as each new prop pops up. */
  ambient(fx, dt, quality) {
    const e = this.entries.get(this.current);
    if (!e) return;
    if (e.p > 0.5) e.place.ambient?.(fx, dt, quality);
    if (e.sparkled === Infinity || !e.place.props) return;
    const props = e.place.props;
    while (e.sparkled < props.length) {
      const pr = props[e.sparkled];
      if (e.p < pr.delay * STAGGER + 0.08) break;
      e.sparkled++;
      if (quality === 'low' && e.sparkled % 2) continue;
      _v.set(pr.x, pr.y + (pr.far ? 1.5 : 0.35), pr.z);
      fx.burst(_v, pr.far ? { count: 14, color: 0xffffff, color2: this.v?.accent ?? 0xffe08a, speed: 7, size: 1.6, life: 0.8, gravity: -1, spread: 3, up: 2 } : { count: 9, color: 0xffffff, color2: this.v?.accent ?? 0xffe08a, speed: 3.2, size: 0.55, life: 0.6, gravity: 3, spread: 0.6, up: 2.2 });
    }
    if (e.p >= 1) e.sparkled = Infinity;
  }
}

const _v = new THREE.Vector3();
