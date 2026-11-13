/**
 * Save data — everything the player earns lives in localStorage under one key.
 * Reads and writes are wrapped so the game still runs where storage is blocked
 * (private windows, embedded previews); progress then simply lasts for the session.
 *
 * Shape (version 1; new fields are optional, so older saves load unchanged):
 *
 *   settings      { music, sfx, musicOn, sfxOn, pace, quality, reduceMotion, season, … }
 *   character     selected character id
 *   unlocked      character ids                   seenUnlocks  ids already celebrated
 *   best          { score, streak, stage }        classic games only (streak: any game)
 *   totals        { games, correct, wrong, score }
 *   expr          id → { seen, correct, wrong, streak, last: 'c'|'w'|null, fav, practise,
 *                        t,      // last change (ms) — cloud merge keeps the record with the later t
 *                        box,    // Leitner box 0–5
 *                        due }   // ms; due for review once Date.now() >= due
 *   daily         'YYYY-MM-DD' (UTC) → the ranked daily-challenge attempt for that day:
 *                 { n, score, correct, answered, total, bestStreak, marks, done, t }
 *                 marks: one character per card — c correct, w wrong, - not reached
 *   tutorialDone  boolean
 *
 * Progress (src/game/progress.js — levels, the daily streak, quests):
 *   totals.xp     lifetime XP; the level is worked out from it (src/data/levels.js)
 *   streak        { count, best, last, brollies, lost, lostOn, saved, t }
 *                 last: the LOCAL day ('YYYY-MM-DD') last counted — goal met, or kept by a brolly
 *   days          local 'YYYY-MM-DD' → that day's activity:
 *                 { right, known, reviews, fresh, mastered, xp, games, goal, brolly, daily,
 *                   q: { p0, p1, p2, d0, d1, d2, chest, chars } }   (today's quests)
 *   place         the place the island is in;  seenPlaces  places already celebrated
 *
 * Unknown fields (top level, settings, per-expression) are kept as they are, so
 * other modules — cloud sync, for one — can add their own without losing them.
 */
import { ROSTER, ruleProgress } from '../data/roster.js';
import { levelInfo } from '../data/levels.js';

const KEY = 'phrasefall.save.v1';
const MASTERY_STREAK = 3;
const DAILY_KEEP = 400;
/** Local days of activity kept for the weekly report and the streak calendar. */
export const DAYS_KEEP = 60;
export const BROLLY_MAX = 2;

/**
 * Spaced repetition (Leitner): a right answer moves an expression up one box,
 * a wrong one sends it back to box 0. Each box waits this many days before the
 * expression is due again. Days are counted from local midnight, so anything
 * scheduled "in 1 day" is due all of tomorrow.
 */
export const SR_INTERVALS = [0, 1, 3, 7, 16, 35];
export const SR_MAX_BOX = SR_INTERVALS.length - 1;

/** Local midnight `days` days after the day containing `t`. */
function dayStart(t, days = 0) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  if (days) d.setDate(d.getDate() + days);
  return d.getTime();
}
const dueFor = (box, t) => dayStart(t, SR_INTERVALS[box] ?? 0);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const plain = (v) => v == null || ['string', 'number', 'boolean'].includes(typeof v);
const DATE_ID = /^\d{4}-\d{2}-\d{2}$/;

const blankExpr = () => ({ seen: 0, correct: 0, wrong: 0, streak: 0, last: null, fav: false, practise: false, t: 0 });
export const blankStreak = () => ({ count: 0, best: 0, last: '', brollies: 0, lost: 0, lostOn: '', saved: null, t: 0 });
export const blankDay = () => ({ right: 0, known: 0, reviews: 0, fresh: 0, mastered: 0, xp: 0, games: 0, goal: false, brolly: false, daily: false, q: blankQuests() });
const blankQuests = () => ({ p0: 0, p1: 0, p2: 0, d0: false, d1: false, d2: false, chest: false, chars: [] });

const defaults = () => ({
  version: 1,
  settings: { music: 0.6, sfx: 0.8, musicOn: true, sfxOn: true, pace: 'standard', quality: 'auto', reduceMotion: false, season: 'auto' },
  character: 'fox',
  unlocked: ROSTER.filter((r) => r.rule.type === 'start').map((r) => r.id),
  seenUnlocks: [],
  best: { score: 0, streak: 0, stage: 1 },
  totals: { games: 0, correct: 0, wrong: 0, score: 0, xp: 0 },
  /** id → { seen, correct, wrong, streak, last: 'c' | 'w', fav, practise, t, box, due } */
  expr: {},
  /** 'YYYY-MM-DD' → ranked daily challenge attempt */
  daily: {},
  tutorialDone: false,
  streak: blankStreak(),
  /** local 'YYYY-MM-DD' → that day's activity and quests */
  days: {},
  place: 'home',
  seenPlaces: ['home'],
});

function cleanStreak(raw) {
  const s = { ...blankStreak(), ...(isObj(raw) ? raw : {}) };
  for (const k of ['count', 'best', 'lost', 't']) s[k] = Math.max(0, Math.round(num(s[k])));
  s.best = Math.max(s.best, s.count);
  s.brollies = Math.max(0, Math.min(BROLLY_MAX, Math.round(num(s.brollies))));
  s.last = DATE_ID.test(s.last) ? s.last : '';
  s.lostOn = DATE_ID.test(s.lostOn) ? s.lostOn : '';
  s.saved = isObj(s.saved) && DATE_ID.test(s.saved.on) ? { n: Math.max(1, Math.round(num(s.saved.n, 1))), on: s.saved.on } : null;
  return s;
}

function cleanDay(raw) {
  if (!isObj(raw)) return null;
  const day = { ...blankDay(), ...raw };
  for (const k of ['right', 'known', 'reviews', 'fresh', 'mastered', 'xp', 'games']) day[k] = Math.max(0, Math.round(num(day[k])));
  for (const k of ['goal', 'brolly', 'daily']) day[k] = !!day[k];
  const q = { ...blankQuests(), ...(isObj(raw.q) ? raw.q : {}) };
  for (const k of ['p0', 'p1', 'p2']) q[k] = Math.max(0, Math.round(num(q[k])));
  for (const k of ['d0', 'd1', 'd2', 'chest']) q[k] = !!q[k];
  q.chars = strings(q.chars).slice(0, 12);
  day.q = q;
  return day;
}

/** One per-expression record, cleaned up; old records get a Leitner box from their history. */
function cleanExpr(raw) {
  if (!isObj(raw)) return null;
  const s = { ...raw };
  for (const k of ['seen', 'correct', 'wrong', 'streak', 't']) s[k] = Math.max(0, num(raw[k]));
  s.last = raw.last === 'c' || raw.last === 'w' ? raw.last : null;
  s.fav = !!raw.fav;
  s.practise = !!raw.practise;
  if (Number.isFinite(raw.box)) s.box = Math.max(0, Math.min(SR_MAX_BOX, Math.round(raw.box)));
  else delete s.box;
  if (Number.isFinite(raw.due)) s.due = raw.due;
  else delete s.due;
  if (s.seen > 0 && s.box == null) {
    // saved before spaced repetition: a box from the current run of right answers
    s.box = s.last === 'w' ? 0 : Math.max(1, Math.min(SR_MAX_BOX, s.streak));
    s.due = dueFor(s.box, s.t || Date.now());
  } else if (s.box != null && s.due == null) {
    s.due = dueFor(s.box, s.t || Date.now());
  }
  return s;
}

function cleanDaily(raw) {
  if (!isObj(raw)) return null;
  const r = { ...raw };
  for (const k of ['n', 'score', 'correct', 'answered', 'total', 'bestStreak', 't']) r[k] = Math.max(0, num(raw[k]));
  r.marks = typeof raw.marks === 'string' ? raw.marks.slice(0, 64) : '';
  r.done = !!raw.done;
  return r;
}

export class Save {
  constructor() {
    this.data = defaults();
    this.persistent = true;
    this.listeners = new Set();
    /** Ids that actually have a model; set by the app so a roster entry without one is never awarded. */
    this.available = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Save._merge(this.data, JSON.parse(raw));
    } catch {
      this.persistent = false;
    }
  }

  /** Copy a saved object into `d` (a fresh defaults()), field by field, skipping anything malformed. */
  static _merge(d, saved) {
    if (!isObj(saved)) return false;
    for (const [k, v] of Object.entries(saved)) {
      // fields this module does not know about (added by other modules) pass straight through
      if (!(k in d) && typeof v !== 'function') d[k] = v;
    }
    d.version = 1;
    if (isObj(saved.settings)) {
      for (const [k, v] of Object.entries(saved.settings)) {
        if (k in d.settings ? typeof v === typeof d.settings[k] : plain(v)) d.settings[k] = v;
      }
    }
    if (typeof saved.character === 'string') d.character = saved.character;
    d.unlocked = [...new Set([...d.unlocked, ...strings(saved.unlocked)])];
    if (Array.isArray(saved.seenUnlocks)) d.seenUnlocks = strings(saved.seenUnlocks);
    if (isObj(saved.best)) for (const k of Object.keys(d.best)) d.best[k] = Math.max(d.best[k], num(saved.best[k], d.best[k]));
    if (isObj(saved.totals)) for (const k of Object.keys(d.totals)) d.totals[k] = Math.max(0, num(saved.totals[k], d.totals[k]));
    if (isObj(saved.expr)) {
      d.expr = {};
      for (const [id, rec] of Object.entries(saved.expr)) {
        const s = cleanExpr(rec);
        if (s) d.expr[id] = s;
      }
    }
    if (isObj(saved.daily)) {
      d.daily = {};
      for (const [id, rec] of Object.entries(saved.daily)) {
        const r = DATE_ID.test(id) && cleanDaily(rec);
        if (r) d.daily[id] = r;
      }
    }
    d.tutorialDone = !!saved.tutorialDone;
    d.streak = cleanStreak(saved.streak);
    if (isObj(saved.days)) {
      d.days = {};
      const ids = Object.keys(saved.days).filter((id) => DATE_ID.test(id)).sort().slice(-DAYS_KEEP);
      for (const id of ids) {
        const day = cleanDay(saved.days[id]);
        if (day) d.days[id] = day;
      }
    }
    if (typeof saved.place === 'string') d.place = saved.place;
    d.seenPlaces = [...new Set(['home', ...strings(saved.seenPlaces)])];
    return true;
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

  /**
   * Swap in a whole save (cloud sync uses this after merging local and remote
   * progress). The object is validated field by field exactly like a save read
   * from storage: malformed parts fall back to defaults, unknown fields are kept,
   * and settings missing from `data` keep their current values. Writes and
   * notifies listeners. Returns false (changing nothing) if `data` is not a save.
   */
  replaceAll(data) {
    let src = data;
    if (typeof src === 'string') {
      try {
        src = JSON.parse(src);
      } catch {
        return false;
      }
    }
    if (!isObj(src) || (src.version != null && src.version !== 1)) return false;
    const next = defaults();
    next.settings = { ...this.data.settings };
    if (!Save._merge(next, src)) return false;
    this.data = next;
    if (this.available) this._fitAvailable();
    this.write();
    return true;
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
    this._fitAvailable();
  }
  _fitAvailable() {
    const ids = [...this.available];
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
  _rec(id) {
    return (this.data.expr[id] ??= blankExpr());
  }
  /**
   * A game answer: updates the stats and the Leitner box (right → up one, wrong → box 0).
   * Returns { fresh, mastered }: met for the first time ever / mastered by this answer.
   */
  recordAnswer(id, correct) {
    const s = this._rec(id);
    const fresh = s.seen === 0;
    const wasMastered = s.streak >= MASTERY_STREAK;
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
    s.box = correct ? Math.min(SR_MAX_BOX, (s.box ?? 0) + 1) : 0;
    s.due = dueFor(s.box, s.t);
    if (correct) this.data.totals.correct++;
    else this.data.totals.wrong++;
    return { fresh, mastered: !wasMastered && s.streak >= MASTERY_STREAK };
  }
  /** A flashcard review ("I knew it" / "Not yet"): moves the Leitner box only. Returns the new box. */
  review(id, knew) {
    const s = this._rec(id);
    s.t = Date.now();
    s.box = knew ? Math.min(SR_MAX_BOX, (s.box ?? 0) + 1) : 0;
    s.due = dueFor(s.box, s.t);
    this.write();
    return s.box;
  }
  toggle(id, flag) {
    const s = this._rec(id);
    s[flag] = !s[flag];
    s.t = Date.now();
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
  /** Met in play and due for review now. */
  isDue(id, now = Date.now()) {
    const s = this.data.expr[id];
    return !!s && s.seen > 0 && (s.due ?? 0) <= now;
  }
  /** Ids due for review, most overdue first. `keep(id)` can filter (e.g. ids still in the game). */
  dueIds(now = Date.now(), keep = null) {
    const ex = this.data.expr;
    return Object.keys(ex)
      .filter((id) => ex[id].seen > 0 && (ex[id].due ?? 0) <= now && (!keep || keep(id)))
      .sort((a, b) => (ex[a].due ?? 0) - (ex[b].due ?? 0) || (ex[a].box ?? 0) - (ex[b].box ?? 0));
  }
  get seenIds() {
    return Object.keys(this.data.expr).filter((id) => this.data.expr[id].seen > 0);
  }
  get masteredCount() {
    return Object.keys(this.data.expr).filter((id) => this.isMastered(id)).length;
  }

  // ── daily challenge ─────────────────────────────────────────────────────
  /** The ranked attempt for a UTC day ('YYYY-MM-DD'), or null if not played. */
  dailyRecord(dateId) {
    return this.data.daily[dateId] ?? null;
  }
  /** Create or update the ranked attempt for a day, then write. */
  saveDaily(dateId, patch) {
    const daily = this.data.daily;
    daily[dateId] = { ...daily[dateId], ...patch, t: Date.now() };
    const days = Object.keys(daily).sort();
    for (const old of days.slice(0, Math.max(0, days.length - DAILY_KEEP))) delete daily[old];
    this.write();
    return daily[dateId];
  }

  // ── progress ────────────────────────────────────────────────────────────
  /** Lifetime stats used by unlock rules. */
  progress() {
    const d = this.data;
    return {
      score: d.best.score,
      streak: d.best.streak,
      stage: d.best.stage,
      games: d.totals.games,
      correct: d.totals.correct,
      seen: this.seenIds.length,
      mastered: this.masteredCount,
      total: d.totals.score,
      streakDays: d.streak.best,
      level: levelInfo(d.totals.xp).level,
    };
  }

  /**
   * Record a finished game. Returns { newBest, unlocked: [ids] }.
   * Daily challenges count towards totals and streaks but not the classic best score or stage.
   */
  finishGame({ score, bestStreak, stage, mode = 'classic' }) {
    const d = this.data;
    const classic = mode !== 'daily';
    const newBest = classic && score > d.best.score;
    if (classic) {
      d.best.score = Math.max(d.best.score, score);
      d.best.stage = Math.max(d.best.stage, stage);
    }
    d.best.streak = Math.max(d.best.streak, bestStreak);
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
      if (ruleProgress(rule, p).done) {
        this.data.unlocked.push(id);
        fresh.push(id);
      }
    }
    return fresh;
  }

  /** 0…1 progress towards a character's unlock rule (a tier: the better of points and mastery). */
  unlockProgress(rule) {
    return ruleProgress(rule, this.progress()).frac;
  }

  /** Full progress towards a rule, for display: { frac, done, parts: [{ label, have, need, frac }] }. */
  ruleProgress(rule) {
    return ruleProgress(rule, this.progress());
  }
}
