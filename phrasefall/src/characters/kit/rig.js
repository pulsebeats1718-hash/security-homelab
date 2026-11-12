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
