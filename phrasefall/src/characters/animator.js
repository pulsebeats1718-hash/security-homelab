/**
 * Animator — procedural animation for any Rig.
 *
 * Layers, evaluated every frame:
 *   1. shared idle      breathing, weight shift, glances, blinking
 *   2. character idle   the character's own personality loop (def.idle)
 *   3. gaze / worry     look up at the falling expression, flinch as it nears
 *   4. action clip      cheer, attack, hit, ko, select, appear, wave … blended on top
 *   5. secondary motion springs for ears, tails, hats, capes
 *
 * A pose is a flat set of offsets from the rest skeleton, so every clip works on
 * every character without retargeting.
 */
import { clamp, damp, ease, keys, lerp } from '../core/utils.js';

const KEYS = [
  'x', 'y', 'z', 'yaw', 'pitch', 'roll', 'sq', 'grow', 'hipsY', 'breath',
  'torsoX', 'torsoY', 'torsoZ',
  'headX', 'headY', 'headZ',
  'armLX', 'armLY', 'armLZ',
  'armRX', 'armRY', 'armRZ',
  'legLX', 'legLZ', 'legRX', 'legRZ',
  'tailX', 'tailY', 'tailZ',
];

const makePose = () => {
  const p = {};
  for (const k of KEYS) p[k] = 0;
  return p;
};
const zero = (p) => {
  for (const k of KEYS) p[k] = 0;
};

/** Raise both arms sideways/up by `a` radians (0 = hanging, ~2.6 = overhead). */
const armsUp = (P, a, spread = 0) => {
  P.armLZ += a + spread;
  P.armRZ -= a + spread;
};

/**
 * Action clips. fn(P, u) writes a full pose for progress u ∈ [0,1].
 * face: expression shown during the clip. hold: stay on the last frame.
 * events: [[u, name]] fired once as the clip passes u.
 */
export const CLIPS = {
  appear: {
    dur: 0.55,
    face: 'happy',
    fn(P, u) {
      P.grow = keys(u, [[0, -1], [0.55, 0.12], [0.8, -0.03], [1, 0]], ease.outCubic);
      P.y = keys(u, [[0, 0], [0.4, 0.28], [0.75, 0], [1, 0]], ease.outQuad);
      P.sq = keys(u, [[0, 0.2], [0.5, 0.1], [0.78, -0.16], [1, 0]]);
      P.yaw = (1 - ease.outCubic(u)) * -2.4;
      armsUp(P, keys(u, [[0, 0], [0.4, 1.6], [1, 0]]));
    },
  },

  /** Correct answer: a joyful hop. */
  cheer: {
    dur: 0.78,
    face: 'happy',
    fn(P, u) {
      const j = clamp((u - 0.14) / 0.56);
      P.y = u > 0.14 && u < 0.7 ? 0.62 * 4 * j * (1 - j) : 0;
      P.sq = keys(u, [[0, 0], [0.14, -0.2], [0.24, 0.16], [0.45, 0.02], [0.68, 0.1], [0.76, -0.2], [0.9, 0.05], [1, 0]]);
      armsUp(P, keys(u, [[0, 0], [0.14, -0.15], [0.32, 2.5], [0.7, 2.35], [1, 0]], ease.outCubic));
      P.armLX = P.armRX = keys(u, [[0, 0], [0.3, -0.25], [1, 0]]);
      P.legLX = keys(u, [[0, 0], [0.14, 0.2], [0.4, -0.7], [0.7, -0.1], [1, 0]]);
      P.legRX = keys(u, [[0, 0], [0.14, 0.2], [0.4, 0.45], [0.7, -0.1], [1, 0]]);
      P.headX = keys(u, [[0, 0], [0.14, 0.15], [0.35, -0.28], [0.8, 0.08], [1, 0]]);
      P.torsoX = keys(u, [[0, 0], [0.14, 0.12], [0.35, -0.1], [1, 0]]);
    },
  },

  /** Throw / cast upwards with the right arm. */
  attack: {
    dur: 0.42,
    face: 'focus',
    events: [[0.42, 'release']],
    fn(P, u) {
      // chibi arms cannot reach over the head, so the throw goes up and out to the side
      P.armRZ = keys(u, [[0, 0], [0.26, -0.5], [0.5, -2.0], [0.78, -1.9], [1, 0]], ease.outCubic);
      P.armRX = keys(u, [[0, 0], [0.26, 0.9], [0.5, 0.55], [0.78, 0.45], [1, 0]], ease.outCubic);
      P.armLX = keys(u, [[0, 0], [0.26, -0.5], [0.5, 0.5], [1, 0]]);
      P.armLZ = keys(u, [[0, 0], [0.3, 0.4], [1, 0]]);
      P.torsoY = keys(u, [[0, 0], [0.26, -0.38], [0.5, 0.3], [1, 0]]);
      P.torsoX = keys(u, [[0, 0], [0.26, 0.1], [0.5, -0.2], [1, 0]]);
      P.sq = keys(u, [[0, 0], [0.26, -0.14], [0.5, 0.14], [0.8, -0.04], [1, 0]]);
      P.y = keys(u, [[0, 0], [0.3, 0], [0.55, 0.14], [0.85, 0], [1, 0]], ease.outQuad);
      P.headX = keys(u, [[0, 0], [0.5, -0.34], [0.8, -0.3], [1, 0]]);
    },
  },

  /** Football-style volley for characters that kick rather than throw. */
  kick: {
    dur: 0.46,
    face: 'focus',
    events: [[0.44, 'release']],
    fn(P, u) {
      P.legRX = keys(u, [[0, 0], [0.28, 0.9], [0.5, -1.75], [0.75, -1.3], [1, 0]], ease.outCubic);
      P.legLX = keys(u, [[0, 0], [0.5, 0.15], [1, 0]]);
      P.torsoX = keys(u, [[0, 0], [0.28, 0.16], [0.5, -0.3], [1, 0]]);
      P.pitch = keys(u, [[0, 0], [0.5, -0.12], [1, 0]]);
      armsUp(P, keys(u, [[0, 0], [0.3, 0.5], [0.5, 1.1], [1, 0]]));
      P.armLX = keys(u, [[0, 0], [0.5, -0.6], [1, 0]]);
      P.armRX = keys(u, [[0, 0], [0.5, 0.7], [1, 0]]);
      P.y = keys(u, [[0, 0], [0.3, 0], [0.55, 0.16], [0.85, 0], [1, 0]], ease.outQuad);
      P.sq = keys(u, [[0, 0], [0.28, -0.12], [0.5, 0.1], [1, 0]]);
      P.headX = keys(u, [[0, 0], [0.5, -0.3], [1, 0]]);
    },
  },

  /** Bonked on the head by a falling expression. */
  hit: {
    dur: 0.95,
    face: 'hurt',
    fn(P, u) {
      const fade = 1 - u;
      P.sq = keys(u, [[0, 0], [0.07, -0.4], [0.2, 0.2], [0.34, -0.13], [0.5, 0.07], [0.68, -0.03], [1, 0]]);
      P.roll = Math.sin(u * Math.PI * 7) * 0.16 * fade;
      P.x = Math.sin(u * Math.PI * 9) * 0.06 * fade;
      P.headZ = Math.sin(u * Math.PI * 6 + 1) * 0.22 * fade;
      P.headX = keys(u, [[0, 0], [0.08, 0.38], [0.4, -0.1], [1, 0]]);
      armsUp(P, keys(u, [[0, 0], [0.1, 1.05], [0.5, 0.5], [1, 0]], ease.outCubic));
      P.armLX = Math.sin(u * 30) * 0.25 * fade;
      P.armRX = -Math.sin(u * 30) * 0.25 * fade;
      P.legLZ = keys(u, [[0, 0], [0.08, 0.25], [0.5, 0], [1, 0]]);
      P.legRZ = -P.legLZ;
    },
  },

  /** Last life lost: stagger, topple sideways and stay down. */
  ko: {
    dur: 1.25,
    face: 'ko',
    hold: true,
    events: [[0.62, 'thud']],
    fn(P, u) {
      P.sq = keys(u, [[0, 0], [0.06, -0.4], [0.16, 0.2], [0.3, 0], [0.62, 0], [0.7, -0.12], [0.85, 0.03], [1, 0]]);
      const wob = clamp(1 - u / 0.36);
      P.yaw = keys(u, [[0, 0], [0.3, 0.5], [0.62, 0.12], [1, 0.12]]);
      const fall = keys(u, [[0, 0], [0.32, 0.08], [0.62, 1], [1, 1]], ease.inQuad);
      const bounce = u > 0.62 ? Math.abs(Math.sin((u - 0.62) * 16)) * 0.12 * (1 - (u - 0.62) / 0.38) : 0;
      P.roll = fall * 1.5 - bounce + Math.sin(u * 40) * 0.1 * wob;
      P.y = fall * 0.36 + bounce * 0.5;
      P.x = fall * 0.5;
      armsUp(P, keys(u, [[0, 0], [0.1, 1.6], [0.62, 2.2], [1, 1.9]]));
      P.legLX = keys(u, [[0, 0], [0.62, -0.5], [1, -0.3]]);
      P.legRX = keys(u, [[0, 0], [0.62, 0.4], [1, 0.25]]);
      P.headZ = fall * -0.25;
    },
  },

  /** Chosen on the character screen: spin-jump and pose. */
  select: {
    dur: 1.0,
    face: 'happy',
    fn(P, u) {
      const j = clamp((u - 0.16) / 0.5);
      P.y = u > 0.16 && u < 0.66 ? 0.8 * 4 * j * (1 - j) : 0;
      P.yaw = keys(u, [[0, 0], [0.16, -0.3], [0.66, Math.PI * 2], [1, Math.PI * 2]], ease.inOutCubic);
      P.sq = keys(u, [[0, 0], [0.16, -0.24], [0.26, 0.18], [0.5, 0], [0.64, 0.1], [0.72, -0.22], [0.86, 0.06], [1, 0]]);
      armsUp(P, keys(u, [[0, 0], [0.16, -0.1], [0.34, 2.6], [0.8, 2.3], [1, 0]], ease.outCubic));
      P.legLX = keys(u, [[0, 0], [0.4, -0.6], [0.66, 0], [1, 0]]);
      P.legRX = keys(u, [[0, 0], [0.4, 0.5], [0.66, 0], [1, 0]]);
      P.headX = keys(u, [[0, 0], [0.35, -0.2], [0.8, 0.05], [1, 0]]);
    },
  },

  /** Friendly wave at the player. */
  wave: {
    dur: 1.5,
    face: 'happy',
    fn(P, u) {
      const up = keys(u, [[0, 0], [0.18, 1], [0.82, 1], [1, 0]]);
      P.armRZ = -2.5 * up + Math.sin(u * Math.PI * 9) * 0.32 * up;
      P.armRX = -0.2 * up;
      P.headZ = -0.14 * up;
      P.torsoZ = 0.05 * up;
      P.roll = 0.03 * up;
    },
  },

  /** New stage / streak: a quick power-up flex. */
  power: {
    dur: 0.9,
    face: 'happy',
    fn(P, u) {
      P.sq = keys(u, [[0, 0], [0.2, -0.22], [0.42, 0.2], [0.7, -0.05], [1, 0]]);
      P.y = keys(u, [[0, 0], [0.2, 0], [0.45, 0.32], [0.72, 0], [1, 0]], ease.outQuad);
      armsUp(P, keys(u, [[0, 0], [0.2, 0.3], [0.42, 2.2], [0.75, 2.0], [1, 0]], ease.outBack));
      P.armLX = P.armRX = keys(u, [[0, 0], [0.42, -0.5], [1, 0]]);
      P.headX = keys(u, [[0, 0], [0.2, 0.2], [0.45, -0.3], [1, 0]]);
    },
  },
};

export class Animator {
  /**
   * @param {import('./kit/rig.js').Rig} rig
   * @param {object} def character definition (may provide idle(P, t, rig, animator))
   */
  constructor(rig, def = {}) {
    this.rig = rig;
    this.def = def;
    this.t = Math.random() * 20;
    this.P = makePose();
    this.Q = makePose();
    this.clip = null;
    this.onEvent = null;
    /** 0…1 how strongly the character looks up at the sky. */
    this.gazeUp = 0;
    /** −1…1 sideways gaze. */
    this.gazeX = 0;
    /** 0…1 nervousness as an expression gets close. */
    this.worry = 0;
    this._gazeUp = 0;
    this._gazeX = 0;
    this._worry = 0;
    this._glance = 0;
    this._glanceTarget = 0;
    this._glanceT = 1 + Math.random() * 2;
    this._lastY = 0;
    this._lastYaw = 0;
    this._flash = 0;
    this.idleScale = 1;
  }

  /** Start an action clip. Returns its duration in seconds. */
  play(name, o = {}) {
    const def = CLIPS[name];
    if (!def) return 0;
    const dur = def.dur / (o.speed ?? 1);
    this.clip = { def, name, t: 0, dur, fired: 0, onDone: o.onDone ?? null };
    if (def.face && this.rig.face) this.rig.face.set(def.face, def.hold ? 0 : dur + (o.faceHold ?? 0.05));
    return dur;
  }

  stop() {
    this.clip = null;
    this.rig.face?.release();
  }

  get busy() {
    return !!this.clip && !this.clip.def.hold;
  }

  /** Flash the whole character (colour as THREE.Color-compatible hex). */
  flash(hex = 0xffffff, strength = 1) {
    this.rig.fx.flashColor.value.set(hex);
    this._flash = strength;
  }

  update(dt) {
    const { rig, P, Q } = this;
    this.t += dt;
    const t = this.t;
    zero(P);

    // 1 ── shared idle
    const b = Math.sin(t * 2.1);
    P.breath = b;
    P.headZ = Math.sin(t * 0.9) * 0.03;
    P.headX = Math.sin(t * 1.25 + 1) * 0.02;
    P.roll = Math.sin(t * 0.7) * 0.012;
    P.armLZ = b * 0.025;
    P.armRZ = -b * 0.025;
    P.armLX = Math.sin(t * 1.6) * 0.035;
    P.armRX = Math.sin(t * 1.6 + Math.PI) * 0.035;
    P.tailZ = Math.sin(t * 1.8) * 0.12;

    // occasional glance left / right
    this._glanceT -= dt;
    if (this._glanceT <= 0) {
      this._glanceTarget = Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 0.7;
      this._glanceT = 1.4 + Math.random() * 2.8;
    }
    this._glance = damp(this._glance, this._glanceTarget, 5, dt);

    // 2 ── character idle
    if (this.def.idle) this.def.idle(P, t, rig, this);

    // 3 ── gaze + worry
    this._gazeUp = damp(this._gazeUp, this.gazeUp, 7, dt);
    this._gazeX = damp(this._gazeX, this.gazeX, 7, dt);
    this._worry = damp(this._worry, this.worry, 6, dt);
    const g = this._gazeUp;
    P.headY += this._glance * (1 - g) + this._gazeX * 0.35;
    P.headX += -0.46 * g;
    P.torsoX += -0.07 * g;
    const w = this._worry;
    if (w > 0.01) {
      P.x += Math.sin(t * 38) * 0.012 * w;
      armsUp(P, 0.5 * w);
      P.armLX += -0.5 * w;
      P.armRX += -0.5 * w;
      P.sq += -0.05 * w;
      P.legLZ += 0.08 * w;
      P.legRZ += -0.08 * w;
    }

    // 4 ── action clip
    const c = this.clip;
    if (c) {
      c.t += dt;
      const u = clamp(c.t / c.dur);
      zero(Q);
      c.def.fn(Q, u, rig);
      const wIn = clamp(c.t / 0.07);
      const wOut = c.def.hold ? 1 : clamp((c.dur - c.t) / 0.14);
      const wt = Math.min(wIn, wOut);
      for (const key of KEYS) P[key] = lerp(P[key], Q[key], wt);
      const ev = c.def.events;
      if (ev) {
        while (c.fired < ev.length && u >= ev[c.fired][0]) {
          this.onEvent?.(ev[c.fired][1], c.name);
          c.fired++;
        }
      }
      if (c.t >= c.dur && !c.def.hold) {
        this.clip = null;
        c.onDone?.();
      } else if (c.t >= c.dur && c.def.hold && c.onDone) {
        const done = c.onDone;
        c.onDone = null;
        done();
      }
    }

    // optional per-character limits (e.g. long robes that legs must not poke through)
    if (this.def.constrain) this.def.constrain(P, rig, this);

    // ── apply to skeleton
    const J = rig.joints;
    const s = 1 + P.grow;
    rig.pivot.position.set(P.x, P.y, P.z);
    rig.pivot.rotation.set(P.pitch, P.yaw, P.roll);
    rig.pivot.scale.set(Math.max(0.001, s * (1 - P.sq * 0.55)), Math.max(0.001, s * (1 + P.sq)), Math.max(0.001, s * (1 - P.sq * 0.55)));
    if (J.hips) J.hips.obj.position.y = J.hips.py + P.hipsY;
    if (J.torso) {
      J.torso.obj.rotation.set(J.torso.rx + P.torsoX, J.torso.ry + P.torsoY, J.torso.rz + P.torsoZ);
      J.torso.obj.scale.set(1 + P.breath * 0.01, 1 + P.breath * 0.016, 1 + P.breath * 0.022);
    }
    if (J.head) J.head.obj.rotation.set(J.head.rx + P.headX, J.head.ry + P.headY, J.head.rz + P.headZ);
    if (J.armL) J.armL.obj.rotation.set(J.armL.rx + P.armLX, J.armL.ry + P.armLY, J.armL.rz + P.armLZ);
    if (J.armR) J.armR.obj.rotation.set(J.armR.rx + P.armRX, J.armR.ry + P.armRY, J.armR.rz + P.armRZ);
    if (J.legL) J.legL.obj.rotation.set(J.legL.rx + P.legLX, J.legL.ry, J.legL.rz + P.legLZ);
    if (J.legR) J.legR.obj.rotation.set(J.legR.rx + P.legRX, J.legR.ry, J.legR.rz + P.legRZ);
    if (J.tail) J.tail.obj.rotation.set(J.tail.rx + P.tailX, J.tail.ry + P.tailY, J.tail.rz + P.tailZ);

    // 5 ── secondary motion, props, face, flash
    const inv = dt > 0 ? 1 / dt : 0;
    const vy = clamp((P.y - this._lastY) * inv, -8, 8);
    const vyaw = clamp((P.yaw - this._lastYaw) * inv, -12, 12);
    this._lastY = P.y;
    this._lastYaw = P.yaw;
    rig.updateSprings(t, dt, vy, vyaw);
    for (const fn of rig.tickers) fn(t, dt, rig, this);
    if (rig.face) {
      if (!c) {
        const mood = w > 0.55 ? 'worried' : 'neutral';
        if (rig.face.base !== mood) rig.face.setBase(mood);
      }
      rig.face.update(dt);
    }
    if (this._flash > 0 || rig.fx.flash.value > 0) {
      this._flash = Math.max(0, this._flash - dt * 4.5);
      rig.fx.flash.value = this._flash * this._flash;
    }
  }
}
