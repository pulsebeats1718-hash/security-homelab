/**
 * Hero — the one live character standing on the island. Handles swapping
 * characters (with a puff of sparkles), the turntable on the collection screen
 * and the little idle waves on the menu.
 */
import * as THREE from 'three';
import { createCharacter } from '../characters/index.js';
import { damp } from '../core/utils.js';

const _v = new THREE.Vector3();

export class Hero {
  constructor({ stage, fx, env, game }) {
    this.stage = stage;
    this.fx = fx;
    this.env = env;
    this.game = game;
    this.ch = null;
    this.id = null;
    this.locked = false;
    /** Turntable angle (radians) and whether it eases back to face the camera. */
    this.spin = 0;
    this.spinVel = 0;
    this.dragging = false;
    this.autoReturn = true;
    this.waveT = 4;
    this.waves = false;
  }

  /** Put a character on the island. */
  set(id, { locked = false, effect = true, clip = 'appear' } = {}) {
    if (this.ch && this.id === id && this.locked === locked) return this.ch;
    if (this.ch) {
      this.ch.rig.dispose();
      this.ch = null;
    }
    const ch = createCharacter(id);
    this.ch = ch;
    this.id = ch.def.id;
    this.locked = locked;
    ch.rig.setSilhouette(locked);
    ch.rig.root.rotation.y = this.spin;
    this.stage.scene.add(ch.rig.root);
    this.game.setCharacter(ch);
    if (clip) ch.animator.play(clip);
    if (locked) ch.rig.face?.set('neutral');
    if (effect) {
      _v.set(0, 1.1, 0);
      this.fx.burst(_v, { count: 26, color: locked ? 0x8f7bff : ch.def.accent, color2: 0xffffff, speed: 3.6, size: 0.55, life: 0.6, gravity: 0, spread: 0.8, up: 0.5 });
      this.fx.ring(_v.set(0, 0.06, 0), { color: locked ? 0x8f7bff : ch.def.accent, from: 0.4, to: 2.6, life: 0.5, flat: true, opacity: 0.7 });
    }
    return ch;
  }

  play(clip, o) {
    return this.ch?.animator.play(clip, o);
  }

  /** Face the camera again (called when leaving the collection screen). */
  face() {
    this.autoReturn = true;
    this.dragging = false;
  }

  update(dt) {
    const ch = this.ch;
    if (!ch) return;
    if (!this.dragging) {
      if (this.autoReturn) {
        // unwind to the nearest full turn so it never spins the long way round
        const target = Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2;
        this.spin = damp(this.spin, target, 6, dt);
        this.spinVel = 0;
      } else {
        this.spin += this.spinVel * dt;
        this.spinVel = damp(this.spinVel, 0, 3, dt);
      }
    }
    ch.rig.root.rotation.y = this.spin;

    if (this.waves && !this.locked && !ch.animator.clip) {
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.waveT = 6 + Math.random() * 5;
        ch.animator.play('wave');
      }
    }
    ch.animator.update(dt);
    this.env.blob.position.x = ch.rig.pivot.position.x;
  }
}
