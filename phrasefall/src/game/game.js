/**
 * Game — the rules of a run.
 *
 *   An expression falls. Pick its meaning from four options before it lands.
 *   Right: +100 and the streak grows (bonus at 5, bigger bonus at 10).
 *   Wrong or too slow: lose one of three lives. No lives left: game over.
 *   Every eight correct answers the stage, vocabulary and time of day move on.
 *
 * This module owns state and timing only. It talks to the interface through
 * events and to the 3D world through the stage / environment / effects objects.
 */
import * as THREE from 'three';
import { STAGES, PACE, SCORING, streakBonus } from '../data/stages.js';
import { BY_STAGE } from '../data/expressions/index.js';
import { ExpressionCard } from './card.js';
import { shots } from './shots.js';
import { clamp, shuffle, smoothstep } from '../core/utils.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

export class Game {
  constructor({ stage, env, fx, audio, save, events }) {
    this.stage = stage;
    this.env = env;
    this.fx = fx;
    this.audio = audio;
    this.save = save;
    this.events = events;
    this.card = new ExpressionCard(stage.scene);
    this.ch = null;
    this.state = 'idle'; // idle | intro | playing | resolving | stageup | over
    this.paused = false;
    this.timers = [];
    this.layout = { panelH: 240, hudH: 84 };
    this.metrics = null;
    this.dizzyAnchor = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.lives = SCORING.lives;
    this.stageIndex = 0;
    this.correctInStage = 0;
    this.answered = 0;
    this.correct = 0;
    this.wrong = [];
    this.seen = [];
    this.used = new Set();
    this.deck = [];
    this.question = null;
    this.fallTime = 10;
    this.tickT = 0;
    this.trailT = 0;
    this.timers.length = 0;
    this.pendingBurst = null;
  }

  get stageDef() {
    return STAGES[this.stageIndex];
  }
  get active() {
    return this.state !== 'idle' && this.state !== 'over';
  }

  setCharacter(ch) {
    this.ch = ch;
    ch.animator.onEvent = (name) => this._onAnimEvent(name);
  }

  /** The interface reports how much room its panels take; the camera frames the rest. */
  setLayout(panelH, hudH) {
    this.layout = { panelH, hudH };
    if (this.active) this.applyShot(0.25);
  }

  applyShot(seconds = 0.9) {
    this.metrics = shots.play(this.stage, this.layout.panelH, this.layout.hudH);
    this.stage.setShot(this.metrics.shot, seconds);
  }

  after(seconds, fn) {
    this.timers.push({ t: seconds, fn });
  }

  _set(state) {
    this.state = state;
    this.events.emit('game:state', state);
  }

  // ── run lifecycle ───────────────────────────────────────────────────────
  start() {
    this.reset();
    this.paused = false;
    this.card.hide();
    this.fx.setDizzy(false);
    this.env.setDim(0);
    this.env.setTheme(this.stageDef.theme, 1.4);
    this.env.island.setStreak(0);
    this.ch.animator.stop();
    this.ch.animator.gazeUp = 0;
    this.ch.animator.worry = 0;
    this.audio.music?.muffle(false);
    this.audio.music?.set('game', 1);
    this.applyShot(1.0);
    this._set('intro');
    this.events.emit('game:intro', { stage: this.stageDef, lives: this.lives });
    this.audio.play('start');
    this.after(0.55, () => {
      this.audio.play('ready');
      this.ch.animator.play('power');
    });
    this.after(1.45, () => {
      this.audio.play('go');
      this.events.emit('game:go');
    });
    this.after(1.75, () => this.nextCard());
  }

  pause() {
    if (!this.active || this.paused) return;
    this.paused = true;
    this.audio.music?.muffle(true);
    this.events.emit('game:pause', true);
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.audio.music?.muffle(false);
    this.events.emit('game:pause', false);
  }

  /** Leave the run without recording it. */
  quit() {
    this.timers.length = 0;
    this.paused = false;
    this.card.hide();
    this.fx.setDizzy(false);
    this.env.setDim(0);
    if (this.ch) {
      this.ch.animator.stop();
      this.ch.animator.gazeUp = 0;
      this.ch.animator.worry = 0;
    }
    this.env.island.setStreak(0);
    this.audio.music?.muffle(false);
    this._set('idle');
  }

  // ── questions ───────────────────────────────────────────────────────────
  _refillDeck() {
    const save = this.save;
    let weigh = (e) => {
      const s = save.stat(e.id);
      if (!s || !s.seen) return 2;
      if (s.practise) return 3;
      if (save.needsWork(e.id)) return 2.6;
      if (save.isMastered(e.id)) return 0.6;
      return 1.2;
    };
    // harder expressions (level 2, then 3) join the mix as the player discovers more of the stage
    const stageList = BY_STAGE[this.stageIndex];
    const found = stageList.reduce((n, e) => n + (save.stat(e.id)?.seen ? 1 : 0), 0);
    const levelFactor = [1, 1, clamp(0.25 + found / 40, 0.25, 1), clamp(0.1 + found / 100, 0.1, 1)];
    const base = weigh;
    weigh = (e) => base(e) * (levelFactor[e.level] ?? 1);
    let pool = stageList.filter((e) => !this.used.has(e.id));
    if (!pool.length) {
      // endless final stage: draw from the whole game once its own list is used up
      pool = BY_STAGE.flat().filter((e) => !this.used.has(e.id));
      if (!pool.length) {
        this.used.clear();
        pool = BY_STAGE.flat();
      }
    }
    // weighted shuffle: expressions that need practice tend to come first
    this.deck = pool
      .map((e) => ({ e, k: Math.pow(Math.random(), 1 / weigh(e)) }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.e);
  }

  nextCard() {
    if (this.state === 'over' || this.state === 'idle') return;
    if (!this.deck.length) this._refillDeck();
    const expr = this.deck.pop();
    this.used.add(expr.id);
    if (!this.seen.includes(expr.id)) this.seen.push(expr.id);
    const options = shuffle([{ text: expr.meaning, correct: true }, ...expr.distractors.map((text) => ({ text, correct: false }))]);
    this.question = { expr, options, correctIndex: options.findIndex((o) => o.correct), number: this.answered + 1 };

    const st = this.stageDef;
    const pace = PACE[this.save.settings.pace] ?? PACE.standard;
    this.fallTime = Math.max(st.floor, st.fall - st.step * this.correctInStage) * pace.factor;
    this.tickT = 0;

    const m = (this.metrics = shots.play(this.stage, this.layout.panelH, this.layout.hudH));
    const headTop = (this.ch?.rig.metrics.height ?? 2) + 0.05;
    this.card.show(expr.text, {
      scale: m.cardScale,
      spawnY: Math.max(m.spawnY, headTop + m.cardH * 1.4),
      impactY: headTop + m.cardH / 2 - 0.12,
      accent: this.env.v.accent,
    });
    this.fx.line(this.card.pos, this.card.halfWidth, { count: 16, color: 0xffffff, color2: this.env.v.accent, speed: 2.5, size: 0.4, life: 0.5, gravity: 0 });
    this.audio.play('spawn');
    this._set('playing');
    this.events.emit('game:question', { ...this.question, stage: st, stageIndex: this.stageIndex, fallTime: this.fallTime });
  }

  /** Player picks option `index`. */
  answer(index) {
    if (this.state !== 'playing' || this.paused || !this.question) return;
    const opt = this.question.options[index];
    if (!opt) return;
    if (opt.correct) this._hit(index);
    else this._miss(index);
  }

  // ── correct ─────────────────────────────────────────────────────────────
  _hit(index) {
    const q = this.question;
    this._set('resolving');
    this.card.freeze();
    this.answered++;
    this.correct++;
    this.correctInStage++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const bonus = streakBonus(this.streak);
    const gained = SCORING.correct + bonus;
    this.score += gained;
    this.save.recordAnswer(q.expr.id, true);
    this.events.emit('game:answered', { choice: index, correct: true, correctIndex: q.correctIndex });

    const a = this.ch.animator;
    a.worry = 0;
    const clip = this.ch.def.attack === 'kick' ? 'kick' : 'attack';
    this.pendingBurst = { gained, bonus };
    a.play(clip, { speed: 1.25 });
    // safety net in case the release event is missed
    this.after(0.5, () => this._release());
    this.after(0.8, () => this._burst());
  }

  _onAnimEvent(name) {
    if (name === 'release') this._release();
    else if (name === 'thud') {
      this.audio.play('thud');
      this.stage.shake(7, 0.25);
      this.ch.rig.pivot.getWorldPosition(_v);
      this.fx.burst(_v.setY(0.1), { count: 14, color: 0xfff1d6, speed: 2.4, size: 0.5, life: 0.5, gravity: -1, up: 0.6 });
    }
  }

  _release() {
    if (!this.pendingBurst || this.pendingBurst.fired) return;
    this.pendingBurst.fired = true;
    const rig = this.ch.rig;
    const kick = this.ch.def.attack === 'kick';
    const src = kick ? rig.m.footR ?? rig.legR : rig.props.muzzle ?? rig.handR;
    src.getWorldPosition(_v);
    this.audio.play(kick ? 'kick' : 'shoot');
    this.fx.burst(_v, { count: 8, color: this.ch.def.accent, speed: 2, size: 0.35, life: 0.3, gravity: 0 });
    this.fx.fire(_v, this.card.pos, { color: this.ch.def.accent, style: this.ch.def.shot ?? 'orb', dur: 0.17, size: 0.2, onHit: () => this._burst() });
  }

  _burst() {
    const pb = this.pendingBurst;
    if (!pb) return;
    this.pendingBurst = null;
    const card = this.card;
    const pos = _w.copy(card.pos);
    const accent = this.env.v.accent;
    card.hide();
    this.fx.shatter(pos, card.halfWidth, card.halfHeight, { count: 24, colors: [0xfff6e3, 0xfff6e3, accent.getHex(), 0xffffff], speed: 6.5, size: 0.3 * card.scale + 0.08 });
    this.fx.line(pos, card.halfWidth, { count: 34, color: 0xffffff, color2: accent, speed: 7, size: 0.55, life: 0.8, gravity: 5 });
    this.fx.ring(pos, { color: accent, from: 0.4, to: 2.4 * card.scale + 0.8, life: 0.4, opacity: 0.7 });
    this.audio.play('pop');
    this.audio.play('correct', { streak: this.streak });
    this.stage.shake(3, 0.16);

    const screen = this.stage.toScreen(pos);
    this.events.emit('game:score', { score: this.score, gained: SCORING.correct, bonus: pb.bonus, streak: this.streak, x: screen.x, y: screen.y });
    this.env.island.setStreak(this.streak);
    this.env.island.pulseRing(pb.bonus ? 1 : 0.45);
    this.ch.animator.play('cheer', { speed: 1.1 });
    this.ch.animator.gazeUp = 0;

    if (pb.bonus) {
      this.audio.play(pb.bonus >= SCORING.streak10 ? 'streak10' : 'streak5');
      this.ch.rig.root.getWorldPosition(_v);
      this.fx.confetti(_v.setY(1.2), { count: pb.bonus >= SCORING.streak10 ? 70 : 40 });
      this.ch.animator.flash(0xffe9a8, 0.6);
    }

    if (this.correctInStage >= this.stageDef.goal && this.stageIndex < STAGES.length - 1) this.after(0.75, () => this._stageUp());
    else this.after(0.62, () => this.nextCard());
  }

  // ── wrong / too slow ────────────────────────────────────────────────────
  _miss(index) {
    const q = this.question;
    this._set('resolving');
    this.answered++;
    this.streak = 0;
    this.lives--;
    this.save.recordAnswer(q.expr.id, false);
    if (!this.wrong.includes(q.expr.id)) this.wrong.push(q.expr.id);
    this.events.emit('game:answered', { choice: index, correct: false, correctIndex: q.correctIndex, timeout: index == null });
    this.env.island.setStreak(0);
    if (index != null) {
      this.audio.play('wrong');
      this.card.slam();
      this.ch.animator.worry = 1;
    } else {
      this._impact();
    }
  }

  _impact() {
    const card = this.card;
    if (card.state === 'gone') return;
    const pos = _w.copy(card.pos);
    card.hide();
    this.fx.shatter(pos, card.halfWidth * 0.8, card.halfHeight, { count: 20, colors: [0xfff6e3, 0xff5068, 0xffb0b8], speed: 5, size: 0.3 * card.scale + 0.08, down: 1 });
    this.fx.burst(pos, { count: 22, color: 0xff8a98, color2: 0xffffff, speed: 5, size: 0.5, life: 0.6, gravity: 6 });
    this.ch.rig.root.getWorldPosition(_v);
    this.fx.ring(_v.setY(0.06), { color: 0xff7a8a, from: 0.5, to: 3.4, life: 0.5, flat: true, opacity: 0.8 });
    this.stage.shake(16, 0.45);
    const a = this.ch.animator;
    a.worry = 0;
    a.gazeUp = 0;
    a.flash(0xff4d6a, 1);
    this.audio.play('hit');
    this.audio.play('lifeLost');
    try {
      navigator.vibrate?.(this.lives <= 0 ? [60, 60, 140] : 70);
    } catch {
      /* haptics are optional */
    }
    this.events.emit('game:lives', { lives: this.lives });
    this.events.emit('game:damage');

    if (this.lives <= 0) {
      this._gameOver();
      return;
    }
    a.play('hit');
    this.fx.setDizzy(true);
    this.after(1.25, () => this.fx.setDizzy(false));
    this.after(1.9, () => this.nextCard());
  }

  // ── stage up ────────────────────────────────────────────────────────────
  _stageUp() {
    this.stageIndex++;
    this.correctInStage = 0;
    this.deck = [];
    const st = this.stageDef;
    this._set('stageup');
    this.env.setTheme(st.theme, 2.8);
    this.audio.play('stage');
    this.audio.music?.set('game', st.n);
    this.ch.animator.play('power');
    this.ch.rig.root.getWorldPosition(_v);
    this.fx.confetti(_v.setY(1.4), { count: 60, spread: 4 });
    this.fx.ring(_v.setY(0.08), { color: 0xffffff, from: 0.6, to: 6, life: 0.8, flat: true, opacity: 0.7 });
    this.events.emit('game:stage', { stage: st, index: this.stageIndex });
    this.after(2.5, () => this.nextCard());
  }

  // ── game over ───────────────────────────────────────────────────────────
  _gameOver() {
    this._set('over');
    this.timers.length = 0;
    const a = this.ch.animator;
    a.play('ko');
    this.fx.setDizzy(true);
    this.audio.music?.muffle(true);
    this.env.setDim(1);
    const record = this.save.finishGame({ score: this.score, bestStreak: this.bestStreak, stage: this.stageIndex + 1 });
    const results = {
      score: this.score,
      best: this.save.data.best.score,
      newBest: record.newBest && this.score > 0,
      unlocked: record.unlocked,
      streak: this.bestStreak,
      stage: this.stageDef,
      stageIndex: this.stageIndex,
      answered: this.answered,
      correct: this.correct,
      accuracy: this.answered ? Math.round((this.correct / this.answered) * 100) : 0,
      wrong: this.wrong.slice(),
      seen: this.seen.slice(),
    };
    this.results = results;
    this.events.emit('game:ending', results);
    this.after(0.9, () => {
      this.audio.play('gameOver');
      this.stage.setShot(shots.over(this.stage), 1.5);
    });
    this.after(2.1, () => this.events.emit('game:over', results));
  }

  // ── frame ───────────────────────────────────────────────────────────────
  update(dt) {
    const ch = this.ch;
    if (ch) {
      ch.rig.head.getWorldPosition(this.dizzyAnchor);
      this.dizzyAnchor.y += ch.rig.headRadii[1] * 1.9 + 0.1;
    }
    if (this.paused) return;

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) {
        this.timers.splice(i, 1);
        tm.fn();
      }
    }

    const card = this.card;
    const res = card.update(dt, this.fallTime);

    if (this.state === 'playing' && ch) {
      const t = card.t;
      const a = ch.animator;
      a.gazeUp = 0.45 + 0.55 * t;
      a.gazeX = clamp(card.pos.x * 0.8, -1, 1);
      a.worry = smoothstep(0.72, 0.96, t);

      // warning ticks speed up as the expression closes in
      if (t > 0.66) {
        this.tickT -= dt;
        if (this.tickT <= 0) {
          this.audio.play('tick', { urgent: t > 0.86 });
          this.tickT = t > 0.86 ? 0.2 : 0.42;
        }
      }
      // sparkling tail
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.045;
        const hw = card.halfWidth;
        const col = card.frameMat.color;
        this.fx.spark(card.pos.x + (Math.random() * 2 - 1) * hw, card.pos.y + card.halfHeight, card.pos.z - 0.1, (Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.8, 0, Math.random() < 0.4 ? 0xffffff : col, 0.3 + Math.random() * 0.3, 0.5 + Math.random() * 0.4, -0.6, 1);
      }
      if (res === 'landed') this._miss(null);
    } else if (this.state === 'resolving' && res === 'landed') {
      this._impact();
    }
  }
}
