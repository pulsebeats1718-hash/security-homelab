/**
 * SceneKit — everything a theatre scene's build(s) works with. One kit per scene; dispose()
 * takes the whole scene down and leaves the island exactly as it was.
 *
 *   s.k               the character construction kit (createKit): toy materials (mat, glow, glass,
 *                     metal, halo) and soft primitives (ball, dome, cap, cyl, cone, box, torus,
 *                     lathe, disc, star, stroke, group, at). Geometry comes from the shared cache;
 *                     the materials belong to the scene and go with it.
 *   s.root            the scene's group, in world space. y = 0 is the top of the dais, which is
 *                     centred on the origin (radius 1.5); the audience looks from +Z.
 *   s.add(...)        add objects to the scene;  s.ground(x, z) the height of the floor there
 *   s.own(x)          hand over a texture / material / geometry made outside the kit for disposal
 *   s.hero()          the player's own character, as an Actor (see actor.js); s.heroId its id
 *   s.cast(id, o)     a guest character ({ x, z, yaw, y, scale }); s.other(ids) picks one that is
 *                     not the hero
 *   s.t, s.clock      the scene time (wraps every `loop` seconds) and the time since it began
 *   s.cue(t0)         true on the one frame each loop when the scene time passes t0; s.first is
 *                     true during the first time through
 *   s.face(o)         an expressive face for a prop (see characters/kit/face.js), kept alive
 *   s.label(text, o)  a flat text card (canvas texture)
 *   s.bake(obj)       merge a little model into one vertex-coloured geometry; s.baked(obj) as a
 *                     mesh (one draw call); s.vc(o) is their toy material
 *   s.swarm(...)      many copies of one geometry, placed each frame by a function (one draw call)
 *   s.blob(r)         a soft round contact shadow
 *   s.every(fn)       run fn(t, dt) every frame, after the scene's own update
 *   s.fx, s.sound(n)  the game's particle effects; a sound effect (first time through only)
 *   s.director        the director (its stage, for a camera shake)
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createKit } from '../../characters/kit/kit.js';
import { buildFace } from '../../characters/kit/face.js';
import { setSummerGear } from '../../characters/kit/summer.js';
import { createCharacter } from '../../characters/index.js';
import { makeGlowTexture } from '../sky.js';
import { groundY } from '../places/kit.js';
import { Actor } from './actor.js';

const DAIS_R = 1.5;
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();

export class SceneKit {
  /**
   * @param {import('./director.js').Director} director
   * @param {object} def the scene definition
   */
  constructor(director, def) {
    this.director = director;
    this.app = director.app;
    this.def = def;
    this.THREE = THREE;
    this.fx = director.app.fx;
    this.k = createKit();
    this.root = new THREE.Group();
    this.root.name = `theatre:${def.id}`;
    director.stage.scene.add(this.root);
    this.actors = [];
    this.t = 0;
    this.clock = 0;
    this.loops = 0;
    this.prev = -1e-6;
    this.wrapped = false;
    this._hero = null;
    this._faces = [];
    this._swarms = [];
    this._every = [];
    this._blobs = [];
    this._own = []; // textures, materials and geometries made outside the kit
    this._heroState = null;
  }

  /** True during the first time through the loop. */
  get first() {
    return this.loops === 0;
  }

  /** Height of the floor at (x, z): the dais top, or the turf around it. */
  ground(x, z) {
    return Math.hypot(x, z) < DAIS_R ? 0 : groundY(x, z);
  }

  add(...objs) {
    for (const o of objs) if (o) this.root.add(o);
    return objs[0];
  }

  /** Keep something to dispose with the scene (texture, material, geometry). */
  own(x) {
    this._own.push(x);
    return x;
  }

  // ── cast ─────────────────────────────────────────────────────────────────
  /** The player's own character, taken over for the scene (given back by dispose). */
  hero() {
    if (this._hero) return this._hero;
    const hero = this.app.hero;
    if (!hero.ch) hero.set(this.app.save.data.character, { effect: false, clip: null });
    const a = new Actor(this, hero.ch, { hero: true });
    a.keep(a.root, 'position', 'scale', 'visible');
    this._heroState = { waves: hero.waves };
    hero.waves = false;
    hero.spin = 0;
    hero.spinVel = 0;
    hero.face();
    this._hero = a;
    this.actors.push(a);
    return a;
  }

  /** Id of the player's character. */
  get heroId() {
    return this.app.hero.id ?? this.app.save.data.character;
  }

  /** The first of `ids` that is not the hero (the hero plays itself, never its own twin). */
  other(ids) {
    return ids.find((id) => id !== this.heroId) ?? ids[0];
  }

  /** A guest character from the roster. */
  cast(id, { x = 0, z = 0, y = 0, yaw = 0, scale = 1 } = {}) {
    const ch = createCharacter(id);
    if (this.app.hero.summer) setSummerGear(ch.rig, ch.def, true);
    const a = new Actor(this, ch);
    a.place(x, z, yaw, y);
    if (scale !== 1) a.root.scale.setScalar(scale);
    this.root.add(a.root);
    this.actors.push(a);
    // without real shadows (low quality) a soft blob grounds each guest, like the hero's
    if (!this.director.stage.quality.shadow) this._blobs.push({ actor: a, mesh: this.add(this.blob(0.62 * scale)) });
    return a;
  }

  /** A soft round contact shadow (for guests and floating props on low quality). */
  blob(r = 0.6, opacity = 0.32) {
    const mat = this.own(new THREE.MeshBasicMaterial({ map: makeGlowTexture(), color: 0x000000, transparent: true, opacity, depthWrite: false }));
    const mesh = new THREE.Mesh(this.own(new THREE.CircleGeometry(r, 20)), mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  // ── time ─────────────────────────────────────────────────────────────────
  /** True on the one frame each loop when the scene time passes t0. */
  cue(t0) {
    const { prev, t } = this;
    if (this.wrapped) return t0 > prev || t0 <= t;
    return t0 > prev && t0 <= t;
  }

  /** Run fn(t, dt) every frame after the scene's update. */
  every(fn) {
    this._every.push(fn);
    return fn;
  }

  /** A sound effect, the first time through the scene only (a loop of noises would grate). */
  sound(name, o) {
    if (this.first) this.app.audio.play(name, o);
  }

  // ── props ────────────────────────────────────────────────────────────────
  /** An expressive face on a prop: { parent, radii, center, eye, brow, mouth, cheeks } (face.js). */
  face(o) {
    const k = this.k;
    const f = buildFace(k, { ...o, center: o.center ?? new THREE.Vector3() });
    this._faces.push(f);
    return f;
  }

  /** The vertex-coloured toy material used by baked models. */
  vc(o = {}) {
    const m = this.k.mat(0xffffff, { rough: 0.55, ...o, vc: true });
    if (!m.vertexColors) {
      m.vertexColors = true;
      m.needsUpdate = true;
    }
    return m;
  }

  /**
   * Merge a model built from kit primitives into one geometry with its colours baked in, so it
   * draws in one call (and can be instanced with swarm()). Glowing or see-through parts should
   * stay separate: only the colour survives.
   */
  bake(obj) {
    obj.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
    const parts = [];
    const c = new THREE.Color();
    obj.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      g.applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld));
      c.copy(o.material?.color ?? c.set(0xffffff));
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      parts.push(g);
    });
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    return this.own(merged);
  }

  /** A baked model as one mesh. */
  baked(obj, o) {
    const mesh = this.k.mesh(this.bake(obj), this.vc(o));
    return mesh;
  }

  /**
   * `n` copies of a geometry in one draw call. place(dummy, i, t, clock) positions copy i each
   * frame (dummy starts at the origin, unrotated, scale 1); return false to hide it.
   */
  swarm(geo, mat, n, place, { shadow = true } = {}) {
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(mesh);
    this._swarms.push({ mesh, n, place, d: new THREE.Object3D() });
    this._placeSwarm(this._swarms[this._swarms.length - 1]);
    return mesh;
  }

  _placeSwarm(sw) {
    const d = sw.d;
    for (let i = 0; i < sw.n; i++) {
      d.position.set(0, 0, 0);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      if (sw.place(d, i, this.t, this.clock) === false) d.scale.set(0, 0, 0);
      d.updateMatrix();
      sw.mesh.setMatrixAt(i, d.matrix);
    }
    sw.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * A flat text card facing +Z: size = its height in metres. Options: color, stroke (outline
   * colour or null), bg (a rounded backing colour), weight, italic.
   */
  label(text, { size = 0.5, color = '#fff6e3', stroke = '#17123f', bg = null, weight = 700, pad = 0.3, double = false } = {}) {
    const px = 128;
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d');
    const font = `${weight} ${px}px "Fredoka Variable", "Fredoka", ui-rounded, system-ui, sans-serif`;
    g.font = font;
    const w = Math.ceil(g.measureText(text).width + px * pad * 2 + (stroke ? px * 0.2 : 0));
    const h = Math.ceil(px * 1.45);
    canvas.width = w;
    canvas.height = h;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (bg) {
      const r = h * 0.42;
      g.fillStyle = bg;
      g.beginPath();
      if (g.roundRect) g.roundRect(4, 4, w - 8, h - 8, r);
      else g.rect(4, 4, w - 8, h - 8);
      g.fill();
    }
    if (stroke) {
      g.lineJoin = 'round';
      g.lineWidth = px * 0.16;
      g.strokeStyle = stroke;
      g.strokeText(text, w / 2, h / 2 + px * 0.04);
    }
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + px * 0.04);
    const tex = this.own(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = this.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: double ? THREE.DoubleSide : THREE.FrontSide, toneMapped: false }));
    const mesh = new THREE.Mesh(this.own(new THREE.PlaneGeometry((size * w) / h, size)), mat);
    mesh.renderOrder = 5;
    return mesh;
  }

  // ── the frame loop (called by the director) ─────────────────────────────
  _tick(prev, t, wrapped, dt) {
    this.prev = prev;
    this.t = t;
    this.wrapped = wrapped;
    this.clock += dt;
  }

  _after(dt) {
    for (const fn of this._every) fn(this.t, dt);
    for (const a of this.actors) if (!a.isHero) a.animator.update(dt);
    for (const a of this.actors) a._after();
    for (const f of this._faces) f.update(dt);
    for (const sw of this._swarms) this._placeSwarm(sw);
    for (const b of this._blobs) {
      b.actor.rig.pivot.getWorldPosition(_v);
      b.mesh.position.set(_v.x, this.ground(_v.x, _v.z) + 0.015, _v.z);
    }
    // the hero's blob shadow (low quality) follows it round the stage
    const hero = this._hero;
    if (hero) {
      const blob = this.app.env.blob;
      hero.rig.pivot.getWorldPosition(_v);
      blob.position.x = _v.x;
      blob.position.z = _v.z;
      blob.position.y = this.ground(_v.x, _v.z) + 0.012;
    }
  }

  /** Take the scene down: guests leave, the hero is given back, every resource is freed. */
  dispose() {
    const loose = [];
    for (const a of this.actors) {
      loose.push(...a.props);
      a.release();
      if (!a.isHero) a.rig.dispose();
    }
    const hero = this._hero;
    if (hero) {
      const h = this.app.hero;
      h.waves = this._heroState?.waves ?? false;
      h.spin = 0;
      h.spinVel = 0;
      h.face();
      const blob = this.app.env.blob;
      blob.position.set(hero.rig.pivot.position.x, 0.012, 0);
    }
    const geos = new Set();
    const visit = (o) => {
      if ((o.isMesh || o.isPoints || o.isLine) && o.geometry && !o.geometry.userData?.shared) geos.add(o.geometry);
    };
    this.root.traverse(visit);
    for (const o of loose) o.traverse(visit);
    for (const g of geos) g.dispose();
    for (const m of this.k.rig.materials) m.dispose();
    for (const h of this.k.rig.halos) h.material.dispose();
    for (const x of this._own) x.dispose?.();
    for (const sw of this._swarms) sw.mesh.dispose?.();
    this.root.removeFromParent();
    this.actors.length = 0;
    this._faces.length = 0;
    this._swarms.length = 0;
    this._every.length = 0;
  }
}
