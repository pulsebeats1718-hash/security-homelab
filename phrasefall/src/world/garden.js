/**
 * The memory garden: every expression the player has mastered grows a flower on the island.
 *
 *   daisy      everyday expressions        bluebell  set phrases
 *   tulip      phrasal verbs               lavender  collocations
 *   sunflower  idioms                      rose      advanced expressions
 *
 * A flower due for spaced-repetition review is thirsty: it droops and fades until the
 * expression is reviewed, then stands up again. One answered wrong last time wilts further.
 * New flowers grow in; the garden fills outwards from the dais, oldest flowers nearest.
 *
 * Spots are free ground around the dais, chosen per place (clear of the place's props,
 * water, paths and the stepping stones; off the sand in summer) and stable: the same
 * expression keeps the same spot in a place. Up to MAX_FLOWERS are drawn (about 360 on a
 * fully grown island); the count in the interface is the whole garden.
 *
 * Drawn with one instanced stem mesh and one instanced head mesh per kind (12 draw calls),
 * swaying gently in the vertex shader. World code only: the game decides what is planted
 * (setPlants) — see src/game/garden.js.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/utils.js';
import { groundY, islandR } from './places/kit.js';
import { STEPPING_STONES } from './island.js';
import { sandEdge, seasonDetail, trackSeasonMaterial, WIND_GLSL } from './seasons/shader.js';

export const KINDS = ['daisy', 'tulip', 'sunflower', 'bluebell', 'lavender', 'rose'];
/** Which flower each kind of expression grows. */
export const KIND_FOR_TYPE = { everyday: 'daisy', phrasal: 'tulip', idiom: 'sunflower', 'set-phrase': 'bluebell', collocation: 'lavender', advanced: 'rose' };
export const MAX_FLOWERS = 360;
/** Places whose island is mostly beach: once the grass is full, the garden carries on over the sand. */
const SAND_OVERFLOW = new Set(['sydney']);
/** Garden flowers are a little larger than the island's wild ones, so they read as special. */
const SCALE = 1.25;

/** Stem height and head size for each kind (world units; the character is about 2 tall). */
const SHAPE = {
  daisy: { h: 0.3, s: 1 },
  tulip: { h: 0.34, s: 1 },
  sunflower: { h: 0.5, s: 1.15 },
  bluebell: { h: 0.3, s: 1 },
  lavender: { h: 0.32, s: 1 },
  rose: { h: 0.34, s: 1 },
};
const PALETTE = {
  daisy: [0xffffff, 0xfff1f6, 0xfff7dc, 0xffe3ef],
  tulip: [0xff4d5e, 0xff8fb8, 0xff9a3c, 0xffd23f, 0xc77dff],
  sunflower: [0xffd23f, 0xffc21f, 0xffb347],
  bluebell: [0x6f8cff, 0x8f7bff, 0xa7c4ff],
  lavender: [0xa47bff, 0xc4a3ff, 0x8e6bd9],
  rose: [0xe8364f, 0xff7a9a, 0xff8f6b, 0xfff0f3],
};
const THIRSTY = new THREE.Color(0xb59a6e); // faded, dry
const WILTED = new THREE.Color(0x8a6a45);
const STEM = new THREE.Color(0x3fa65c);
const STEM_DRY = new THREE.Color(0xa7a052);

const hashString = (s) => [...String(s)].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

// ── geometry ──────────────────────────────────────────────────────────────
/** Paint every vertex of `g` one colour (vertex colours carry the fixed parts: centres, leaves). */
function paint(g, hex) {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const clean = (g) => {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'color'].includes(k)) out.deleteAttribute(k);
  return out;
};
const merge = (parts) => mergeGeometries(parts.map(clean));

/** A stem of height 1 (scaled per kind) with two little leaves. */
function stemGeometry() {
  const stem = paint(new THREE.CylinderGeometry(0.011, 0.016, 1, 5, 1), 0xffffff).translate(0, 0.5, 0);
  const leaf = (y, side) => paint(new THREE.SphereGeometry(0.045, 6, 4).scale(1, 0.22, 0.45).rotateZ(side * 0.5).translate(side * 0.045, y, 0), 0xe8ffe0);
  return merge([stem, leaf(0.32, 1), leaf(0.5, -1)]);
}

/** Petals round a centre, facing up (+y). */
function rayFlower(n, petalLen, petalW, centreR, centreHex) {
  const parts = [paint(new THREE.CylinderGeometry(centreR, centreR * 0.9, centreR * 0.55, 10, 1).translate(0, centreR * 0.25, 0), centreHex)];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push(paint(new THREE.SphereGeometry(1, 6, 4).scale(petalLen, petalW * 0.25, petalW).translate(petalLen * 0.9 + centreR * 0.6, 0, 0).rotateY(a), 0xffffff));
  }
  return merge(parts);
}

function headGeometry(kind) {
  switch (kind) {
    case 'daisy':
      return rayFlower(11, 0.05, 0.022, 0.03, 0xffd23f);
    case 'sunflower':
      return rayFlower(14, 0.07, 0.03, 0.055, 0x6b3f1f);
    case 'tulip': {
      const pts = [[0, 0], [0.03, 0.006], [0.05, 0.035], [0.052, 0.07], [0.038, 0.105], [0.042, 0.112]].map(([r, y]) => new THREE.Vector2(r, y));
      return merge([paint(new THREE.LatheGeometry(pts, 10), 0xffffff)]);
    }
    case 'rose': {
      const bud = paint(new THREE.SphereGeometry(0.04, 9, 7).scale(1, 0.95, 1).translate(0, 0.045, 0), 0xffffff);
      const outer = paint(new THREE.SphereGeometry(0.052, 9, 6, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65).translate(0, 0.05, 0), 0xffffff);
      const swirl = paint(new THREE.TorusGeometry(0.022, 0.008, 5, 12).rotateX(Math.PI / 2).translate(0, 0.088, 0), 0xffffff);
      const cup = paint(new THREE.ConeGeometry(0.03, 0.03, 6).rotateX(Math.PI).translate(0, 0.012, 0), 0x3f8f45);
      return merge([cup, outer, bud, swirl]);
    }
    case 'bluebell': {
      // a short arching tip with three bells hanging from it
      const parts = [paint(new THREE.CylinderGeometry(0.006, 0.008, 0.12, 4).rotateZ(-0.9).translate(0.045, 0.03, 0), 0x3f8f45)];
      [[0.02, 0.012], [0.055, 0.032], [0.09, 0.05]].forEach(([x, y], i) => {
        parts.push(paint(new THREE.ConeGeometry(0.022 - i * 0.002, 0.045, 7, 1, true).translate(x, y - 0.025, 0), 0xffffff));
        parts.push(paint(new THREE.SphereGeometry(0.012, 5, 4).translate(x, y - 0.003, 0), 0xffffff));
      });
      return merge(parts);
    }
    case 'lavender':
    default: {
      const parts = [];
      for (let i = 0; i < 7; i++) {
        const r = 0.024 - i * 0.0022;
        parts.push(paint(new THREE.SphereGeometry(r, 6, 4).translate(Math.sin(i * 2.3) * 0.006, 0.015 + i * 0.022, Math.cos(i * 2.3) * 0.006), 0xffffff));
      }
      return merge(parts);
    }
  }
}

/**
 * A gentle sway for the stems and heads, from each instance's position; on medium and high
 * quality the gusts rolling over the lawn bow them too (the same breeze as the grass).
 */
function swaying(mat, time, lift) {
  mat.onBeforeCompile = (shader) => {
    const gusts = seasonDetail() > 0;
    shader.uniforms.uTime = time;
    shader.uniforms.uLift = { value: lift };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uLift;\n${gusts ? WIND_GLSL : ''}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float pfPhase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
          float pfBend = uLift > 0.0 ? uLift : max(0.0, position.y);
          transformed.x += sin(uTime * 1.5 + pfPhase) * 0.05 * pfBend;
          transformed.z += cos(uTime * 1.1 + pfPhase * 1.3) * 0.03 * pfBend;
          ${gusts ? 'transformed.xz += PF_WIND * (pfGust(instanceMatrix[3].xz, uTime) * 0.09 * pfBend);' : ''}
        #endif`
      );
  };
  mat.customProgramCacheKey = () => `pf-garden-${lift > 0 ? 'head' : 'stem'}-${seasonDetail() > 0 ? 1 : 0}`;
  trackSeasonMaterial(mat); // recompiled when the quality tier changes
  return mat;
}

/**
 * Every spot where a garden flower may grow in the environment's current place and season, in
 * the order the garden fills them ({ x, z, k }: k = how late it fills). The garden uses the first
 * `max`; decorations keep clear of those (src/world/decor.js).
 */
export function gardenSpots(env) {
  const places = env.places;
  const placeId = places.current;
  const season = env.season;
  const place = places._entry?.(placeId)?.place ?? {};
  const taken = (place.props ?? []).filter((p) => !p.far).map((p) => ({ x: p.x, z: p.z, r: 0.6 }));
  for (const [x, z, s] of STEPPING_STONES) taken.push({ x, z, r: s + 0.22 });
  for (const a of place.avoid ?? []) taken.push({ x: a.x, z: a.z, r: a.r + 0.15 });
  const keep = place.ground?.keep;
  const rng = mulberry32(hashString(`garden:${placeId}`));
  const out = [];
  const step = 0.3;
  for (let gx = -6; gx <= 6; gx += step) {
    for (let gz = -5; gz <= 5; gz += step) {
      const x = gx + (rng() - 0.5) * step * 0.7;
      const z = gz + (rng() - 0.5) * step * 0.7;
      if (islandR(x, z) > 0.85 || Math.hypot(x, z) < 2.2) continue;
      if (Math.abs(x) < 1.15 && z > 1.4) continue; // the path to the front of the dais
      // off the place's own ground (streets, pavements…); on a beach island the sand takes the overflow
      const offTurf = keep && !keep(x, z);
      if (offTurf && !SAND_OVERFLOW.has(placeId)) continue;
      if (place.free && !place.free(x, z)) continue;
      if (season === 'summer' && sandEdge(x, z) <= 0.12) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r)) continue;
      // the sides of the dais first (on screen beside the character, above the menu's buttons),
      // then outwards; the far front hides behind the interface and straight behind the character
      // behind the character itself, so those fill last
      const side = Math.abs(Math.hypot(x, z) - 2.6);
      out.push({ x, z, k: side + (z > 1.3 ? 1.6 + (z - 1.3) * 0.8 : 0) + (Math.abs(x) < 1.6 && z < -1.2 ? 0.9 : 0) + rng() * 0.3 + (offTurf ? 100 : 0) });
    }
  }
  out.sort((a, b) => a.k - b.k);
  return out;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3();
const _c = new THREE.Color();

export class Garden {
  /**
   * @param {object} env the Environment (its island group carries the garden; its places and
   *        seasons decide where flowers may grow)
   */
  constructor(env, { quality = 'high' } = {}) {
    this.env = env;
    this.group = new THREE.Group();
    this.group.name = 'garden';
    env.island.group.add(this.group);
    this.time = { value: 0 };
    this.max = quality === 'low' ? 160 : MAX_FLOWERS;
    this.meshes = {};
    const stemGeo = stemGeometry();
    for (const kind of KINDS) {
      const stems = new THREE.InstancedMesh(stemGeo, swaying(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), this.time, 0), this.max);
      // heads sway as far as the top of their stem (lift 1: the stem's full bend)
      const heads = new THREE.InstancedMesh(headGeometry(kind), swaying(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 }), this.time, 1), this.max);
      for (const m of [stems, heads]) {
        m.count = 0;
        m.frustumCulled = false;
        m.castShadow = quality !== 'low';
        m.receiveShadow = true;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(m);
      }
      this.meshes[kind] = { stems, heads, list: [] };
    }
    /** id → flower { id, kind, spot, health, target, grow, color, seed } */
    this.flowers = new Map();
    this.order = [];
    this.layoutKey = '';
    this.spots = [];
    this.animating = true;
  }

  /** Free spots for the current place and season, nearest the front of the dais first. */
  _spots() {
    return gardenSpots(this.env).slice(0, this.max);
  }

  /**
   * What grows: [{ id, kind, state: 'ok' | 'thirsty' | 'wilted' }] in planting order (oldest
   * first). New ids grow in; changed states droop or recover smoothly.
   */
  setPlants(list) {
    const seen = new Set();
    this.order = [];
    for (const p of list.slice(0, this.max)) {
      if (!KINDS.includes(p.kind)) continue;
      seen.add(p.id);
      let f = this.flowers.get(p.id);
      const target = p.state === 'wilted' ? 0 : p.state === 'thirsty' ? 0.35 : 1;
      if (!f) {
        const seed = hashString(p.id);
        const pal = PALETTE[p.kind];
        f = { id: p.id, kind: p.kind, health: target, target, grow: 0, seed, color: new THREE.Color(pal[seed % pal.length]), spot: null };
        this.flowers.set(p.id, f);
      }
      f.target = target;
      this.order.push(f);
    }
    for (const id of [...this.flowers.keys()]) if (!seen.has(id)) this.flowers.delete(id);
    this._layout(true);
    this.animating = true;
  }

  /** Put the flowers on their spots (again when the place or season changes). */
  _layout(force = false) {
    const key = `${this.env.places.current}|${this.env.season}`;
    if (!force && key === this.layoutKey) return;
    const moved = key !== this.layoutKey;
    this.layoutKey = key;
    if (moved) this.spots = this._spots();
    for (const kind of KINDS) this.meshes[kind].list.length = 0;
    this.order.forEach((f, i) => {
      const spot = this.spots[i];
      f.spot = spot ?? null;
      if (!spot) return;
      if (moved && f.grow >= 1) f.grow = 0.001; // a new place: the garden grows in again
      this.meshes[f.kind].list.push(f);
    });
    for (const kind of KINDS) {
      const m = this.meshes[kind];
      m.stems.count = m.heads.count = m.list.length;
      m.list.forEach((f, i) => this._write(m, f, i));
      m.stems.instanceMatrix.needsUpdate = m.heads.instanceMatrix.needsUpdate = true;
      if (m.stems.instanceColor) m.stems.instanceColor.needsUpdate = true;
      if (m.heads.instanceColor) m.heads.instanceColor.needsUpdate = true;
    }
  }

  /** One flower's stem and head matrices and colours. */
  _write(m, f, i) {
    const { x, z } = f.spot;
    const shape = SHAPE[f.kind];
    const r = mulberry32(f.seed);
    const size = (0.85 + r() * 0.35) * shape.s * SCALE * easeOutBack(Math.min(1, f.grow));
    const yaw = r() * Math.PI * 2;
    const dry = 1 - f.health; // 0 fresh … 1 wilted
    // the stem leans a little, and much more when dry; heads face the front of the island
    const lean = 0.08 + dry * 0.45;
    const leanDir = r() * Math.PI * 2;
    _e.set(Math.cos(leanDir) * lean, yaw, Math.sin(leanDir) * lean, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(x, groundY(x, z) - 0.01, z);
    const h = shape.h * (0.9 + r() * 0.25);
    _s.set(size, h * size, size);
    _m.compose(_p, _q, _s);
    m.stems.setMatrixAt(i, _m);
    _up.set(0, h * size, 0).applyQuaternion(_q).add(_p);
    // healthy heads tilt towards the viewer; dry ones hang down
    _e.set(0.55 + dry * 1.35, (r() - 0.5) * 0.8, (r() - 0.5) * 0.3, 'YXZ');
    _q.setFromEuler(_e);
    _s.setScalar(size);
    _m.compose(_up, _q, _s);
    m.heads.setMatrixAt(i, _m);
    _c.copy(f.color).lerp(f.health < 0.2 ? WILTED : THIRSTY, Math.min(1, dry * 0.85));
    m.heads.setColorAt(i, _c);
    m.stems.setColorAt(i, _c.copy(STEM).lerp(STEM_DRY, dry));
  }

  /** World position of a flower's head (for sparkles), or null if it is not drawn. */
  positionOf(id, target = new THREE.Vector3()) {
    const f = this.flowers.get(id);
    if (!f?.spot) return null;
    target.set(f.spot.x, groundY(f.spot.x, f.spot.z) + SHAPE[f.kind].h * SCALE, f.spot.z);
    return this.group.localToWorld(target);
  }

  get count() {
    return this.flowers.size;
  }

  update(t, dt) {
    this.time.value = t;
    this._layout();
    if (!this.animating) return;
    let busy = false;
    for (const kind of KINDS) {
      const m = this.meshes[kind];
      let dirty = false;
      m.list.forEach((f, i) => {
        let changed = false;
        if (f.grow < 1) {
          f.grow = Math.min(1, f.grow + dt / (0.7 + (f.seed % 7) * 0.08));
          changed = true;
        }
        if (Math.abs(f.health - f.target) > 0.002) {
          f.health += (f.target - f.health) * Math.min(1, dt * 2.4);
          changed = true;
        }
        if (changed) {
          this._write(m, f, i);
          dirty = true;
        }
      });
      if (dirty) {
        busy = true;
        m.stems.instanceMatrix.needsUpdate = m.heads.instanceMatrix.needsUpdate = true;
        if (m.stems.instanceColor) m.stems.instanceColor.needsUpdate = true;
        if (m.heads.instanceColor) m.heads.instanceColor.needsUpdate = true;
      }
    }
    this.animating = busy;
  }
}

function easeOutBack(u) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}
