/**
 * Achievements — surprise badges for milestones (definitions: src/data/achievements.js; the
 * grid in My Collection: src/ui/achievements.js). Cosmetic and motivational only.
 *
 * It listens to the game's events and keeps two things in the save:
 *   stats   { [name]: number }      counters moved on by events (golden cards caught, bosses
 *                                    beaten, flashcards reviewed …). Numbers only, so cloud
 *                                    saves can merge them by maximum
 *   ach     { [id]: unlockedAtMs }   the badges won
 *
 * Each badge counts one measure (MEASURES) towards its goal. Most are a counter from `stats`;
 * the rest come from the save itself (expressions mastered, flowers, level, the daily streak,
 * situations finished, the day log …), and a few counters are topped up from records the save
 * has kept from the start, so a returning player gets the badges they have already earned.
 * Measures are checked as events arrive, after every game, at start-up and when a cloud sync
 * replaces the save. A badge is won once: the save is written, 'achievement:unlocked' { id }
 * is announced, and a sound and a toast celebrate it — straight away, or for badges won while
 * the game starts up, as soon as the player is past the title screen.
 *
 * Party games are several people sharing one phone, so their answers count for nothing here:
 * only 'party:done' does. Second chances and watering rounds are review rounds, not games.
 */
import { ACHIEVEMENTS } from '../data/achievements.js';
import { PLACES } from '../data/places.js';
import { levelInfo } from '../data/levels.js';
import { RELAX_GAME_MIN, addDays } from './progress.js';
import { duelOutcome } from './duel.js';

/** At most this many toasts at once (the toast stack holds three); more become one "N more". */
const TOAST_MAX = 3;
/** Counters that moved outside a game are written after this long (or with the next save). */
const WRITE_DELAY = 1200;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** A count read from the save: a finite number above 0, anything else is 0. */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const DATE_ID = /^\d{4}-\d{2}-\d{2}$/;

/** Night owl and early bird: the player's local hour when a game finished. */
export const isNightHour = (hour) => hour >= 22 || hour < 4;
export const isEarlyHour = (hour) => hour >= 5 && hour < 8;

/**
 * A finished run that counts as one of the player's own games — the same rule as XP and
 * quests (progress.js): not a party, a second chance or a watering, and a relax session
 * only once it has some substance.
 */
export function isOwnGame(r) {
  if (!isObj(r) || ['party', 'retry', 'water'].includes(r.mode)) return false;
  return r.mode !== 'relax' || num(r.answered) >= RELAX_GAME_MIN;
}

/** 0 (Sunday) … 6 (Saturday) for a local day id 'YYYY-MM-DD'. */
function weekday(id) {
  const [y, m, d] = id.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getDay();
}

/** Weekends with a game finished on the Saturday and on the Sunday, from the day log (progress.js). */
export function weekendsPlayed(days) {
  if (!isObj(days)) return 0;
  let n = 0;
  for (const [id, day] of Object.entries(days)) {
    if (DATE_ID.test(id) && num(day?.games) > 0 && weekday(id) === 0 && num(days[addDays(id, -1)]?.games) > 0) n++;
  }
  return n;
}

/** Ranked daily challenges with every card right (save.data.daily keeps a record of each). */
function perfectDailyRecords(daily) {
  if (!isObj(daily)) return 0;
  return Object.values(daily).filter((r) => isObj(r) && r.done && num(r.total) > 0 && num(r.correct) >= r.total).length;
}

/** Counters kept in save.data.stats, moved on by events. */
export const COUNTERS = [
  'games', // the player's own games finished (isOwnGame)
  'fevers', // times fever mode started
  'golden', // golden cards caught
  'jackpots', // golden cards caught in fever mode
  'bestStreak', // the longest run of right answers in a game with lives to lose
  'twists', // twist cards answered right
  'perfectDailies', // ranked daily challenges with every card right
  'bosses', // boss storm clouds beaten
  'powersUsed', // power-ups used
  'secondChances', // expressions put right in second chances
  'watered', // thirsty flowers watered (put right in watering rounds)
  'reviews', // flashcards rated
  'perfectShows', // Literal Theatre rounds with everything right
  'challenges', // friend challenges sent
  'challengesWon', // friend challenges won (a challenge someone else sent)
  'parties', // party games finished
  'setsDone', // sticker sets completed
  'nightGames', // games finished between 10 pm and 4 am
  'earlyGames', // games finished between 5 and 8 am
];

/**
 * What a badge's `count` measures, as a number to compare with its goal. `m` gives
 * `stat(name)`, the save (`save`, `data`), `level`, `streak` and `talks` (finished situations).
 */
export const MEASURES = {
  ...Object.fromEntries(COUNTERS.map((k) => [k, (m) => m.stat(k)])),
  // counters topped up from records the save has always kept (and merges across devices as it should)
  games: (m) => Math.max(m.stat('games'), num(m.data.totals?.games)),
  bestStreak: (m) => Math.max(m.stat('bestStreak'), num(m.data.best?.streak)),
  perfectDailies: (m) => Math.max(m.stat('perfectDailies'), perfectDailyRecords(m.data.daily)),
  // straight from the save
  mastered: (m) => m.save.masteredCount,
  flowers: (m) => m.save.plantedIds().length,
  discovered: (m) => m.save.seenIds.length,
  level: (m) => m.level,
  streakDays: (m) => Math.max(num(m.streak?.count), num(m.streak?.best)),
  situations: (m) => m.talks.size,
  perfectTalks: (m) => [...m.talks.values()].filter((t) => t.of > 0 && t.best >= t.of).length,
  talkPlaces: (m) => PLACES.filter((p) => [...m.talks.keys()].some((id) => id.startsWith(`${p.id}-`))).length,
  weekends: (m) => weekendsPlayed(m.data.days),
};

export function createAchievements(app) {
  const { events, save } = app;
  let mode = 'classic'; // the game being played: party games don't count
  let playing = false; // mid-game, counters wait for the game's end to be written
  let dirty = false; // counters changed since the save was last written
  let timer = null;
  const toasts = []; // badges won, waiting for a screen to be celebrated on
  const talked = new Map(); // situations finished this session: id → { best, of }

  /** The save's achievement data, repaired if it is missing or malformed (data is replaced by cloud syncs, so never kept). */
  function data() {
    const d = save.data;
    if (!isObj(d.stats)) d.stats = {};
    if (!isObj(d.ach)) d.ach = {};
    return d;
  }
  const stat = (k) => num(data().stats[k]);
  const unlockedAt = (id) => num(data().ach[id]) || null;
  function add(k, n = 1) {
    data().stats[k] = stat(k) + n;
    dirty = true;
  }
  function raise(k, v) {
    if (num(v) <= stat(k)) return;
    data().stats[k] = num(v);
    dirty = true;
  }

  /** Finished situations, id → { best, of }: the talk screen's records plus any finished this session. */
  function situations(talk) {
    const out = new Map();
    if (isObj(talk)) for (const [id, r] of Object.entries(talk)) if (isObj(r) && r.done) out.set(id, { best: num(r.best), of: num(r.of) });
    for (const [id, r] of talked) {
      const was = out.get(id);
      out.set(id, { best: Math.max(was?.best ?? 0, r.best), of: r.of || was?.of || 0 });
    }
    return out;
  }

  /** A measuring function for one check or listing: each measure is worked out at most once. */
  function measurer() {
    const d = data();
    let talks = null;
    const m = {
      data: d,
      save,
      stat,
      get level() {
        return app.progress?.level ?? levelInfo(num(d.totals?.xp)).level;
      },
      get streak() {
        return app.progress?.streak ?? d.streak;
      },
      get talks() {
        return (talks ??= situations(d.talk));
      },
    };
    const memo = new Map();
    return (name) => {
      if (!memo.has(name)) memo.set(name, num(MEASURES[name]?.(m)));
      return memo.get(name);
    };
  }

  /**
   * Unlock every badge whose measure has reached its goal. `only`: the measures that may have
   * moved (null: all of them). Returns the badges unlocked now.
   */
  function check(only = null) {
    const get = measurer();
    const won = [];
    for (const a of ACHIEVEMENTS) {
      if (unlockedAt(a.id) || (only && !only.includes(a.count))) continue;
      if (get(a.count) < (a.goal ?? 1)) continue;
      data().ach[a.id] = Date.now();
      won.push(a);
    }
    if (!won.length) return won;
    save.write();
    for (const a of won) events.emit('achievement:unlocked', { id: a.id });
    toasts.push(...won);
    celebrate();
    return won;
  }

  /** Sound and toasts for the badges won, once a screen past the title is showing. */
  function celebrate() {
    const screen = app.ui?.name;
    if (!toasts.length || !screen || screen === 'splash') return;
    const won = toasts.splice(0);
    app.audio?.play('unlock');
    const shown = won.length > TOAST_MAX ? won.slice(0, TOAST_MAX - 1) : won;
    for (const a of shown) app.ui.toast({ icon: a.icon, title: 'Achievement unlocked', sub: a.name, tone: 'gold', ms: 3600 });
    const more = won.length - shown.length;
    if (more) app.ui.toast({ icon: 'trophy', title: `${more} more achievements unlocked`, sub: 'See them all in My Collection', tone: 'gold', ms: 3600 });
  }

  /** Write counters that moved: soon (or with whatever writes the save next), and mid-game only when it ends. */
  function persist(now = false) {
    if (!dirty || playing) return;
    if (!now) {
      if (!timer) {
        timer = setTimeout(() => persist(true), WRITE_DELAY);
        timer.unref?.(); // Node (tests): never keeps the process alive
      }
      return;
    }
    clearTimeout(timer);
    timer = null;
    dirty = false;
    save.write();
  }
  save.onChange?.(() => {
    dirty = false; // the counters went out with that write
  });

  // ── games ───────────────────────────────────────────────────────────────
  events.on('game:intro', (p) => {
    mode = p?.mode ?? 'classic';
    playing = true;
  });
  events.on('game:answered', (p) => {
    const m = p?.mode ?? mode;
    if (!p?.correct || m === 'party') return;
    const moved = [];
    const count = (k) => {
      add(k);
      moved.push(k);
    };
    if (p.golden) count('golden');
    if (p.golden && p.fever) count('jackpots');
    if (p.twist) count('twists');
    if (m === 'retry') count('secondChances');
    if (m === 'water') count('watered');
    // relax, second chances and watering have no lives to lose: their streaks don't count
    if (!p.safe && num(p.streak) > stat('bestStreak')) {
      raise('bestStreak', p.streak);
      moved.push('bestStreak');
    }
    if (p.mastered) moved.push('mastered', 'flowers');
    if (moved.length) check(moved);
  });
  events.on('game:fever', (p) => {
    if (!p?.on || mode === 'party') return;
    add('fevers');
    check(['fevers']);
  });
  events.on('boss:end', (p) => {
    if (!p?.won || mode === 'party') return;
    add('bosses');
    check(['bosses']);
  });
  events.on('power:used', () => {
    add('powersUsed');
    check(['powersUsed']);
  });
  events.on('game:ending', (r) => {
    playing = false;
    if (isOwnGame(r)) {
      add('games');
      const hour = new Date(Date.now()).getHours();
      if (isNightHour(hour)) add('nightGames');
      if (isEarlyHour(hour)) add('earlyGames');
      if (r.mode !== 'relax') raise('bestStreak', r.streak);
      // the day's first (ranked) attempt only: practice replays have seen the cards before
      if (r.mode === 'daily' && r.daily?.ranked && num(r.daily.total) > 0 && num(r.correct) >= r.daily.total) add('perfectDailies');
      // a challenge someone sent (opponent is null when you started it), won on points, then right answers
      const them = r.mode === 'duel' ? r.duel?.opponent : null;
      if (isObj(them) && duelOutcome({ score: num(r.score), correct: num(r.correct) }, { score: num(them.score), correct: num(them.correct) }) === 'win') add('challengesWon');
    }
    check(); // everything: mastery, flowers, level, the streak and the day log move during games too
    persist(true);
  });

  // ── learning outside games ──────────────────────────────────────────────
  events.on('cards:review', () => {
    add('reviews');
    check(['reviews']);
    persist();
  });
  // a reply or a line right first time counts as a right answer, which can master an expression
  const answeredRight = (p) => p?.correct && check(['mastered', 'flowers']);
  events.on('talk:answered', answeredRight);
  events.on('theatre:answered', answeredRight);
  events.on('talk:done', (p) => {
    if (typeof p?.id === 'string') talked.set(p.id, { best: num(p.first), of: num(p.of) });
    check();
    persist();
  });
  events.on('theatre:done', (p) => {
    if (num(p?.n) > 0 && num(p?.right) >= p.n) add('perfectShows');
    check();
    persist();
  });

  // ── progress, friends, the album ────────────────────────────────────────
  events.on('progress:level', () => check(['level']));
  events.on('progress:goal', () => check(['streakDays']));
  const counted = (k) => () => {
    add(k);
    check([k]);
    persist();
  };
  events.on('duel:shared', counted('challenges'));
  events.on('party:done', counted('parties'));
  events.on('album:complete', counted('setsDone'));

  // ── the app ─────────────────────────────────────────────────────────────
  events.on('save:replaced', () => check()); // a cloud sync: progress from another device
  events.on('ui:screen', (name) => {
    playing = name === 'play';
    persist();
    celebrate();
  });

  check(); // badges earned before achievements existed (or on another device)

  return {
    /** Every badge in order with its state: [{ ...definition, unlocked, at (ms or null), have, goal }]. */
    list() {
      const get = measurer();
      return ACHIEVEMENTS.map((a) => {
        const goal = a.goal ?? 1;
        const at = unlockedAt(a.id);
        return { ...a, unlocked: at != null, at, have: at != null ? goal : Math.min(goal, Math.floor(get(a.count))), goal };
      });
    },
    isUnlocked: (id) => unlockedAt(id) != null,
    /** How many badges are unlocked. */
    count: () => ACHIEVEMENTS.reduce((n, a) => n + (unlockedAt(a.id) ? 1 : 0), 0),
  };
}
