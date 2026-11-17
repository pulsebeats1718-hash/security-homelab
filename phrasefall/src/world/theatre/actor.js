/**
 * Actor — a character on the theatre stage: the player's own hero or a guest from the roster.
 *
 * The scene takes over the character's animator with a "theatre" clip whose pose the scene writes
 * every frame: `actor.pose = (P, t, actor) => …` fills P with the animator's pose keys (offsets
 * from the rest skeleton, see src/characters/animator.js) for scene time t. With no pose the actor
 * idles. Built-in clips can be mixed in at any phase (`actor.clip(P, 'cheer', u)`), so a scene is a
 * pure function of its time and loops seamlessly.
 *
 *   actor.place(x, z, yaw, y)  put it somewhere; actor.root is its placement in the world (the
 *                         hero's root lives in the stage scene, a guest's in the scene's group)
 *   actor.yaw             facing in radians, added to the pose (0 = towards the audience, +Z)
 *   actor.idle(P, o)      breathing, sway and the character's own idle ({ own, arms } to leave out)
 *   actor.clip(P, n, u)   a built-in animation clip at progress u
 *   actor.mood(name)      hold a face: happy, focus, worried, surprised, hurt, neutral (null = let go)
 *   actor.hold(side, obj) put a prop in the 'L' or 'R' hand ({ x, y, z, rx, ry, rz, upright, asIs })
 *   actor.attach(at, obj) put a prop on a joint ('head', 'torso', 'hips', 'pivot') or any Object3D
 *   actor.keep(obj, …)    remember properties of a part the scene is about to change
 *   actor.handPos(side)   where a hand is in the world;  actor.at(t, fn) measures a future pose
 *
 * Pose helpers for P: walk, sit, gasp (hands to mouth), shrug, point.
 *
 * release() undoes everything: props are taken off, kept values restored, the face and the
 * animator handed back. `upright` props keep their own orientation in the world (an umbrella held
 * aloft stays upright whatever the arm does), turned with the actor.
 */
import * as THREE from 'three';
import { CLIPS } from '../../characters/animator.js';
import { clamp } from '../../core/utils.js';

/** The animator's pose keys (see animator.js). */
export const POSE_KEYS = [
  'x', 'y', 'z', 'yaw', 'pitch', 'roll', 'sq', 'grow', 'hipsY', 'breath',
  'torsoX', 'torsoY', 'torsoZ',
  'headX', 'headY', 'headZ',
  'armLX', 'armLY', 'armLZ',
  'armRX', 'armRY', 'armRZ',
  'legLX', 'legLZ', 'legRX', 'legRZ',
  'tailX', 'tailY', 'tailZ',
];
const ARM_KEYS = ['armLX', 'armLY', 'armLZ', 'armRX', 'armRY', 'armRZ'];

const TMP = Object.fromEntries(POSE_KEYS.map((k) => [k, 0]));
const KEEP = {};
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();

export class Actor {
  /**
   * @param {import('./kit.js').SceneKit} kit
   * @param {{ def: object, rig: import('../../characters/kit/rig.js').Rig, animator: import('../../characters/animator.js').Animator }} ch
   */
  constructor(kit, ch, { hero = false } = {}) {
    this.kit = kit;
    this.ch = ch;
    this.def = ch.def;
    this.id = ch.def.id;
    this.rig = ch.rig;
    this.animator = ch.animator;
    this.root = ch.rig.root;
    this.isHero = hero;
    this.yaw = 0;
    /** (P, t, actor) => void — the scene's pose for this actor; null = idle. */
    this.pose = null;
    /** Offsets the idle sway so two actors never breathe in step. */
    this.phase = Math.random() * 10;
    this._mood = null;
    this._held = [];
    this._kept = [];
    this._clip = { def: { dur: 1e9, hold: true, fn: (Q) => this._write(Q) }, name: 'theatre', t: 0, dur: 1e9, fired: 0, onDone: null };
    this.take();
  }

  /** Height of the character's head centre and top (for placing clouds, hats, thought bubbles). */
  get headY() {
    return this.rig.metrics.headY ?? 1.5;
  }
  get height() {
    return this.rig.metrics.height ?? 2;
  }

  /** (Re)take the animator: from now on the scene's pose drives the character. */
  take() {
    this._clip.t = 0;
    this.animator.clip = this._clip;
    return this;
  }

  /** Place the actor (world position; y lifts it off the ground) and turn it. */
  place(x = 0, z = 0, yaw = this.yaw, y = 0) {
    this.root.position.set(x, y, z);
    this.yaw = yaw;
    return this;
  }

  _write(Q) {
    if (this.pose) this.pose(Q, this.kit.t, this);
    else this.idle(Q);
    Q.yaw += this.yaw;
  }

  /**
   * Add the quiet standing life to P: breathing, a little sway, and the character's own idle
   * personality (`own: false` leaves it out; `arms: false` keeps the arms still for holding props).
   * Runs on the scene's continuous clock, so it never jumps when the scene loops.
   */
  idle(P, { own = true, arms = true } = {}) {
    const t = this.kit.clock + this.phase;
    const b = Math.sin(t * 2.1);
    P.breath += b;
    P.headZ += Math.sin(t * 0.9) * 0.03;
    P.headX += Math.sin(t * 1.25 + 1) * 0.02;
    P.roll += Math.sin(t * 0.7) * 0.012;
    P.tailZ += Math.sin(t * 1.8) * 0.12;
    if (arms) {
      P.armLZ += b * 0.025;
      P.armRZ -= b * 0.025;
      P.armLX += Math.sin(t * 1.6) * 0.035;
      P.armRX += Math.sin(t * 1.6 + Math.PI) * 0.035;
    }
    if (own && this.def.idle) {
      if (!arms) for (const k of ARM_KEYS) KEEP[k] = P[k];
      this.def.idle(P, t, this.rig, this.animator);
      if (!arms) for (const k of ARM_KEYS) P[k] = KEEP[k];
    }
    return P;
  }

  /** Mix a built-in clip (cheer, wave, select, power, hit, attack, kick, appear) into P at progress u. */
  clip(P, name, u, weight = 1) {
    const c = CLIPS[name];
    if (!c || weight <= 0) return P;
    for (const k of POSE_KEYS) TMP[k] = 0;
    c.fn(TMP, clamp(u), this.rig);
    for (const k of POSE_KEYS) P[k] += TMP[k] * weight;
    return P;
  }

  /** Hold an expression on the face until told otherwise (null lets it go). */
  mood(name) {
    const f = this.rig.face;
    if (!f || this._mood === name) return this;
    this._mood = name;
    if (name) f.set(name, 1e9);
    else f.release();
    return this;
  }

  /** Flash the whole character (a quick colour pulse). */
  flash(hex = 0xffffff, strength = 0.8) {
    this.animator.flash(hex, strength);
    return this;
  }

  /** Put a prop in a hand ('L' = the character's left, 'R' = its right). */
  hold(side, obj, o = {}) {
    const hand = side === 'L' ? this.rig.handL : this.rig.handR;
    return this._attach(hand ?? this.rig.pivot, obj, o);
  }

  /** Put a prop on a joint ('head', 'torso', 'hips', 'pivot', 'legL' …) or on any Object3D. */
  attach(at, obj, o = {}) {
    const parent = typeof at === 'string' ? this.rig[at] ?? this.rig.pivot : at;
    return this._attach(parent, obj, o);
  }

  _attach(parent, obj, o) {
    // asIs: the prop is already placed in the parent's space (e.g. with k.onSphere)
    if (!o.asIs) {
      obj.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
      obj.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    }
    if (o.scale) obj.scale.setScalar(o.scale);
    parent.add(obj);
    this._held.push({ obj, upright: o.upright ? new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0)) : null });
    return obj;
  }

  /** Props this actor holds (the kit disposes their geometry with the scene). */
  get props() {
    return this._held.map((h) => h.obj);
  }

  /** Remember properties of `obj` (vectors, eulers, numbers, booleans) so release() can put them back. */
  keep(obj, ...props) {
    for (const p of props) {
      const v = obj[p];
      this._kept.push([obj, p, v && typeof v.clone === 'function' ? v.clone() : v]);
    }
    return obj;
  }

  /**
   * Pose the character as it will be at scene time t and measure something there — fn() runs
   * with the skeleton in that pose (e.g. where a held hammer's head lands, so a scene can put the
   * nail right under it). Nothing is left changed but the pose, which the next frame rewrites.
   */
  at(t, fn) {
    const kit = this.kit;
    const keepT = kit.t;
    kit.t = t;
    this._clip.t = Math.max(this._clip.t, 1); // fully blended in
    this.animator.update(0);
    this.root.updateMatrixWorld(true);
    const out = fn();
    kit.t = keepT;
    return out;
  }

  /** World position of a hand (or any part) — for things that follow it without being held. */
  handPos(side = 'R', out = new THREE.Vector3()) {
    const hand = side === 'L' ? this.rig.handL : this.rig.handR;
    return (hand ?? this.rig.pivot).getWorldPosition(out);
  }

  /** Called by the kit after the animator has posed the character this frame. */
  _after() {
    for (const h of this._held) {
      if (!h.upright || !h.obj.parent) continue;
      // world orientation wanted: the actor's facing, then the prop's own rotation
      this.root.getWorldQuaternion(_q);
      _q.multiply(_q2.setFromAxisAngle(AXIS_Y, this.yaw)).multiply(h.upright);
      h.obj.parent.getWorldQuaternion(_q3).invert();
      h.obj.quaternion.copy(_q3.multiply(_q));
    }
  }

  /** Undo everything the scene did to this character. */
  release() {
    if (this.animator.clip === this._clip) this.animator.stop();
    else this.rig.face?.release();
    this._mood = null;
    for (const h of this._held) h.obj.removeFromParent();
    this._held.length = 0;
    for (let i = this._kept.length - 1; i >= 0; i--) {
      const [obj, p, v] = this._kept[i];
      if (v && typeof v.clone === 'function' && obj[p] && typeof obj[p].copy === 'function') obj[p].copy(v);
      else obj[p] = v;
    }
    this._kept.length = 0;
  }
}

/** A gentle walk cycle mixed into P (speed 1 ≈ a stroll; amount 0…1 fades it in and out). */
export function walk(P, t, { speed = 1, amount = 1 } = {}) {
  if (amount <= 0) return P;
  const c = t * 8.5 * speed;
  const s = Math.sin(c);
  P.legLX += s * 0.6 * amount;
  P.legRX -= s * 0.6 * amount;
  P.armLX -= s * 0.42 * amount;
  P.armRX += s * 0.42 * amount;
  P.y += Math.abs(Math.cos(c)) * 0.07 * amount;
  P.roll += s * 0.045 * amount;
  P.torsoY += s * 0.06 * amount;
  return P;
}

/** Both hands up to the mouth in surprise (w fades it in and out). */
export function gasp(P, w = 1) {
  if (w <= 0) return P;
  P.armLX += -1.95 * w;
  P.armRX += -1.95 * w;
  P.armLZ += -0.62 * w;
  P.armRZ += 0.62 * w;
  P.headX += 0.08 * w;
  P.torsoX += -0.04 * w;
  return P;
}

/** Palms up and a tilt of the head: "what a fuss!" */
export function shrug(P, w = 1) {
  if (w <= 0) return P;
  P.armLZ += 0.8 * w;
  P.armRZ -= 0.8 * w;
  P.armLX += -0.55 * w;
  P.armRX += -0.55 * w;
  P.headZ += 0.2 * w;
  P.y += 0.03 * w;
  return P;
}

/** Point with one arm ('L' or 'R'): out to the side and up by `lift` (0 = level, 1 = high). */
export function point(P, side = 'R', w = 1, lift = 0.4) {
  if (w <= 0) return P;
  const s = side === 'L' ? 1 : -1;
  P[`arm${side}Z`] += s * (1.35 + lift * 0.9) * w;
  P[`arm${side}X`] += -0.35 * w;
  return P;
}

/** Sitting: legs forward, body tucked down by `drop` (metres). */
export function sit(P, { drop = 0.3, legs = 1.35, spread = 0.12 } = {}) {
  P.legLX -= legs;
  P.legRX -= legs;
  P.legLZ += spread;
  P.legRZ -= spread;
  P.y -= drop;
  P.torsoX -= 0.06;
  return P;
}
