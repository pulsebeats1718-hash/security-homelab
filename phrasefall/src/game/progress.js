/**
 * Progress — the reasons to come back tomorrow. Cosmetic and motivational only:
 * nothing here changes the rules of a game.
 *
 *   Level      XP for everything the player does (src/data/levels.js); levels
 *              unlock new places for the island (src/data/places.js).
 *   Streak     days in a row with the daily goal met. Missing a day uses up a
 *              brolly (a streak saver: one for every 7 days of streak, hold up to
 *              two); with none left the streak ends. Milestones at 7, 30, 100 and
 *              365 days unlock characters (roster rule `streakDays`).
 *   Goal       15 right answers in a day (games, or flashcards rated "I knew it"),
 *              or finishing the day's ranked daily challenge.
 *   Quests     three a day (easy, medium, hard), the same for everyone on the same
 *              date; finishing all three opens a reward chest.
 *   Day log    a little activity record per local day for the weekly report.
 *
 * Days here are the player's LOCAL calendar days, so a streak ends at their own
 * midnight (the daily challenge, by contrast, is the same UTC day for everyone).
 *
 * It listens to game events and the flashcards' `cards:review`, updates the
 * save, and announces what happened as `progress:*` events for the interface:
 *   progress:xp { gained, total }        progress:level { level, places }
 *   progress:quest { quest }             progress:chest-ready
 *   progress:goal { count, brolly, unlocked, milestone }
 *   progress:streak-lost { count }       progress:brolly-used { n, count }
 */
import { mulberry32, hash32 } from '../core/utils.js';
import { XP, levelInfo } from '../data/levels.js';
import { PLACES, placesForLevel } from '../data/places.js';
import { blankDay, BROLLY_MAX, DAYS_KEEP } from '../core/storage.js';

export const GOAL = 15;
export const BROLLY_EVERY = 7;
export const STREAK_MILESTONES = [7, 30, 100, 365];
export { BROLLY_MAX };

// ── local calendar days ───────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
/** 'YYYY-MM-DD' in the player's own time zone. */
export const localDay = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const noon = (id) => {
  const [y, m, d] = id.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
export const addDays = (id, n) => {
  const d = noon(id);
  d.setDate(d.getDate() + n);
  return localDay(d.getTime());
};
export const daysBetween = (a, b) => Math.round((noon(b) - noon(a)) / 86_400_000);
/** Milliseconds to the player's next midnight (when quests and the goal reset). */
export const msToMidnight = (t = Date.now()) => {
  const d = new Date(t);
  d.setHours(24, 0, 0, 0);
  return d.getTime() - t;
};
/** "Mon" for a local day id. */
export const weekdayShort = (id) => noon(id).toLocaleDateString('en-GB', { weekday: 'short' });

// ── quests ────────────────────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString('en-GB');
const KINDS = {
  right: { icon: 'check', text: (n) => `Get ${fmt(n)} answers right` },
  fresh: { icon: 'sparkle', text: (n) => `Discover ${n} new expressions` },
  streak: { icon: 'flame', text: (n) => `Reach a ×${n} streak in a game` },
  score: { icon: 'trophy', text: (n) => `Score ${fmt(n)} in one game` },
  games: { icon: 'play', text: (n) => `Finish ${n} games` },
  review: { icon: 'cards', text: (n) => `Review ${n} flashcards` },
  daily: { icon: 'calendar', text: () => 'Play the daily challenge' },
  stage: { icon: 'layers', text: (n) => `Reach stage ${n} in a classic game` },
  chars: { icon: 'user', text: (n) => `Finish games with ${n} different characters` },
  golden: { icon: 'star', text: () => 'Catch a golden expression' },
  fever: { icon: 'bolt', text: () => 'Hit fever mode with a ×10 streak' },
  phrasal: { icon: 'book', text: (n) => `Get ${n} phrasal verbs right` },
  idiom: { icon: 'book', text: (n) => `Get ${n} idioms right` },
};
/** One quest a day from each tier. Targets suit a session or two of play. */
const TIERS = [
  { label: 'Easy', xp: 40, pool: [['right', 15], ['games', 2], ['fresh', 6], ['review', 5], ['daily', 1], ['streak', 5]] },
  { label: 'Medium', xp: 60, pool: [['right', 30], ['fresh', 12], ['streak', 8], ['score', 1500], ['stage', 3], ['chars', 2], ['review', 12], ['golden', 1], ['phrasal', 8]] },
  { label: 'Hard', xp: 90, pool: [['right', 50], ['streak', 12], ['score', 3000], ['stage', 4], ['fever', 1], ['games', 5], ['idiom', 10], ['fresh', 20]] },
];

/** The three quests for a day — derived from the date alone, so every device agrees. */
export function questsFor(dayId) {
  const rng = mulberry32(hash32(`quests:${dayId}`));
  const used = new Set();
  return TIERS.map((tier, slot) => {
    const options = tier.pool.filter(([kind]) => !used.has(kind));
    const [kind, n] = options[Math.floor(rng() * options.length)];
    used.add(kind);
    return { slot, kind, n, xp: tier.xp, tier: tier.label, icon: KINDS[kind].icon, text: KINDS[kind].text(n) };
  });
}

/** What a chest holds: 100–250 XP, sometimes a brolly. */
function rollChest(brollies, rng = Math.random) {
  const xp = [100, 150, 150, 200, 200, 250][Math.floor(rng() * 6)];
  return { xp, brolly: brollies < BROLLY_MAX && rng() < 0.35 };
}

export class Progress {
  constructor({ save, events }) {
    this.save = save;
    this.events = events;
    /** The current / last game: what changed during it, for the results screen. */
    this.run = null;
    this.touch();
    events.on('game:intro', () => this._runStart());
    events.on('game:answered', (p) => this._answered(p));
    events.on('game:score', (p) => this._bump('score', p.score, true));
    events.on('game:fever', (p) => p.on && this._bump('fever', 1, true));
    events.on('game:stage', ({ stage }) => this._bump('stage', stage.n, true));
    events.on('game:ending', (r) => this._finished(r));
    events.on('cards:review', (p) => this._reviewed(p));
  }

  get data() {
    return this.save.data;
  }
  /** The game in progress (its bookkeeping stops once it has finished). */
  get liveRun() {
    return this.run && !this.run.done ? this.run : null;
  }

  // ── level ───────────────────────────────────────────────────────────────
  get xp() {
    return this.data.totals.xp ?? 0;
  }
  get info() {
    return levelInfo(this.xp);
  }
  get level() {
    return this.info.level;
  }

  /** Add XP; announces level-ups (and the places they unlock). */
  addXp(amount) {
    if (!(amount > 0)) return;
    const before = levelInfo(this.xp).level;
    this.data.totals.xp = this.xp + amount;
    this._day().xp += amount;
    const run = this.liveRun;
    if (run) run.xp += amount;
    const after = levelInfo(this.xp).level;
    this.events.emit('progress:xp', { gained: amount, total: this.xp });
    if (after > before) {
      const places = PLACES.filter((p) => p.level > before && p.level <= after);
      if (run) run.places.push(...places);
      this.events.emit('progress:level', { level: after, from: before, places });
      this.save.write();
    }
  }

  // ── places ──────────────────────────────────────────────────────────────
  unlockedPlaces() {
    return placesForLevel(this.level);
  }
  isPlaceOpen(id) {
    return this.unlockedPlaces().some((p) => p.id === id);
  }
  /** The place the island should be in: the chosen one if it is open, otherwise home. */
  get place() {
    const id = this.data.place;
    return this.isPlaceOpen(id) ? id : 'home';
  }
  setPlace(id) {
    if (!this.isPlaceOpen(id)) return false;
    this.data.place = id;
    this.markPlaceSeen(id);
    this.save.write();
    return true;
  }
  /** Places unlocked but not yet celebrated, in journey order. */
  unseenPlaces() {
    const seen = new Set(this.data.seenPlaces);
    return this.unlockedPlaces().filter((p) => !seen.has(p.id));
  }
  markPlaceSeen(id) {
    if (!this.data.seenPlaces.includes(id)) {
      this.data.seenPlaces.push(id);
      this.save.write();
    }
  }

  // ── days ────────────────────────────────────────────────────────────────
  /** Today's (or a given day's) activity record, created when first needed. */
  _day(id = localDay()) {
    const days = this.data.days;
    if (!days[id]) {
      days[id] = blankDay();
      const ids = Object.keys(days).sort();
      for (const old of ids.slice(0, Math.max(0, ids.length - DAYS_KEEP))) delete days[old];
    }
    return days[id];
  }
  today() {
    return this._day();
  }
  /** Progress towards today's goal: { have, need, met }. */
  goal() {
    const d = this._day();
    return { have: Math.min(GOAL, d.right + d.known), need: GOAL, met: d.goal };
  }

  /** The last seven local days (oldest first) and their totals, for the weekly report. */
  week(now = Date.now()) {
    const today = localDay(now);
    const days = [];
    const sum = { xp: 0, right: 0, fresh: 0, mastered: 0, games: 0, played: 0 };
    for (let i = 6; i >= 0; i--) {
      const id = addDays(today, -i);
      const d = this.data.days[id];
      const row = { id, label: weekdayShort(id), today: i === 0, xp: d?.xp ?? 0, right: d?.right ?? 0, fresh: d?.fresh ?? 0, mastered: d?.mastered ?? 0, games: d?.games ?? 0, goal: !!d?.goal, brolly: !!d?.brolly };
      days.push(row);
      for (const k of ['xp', 'right', 'fresh', 'mastered', 'games']) sum[k] += row[k];
      if (row.xp > 0) sum.played++;
    }
    return { days, ...sum };
  }

  // ── streak ──────────────────────────────────────────────────────────────
  get streak() {
    return this.data.streak;
  }
  /** Is today's goal still needed to keep (or start) the streak? */
  get streakAtRisk() {
    const s = this.streak;
    return s.count > 0 && s.last !== localDay();
  }

  /**
   * Bring the streak up to today: missed days are covered by brollies while
   * they last, otherwise the streak ends. Safe to call any time.
   */
  touch(now = Date.now()) {
    const s = this.streak;
    if (!s.last || s.count <= 0) return;
    const today = localDay(now);
    const gap = daysBetween(s.last, today);
    if (gap <= 1) return;
    const missed = gap - 1;
    if (s.brollies >= missed) {
      s.brollies -= missed;
      for (let i = 1; i <= missed; i++) this._day(addDays(s.last, i)).brolly = true;
      s.saved = { n: missed, on: today };
      s.last = addDays(today, -1);
      this.events.emit('progress:brolly-used', { n: missed, count: s.count });
    } else {
      s.lost = s.count;
      s.lostOn = today;
      s.count = 0;
      this.events.emit('progress:streak-lost', { count: s.lost });
    }
    s.t = now;
    this.save.write();
  }

  /** One-off notes for the menu: a brolly that saved the streak, or a streak that ended. */
  notice() {
    const s = this.streak;
    if (s.saved && s.saved.on === localDay()) return { kind: 'brolly', n: s.saved.n, count: s.count };
    if (s.lost && s.lostOn === localDay() && s.count === 0) return { kind: 'lost', count: s.lost };
    return null;
  }
  dismissNotice() {
    const s = this.streak;
    s.saved = null;
    s.lost = 0;
    s.lostOn = '';
    this.save.write();
  }

  _checkGoal(dayId = localDay()) {
    const day = this._day(dayId);
    if (day.goal || (day.right + day.known < GOAL && !day.daily)) return;
    day.goal = true;
    this.touch();
    const s = this.streak;
    if (s.last === dayId) return;
    s.count = s.count > 0 && s.last === addDays(dayId, -1) ? s.count + 1 : 1;
    s.last = dayId;
    s.best = Math.max(s.best, s.count);
    s.lost = 0;
    s.lostOn = '';
    s.t = Date.now();
    let brolly = false;
    if (s.count % BROLLY_EVERY === 0 && s.brollies < BROLLY_MAX) {
      s.brollies++;
      brolly = true;
    }
    const unlocked = this.save.checkUnlocks(); // the streak characters
    const run = this.liveRun;
    if (run) {
      run.goal = true;
      run.unlocked.push(...unlocked);
    }
    this.addXp(XP.goal);
    this.save.write();
    this.events.emit('progress:goal', { count: s.count, brolly, unlocked, milestone: STREAK_MILESTONES.includes(s.count) });
  }

  /** The next streak milestone, with its character id from the roster: { days, id } or null. */
  nextMilestone() {
    const best = this.streak.best;
    const days = STREAK_MILESTONES.find((d) => d > best);
    return days ? { days } : null;
  }

  // ── quests ──────────────────────────────────────────────────────────────
  /** Today's quests with progress: [{ slot, kind, n, xp, tier, icon, text, have, done }]. */
  quests(dayId = localDay()) {
    const q = this._day(dayId).q;
    return questsFor(dayId).map((def) => ({ ...def, have: Math.min(def.n, q[`p${def.slot}`] ?? 0), done: !!q[`d${def.slot}`] }));
  }
  /** 'locked' (quests to do), 'ready' (all done) or 'opened'. */
  chestState() {
    const q = this._day().q;
    if (q.chest) return 'opened';
    return q.d0 && q.d1 && q.d2 ? 'ready' : 'locked';
  }
  /** Open today's chest. Returns { xp, brolly } or null if it isn't ready. */
  openChest() {
    if (this.chestState() !== 'ready') return null;
    const s = this.streak;
    const reward = rollChest(s.brollies);
    this._day().q.chest = true;
    if (reward.brolly) {
      s.brollies = Math.min(BROLLY_MAX, s.brollies + 1);
      s.t = Date.now();
    }
    this.addXp(reward.xp);
    this.save.write();
    return reward;
  }

  /** Move quests of `kind` on: add `value`, or with `max` keep the highest value seen. */
  _bump(kind, value, max = false) {
    const id = localDay();
    const q = this._day(id).q;
    for (const quest of questsFor(id)) {
      if (quest.kind !== kind) continue;
      const key = `p${quest.slot}`;
      const before = q[key] ?? 0;
      q[key] = max ? Math.max(before, value) : before + value;
      if (!q[`d${quest.slot}`] && q[key] >= quest.n) {
        q[`d${quest.slot}`] = true;
        this.liveRun?.quests.push(quest.slot);
        this.addXp(quest.xp);
        this.events.emit('progress:quest', { quest: { ...quest, have: quest.n, done: true } });
        if (q.d0 && q.d1 && q.d2) this.events.emit('progress:chest-ready');
        this.save.write();
      }
    }
  }

  // ── events ──────────────────────────────────────────────────────────────
  _runStart() {
    this.touch();
    const d = this.data;
    this.run = {
      xp0: d.totals.xp ?? 0,
      xp: 0,
      day: localDay(),
      goal0: this.goal(),
      streak0: d.streak.count,
      quests0: this.quests(),
      quests: [],
      places: [],
      unlocked: [],
      goal: false,
    };
  }

  _answered(p) {
    const id = localDay();
    const day = this._day(id);
    if (p.correct) {
      day.right++;
      this.addXp(XP.right * (p.golden ? 3 : 1) * (p.fever ? 2 : 1));
      this._bump('right', 1);
      this._bump('streak', p.streak ?? 0, true);
      if (p.golden) this._bump('golden', 1);
      if (p.type === 'phrasal' || p.type === 'idiom') this._bump(p.type, 1);
      if (p.mastered) day.mastered++;
    }
    if (p.fresh) {
      day.fresh++;
      this._bump('fresh', 1);
    }
    this._checkGoal(id);
  }

  _finished(r) {
    const id = localDay();
    const day = this._day(id);
    day.games++;
    this.addXp(XP.game);
    this._bump('games', 1);
    const q = day.q;
    const ch = this.data.character;
    if (!q.chars.includes(ch)) q.chars.push(ch);
    this._bump('chars', q.chars.length, true);
    if (r.mode === 'daily') {
      this._bump('daily', 1, true);
      if (r.daily?.ranked && !day.daily) {
        day.daily = true;
        this.addXp(XP.daily);
      }
    }
    this._checkGoal(id);
    if (this.run) this.run.done = true;
    this.save.write();
  }

  _reviewed({ knew }) {
    const id = localDay();
    const day = this._day(id);
    day.reviews++;
    if (knew) day.known++;
    if (day.reviews <= XP.reviewCap) this.addXp(XP.review);
    this._bump('review', 1);
    this._checkGoal(id);
    this.save.write();
  }
}
