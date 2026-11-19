/**
 * Juice — how every moment of play feels. Listens to the game's events and answers them with light
 * and particles (effects.js), a camera jolt (the stage's shake) and the character's own glow.
 *
 *   right answer   the card's glitter flies up to the score, a soft shockwave runs across the dais,
 *                  sparkles spiral round the character, a small camera punch; golden cards add a
 *                  burst of light; streaks of 5, 10, 15 … grow more splendid each time
 *   wrong answer   a dull puff where the card lands and a little dust round the feet (the card itself
 *                  wobbles on its way down, card.js)
 *   fever          a warm energy aura round the character (its rim glows, the bloom spreads it), a
 *                  flickering glow behind it, sparkles trailing up round it and a glow on the dais
 *   golden cards   a trail of golden glitter as they fall (their rays and shimmer are in card.js)
 *   level-ups and  confetti, light bursts and a little jump on the island (no jump mid-question,
 *   new characters nor from a knocked-out character)
 *
 * Bosses look after their own storm (boss.js); they get the effects through attach().
 * Everything is pooled and scaled by the quality tier; nothing here changes the game's rules or timing.
 */
import * as THREE from 'three';
import { getCharacter } from '../characters/index.js';

const FEVER = new THREE.Color(0xff6a2b);
const FEVER_CORE = new THREE.Color(0xffc45a);
const GOLD = 0xffc83d;

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// the fever aura behind the character: a soft body of warm light with flame tongues licking upwards
const AURA_FRAG = /* glsl */ `
uniform float uTime;
uniform float uLevel;
uniform vec3 uCore;
uniform vec3 uEdge;
varying vec2 vUv;
void main() {
  vec2 p = vUv;
  float r = length(p * vec2(1.0, 0.8));
  float up = smoothstep(-0.3, 1.0, p.y);
  float n = sin(p.x * 8.0 + uTime * 2.1) * 0.5 + sin(p.x * 15.0 - uTime * 3.3 + p.y * 4.0) * 0.3 + sin(p.y * 7.0 - uTime * 7.5 + p.x * 3.0) * 0.35;
  float edge = 0.74 + 0.2 * n * up;
  float body = smoothstep(edge, edge - 0.5, r);
  float core = smoothstep(0.75, 0.0, r);
  float flick = 0.88 + 0.12 * sin(uTime * 11.0 + p.y * 5.0);
  vec3 col = mix(uEdge, uCore, core);
  float a = body * uLevel * (0.4 + 0.6 * core) * flick;
  gl_FragColor = vec4(col * (1.0 + core * 0.8), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// a glow on the dais: warm light pooling under the character, rays turning slowly, a pulsing ring
const DAIS_FRAG = /* glsl */ `
uniform float uTime;
uniform float uLevel;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float glow = exp(-r * r * 3.2) * 0.75;
  float pulse = 0.5 + 0.06 * sin(uTime * 4.0);
  float ring = exp(-pow((r - pulse) / 0.05, 2.0)) * 0.45 + exp(-pow((r - fract(uTime * 0.45) * 0.95) / 0.04, 2.0)) * 0.3 * (1.0 - fract(uTime * 0.45));
  float ang = atan(vUv.y, vUv.x);
  float rays = pow(abs(sin(ang * 6.0 + uTime * 0.7)), 10.0) * smoothstep(1.0, 0.25, r) * 0.3;
  float a = (glow + ring + rays) * uLevel * smoothstep(1.0, 0.75, r);
  gl_FragColor = vec4(uColor * (1.0 + glow), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _t = new THREE.Vector3();
const _c = new THREE.Color();

export class Juice {
  /**
   * @param {{ stage: object, fx: import('./effects.js').Effects, game: object, hero: object }} o
   */
  constructor({ stage, fx, game, hero }) {
    this.stage = stage;
    this.fx = fx;
    this.game = game;
    this.hero = hero;
    this.events = game.events;
    this.t = 0;
    this.feverOn = false;
    this.fever = 0; // 0…1, eased
    this.feverSparkT = 0;
    this.goldT = 0;
    this.later = [];
    this.screen = null;
    this.ending = null; // the last game's results, for celebrations on the results screen

    const plane = new THREE.PlaneGeometry(2, 2);
    this.auraU = { uTime: { value: 0 }, uLevel: { value: 0 }, uCore: { value: FEVER_CORE.clone() }, uEdge: { value: FEVER.clone() } };
    this.aura = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: this.auraU, vertexShader: QUAD_VERT, fragmentShader: AURA_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.aura.visible = false;
    this.aura.renderOrder = 2;
    stage.scene.add(this.aura);
    this.daisU = { uTime: { value: 0 }, uLevel: { value: 0 }, uColor: { value: FEVER.clone() } };
    this.dais = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: this.daisU, vertexShader: QUAD_VERT, fragmentShader: DAIS_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.dais.rotation.x = -Math.PI / 2;
    this.dais.position.y = 0.03;
    this.dais.scale.setScalar(2.5);
    this.dais.visible = false;
    this.dais.renderOrder = 1;
    stage.scene.add(this.dais);

    game.boss3d?.attach?.(fx, stage);
    this._listen();
  }

  get tier() {
    return this.stage.qualityName;
  }
  get ch() {
    return this.hero.ch;
  }

  _after(seconds, fn) {
    this.later.push({ t: seconds, fn });
  }

  /** Where the character stands (its feet), into `out`. */
  _feet(out) {
    if (this.ch) this.ch.rig.root.getWorldPosition(out);
    else out.set(0, 0, 0);
    return out;
  }

  /** Behind the character at chest height (where bursts of light go), into `out`. */
  _behind(out) {
    this._feet(out);
    return out.set(out.x, (this.ch?.rig.metrics.height ?? 2) * 0.55, out.z - 0.45);
  }

  /** The score at the top of the screen, as a point in the world at the card's distance. */
  _scoreTarget(out, from) {
    const st = this.stage;
    const cam = st.camera;
    const ndcY = 1 - (2 * Math.min(66, st.height * 0.075)) / st.height;
    out.set(0, ndcY, 0.5).unproject(cam).sub(cam.position).normalize();
    const dist = cam.position.distanceTo(from) * 0.94;
    return out.multiplyScalar(dist).add(cam.position);
  }

  _listen() {
    const on = (name, fn) => this.events.on(name, fn);
    on('game:score', (p) => this._right(p));
    on('game:damage', () => this._thud(false));
    on('game:missed', (p) => this._thud(true, p));
    on('game:fever', ({ on: v, quiet }) => this._setFever(v, quiet));
    on('game:stage', () => this._stageUp());
    on('game:intro', () => {
      this.ending = null;
      this._setFever(false, true);
    });
    on('game:ending', (r) => {
      this.ending = { unlocked: [...(r.unlocked ?? []), ...(this.ending?.unlocked ?? [])], newBest: !!r.newBest, ko: r.reason === 'ko', level: this.ending?.level ?? null };
      this._setFever(false, true);
    });
    on('progress:goal', (p) => {
      if (p?.unlocked?.length && this.game.active) (this.ending ??= { unlocked: [], newBest: false, ko: false, level: null }).unlocked.push(...p.unlocked);
    });
    on('progress:level', (p) => this._levelUp(p));
    on('achievement:unlocked', () => {
      if (this.game.state === 'playing' || this.game.state === 'resolving') return;
      this.fx.swirl(this._feet(_v).setY(0.4), { count: this.fx.n(10), color: 0xfff3c4, color2: GOLD, size: 0.6, height: 1.6 });
    });
    on('ui:screen', (name) => {
      this.screen = name;
      if (name === 'results' && this.ending) this._results(this.ending);
    });
  }

  // ── right ───────────────────────────────────────────────────────────────
  _right(p) {
    const fx = this.fx;
    const card = this.game.card;
    const from = _v.copy(card.pos);
    const accent = card.accent.getHex();
    const golden = !!p.golden;
    // the card's glitter flies up to the score
    const to = this._scoreTarget(_w, from);
    fx.glitter(from, to, card.halfWidth * 0.8, {
      count: fx.n(golden ? 30 : 20),
      colors: golden ? [0xffffff, 0xffe08a, 0xffc83d, 0xfff3c4] : [0xffffff, 0xfff3c4, accent],
      size: golden ? 0.62 : 0.5,
      speed: 4.2,
      delay: 0.14,
      stars: 0.4,
    });
    // a soft shockwave across the dais and sparkles spiralling up round the character
    const feet = this._feet(_t);
    fx.ring(_w.copy(feet).setY(0.05), { color: golden ? GOLD : accent, from: 0.5, to: 2.9, life: 0.6, flat: true, opacity: 0.55, width: 0.09, fill: 0.5 });
    if (this.tier !== 'low') fx.swirl(_w.copy(feet).setY(0.25), { count: fx.n(golden ? 12 : 8), color: 0xffffff, color2: golden ? GOLD : accent, size: 0.62, height: 1.5, radius: 0.72 });
    if (golden) {
      fx.burstRays(from, { color: 0xffe7a3, size: card.halfWidth * 2.4, life: 0.9, opacity: 0.7, spin: 0.6, count: 16 });
      fx.flash(0xffd98a, 0.1, 0.25);
    }
    // the camera punch: a small jolt, bigger for golden cards and streaks
    let punch = golden ? 6 : 3.5;
    const level = p.bonus ? Math.floor((p.streak ?? 0) / 5) : 0;
    if (level > 0) punch = this._streak(level, feet, p);
    if (!p.safe) this.stage.shake(punch, 0.2 + Math.min(level, 3) * 0.04);
  }

  /** A streak of 5, 10, 15 …: more splendid each time (level 1, 2, 3 …). Returns the camera punch. */
  _streak(level, feet, p) {
    const fx = this.fx;
    const big = level % 2 === 0; // the tens
    const k = Math.min(level, 4);
    const col = big ? FEVER.getHex() : GOLD;
    fx.ring(_w.copy(feet).setY(0.06), { color: col, from: 0.4, to: 3.6 + k * 0.4, life: 0.7, flat: true, opacity: 0.75, width: 0.06, fill: 0.6 });
    this._after(0.12, () => fx.ring(_w.copy(this._feet(_v)).setY(0.06), { color: 0xffffff, from: 0.3, to: 2.6 + k * 0.3, life: 0.55, flat: true, opacity: 0.5, width: 0.05 }));
    fx.burstRays(this._behind(_w), { color: big ? 0xffb366 : 0xffe7a3, size: 3.6 + k * 0.7, life: 1.1 + k * 0.15, opacity: 0.45 + k * 0.08, spin: 0.4, count: 12 + k * 2 });
    fx.swirl(_w.copy(feet).setY(0.2), { count: fx.n(12 + k * 5), color: 0xffffff, color2: col, size: 0.75, height: 2.0, radius: 0.85, spin: 3.6, rise: 1.8 });
    // a fountain of sparks rising from the dais
    _w.copy(feet).setY(0.15);
    for (let i = 0, n = fx.n(10 + k * 6); i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.9;
      fx.spark(_w.x + Math.cos(a) * r, _w.y, _w.z + Math.sin(a) * r * 0.8, Math.cos(a) * 0.4, 3.5 + Math.random() * 3 + k * 0.5, Math.sin(a) * 0.3, Math.random() < 0.5 ? 0xffffff : col, 0.5 + Math.random() * 0.3, 0.7 + Math.random() * 0.4, 4, 1.2);
    }
    if (big) fx.flash(0xffc27a, 0.08 + k * 0.025, 0.3);
    return 6 + k * 1.6;
  }

  // ── wrong ───────────────────────────────────────────────────────────────
  /** The card lands: a dull puff where it hits and a little dust round the feet. */
  _thud(safe) {
    const fx = this.fx;
    const card = this.game.card;
    _v.copy(card.pos);
    fx.puff(_v, { count: fx.n(safe ? 6 : 9), color: safe ? 0xd8cfe0 : 0xa79fbf, size: 0.55 * card.scale + 0.25, life: 0.75, speed: 1.6, up: 0.3, spread: card.halfWidth * 0.6, alpha: safe ? 0.55 : 0.75 });
    const feet = this._feet(_w);
    fx.puff(feet.setY(0.1), { count: fx.n(5), color: 0xcfc4b4, size: 0.32, life: 0.6, speed: 1.8, up: 0.15, spread: 0.6, alpha: 0.5, grow: 1.5 });
  }

  // ── fever ───────────────────────────────────────────────────────────────
  _setFever(on, quiet = false) {
    if (this.feverOn === on) return;
    this.feverOn = on;
    if (!on || quiet || !this.ch) return;
    const fx = this.fx;
    const feet = this._feet(_v);
    fx.burstRays(this._behind(_w), { color: 0xffb070, size: 5.2, life: 1.5, opacity: 0.65, spin: 0.5, count: 16 });
    fx.flash(0xffa060, 0.16, 0.35);
    fx.swirl(_w.copy(feet).setY(0.2), { count: fx.n(22), color: 0xffd27a, color2: FEVER.getHex(), size: 0.8, height: 2.1, radius: 0.9, spin: 4, rise: 2 });
    fx.ring(_w.copy(feet).setY(0.06), { color: 0xffd27a, from: 0.3, to: 4.8, life: 0.9, flat: true, opacity: 0.7, width: 0.05, fill: 0.7 });
  }

  // ── stage, level, unlocks ───────────────────────────────────────────────
  _stageUp() {
    if (!this.ch) return;
    this.fx.burstRays(this._behind(_v), { color: 0xfff1c4, size: 5, life: 1.6, opacity: 0.55, spin: 0.3, count: 14 });
    this.fx.flash(0xfff1d6, 0.1, 0.4);
  }

  _levelUp() {
    const g = this.game;
    if (g.active && g.state !== 'over') {
      // mid-game: light and sparkle on the island, no jump (the next card is on its way)
      this._celebrate({ jump: false, confetti: 26, rays: 4.2, flash: 0.06 });
    } else if (g.state === 'over' && this.screen !== 'results') {
      // the game has just ended: celebrate once the results are up
      (this.ending ??= { unlocked: [], newBest: false, ko: false, level: null }).level = true;
    } else {
      this._celebrate({ jump: true, confetti: 60, rays: 5.5, flash: 0.12 });
    }
  }

  /** The results are up: a level reached as the game ended, and any new characters. */
  _results(e) {
    this.ending = null;
    if (e.level) this._after(0.9, () => this._celebrate({ jump: !e.ko, confetti: 60, rays: 5.5, flash: 0.1 }));
    if (e.unlocked.length) {
      // in time with the results' "new character" card
      const colors = [...new Set(e.unlocked.map((id) => getCharacter(id)?.accent).filter((c) => c != null)), 0xffffff, 0xffe08a];
      this._after(1.1 + (e.newBest ? 0.9 : 0), () => this._celebrate({ jump: !e.ko, confetti: 70, rays: 6, flash: 0.14, colors }));
    }
  }

  /** Confetti, a burst of light, sparkles and (if the character is free to) a little jump. */
  _celebrate({ jump = true, confetti = 50, rays = 5, flash = 0.1, colors = null } = {}) {
    const ch = this.ch;
    if (!ch || this.screen === 'splash') return;
    const fx = this.fx;
    const feet = this._feet(_v);
    const top = ch.rig.metrics.height;
    fx.confetti(_w.copy(feet).setY(top * 0.8), { count: fx.n(confetti), spread: 3.6, ...(colors ? { colors } : {}) });
    fx.burstRays(this._behind(_t), { color: 0xfff1c4, size: rays, life: 1.8, opacity: 0.6, spin: 0.35, count: 16 });
    fx.swirl(_w.copy(feet).setY(0.2), { count: fx.n(16), color: 0xffffff, color2: 0xffe08a, size: 0.75, height: 2.2, radius: 0.9 });
    fx.ring(_w.copy(feet).setY(0.06), { color: 0xffe9a8, from: 0.4, to: 4.2, life: 0.8, flat: true, opacity: 0.6, width: 0.06, fill: 0.6 });
    if (flash) fx.flash(0xfff1d6, flash, 0.35);
    const a = ch.animator;
    if (jump && a.clip?.name !== 'ko' && !a.busy) a.play('select');
  }

  // ── frame ───────────────────────────────────────────────────────────────
  update(dt) {
    this.t += dt;
    for (let i = this.later.length - 1; i >= 0; i--) {
      const l = this.later[i];
      l.t -= dt;
      if (l.t <= 0) {
        this.later.splice(i, 1);
        l.fn();
      }
    }
    const ch = this.ch;
    const fx = this.fx;
    const low = this.tier === 'low';

    // fever: the aura round the character, the glow behind it and on the dais, trailing sparkles
    this.fever += ((this.feverOn ? 1 : 0) - this.fever) * Math.min(1, dt * (this.feverOn ? 3 : 2.2));
    if (this.fever < 0.004 && !this.feverOn) this.fever = 0;
    const f = this.fever;
    if (ch) {
      const fxu = ch.rig.fx;
      if (fxu.aura) {
        fxu.aura.value = f * (0.8 + 0.2 * Math.sin(this.t * 5.3)) * (low ? 0.7 : 1);
        if (f > 0) fxu.auraColor.value.copy(FEVER).lerp(FEVER_CORE, 0.35 + 0.25 * Math.sin(this.t * 2.1));
      }
    }
    const show = f > 0.005 && !!ch;
    this.aura.visible = show;
    this.dais.visible = show;
    if (show) {
      const top = ch.rig.metrics.height;
      this._feet(_v);
      this.aura.position.set(_v.x + ch.rig.pivot.position.x, top * 0.5 + ch.rig.pivot.position.y, _v.z - 0.35);
      this.aura.quaternion.copy(this.stage.camera.quaternion);
      this.aura.scale.set(top * 0.62, top * 0.72, 1);
      this.auraU.uTime.value = this.t;
      this.auraU.uLevel.value = f * (low ? 0.55 : 0.85);
      this.dais.position.x = _v.x;
      this.dais.position.z = _v.z;
      this.daisU.uTime.value = this.t;
      this.daisU.uLevel.value = f * (low ? 0.6 : 0.8);
      // sparkles trailing up round the character
      this.feverSparkT -= dt;
      if (this.feverOn && this.feverSparkT <= 0) {
        this.feverSparkT = low ? 0.14 : this.tier === 'high' ? 0.045 : 0.07;
        const a = this.t * 4.2 + Math.random() * 1.2;
        const r = 0.6 + Math.random() * 0.25;
        const y = 0.2 + Math.random() * top * 0.9;
        fx.spark(_v.x + Math.cos(a) * r, y, _v.z + Math.sin(a) * r * 0.75, -Math.sin(a) * 2.2, 1.2 + Math.random() * 1.2, Math.cos(a) * 1.6, Math.random() < 0.5 ? 0xffe2a0 : 0xff9a52, -(0.55 + Math.random() * 0.35), 0.8 + Math.random() * 0.4, -0.3, 1.6);
      }
    }

    // golden cards: a trail of glitter as they fall
    const card = this.game.card;
    if (card.golden && (card.state === 'in' || card.state === 'fall')) {
      this.goldT -= dt;
      if (this.goldT <= 0) {
        this.goldT = low ? 0.09 : this.tier === 'high' ? 0.022 : 0.035;
        const hw = card.halfWidth;
        const star = Math.random() < 0.35;
        fx.spark(card.pos.x + (Math.random() * 2 - 1) * hw * 0.95, card.pos.y + card.halfHeight * (0.2 + Math.random() * 0.9), card.pos.z - 0.15, (Math.random() - 0.5) * 0.5, 0.9 + Math.random() * 1.4, -0.2, Math.random() < 0.45 ? 0xffffff : Math.random() < 0.5 ? 0xffd45e : 0xffe9a8, (star ? -1 : 1) * (0.42 + Math.random() * 0.35), 0.6 + Math.random() * 0.5, -1.2, 1.1);
      }
    }
  }
}
