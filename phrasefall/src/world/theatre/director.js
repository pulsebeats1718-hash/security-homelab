/**
 * Director — runs Literal Theatre's scenes on the island.
 *
 *   director.play(def)       build a scene (taking the previous one down) and frame the camera on it
 *   director.clear()         take the scene down: guests and props go, the hero is given back idle
 *   director.setArea(a, s)   the free band of the screen { top, bottom } in px (between the
 *                            interface's header and its bottom panel); the camera reframes
 *   director.celebrate()     confetti and happy faces for a right answer
 *   director.bow(big)        the curtain call at the end of a round: the hero alone on the dais
 *   director.seek(t)         jump to a moment of the scene (previews and screenshots)
 *
 * A scene definition (one module per idiom in ./scenes/, named after the expression id):
 *
 *   export default {
 *     id: 'spill-the-beans',            // the expression id in the game's database
 *     loop: 6,                          // seconds; the scene plays round and round
 *     frame: { x, y, z, w, h },         // the box (world units) the camera must show
 *     view: { yaw, pitch },             // optional camera angle (default a gentle 3/4 view)
 *     avoid: ['…'],                     // idioms never offered as wrong answers for this scene
 *     build(s) { …; return { update(t, dt) {} }; },   // s: the SceneKit (kit.js)
 *     celebrate(s) {},                  // optional: extra delight when the player gets it right
 *   };
 *
 * The scene's update(t) should be a function of the scene time t so that it loops cleanly;
 * s.cue(t0) fires one-off moments (sparkles, sounds) once per loop.
 */
import * as THREE from 'three';
import { SceneKit } from './kit.js';

const CURTAIN = { x: 0, y: 1.05, z: 0, w: 3.6, h: 2.7 };
const _v = new THREE.Vector3();

export class Director {
  constructor(app) {
    this.app = app;
    this.stage = app.stage;
    /** The playing scene: { def, s, live } or null. */
    this.scene = null;
    this.t = 0;
    this.area = null;
    this._framing = CURTAIN;
    // one listener for the life of the app; it does nothing while no scene plays
    this.stage.onUpdate((dt) => this.update(dt));
  }

  get playing() {
    return this.scene?.def.id ?? null;
  }

  /** Build and start a scene. */
  play(def, { seconds = 0.9 } = {}) {
    this.clear();
    const s = new SceneKit(this, def);
    let live;
    try {
      live = def.build(s) ?? {};
    } catch (err) {
      console.error(`Theatre scene "${def.id}" failed to build:`, err);
      s.dispose();
      return false;
    }
    this.scene = { def, s, live };
    this.t = 0;
    s._tick(-1e-6, 0, false, 0);
    live.update?.(0, 0);
    s._after(0);
    this._framing = def.frame ?? CURTAIN;
    this._view = def.view ?? null;
    this.frame(seconds);
    return true;
  }

  /** Take the current scene down and give the island back as it was. */
  clear() {
    const sc = this.scene;
    if (!sc) return;
    this.scene = null;
    try {
      sc.live.dispose?.();
    } catch (err) {
      console.error(`Theatre scene "${sc.def.id}" failed to clean up:`, err);
    }
    sc.s.dispose();
    this.app.hero.ch?.animator.stop();
  }

  /** Jump to time t of the current scene (previews, screenshots). */
  seek(t) {
    const sc = this.scene;
    if (!sc) return;
    const loop = sc.def.loop ?? 6;
    this.t = ((t % loop) + loop) % loop;
    sc.s._tick(this.t - 1e-6, this.t, false, 0);
  }

  update(dt) {
    const sc = this.scene;
    if (!sc) return;
    const loop = sc.def.loop ?? 6;
    const prev = this.t;
    let t = prev + dt;
    let wrapped = false;
    if (t >= loop) {
      t -= loop;
      wrapped = true;
      sc.s.loops++;
    }
    this.t = t;
    sc.s._tick(prev, t, wrapped, dt);
    try {
      sc.live.update?.(t, dt);
      sc.s._after(dt);
    } catch (err) {
      console.error(`Theatre scene "${sc.def.id}" failed:`, err);
      this.clear();
    }
  }

  // ── camera ─────────────────────────────────────────────────────────────
  /** The free band of the screen in px ({ top, bottom }); the camera keeps the action inside it. */
  setArea(area, seconds = 0.5) {
    this.area = area;
    this.frame(seconds);
  }

  /** Glide the camera so the scene's frame box fills the free band. */
  frame(seconds = 0.6) {
    const st = this.stage;
    const f = this._framing;
    const view = this._view ?? {};
    const top = this.area?.top ?? 0;
    const bottom = this.area?.bottom ?? st.height;
    const bandH = Math.max(120, bottom - top);
    const portrait = st.height > st.width * 1.05;
    // leave a little air round the action; phones held upright are narrow, so fit the width first
    const ppu = Math.min((bandH * 0.92) / f.h, (st.width * (portrait ? 0.94 : 0.8)) / f.w);
    const span = st.height / Math.max(10, ppu);
    const oy = (top + bottom) / 2 - st.height / 2;
    st.setShot({ fx: f.x ?? 0, fy: f.y ?? 1, fz: f.z ?? 0, yaw: view.yaw ?? 0.2, pitch: view.pitch ?? 0.13, span, ox: 0, oy, drift: 0.45 }, seconds);
  }

  // ── moments ────────────────────────────────────────────────────────────
  /** A right answer: confetti over the stage, sparkles and happy faces. */
  celebrate() {
    const sc = this.scene;
    const f = this._framing;
    const fx = this.app.fx;
    _v.set(f.x ?? 0, (f.y ?? 1) + f.h * 0.2, (f.z ?? 0) + 0.6);
    fx.confetti(_v, { count: 54, spread: 3.4 });
    fx.burst(_v, { count: 30, color: 0xffe08a, color2: 0xffffff, speed: 5, size: 0.6, life: 0.8, gravity: 2, spread: 1.2, up: 1.5 });
    if (!sc) return;
    for (const a of sc.s.actors) {
      a.mood('happy');
      a.flash(0xfff3c4, 0.45);
    }
    try {
      sc.def.celebrate?.(sc.s);
    } catch (err) {
      console.error(`Theatre scene "${sc.def.id}" celebrate failed:`, err);
    }
  }

  /** The curtain call: the stage is cleared and the hero takes a bow (a big one for a great round). */
  bow(big = false) {
    this.clear();
    this._framing = CURTAIN;
    this._view = { yaw: -0.2, pitch: 0.11 };
    this.frame(1);
    const hero = this.app.hero;
    hero.play(big ? 'select' : 'cheer');
    if (big) {
      _v.set(0, 2.2, 0.4);
      this.app.fx.confetti(_v, { count: 60, spread: 3.6 });
    }
  }
}
