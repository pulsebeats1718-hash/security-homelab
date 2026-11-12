/**
 * Save data — everything the player earns lives in localStorage under one key.
 * Reads and writes are wrapped so the game still runs where storage is blocked
 * (private windows, embedded previews); progress then simply lasts for the session.
 */
import { ROSTER } from '../data/roster.js';

const KEY = 'phrasefall.save.v1';
const MASTERY_STREAK = 3;

const defaults = () => ({
  version: 1,
  settings: { music: 0.6, sfx: 0.8, musicOn: true, sfxOn: true, pace: 'standard', quality: 'auto', reduceMotion: false },
  character: 'fox',
  unlocked: ROSTER.filter((r) => r.rule.type === 'start').map((r) => r.id),
  seenUnlocks: [],
  best: { score: 0, streak: 0, stage: 1 },
  totals: { games: 0, correct: 0, wrong: 0, score: 0 },
  /** id → { seen, correct, wrong, streak, last: 'c' | 'w', fav, practise, t } */
  expr: {},
  tutorialDone: false,
});

export class Save {
  constructor() {
    this.data = defaults();
    this.persistent = true;
    this.listeners = new Set();
    /** Ids that actually have a model; set by the app so a roster entry without one is never awarded. */
    this.available = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this._merge(JSON.parse(raw));
    } catch {
      this.persistent = false;
    }
  }

  _merge(saved) {
    const d = this.data;
    if (!saved || typeof saved !== 'object') return;
    Object.assign(d.settings, saved.settings ?? {});
    if (typeof saved.character === 'string') d.character = saved.character;
    if (Array.isArray(saved.unlocked)) d.unlocked = [...new Set([...d.unlocked, ...saved.unlocked])];
    if (Array.isArray(saved.seenUnlocks)) d.seenUnlocks = saved.seenUnlocks;
    Object.assign(d.best, saved.best ?? {});
    Object.assign(d.totals, saved.totals ?? {});
    if (saved.expr && typeof saved.expr === 'object') d.expr = saved.expr;
    d.tutorialDone = !!saved.tutorialDone;
  }

  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      this.persistent = false;
    }
    for (const fn of this.listeners) fn(this.data);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset() {
    const settings = this.data.settings;
    this.data = defaults();
    this.data.settings = settings;
    this.write();
  }

  // ── settings ────────────────────────────────────────────────────────────
  get settings() {
    return this.data.settings;
  }
  setSetting(key, value) {
    this.data.settings[key] = value;
    this.write();
  }

  // ── characters ──────────────────────────────────────────────────────────
  /** Tell the save which characters exist in this build. */
  setAvailable(ids) {
    this.available = new Set(ids);
    this.data.unlocked = this.data.unlocked.filter((id) => this.available.has(id));
    if (!this.available.has(this.data.character)) this.data.character = this.data.unlocked[0] ?? ids[0];
    if (!this.data.unlocked.includes(this.data.character)) this.data.unlocked.push(this.data.character);
  }
  isUnlocked(id) {
    return this.data.unlocked.includes(id);
  }
  selectCharacter(id) {
    if (!this.isUnlocked(id)) return false;
    this.data.character = id;
    this.write();
    return true;
  }

  // ── expressions ─────────────────────────────────────────────────────────
  stat(id) {
    return this.data.expr[id];
  }
  recordAnswer(id, correct) {
    const s = (this.data.expr[id] ??= { seen: 0, correct: 0, wrong: 0, streak: 0, last: null, fav: false, practise: false, t: 0 });
    s.seen++;
    s.t = Date.now();
    if (correct) {
      s.correct++;
      s.streak++;
      s.last = 'c';
      if (s.streak >= MASTERY_STREAK) s.practise = false;
    } else {
      s.wrong++;
      s.streak = 0;
      s.last = 'w';
    }
    if (correct) this.data.totals.correct++;
    else this.data.totals.wrong++;
  }
  toggle(id, flag) {
    const s = (this.data.expr[id] ??= { seen: 0, correct: 0, wrong: 0, streak: 0, last: null, fav: false, practise: false, t: 0 });
    s[flag] = !s[flag];
    this.write();
    return s[flag];
  }
  isMastered(id) {
    const s = this.data.expr[id];
    return !!s && s.streak >= MASTERY_STREAK;
  }
  needsWork(id) {
    const s = this.data.expr[id];
    return !!s && s.wrong > 0 && s.streak < MASTERY_STREAK;
  }
  get seenIds() {
    return Object.keys(this.data.expr).filter((id) => this.data.expr[id].seen > 0);
  }
  get masteredCount() {
    return Object.keys(this.data.expr).filter((id) => this.isMastered(id)).length;
  }

  // ── progress ────────────────────────────────────────────────────────────
  /** Lifetime stats used by unlock rules. */
  progress() {
    const d = this.data;
    return { score: d.best.score, streak: d.best.streak, stage: d.best.stage, games: d.totals.games, correct: d.totals.correct, mastered: this.masteredCount, total: d.totals.score };
  }

  /**
   * Record a finished game. Returns { newBest, unlocked: [ids] }.
   */
  finishGame({ score, bestStreak, stage }) {
    const d = this.data;
    const newBest = score > d.best.score;
    d.best.score = Math.max(d.best.score, score);
    d.best.streak = Math.max(d.best.streak, bestStreak);
    d.best.stage = Math.max(d.best.stage, stage);
    d.totals.games++;
    d.totals.score += score;
    const unlocked = this.checkUnlocks();
    this.write();
    return { newBest, unlocked };
  }

  checkUnlocks() {
    const p = this.progress();
    const fresh = [];
    for (const { id, rule } of ROSTER) {
      if (this.data.unlocked.includes(id) || (this.available && !this.available.has(id))) continue;
      const have = rule.type === 'start' ? Infinity : p[rule.type] ?? 0;
      if (have >= (rule.n ?? 0)) {
        this.data.unlocked.push(id);
        fresh.push(id);
      }
    }
    return fresh;
  }

  /** 0…1 progress towards a character's unlock rule. */
  unlockProgress(rule) {
    if (rule.type === 'start') return 1;
    const p = this.progress();
    return Math.max(0, Math.min(1, (p[rule.type] ?? 0) / rule.n));
  }
}
