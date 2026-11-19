/**
 * Rig — the animatable skeleton every character shares.
 *
 *   root ─ pivot ─ hips ─┬─ legL / legR
 *                        └─ torso ─┬─ armL / armR ─ handL / handR
 *                                  ├─ head ─ (face, ears, hat …)
 *                                  └─ tail (optional)
 *
 * Characters face +Z. "L" is the character's own left (+X).
 * Joints remember their rest transform; the Animator writes offsets on top.
 */
import * as THREE from 'three';

const _t = new THREE.Vector3();
const _zero = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _sc = new THREE.Vector3();

/** One occluder: `local` in `obj`'s space, radius `r` scaled with it (w = 0: none). */
function _occ(out, obj, local, r) {
  if (!obj) {
    out.w = 0;
    return;
  }
  obj.updateWorldMatrix(true, false);
  obj.matrixWorld.decompose(_p, _q, _sc);
  _p.copy(local).applyMatrix4(obj.matrixWorld);
  out.set(_p.x, _p.y, _p.z, r * (_sc.x + _sc.y + _sc.z) / 3);
}

export class Rig {
  constructor(fx) {
    this.fx = fx;
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    /** @type {Record<string, {obj: THREE.Object3D, rx:number, ry:number, rz:number, px:number, py:number, pz:number}>} */
    this.joints = {};
    /** Named meshes for character-specific tweaks. */
    this.m = {};
    /** Named extras (props, emitters) used by idle hooks and the game. */
    this.props = {};
    this.springs = [];
    /** Per-frame callbacks (t, dt, rig) for cloth, lights and other prop animation. */
    this.tickers = [];
    this.face = null;
    this.materials = [];
    this.halos = [];
    this.headCenter = new THREE.Vector3(0, 0.44, 0);
    this.headRadii = [0.57, 0.52, 0.53];
    this.metrics = { height: 2, headY: 1.5, hipY: 0.4 };
  }

  joint(name, obj) {
    this.joints[name] = {
      obj,
      rx: obj.rotation.x,
      ry: obj.rotation.y,
      rz: obj.rotation.z,
      px: obj.position.x,
      py: obj.position.y,
      pz: obj.position.z,
    };
    this[name] = obj;
    return obj;
  }

  /** Re-capture rest transforms after a builder has adjusted joints. */
  captureRest() {
    for (const j of Object.values(this.joints)) {
      j.rx = j.obj.rotation.x;
      j.ry = j.obj.rotation.y;
      j.rz = j.obj.rotation.z;
      j.px = j.obj.position.x;
      j.py = j.obj.position.y;
      j.pz = j.obj.position.z;
    }
  }

  /**
   * Secondary motion: `obj` lags behind body movement and gently sways.
   * axis: rotation axis ('x' | 'y' | 'z'); gain: reaction to vertical speed;
   * yawGain: reaction to spin; sway/speed/phase: ambient oscillation.
   */
  spring(obj, o = {}) {
    const axis = o.axis ?? 'x';
    this.springs.push({
      obj,
      axis,
      rest: obj.rotation[axis],
      k: o.k ?? 90,
      d: o.d ?? 9,
      gain: o.gain ?? 0.12,
      yawGain: o.yawGain ?? 0,
      sway: o.sway ?? 0,
      speed: o.speed ?? 2,
      phase: o.phase ?? 0,
      max: o.max ?? 0.9,
      angle: 0,
      vel: 0,
    });
    return obj;
  }

  updateSprings(t, dt, vy, vyaw) {
    const h = Math.min(dt, 1 / 30);
    for (const s of this.springs) {
      const target = Math.max(-s.max, Math.min(s.max, -vy * s.gain + vyaw * s.yawGain));
      s.vel += (-s.k * (s.angle - target) - s.d * s.vel) * h;
      s.angle += s.vel * h;
      s.obj.rotation[s.axis] = s.rest + s.angle + Math.sin(t * s.speed + s.phase) * s.sway;
    }
  }

  setSilhouette(on) {
    this.fx.silhouette.value = on ? 1 : 0;
    for (const h of this.halos) h.visible = !on;
  }

  /**
   * Contact occlusion (materials.js, medium and high quality): the head, the body and the two hands
   * as world-space spheres that darken the surfaces facing them — under the chin, round the neck and
   * shoulders, inside the arms, at the tops of the legs, under hat brims and where ears and muzzles
   * meet the head. Called by the Animator once the pose is applied. A part a character has replaced
   * with its own (no arms …) is left out; `rig.occlusion = false` turns it off for a character.
   */
  updateOcclusion() {
    const o = this.fx.occ?.value;
    if (!o) return;
    if (this.occlusion === false) {
      for (const v of o) v.w = 0;
      return;
    }
    const S = this.metrics.torsoS ?? [1, 1, 0.86];
    _occ(o[0], this.head, this.headCenter, Math.min(...this.headRadii) * 0.97);
    _occ(o[1], this.torso, _t.set(0, 0.23 * S[1], 0), 0.34 * Math.min(S[0], 1.15));
    _occ(o[2], this.m.handL ? this.handL : null, _zero, (this.m.handL?.scale.x ?? 0.125) * 1.05);
    _occ(o[3], this.m.handR ? this.handR : null, _zero, (this.m.handR?.scale.x ?? 0.125) * 1.05);
  }

  /** World position of a named anchor (hand, prop tip …). */
  worldPos(obj, out = new THREE.Vector3()) {
    return obj.getWorldPosition(out);
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
    for (const h of this.halos) h.material.dispose();
    this.root.removeFromParent();
  }
}
