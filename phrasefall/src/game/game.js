/**
 * Game — the rules of a run.
 *
 *   An expression falls. Pick its meaning from four options before it lands.
 *   Right: +100 and the streak grows (bonus at 5, bigger bonus at 10).
 *   Wrong or too slow: lose one of three lives. No lives left: game over.
 *   Every eight correct answers the stage, vocabulary and time of day move on.
 *
 * Two modes: 'classic' (above, endless) and 'daily' — a fixed run of 20 cards
 * that is the same for everyone each UTC day (see daily.js), with a small
 * speed bonus and no stage-ups; the time of day moves on as the run progresses.
 *
 * This module owns state and timing only. It talks to the interface through
 * events and to the 3D world through the stage / environment / effects objects.
 */
import * as THREE from 'three';
import { STAGES, PACE, SCORING, streakBonus } from '../data/stages.js';
import { BY_STAGE } from '../data/expressions/index.js';
import { ExpressionCard } from './card.js';
import { shots } from './shots.js';
import { buildDaily, dailySegment, speedBonus, utcDateId } from './daily.js';
import { clamp, shuffle, smoothstep } from '../core/utils.js';

/** Classic games deal expressions that are due for spaced-repetition review this much more often. */
const DUE_WEIGHT = 2.2;

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
    this.mode = 'classic'; // classic | daily
    this.daily = null; // the daily run: { dateId, n, cards, index, ranked, started, settled }
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
    this.qTime = 0; // seconds the current card has been answerable (pauses excluded)
    this.marks = ''; // daily: one character per card — c right, w wrong
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
  /** What the interface needs to know about a daily run (null in classic games). */
  get dailyInfo() {
    const d = this.daily;
    return d && { dateId: d.dateId, n: d.n, total: d.cards.length, index: d.index, ranked: d.ranked };
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
  /** Start a run. `opts.mode`: 'classic' (default) or 'daily'. Needs the expression database loaded. */
  start(opts = {}) {
    this._settleDaily();
    this.reset();
    this.mode = opts.mode === 'daily' ? 'daily' : 'classic';
    this.daily = null;
    if (this.mode === 'daily') {
      const run = buildDaily(utcDateId());
      this.daily = { ...run, index: 0, ranked: !this.save.dailyRecord(run.dateId), started: false, settled: false };
    }
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
    this.events.emit('game:intro', { stage: this.stageDef, lives: this.lives, mode: this.mode, daily: this.dailyInfo });
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

  /** Leave the run without recording it (a ranked daily run still counts what was scored). */
  quit() {
    this._settleDaily();
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
    const now = Date.now();
    let weigh = (e) => {
      const s = save.stat(e.id);
      if (!s || !s.seen) return 2;
      const due = save.isDue(e.id, now) ? DUE_WEIGHT : 1;
      if (s.practise) return 3 * due;
      if (save.needsWork(e.id)) return 2.6 * due;
      if (save.isMastered(e.id)) return 0.6 * due;
      return 1.2 * due;
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
    const d = this.daily;
    let expr;
    let options;
    if (d) {
      const card = d.cards[d.index];
      if (!card) return this._finish('complete');
      ({ expr, options } = card);
      // the sky moves on through the day as the run progresses
      const seg = dailySegment(d.index, d.cards.length);
      if (seg !== this.stageIndex) {
        this.stageIndex = seg;
        this.env.setTheme(this.stageDef.theme, 2.8);
        this.audio.music?.set('game', this.stageDef.n);
      }
      d.index++;
      // the ranked attempt is used up as soon as its first card is on screen
      if (d.ranked && !d.started) {
        d.started = true;
        this._saveDaily(false);
      }
    } else {
      if (!this.deck.length) this._refillDeck();
      expr = this.deck.pop();
      this.used.add(expr.id);
      options = shuffle([{ text: expr.meaning, correct: true }, ...expr.distractors.map((text) => ({ text, correct: false }))]);
    }
    if (!this.seen.includes(expr.id)) this.seen.push(expr.id);
    this.question = { expr, options, correctIndex: options.findIndex((o) => o.correct), number: this.answered + 1 };

    const st = this.stageDef;
    if (d) {
      // fixed pace for everyone: each card falls at the starting speed of its own stage
      this.fallTime = (STAGES[expr.stage - 1] ?? st).fall * PACE.standard.factor;
    } else {
      const pace = PACE[this.save.settings.pace] ?? PACE.standard;
      this.fallTime = Math.max(st.floor, st.fall - st.step * this.correctInStage) * pace.factor;
    }
    this.tickT = 0;
    this.qTime = 0;

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
    this.events.emit('game:question', { ...this.question, stage: st, stageIndex: this.stageIndex, fallTime: this.fallTime, mode: this.mode, daily: this.dailyInfo });
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
    const speed = this.daily ? speedBonus(this.qTime) : 0;
    const gained = SCORING.correct + bonus + speed;
    this.score += gained;
    this.save.recordAnswer(q.expr.id, true);
    if (this.daily) {
      this.marks += 'c';
      this._saveDaily(false);
    }
    this.events.emit('game:answered', { choice: index, correct: true, correctIndex: q.correctIndex });

    const a = this.ch.animator;
    a.worry = 0;
    const clip = this.ch.def.attack === 'kick' ? 'kick' : 'attack';
    this.pendingBurst = { gained, bonus, speed };
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
    this.events.emit('game:score', { score: this.score, gained: SCORING.correct, bonus: pb.bonus, speed: pb.speed, streak: this.streak, x: screen.x, y: screen.y });
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

    if (!this.daily && this.correctInStage >= this.stageDef.goal && this.stageIndex < STAGES.length - 1) this.after(0.75, () => this._stageUp());
    else this.after(0.62, () => this._advance());
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
    if (this.daily) {
      this.marks += 'w';
      this._saveDaily(false);
    }
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
    this.after(1.9, () => this._advance());
  }

  /** Next card — or, at the end of a daily run, the finish. */
  _advance() {
    if (this.daily && this.daily.index >= this.daily.cards.length) this._finish('complete');
    else this.nextCard();
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
    this._finish('ko');
  }

  /** End of a run: 'ko' (out of lives) or 'complete' (the last card of a daily run). */
  _finish(reason) {
    this._set('over');
    this.timers.length = 0;
    const a = this.ch.animator;
    const ko = reason === 'ko';
    if (ko) {
      a.play('ko');
      this.fx.setDizzy(true);
      this.env.setDim(1);
    } else {
      a.play('cheer', { speed: 0.85 });
      this.audio.play('stage');
      this.ch.rig.root.getWorldPosition(_v);
      this.fx.confetti(_v.setY(1.4), { count: 70, spread: 4 });
    }
    this.audio.music?.muffle(true);
    const record = this.save.finishGame({ score: this.score, bestStreak: this.bestStreak, stage: this.stageIndex + 1, mode: this.mode });
    const d = this.daily;
    if (d) this._saveDaily(true);
    const results = {
      mode: this.mode,
      reason,
      // daily: run info, this run's marks and the day's ranked attempt (this run, or an earlier one if this was practice)
      daily: d && { ...this.dailyInfo, marks: this.marks, rankedRecord: this.save.dailyRecord(d.dateId) },
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
    this._submit();
    this.after(0.9, () => {
      if (ko) this.audio.play('gameOver');
      this.stage.setShot(shots.over(this.stage), 1.5);
    });
    this.after(2.1, () => this.events.emit('game:over', results));
  }

  // ── daily challenge bookkeeping ─────────────────────────────────────────
  /** Store the ranked attempt (practice runs are not stored). */
  _saveDaily(done) {
    const d = this.daily;
    if (!d?.ranked || d.settled) return null;
    if (done) d.settled = true;
    return this.save.saveDaily(d.dateId, { n: d.n, score: this.score, correct: this.correct, answered: this.answered, total: d.cards.length, bestStreak: this.bestStreak, marks: this.marks, done });
  }

  /** Leaving a ranked daily run part-way still uses up the day's attempt: record what was scored. */
  _settleDaily() {
    const d = this.daily;
    if (!d?.ranked || !d.started || d.settled) return;
    this._saveDaily(true);
    this._submit();
  }

  /**
   * A ranked daily run cut short by a closed tab is still marked unfinished in
   * the save: count it as finished (and submit today's) once the player is back.
   */
  settleInterruptedDaily() {
    if (this.daily && this.active) return;
    const today = utcDateId();
    for (const [dateId, rec] of Object.entries(this.save.data.daily)) {
      if (rec.done) continue;
      this.save.saveDaily(dateId, { done: true });
      if (dateId === today) this.events.emit('game:submit', { mode: 'daily', dateId, score: rec.score, stage: dailySegment(Math.max(0, rec.answered - 1), rec.total || 20) + 1, correct: rec.correct, answered: rec.answered, bestStreak: rec.bestStreak, character: this.save.data.character });
    }
  }

  /** Hand the result to whoever records scores (results screen → app.online). Practice runs are not submitted. */
  _submit() {
    const d = this.daily;
    if (d && !d.ranked) return;
    const result = { mode: this.mode, score: this.score, stage: this.stageIndex + 1, correct: this.correct, answered: this.answered, bestStreak: this.bestStreak, character: this.save.data.character };
    if (d) result.dateId = d.dateId;
    this.events.emit('game:submit', result);
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
      if (!tm) continue; // a callback that ends the run clears the list mid-loop
      tm.t -= dt;
      if (tm.t <= 0) {
        this.timers.splice(i, 1);
        tm.fn();
      }
    }

    const card = this.card;
    const res = card.update(dt, this.fallTime);
    if (this.state === 'playing') this.qTime += dt;

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
