/**
 * Game — the rules of a run.
 *
 *   An expression falls. Pick its meaning from four options before it lands.
 *   Right: +100 and the streak grows (bonus at 5, bigger bonus at 10).
 *   Wrong or too slow: lose one of three lives. No lives left: game over.
 *   Every eight correct answers the stage, vocabulary and time of day move on.
 *
 * Modes
 *   classic  the rules above, endless
 *   daily    a fixed run of 20 cards, the same for everyone each UTC day (see
 *            daily.js), with a small speed bonus and no stage-ups; the time of
 *            day moves on as the run progresses
 *   duel     a friend challenge: a fixed run of 20 cards from a seed (duel.js),
 *            played like the daily challenge, so both friends get the same cards
 *   relax    no lives and no points: slow, steady cards; the player finishes when
 *            they like (finishRelax). Counts right answers, XP and learning
 *   retry    "second chance" straight after a game: the expressions just missed
 *            fall again, slowly, with no lives to lose. One that is missed again
 *            comes back once more at the end
 *
 * Fever: ten right answers in a row light the island up and double the points
 * of every answer after that, until the next miss. Golden cards (classic only,
 * about one card in sixteen) are worth triple points.
 *
 * Twist cards (classic and relax, see twists.js): about one card in four that
 * shows an expression the player has met before asks for it another way: flip,
 * fill the gap, listen or build it. +50 points in classic.
 *
 * This module owns state and timing only. It talks to the interface through
 * events and to the 3D world through the stage / environment / effects objects.
 */
import * as THREE from 'three';
import { STAGES, PACE, SCORING, streakBonus } from '../data/stages.js';
import { BY_STAGE, getExpression } from '../data/expressions/index.js';
import { ExpressionCard } from './card.js';
import { shots } from './shots.js';
import { buildDaily, dailySegment, speedBonus, utcDateId } from './daily.js';
import { buildDuel, cleanSeed, newDuelSeed } from './duel.js';
import { pickTwist, phrasalIndex } from './twists.js';
import { speechAvailable } from '../audio/speech.js';
import { clamp, shuffle, smoothstep } from '../core/utils.js';

/** Classic games deal expressions that are due for spaced-repetition review this much more often. */
const DUE_WEIGHT = 2.2;
/** A run of this many right answers starts fever mode: double points until a miss. */
export const FEVER_AT = 10;
/** Chance that a classic card is golden (triple points): never the first two cards, never two in a row. */
export const GOLDEN_CHANCE = 0.06;
/** Chance that a card showing an expression the player has met before is a twist card. */
export const TWIST_CHANCE = 0.28;
/** Points for getting a twist card right, on top of the usual points (classic). */
export const TWIST_BONUS = 50;
/** Twist cards take longer to read or answer: their fall time is stretched by this much. */
const TWIST_TIME = { flip: 1.15, gap: 1.2, listen: 1.1, build: 1.45 };
/** Seconds added to a Listen card's fall, for the speaking. */
const LISTEN_EXTRA = 1.5;
/** Second chance: at most this many expressions, falling this much slower than their stage. */
export const RETRY_MAX = 10;
const RETRY_SLOW = 1.35;
/** Relax mode: every card falls at stage 1's starting speed, this much slower. */
const RELAX_SLOW = 1.45;
export const MODES = ['classic', 'daily', 'duel', 'relax', 'retry'];
export const GOLD = 0xffb21e;
export const FEVER_COLOR = 0xff6a2b;

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _fever = new THREE.Color(FEVER_COLOR);

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
    this.mode = 'classic'; // see MODES
    this.daily = null; // the daily run: { dateId, n, cards, index, ranked, started, settled }
    this.fixed = null; // a duel or second-chance run: { cards, index, total, requeued }
    this.duel = null; // { seed, opponent }
    this.paused = false;
    this.held = false; // relax: the card waits while the player reads its example
    this.forceTwist = null; // testing aid: 'flip' | 'gap' | 'listen' | 'build' on every eligible card
    this.timers = [];
    this.layout = { panelH: 240, hudH: 84 };
    this.metrics = null;
    this.dizzyAnchor = new THREE.Vector3();
    this._phrasal = null;
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
    this.fixedIds = new Set(); // retry: expressions put right
    this.twists = { shown: 0, right: 0 };
    this.used = new Set();
    this.deck = [];
    this.question = null;
    this.qTime = 0; // seconds the current card has been answerable (pauses excluded)
    this.marks = ''; // daily / duel: one character per card — c right, w wrong
    this.fallTime = 10;
    this.tickT = 0;
    this.trailT = 0;
    this.timers.length = 0;
    this.pendingBurst = null;
    this.fever = false;
    this.feverT = 0;
    this.lastGolden = false;
    this.held = false;
  }

  get stageDef() {
    return STAGES[this.stageIndex];
  }
  get active() {
    return this.state !== 'idle' && this.state !== 'over';
  }
  /** Relax and second chance: no lives to lose and no points. */
  get safe() {
    return this.mode === 'relax' || this.mode === 'retry';
  }
  /** What the interface needs to know about a daily run (null in other games). */
  get dailyInfo() {
    const d = this.daily;
    return d && { dateId: d.dateId, n: d.n, total: d.cards.length, index: d.index, ranked: d.ranked };
  }
  /** Progress through a duel or second-chance run (null in other games). */
  get fixedInfo() {
    const f = this.fixed;
    return f && { index: f.index, total: f.cards.length, unique: f.total, fixed: this.fixedIds.size };
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
  /**
   * Start a run. Needs the expression database loaded.
   *   opts.mode      one of MODES (default 'classic')
   *   opts.seed      duel: the challenge seed (a new one if missing)
   *   opts.opponent  duel: the friend's result being answered, or null
   *   opts.ids       retry: the expression ids to try again
   */
  start(opts = {}) {
    this._settleDaily();
    this._setFever(false, true);
    this.reset();
    this.mode = MODES.includes(opts.mode) ? opts.mode : 'classic';
    this.daily = null;
    this.fixed = null;
    this.duel = null;
    if (this.mode === 'daily') {
      const run = buildDaily(utcDateId());
      this.daily = { ...run, index: 0, ranked: !this.save.dailyRecord(run.dateId), started: false, settled: false };
    } else if (this.mode === 'duel') {
      const seed = cleanSeed(opts.seed) ?? newDuelSeed();
      const cards = buildDuel(seed, BY_STAGE);
      this.fixed = { cards, index: 0, total: cards.length, requeued: new Set() };
      this.duel = { seed, opponent: opts.opponent ?? null };
    } else if (this.mode === 'retry') {
      const exprs = [...new Set(opts.ids ?? [])].map(getExpression).filter(Boolean).slice(0, RETRY_MAX);
      const cards = shuffle(exprs.map((expr) => ({ expr, options: this._options(expr) })));
      this.fixed = { cards, index: 0, total: cards.length, requeued: new Set() };
    }
    this.paused = false;
    this.card.hide();
    this.fx.setDizzy(false);
    this.env.setDim(0);
    this.env.setTheme(this.mode === 'retry' ? 'golden' : this.stageDef.theme, 1.4);
    this.env.island.setStreak(0);
    this.ch.animator.stop();
    this.ch.animator.gazeUp = 0;
    this.ch.animator.worry = 0;
    this.audio.music?.muffle(false);
    this.audio.music?.set('game', this.mode === 'retry' ? 3 : 1);
    this.applyShot(1.0);
    this._set('intro');
    this.events.emit('game:intro', { stage: this.stageDef, lives: this.lives, mode: this.mode, daily: this.dailyInfo, fixed: this.fixedInfo, duel: this.duel });
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

  /** Relax: the card stops falling while the player reads its example (and starts again on release). */
  hold(on) {
    this.held = !!on && this.mode === 'relax' && this.state === 'playing';
  }

  /** Relax mode has no game over: the player ends the session here and gets the results. */
  finishRelax() {
    if (this.mode !== 'relax' || !this.active) return;
    this.paused = false;
    this.audio.music?.muffle(false);
    this.events.emit('game:pause', false);
    this.card.hide();
    this.pendingBurst = null;
    this._finish('complete');
  }

  /** Leave the run without recording it (a ranked daily run still counts what was scored). */
  quit() {
    this._settleDaily();
    this._setFever(false, true);
    this.timers.length = 0;
    this.paused = false;
    this.held = false;
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
  _options(expr) {
    return shuffle([{ text: expr.meaning, correct: true }, ...expr.distractors.map((text) => ({ text, correct: false }))]);
  }

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

  /** A twist for this card, or null: classic and relax only, for expressions met before. */
  _twistFor(expr) {
    if (this.mode !== 'classic' && this.mode !== 'relax') return null;
    if (this.answered < 2 && !this.forceTwist) return null;
    if (!this.save.stat(expr.id)?.seen && !this.forceTwist) return null;
    if (!this.forceTwist && Math.random() >= TWIST_CHANCE) return null;
    this._phrasal ??= phrasalIndex(BY_STAGE.flat());
    const canListen = this.forceTwist === 'listen' || (this.save.settings.sfxOn && speechAvailable());
    const opts = { pool: BY_STAGE[expr.stage - 1] ?? BY_STAGE.flat(), known: this._phrasal, canListen };
    if (!this.forceTwist) return pickTwist(expr, opts);
    // testing: keep drawing until the forced kind comes up (it may not suit this expression)
    for (let i = 0; i < 12; i++) {
      const t = pickTwist(expr, opts);
      if (t?.kind === this.forceTwist) return t;
    }
    return null;
  }

  nextCard() {
    if (this.state === 'over' || this.state === 'idle') return;
    const d = this.daily;
    const f = this.fixed;
    let expr;
    let options;
    if (d) {
      const card = d.cards[d.index];
      if (!card) return this._finish('complete');
      ({ expr, options } = card);
      // the sky moves on through the day as the run progresses
      this._daySky(d.index, d.cards.length);
      d.index++;
      // the ranked attempt is used up as soon as its first card is on screen
      if (d.ranked && !d.started) {
        d.started = true;
        this._saveDaily(false);
      }
    } else if (f) {
      const card = f.cards[f.index];
      if (!card) return this._finish('complete');
      ({ expr, options } = card);
      if (this.mode === 'duel') this._daySky(f.index, f.cards.length);
      f.index++;
    } else {
      if (!this.deck.length) this._refillDeck();
      expr = this.deck.pop();
      this.used.add(expr.id);
      options = this._options(expr);
    }
    if (!this.seen.includes(expr.id)) this.seen.push(expr.id);
    const twist = this._twistFor(expr);
    if (twist) {
      this.twists.shown++;
      if (twist.kind === 'flip' || twist.kind === 'gap') options = twist.options;
      else if (twist.kind === 'build') options = [];
    }
    const golden = this.mode === 'classic' && !twist && this.answered >= 2 && !this.lastGolden && Math.random() < GOLDEN_CHANCE;
    this.lastGolden = golden;
    this.question = { expr, options, correctIndex: options.findIndex((o) => o.correct), number: this.answered + 1, golden, twist };

    const st = this.stageDef;
    const pace = (PACE[this.save.settings.pace] ?? PACE.standard).factor;
    const own = STAGES[expr.stage - 1] ?? st;
    let fall;
    if (d || this.mode === 'duel') fall = own.fall * PACE.standard.factor; // fixed pace: scores stay comparable
    else if (this.mode === 'retry') fall = own.fall * RETRY_SLOW * pace;
    else if (this.mode === 'relax') fall = STAGES[0].fall * RELAX_SLOW * pace;
    else fall = Math.max(st.floor, st.fall - st.step * this.correctInStage) * pace;
    if (twist) fall = fall * TWIST_TIME[twist.kind] + (twist.kind === 'listen' ? LISTEN_EXTRA : 0);
    this.fallTime = fall;
    this.tickT = 0;
    this.qTime = 0;
    this.held = false;

    const m = (this.metrics = shots.play(this.stage, this.layout.panelH, this.layout.hudH));
    const headTop = (this.ch?.rig.metrics.height ?? 2) + 0.05;
    const accent = golden ? GOLD : this.fever ? FEVER_COLOR : this.env.v.accent;
    const face = !twist ? expr.text : twist.kind === 'gap' ? twist.sentence : twist.kind === 'listen' ? '' : twist.prompt;
    this.card.show(face, {
      scale: m.cardScale,
      spawnY: Math.max(m.spawnY, headTop + m.cardH * 1.4),
      impactY: headTop + m.cardH / 2 - 0.12,
      accent,
      golden,
      kind: twist?.kind ?? null,
    });
    this.fx.line(this.card.pos, this.card.halfWidth, { count: golden ? 40 : 16, color: golden ? 0xfff1b8 : 0xffffff, color2: accent, speed: golden ? 4 : 2.5, size: golden ? 0.55 : 0.4, life: golden ? 0.8 : 0.5, gravity: 0 });
    this.audio.play(golden ? 'golden' : 'spawn');
    this._set('playing');
    this.events.emit('game:question', { ...this.question, stage: st, stageIndex: this.stageIndex, fallTime: this.fallTime, mode: this.mode, daily: this.dailyInfo, fixed: this.fixedInfo });
  }

  /** Daily and duel runs: the sky moves through the day as the cards go by. */
  _daySky(index, total) {
    const seg = dailySegment(index, total);
    if (seg === this.stageIndex) return;
    this.stageIndex = seg;
    this.env.setTheme(this.stageDef.theme, 2.8);
    this.audio.music?.set('game', this.stageDef.n);
  }

  /** Player picks option `index`. */
  answer(index) {
    if (this.state !== 'playing' || this.paused || !this.question) return;
    const opt = this.question.options[index];
    if (!opt) return;
    if (opt.correct) this._hit(index);
    else this._miss(index);
  }

  /** Build it: the player has put every word in place. */
  answerBuilt() {
    if (this.state !== 'playing' || this.paused || this.question?.twist?.kind !== 'build') return;
    this._hit(null);
  }

  /** Build it: a word tapped out of order brings the card a little closer. */
  nudge(amount = 0.06) {
    if (this.state !== 'playing' || this.paused) return;
    const c = this.card;
    if (c.state === 'in' || c.state === 'fall') c.t = Math.min(0.97, c.t + amount);
  }

  // ── correct ─────────────────────────────────────────────────────────────
  _hit(index) {
    const q = this.question;
    const safe = this.safe;
    this._set('resolving');
    this.held = false;
    this.card.freeze();
    this.answered++;
    this.correct++;
    this.correctInStage++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    if (q.twist) this.twists.right++;
    if (this.mode === 'retry') this.fixedIds.add(q.expr.id);
    // relax and second chance score no points; fever doubles, a golden card triples (both: ×6)
    const fever = this.fever;
    const bonus = safe ? 0 : streakBonus(this.streak);
    const speed = this.daily || this.mode === 'duel' ? speedBonus(this.qTime) : 0;
    const twist = q.twist && !safe ? TWIST_BONUS : 0;
    const base = safe ? 0 : SCORING.correct * (q.golden ? 3 : 1) * (fever ? 2 : 1);
    const gained = base + bonus + speed + twist;
    this.score += gained;
    const rec = this.save.recordAnswer(q.expr.id, true);
    if (this.daily || this.mode === 'duel') this.marks += 'c';
    if (this.daily) this._saveDaily(false);
    this.events.emit('game:answered', { choice: index, correct: true, correctIndex: q.correctIndex, id: q.expr.id, type: q.expr.type, golden: !!q.golden, fever, streak: this.streak, fresh: rec.fresh, mastered: rec.mastered, mode: this.mode, twist: q.twist?.kind ?? null, safe });

    const a = this.ch.animator;
    a.worry = 0;
    const clip = this.ch.def.attack === 'kick' ? 'kick' : 'attack';
    this.pendingBurst = { gained, base, bonus, speed, twist, golden: !!q.golden, fever, safe };
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
    this.stage.shake(pb.golden ? 6 : 3, pb.golden ? 0.24 : 0.16);
    if (pb.golden) {
      this.audio.play('goldenHit');
      this.fx.confetti(pos, { count: 60, spread: 3, colors: [0xffc83d, 0xffe08a, 0xfff6e3, 0xf0a31b] });
      this.fx.ring(pos, { color: GOLD, from: 0.6, to: 3.6 * card.scale + 1, life: 0.55, opacity: 0.85 });
    }

    const screen = this.stage.toScreen(pos);
    this.events.emit('game:score', { score: this.score, gained: pb.base, bonus: pb.bonus, speed: pb.speed, twist: pb.twist, golden: pb.golden, fever: pb.fever, safe: pb.safe, mode: this.mode, streak: this.streak, x: screen.x, y: screen.y });
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
    if (!this.safe && !this.fever && this.streak >= FEVER_AT) this.after(0.35, () => this.streak >= FEVER_AT && this._setFever(true));

    const stages = this.mode === 'classic' || this.mode === 'relax';
    if (stages && this.correctInStage >= this.stageDef.goal && this.stageIndex < STAGES.length - 1) this.after(0.75, () => this._stageUp());
    else this.after(0.62, () => this._advance());
  }

  // ── wrong / too slow ────────────────────────────────────────────────────
  _miss(index) {
    const q = this.question;
    const f = this.fixed;
    this._set('resolving');
    this.held = false;
    this.answered++;
    this.streak = 0;
    if (!this.safe) this.lives--;
    const rec = this.save.recordAnswer(q.expr.id, false);
    if (!this.wrong.includes(q.expr.id)) this.wrong.push(q.expr.id);
    // second chance: a card missed again comes back once more at the end
    if (this.mode === 'retry' && f && !f.requeued.has(q.expr.id)) {
      f.requeued.add(q.expr.id);
      f.cards.push({ expr: q.expr, options: this._options(q.expr) });
    }
    if (this.daily || this.mode === 'duel') this.marks += 'w';
    if (this.daily) this._saveDaily(false);
    this.events.emit('game:answered', { choice: index, correct: false, correctIndex: q.correctIndex, timeout: index == null, id: q.expr.id, type: q.expr.type, golden: !!q.golden, fever: false, streak: 0, fresh: rec.fresh, mastered: false, mode: this.mode, twist: q.twist?.kind ?? null, safe: this.safe });
    this._setFever(false);
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
    const a = this.ch.animator;
    a.worry = 0;
    a.gazeUp = 0;
    if (this.safe) {
      // relax / second chance: a soft bump, no life lost, and time to read the right answer
      this.fx.shatter(pos, card.halfWidth * 0.8, card.halfHeight, { count: 14, colors: [0xfff6e3, 0xffd6a0, 0xffffff], speed: 3.5, size: 0.26 * card.scale + 0.06, down: 1 });
      this.stage.shake(4, 0.25);
      a.flash(0xffb07a, 0.5);
      a.play('hit');
      this.audio.play('hit');
      this.events.emit('game:missed', { safe: true });
      this.after(2.1, () => this._advance());
      return;
    }
    this.fx.shatter(pos, card.halfWidth * 0.8, card.halfHeight, { count: 20, colors: [0xfff6e3, 0xff5068, 0xffb0b8], speed: 5, size: 0.3 * card.scale + 0.08, down: 1 });
    this.fx.burst(pos, { count: 22, color: 0xff8a98, color2: 0xffffff, speed: 5, size: 0.5, life: 0.6, gravity: 6 });
    this.ch.rig.root.getWorldPosition(_v);
    this.fx.ring(_v.setY(0.06), { color: 0xff7a8a, from: 0.5, to: 3.4, life: 0.5, flat: true, opacity: 0.8 });
    this.stage.shake(16, 0.45);
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

  /** Next card — or, at the end of a fixed run, the finish. */
  _advance() {
    const run = this.daily ?? this.fixed;
    if (run && run.index >= run.cards.length) this._finish('complete');
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
    this.events.emit('game:stage', { stage: st, index: this.stageIndex, mode: this.mode });
    this.after(2.5, () => this.nextCard());
  }

  // ── game over ───────────────────────────────────────────────────────────
  _gameOver() {
    this._finish('ko');
  }

  /** End of a run: 'ko' (out of lives) or 'complete' (the last card of a fixed run, or a finished relax session). */
  _finish(reason) {
    this._set('over');
    this._setFever(false, true);
    this.timers.length = 0;
    this.held = false;
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
    // a second chance is a bonus round, not a game: it does not count towards scores or games played
    const record = this.mode === 'retry' ? { newBest: false, unlocked: [] } : this.save.finishGame({ score: this.score, bestStreak: this.safe ? 0 : this.bestStreak, stage: this.stageIndex + 1, mode: this.mode });
    const d = this.daily;
    if (d) this._saveDaily(true);
    const f = this.fixed;
    const results = {
      mode: this.mode,
      reason,
      // daily: run info, this run's marks and the day's ranked attempt (this run, or an earlier one if this was practice)
      daily: d && { ...this.dailyInfo, marks: this.marks, rankedRecord: this.save.dailyRecord(d.dateId) },
      duel: this.duel && { seed: this.duel.seed, opponent: this.duel.opponent, marks: this.marks, total: f.cards.length },
      retry:
        this.mode === 'retry'
          ? { total: f.total, fixed: [...this.fixedIds], missed: [...new Set(f.cards.map((c) => c.expr.id))].filter((id) => !this.fixedIds.has(id)) }
          : null,
      twists: { ...this.twists },
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

  // ── fever ───────────────────────────────────────────────────────────────
  /** Start or end fever mode. `quiet`: no fanfare (a run ending or starting). */
  _setFever(on, quiet = false) {
    if (this.fever === on) return;
    this.fever = on;
    this.feverT = 0;
    this.audio.music?.setFever?.(on);
    if (!on) this.env.island.setAccent?.(this.env.v.accent);
    this.events.emit('game:fever', { on, streak: this.streak, quiet });
    if (quiet || !this.ch) return;
    if (on) {
      this.audio.play('fever');
      const a = this.ch.animator;
      a.flash(FEVER_COLOR, 0.9);
      this.after(0.25, () => this.state !== 'over' && !a.clip && a.play('power'));
      this.ch.rig.root.getWorldPosition(_v);
      this.fx.ring(_v.setY(0.08), { color: FEVER_COLOR, from: 0.6, to: 6, life: 0.8, flat: true, opacity: 0.85 });
      this.fx.burst(_v.setY(1.1), { count: 46, color: FEVER_COLOR, color2: 0xffd27a, speed: 4.5, size: 0.6, life: 0.8, gravity: -1.5, up: 1.2 });
      this.env.island.pulseRing(1);
      this.stage.shake(6, 0.3);
    } else {
      this.audio.play('feverEnd');
    }
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

  /** Hand the result to whoever records scores (results screen → app.online). Only classic games and ranked daily runs go on the boards. */
  _submit() {
    const d = this.daily;
    if (d ? !d.ranked : this.mode !== 'classic') return;
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
    // a held card (relax: reading the example) keeps bobbing but does not fall
    const res = card.update(dt, this.held ? Infinity : this.fallTime);
    if (this.state === 'playing' && !this.held) this.qTime += dt;

    // fever: embers rise around the character and the island glows fire-orange
    if (this.fever && ch) {
      this.feverT -= dt;
      if (this.feverT <= 0) {
        this.feverT = 0.045;
        ch.rig.root.getWorldPosition(_v);
        const a = Math.random() * Math.PI * 2;
        const r = 0.55 + Math.random() * 0.6;
        this.fx.spark(_v.x + Math.cos(a) * r, 0.08, _v.z + Math.sin(a) * r * 0.7, (Math.random() - 0.5) * 0.3, 1.4 + Math.random() * 1.6, 0, Math.random() < 0.55 ? FEVER_COLOR : 0xffd27a, 0.32 + Math.random() * 0.3, 0.7 + Math.random() * 0.5, -0.8, 1.2);
      }
      this.env.island.setAccent?.(_fever);
    }

    if (this.state === 'playing' && ch) {
      const t = card.t;
      const a = ch.animator;
      a.gazeUp = 0.45 + 0.55 * t;
      a.gazeX = clamp(card.pos.x * 0.8, -1, 1);
      a.worry = smoothstep(0.72, 0.96, t);

      // warning ticks speed up as the expression closes in
      if (t > 0.66 && !this.held) {
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
