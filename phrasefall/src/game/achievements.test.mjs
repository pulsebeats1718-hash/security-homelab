// Unit tests for achievements: the definitions, counters, unlocking once, the secret
// time-based badges (with a fake clock) and the badges that come from the save itself.
//   node src/game/achievements.test.mjs
import assert from 'node:assert/strict';
import { Save } from '../core/storage.js';
import { Events } from '../core/events.js';
import { Progress, GOAL } from './progress.js';
import { createAchievements, MEASURES, COUNTERS, isOwnGame, isNightHour, isEarlyHour, weekendsPlayed } from './achievements.js';
import { ACHIEVEMENTS, GROUPS } from '../data/achievements.js';
import { PLACES } from '../data/places.js';
import { xpForLevel } from '../data/levels.js';
import { ICONS } from '../ui/icons.js';

let passed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    passed++;
  } catch (err) {
    console.error(`✗ ${name}\n`, err);
    process.exitCode = 1;
  }
};

// a fake clock, in the player's local time
const realNow = Date.now;
let now = new Date(2026, 10, 18, 12).getTime(); // Wednesday 18 November 2026, noon
Date.now = () => now;
const setClock = (day, hour, minute = 0) => (now = new Date(2026, 10, day, hour, minute).getTime());

/** A small app: a save, the event bus, levels and streak (Progress) and a UI and audio that record what they are asked to do. */
function fresh({ save = new Save(), screen = 'menu', writeDelay } = {}) {
  const events = new Events();
  const progress = new Progress({ save, events });
  const sounds = [];
  const toasts = [];
  const unlocked = [];
  const ui = { name: screen, toast: (t) => toasts.push(t) };
  events.on('achievement:unlocked', ({ id }) => unlocked.push(id));
  const ach = createAchievements({ save, events, progress, ui, audio: { play: (name) => sounds.push(name) } }, { writeDelay });
  return { save, events, progress, ach, sounds, toasts, unlocked, ui };
}
const stat = (save, k) => save.data.stats[k] ?? 0;
const badge = (ach, id) => ach.list().find((a) => a.id === id);

/** One right answer, as the game announces it. */
const right = (events, extra = {}) => events.emit('game:answered', { correct: true, golden: false, fever: false, streak: 1, twist: null, mode: 'classic', safe: false, mastered: false, fresh: false, ...extra });
/** A whole game: its start and its results. */
function game(events, results = {}) {
  const mode = results.mode ?? 'classic';
  events.emit('game:intro', { mode });
  events.emit('game:ending', { mode, reason: 'ko', score: 800, correct: 8, answered: 11, accuracy: 73, streak: 4, twists: { shown: 1, right: 1 }, planted: [], retry: null, duel: null, daily: null, newBest: false, ...results });
}
/** A mastered expression record (its garden flower planted). */
const mastered = () => ({ seen: 3, correct: 3, wrong: 0, streak: 3, last: 'c', fav: false, practise: false, t: 1, box: 3, due: 0, bloom: 1 });

// ── the definitions ─────────────────────────────────────────────────────
await test('definitions: about thirty badges, every field within its limits', () => {
  assert.ok(ACHIEVEMENTS.length >= 28 && ACHIEVEMENTS.length <= 40, `${ACHIEVEMENTS.length} badges`);
  const ids = new Set();
  for (const a of ACHIEVEMENTS) {
    assert.match(a.id, /^[a-z]+(-[a-z]+)*$/, `${a.id}: kebab-case id`);
    assert.ok(!ids.has(a.id), `${a.id}: duplicate id`);
    ids.add(a.id);
    assert.ok(a.name && [...a.name].length <= 24, `${a.id}: name over 24 characters`);
    assert.ok(a.text && [...a.text].length <= 70, `${a.id}: text is ${[...a.text].length} characters`);
    assert.ok(ICONS[a.icon], `${a.id}: icon "${a.icon}" is not in icons.js`);
    assert.ok(GROUPS.includes(a.group), `${a.id}: unknown group "${a.group}"`);
    assert.ok(MEASURES[a.count], `${a.id}: unknown measure "${a.count}"`);
    if (a.goal !== undefined) assert.ok(Number.isInteger(a.goal) && a.goal > 1, `${a.id}: a goal is a whole number above 1 (leave it out for once)`);
    if (a.secret !== undefined) assert.equal(a.secret, true, `${a.id}: secret is true or left out`);
    if (a.secret) assert.equal(a.group, 'Secret', `${a.id}: secret badges live in the Secret group`);
  }
  for (const g of GROUPS) assert.ok(ACHIEVEMENTS.some((a) => a.group === g), `group "${g}" has badges`);
  for (const k of COUNTERS) assert.ok(MEASURES[k], `counter ${k} has a measure`);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.icon)).size, ACHIEVEMENTS.length, 'every badge has its own icon');
  assert.equal(ACHIEVEMENTS.find((a) => a.id === 'globetrotter').goal, PLACES.length);
});

await test('a fresh save: nothing unlocked, every badge listed with its goal and no progress', () => {
  const { ach, toasts, sounds, unlocked } = fresh();
  assert.equal(ach.count(), 0);
  const list = ach.list();
  assert.deepEqual(list.map((a) => a.id), ACHIEVEMENTS.map((a) => a.id));
  for (const a of list) {
    assert.equal(a.unlocked, false);
    assert.equal(a.at, null);
    assert.equal(a.have, a.count === 'level' ? 1 : 0, `${a.id} starts at the beginning`);
    assert.equal(a.goal, ACHIEVEMENTS.find((d) => d.id === a.id).goal ?? 1, `${a.id}: once is a goal of 1`);
  }
  const golden = badge(ach, 'golden-touch');
  assert.deepEqual([golden.name, golden.icon, golden.group, golden.goal], ['Golden touch', 'coin', 'Playing', 10]);
  assert.deepEqual([toasts.length, sounds.length, unlocked.length], [0, 0, 0]);
});

// ── counters and unlocking ──────────────────────────────────────────────
await test('counters: golden cards count up; the badge unlocks once, saved, announced, with a sound and a toast', () => {
  const { ach, events, save, toasts, sounds, unlocked } = fresh();
  events.emit('game:intro', { mode: 'classic' });
  for (let i = 1; i <= 9; i++) right(events, { golden: true });
  assert.equal(stat(save, 'golden'), 9);
  assert.equal(badge(ach, 'golden-touch').have, 9);
  assert.equal(ach.isUnlocked('golden-touch'), false);
  right(events, { golden: true });
  assert.equal(ach.isUnlocked('golden-touch'), true);
  assert.equal(save.data.ach['golden-touch'], now);
  assert.deepEqual(unlocked, ['golden-touch']);
  assert.deepEqual(sounds, ['unlock']);
  assert.deepEqual(toasts, [{ icon: 'coin', title: 'Achievement unlocked', sub: 'Golden touch', tone: 'gold', ms: 3600 }]);
  // more of the same: counted, but never celebrated again
  for (let i = 0; i < 5; i++) right(events, { golden: true });
  assert.equal(stat(save, 'golden'), 15);
  assert.deepEqual(unlocked, ['golden-touch']);
  assert.equal(toasts.length, 1);
  assert.deepEqual([badge(ach, 'golden-touch').have, badge(ach, 'golden-touch').at], [10, save.data.ach['golden-touch']]);
  assert.equal(ach.count(), 1);
});

await test('a badge is never celebrated twice: not after a restart, nor when its goal is reached again', () => {
  const first = fresh();
  game(first.events);
  assert.ok(first.ach.isUnlocked('first-steps'));
  assert.equal(first.toasts.length, 1);
  const again = fresh({ save: first.save }); // the next start-up, same save
  assert.ok(again.ach.isUnlocked('first-steps'));
  game(again.events);
  assert.deepEqual([again.toasts.length, again.unlocked.length, again.sounds.length], [0, 0, 0]);
  assert.equal(stat(again.save, 'games'), 2);
});

await test('in a game: streaks (ten start fever mode), twist cards, jackpots, bosses and power-ups', () => {
  const { ach, events, save } = fresh();
  events.emit('game:intro', { mode: 'classic' });
  for (let i = 1; i <= 9; i++) right(events, { streak: i, twist: 'flip' });
  assert.equal(badge(ach, 'on-fire').have, 9);
  assert.equal(ach.isUnlocked('on-fire'), false);
  right(events, { streak: 10 });
  assert.ok(ach.isUnlocked('on-fire'));
  for (let i = 11; i <= 19; i++) right(events, { streak: i });
  assert.equal(badge(ach, 'unstoppable').have, 19);
  right(events, { streak: 20, golden: true, fever: true });
  assert.ok(ach.isUnlocked('unstoppable'));
  assert.ok(ach.isUnlocked('jackpot'), 'a golden card in fever mode');
  assert.equal(stat(save, 'twists'), 9);
  for (let i = 0; i < 41; i++) right(events, { twist: ['flip', 'gap', 'listen', 'build'][i % 4] });
  assert.ok(ach.isUnlocked('twister'));
  events.emit('boss:end', { won: false, hits: 2, stage: 0 });
  assert.equal(ach.isUnlocked('silver-lining'), false);
  events.emit('boss:end', { won: true, hits: 3, stage: 0 });
  assert.ok(ach.isUnlocked('silver-lining'));
  for (let i = 0; i < 4; i++) events.emit('boss:end', { won: true, hits: 4, stage: i + 1 });
  assert.ok(ach.isUnlocked('storm-chaser'));
  for (let i = 0; i < 10; i++) events.emit('power:used', { kind: 'shield' });
  assert.ok(ach.isUnlocked('power-player'));
});

await test('second chances and watering count the expressions put right; their streaks have no lives at stake', () => {
  const { ach, events, save } = fresh();
  events.emit('game:intro', { mode: 'retry' });
  for (let i = 1; i <= 19; i++) right(events, { mode: 'retry', safe: true, streak: i });
  events.emit('game:answered', { correct: false, mode: 'retry', safe: true, streak: 0 });
  assert.equal(ach.isUnlocked('second-time-lucky'), false);
  right(events, { mode: 'retry', safe: true, streak: 1 });
  assert.ok(ach.isUnlocked('second-time-lucky'));
  assert.equal(stat(save, 'bestStreak'), 0, 'a safe streak is not a streak record');
  events.emit('game:intro', { mode: 'water' });
  for (let i = 0; i < 50; i++) right(events, { mode: 'water', safe: true, streak: i + 1 });
  assert.ok(ach.isUnlocked('rain-maker'));
  assert.equal(stat(save, 'secondChances'), 20);
  // review rounds are not games
  events.emit('game:ending', { mode: 'water', reason: 'complete', score: 0, correct: 10, answered: 10, streak: 10, retry: { total: 10, fixed: [], missed: [] } });
  assert.equal(ach.isUnlocked('first-steps'), false);
});

await test('party games count for nothing but the party itself', () => {
  const { ach, events, save, unlocked } = fresh();
  events.emit('game:intro', { mode: 'party' });
  for (let i = 1; i <= 25; i++) right(events, { mode: 'party', golden: true, fever: i > 10, twist: 'flip', streak: i });
  events.emit('boss:end', { won: true, hits: 3, stage: 0 }); // no mode on this one: the game's mode decides
  setClock(18, 23, 30);
  events.emit('game:ending', { mode: 'party', reason: 'complete', score: 2500, correct: 25, answered: 25, streak: 25, party: { turn: 0, of: 2 } });
  assert.deepEqual(save.data.stats, {});
  assert.equal(ach.count(), 0);
  events.emit('party:done', { players: [{ name: 'Ann', score: 900 }, { name: 'Bo', score: 700 }], cards: 10 });
  assert.deepEqual(unlocked, ['party-animal']);
  setClock(18, 12);
});

// ── secret, time-based ──────────────────────────────────────────────────
await test('night owl and early bird follow the local clock, for games of your own', () => {
  const { ach, events } = fresh();
  setClock(18, 12);
  game(events);
  setClock(18, 21, 59);
  game(events);
  assert.deepEqual([ach.isUnlocked('night-owl'), ach.isUnlocked('early-bird')], [false, false]);
  setClock(18, 23, 30);
  game(events, { mode: 'relax', answered: 6, correct: 6 }); // too short to count as a game
  game(events, { mode: 'retry', retry: { total: 3, fixed: [], missed: [] } }); // a review round
  game(events, { mode: 'party' });
  assert.equal(ach.isUnlocked('night-owl'), false);
  game(events, { mode: 'relax', answered: 12, correct: 10 });
  assert.ok(ach.isUnlocked('night-owl'));
  setClock(19, 4, 30);
  game(events);
  assert.equal(ach.isUnlocked('early-bird'), false);
  setClock(19, 7, 59);
  game(events, { mode: 'daily', daily: { ranked: false, total: 20 } });
  assert.ok(ach.isUnlocked('early-bird'));
  // the list keeps their secret flag (the grid hides the text until they are won)
  assert.equal(badge(ach, 'jackpot').secret, true);
  assert.deepEqual([22, 23, 0, 3].map(isNightHour), [true, true, true, true]);
  assert.deepEqual([4, 12, 21].map(isNightHour), [false, false, false]);
  assert.deepEqual([5, 6, 7].map(isEarlyHour), [true, true, true]);
  assert.deepEqual([4, 8, 23].map(isEarlyHour), [false, false, false]);
  setClock(18, 12);
});

await test('weekend warrior: games on a Saturday and on the Sunday after', () => {
  const { ach, events } = fresh();
  setClock(20, 18); // Friday
  game(events);
  setClock(22, 10); // Sunday, but nothing on the Saturday
  game(events);
  assert.equal(ach.isUnlocked('weekend-warrior'), false);
  setClock(28, 9); // the next Saturday…
  game(events);
  assert.equal(ach.isUnlocked('weekend-warrior'), false);
  setClock(29, 20); // …and its Sunday
  game(events, { mode: 'relax', answered: 4 }); // a short relax session is not a game
  assert.equal(ach.isUnlocked('weekend-warrior'), false);
  game(events);
  assert.ok(ach.isUnlocked('weekend-warrior'));
  assert.equal(weekendsPlayed({ '2026-11-14': { games: 1 }, '2026-11-15': { games: 2 }, '2026-11-21': { games: 0 }, '2026-11-22': { games: 1 } }), 1);
  assert.equal(weekendsPlayed(null), 0);
  setClock(18, 12);
});

// ── from the save itself ────────────────────────────────────────────────
await test('badges the save already earned unlock at start-up, celebrated once the player is past the title', () => {
  const save = new Save();
  for (let i = 0; i < 100; i++) save.data.expr[`e${i}`] = mastered();
  save.data.totals.xp = xpForLevel(10);
  save.data.totals.games = 12;
  save.data.best.streak = 25;
  save.data.streak = { ...save.data.streak, best: 7 };
  const { ach, events, toasts, sounds, unlocked, ui } = fresh({ save, screen: null });
  const expected = ['first-steps', 'ten-game-test', 'on-fire', 'unstoppable', 'hat-trick', 'creature-of-habit', 'wordsmith', 'budding-gardener', 'green-fingers', 'rising-star'];
  assert.deepEqual(unlocked, expected, 'announced straight away, in order');
  assert.equal(ach.count(), expected.length);
  assert.equal(badge(ach, 'treasure-hunter').have, 100);
  assert.equal(badge(ach, 'month-of-sundays').have, 7);
  assert.equal(badge(ach, 'jet-setter').have, 10);
  // no toasts while the game is loading or on the title screen
  assert.equal(toasts.length, 0);
  ui.name = 'splash';
  events.emit('ui:screen', 'splash');
  assert.equal(toasts.length, 0);
  ui.name = 'menu';
  events.emit('ui:screen', 'menu');
  assert.deepEqual(sounds, ['unlock'], 'one sound for the lot');
  assert.deepEqual(toasts.map((t) => t.sub), ['First steps', 'Ten-game test', 'See them all in My Collection']);
  assert.equal(toasts[2].title, '8 more achievements unlocked');
  events.emit('ui:screen', 'collection');
  assert.equal(toasts.length, 3, 'celebrated once');
});

await test('mastering expressions in a game unlocks learning and garden badges there and then', () => {
  const save = new Save();
  for (let i = 0; i < 49; i++) save.data.expr[`e${i}`] = mastered();
  const { ach, events } = fresh({ save });
  assert.ok(ach.isUnlocked('budding-gardener'));
  assert.equal(badge(ach, 'green-fingers').have, 49);
  events.emit('game:intro', { mode: 'classic' });
  save.recordAnswer('break-the-ice', true);
  save.recordAnswer('break-the-ice', true);
  right(events, { mastered: false });
  assert.equal(ach.isUnlocked('green-fingers'), false);
  const rec = save.recordAnswer('break-the-ice', true);
  assert.ok(rec.planted);
  right(events, { mastered: rec.mastered });
  assert.ok(ach.isUnlocked('green-fingers'), 'the 50th flower');
  assert.equal(badge(ach, 'wordsmith').have, 50);
});

await test('streaks: the daily goal three days in a row is a hat-trick (flashcards count too)', () => {
  const { ach, events, save } = fresh();
  for (let day = 1; day <= 3; day++) {
    for (let i = 0; i < GOAL; i++) events.emit('cards:review', { id: `c${i}`, knew: true });
    if (day < 3) {
      assert.equal(ach.isUnlocked('hat-trick'), false, `day ${day}`);
      now += 86_400_000;
    }
  }
  assert.ok(ach.isUnlocked('hat-trick'));
  assert.equal(badge(ach, 'creature-of-habit').have, 3);
  assert.equal(stat(save, 'reviews'), 3 * GOAL);
  assert.equal(badge(ach, 'bookworm').have, 3 * GOAL);
  setClock(18, 12);
});

await test('levels: Rising star at level 10, Jet-setter once every place is open', () => {
  const { ach, progress } = fresh();
  progress.addXp(xpForLevel(10) - 1);
  assert.equal(ach.isUnlocked('rising-star'), false);
  progress.addXp(1);
  assert.ok(ach.isUnlocked('rising-star'));
  const last = Math.max(...PLACES.map((p) => p.level));
  progress.addXp(xpForLevel(last) - progress.xp);
  assert.equal(progress.level, last);
  assert.ok(ach.isUnlocked('jet-setter'));
});

await test('situations: ten different ones, one with every reply right, and one in every place', () => {
  const { ach, events, save } = fresh();
  const talk = (id, first = 2, of = 3) => {
    (save.data.talk ??= {})[id] = { done: true, best: Math.max(save.data.talk?.[id]?.best ?? 0, first), of, t: now };
    events.emit('talk:done', { id, first, of });
  };
  talk('home-rainy-fete');
  talk('home-rainy-fete'); // the same one again
  assert.equal(badge(ach, 'chatterbox').have, 1);
  assert.equal(badge(ach, 'globetrotter').have, 1);
  assert.equal(ach.isUnlocked('spot-on'), false);
  talk('home-tea-at-brambles', 3, 3);
  assert.ok(ach.isUnlocked('spot-on'));
  talk('london-bus-stop');
  talk('newyork-hot-dog');
  assert.equal(badge(ach, 'globetrotter').have, 3);
  // finished, but not in the save yet: the event alone counts
  events.emit('talk:done', { id: 'sydney-surf-lesson', first: 1, of: 3 });
  assert.ok(ach.isUnlocked('globetrotter'));
  for (const id of ['home-shooting-stars', 'home-harbour-fishing', 'london-bakery-buns', 'london-museum']) talk(id);
  assert.equal(badge(ach, 'chatterbox').have, 9);
  talk('sydney-beach-bbq');
  assert.ok(ach.isUnlocked('chatterbox'));
});

await test('Literal Theatre: only a round with everything right is a showstopper', () => {
  const { ach, events } = fresh();
  events.emit('theatre:done', { n: 0, right: 0 });
  events.emit('theatre:done', { n: 6, right: 5 });
  assert.equal(ach.isUnlocked('showstopper'), false);
  events.emit('theatre:done', { n: 6, right: 6 });
  assert.ok(ach.isUnlocked('showstopper'));
});

await test('friends: sending a challenge, and winning one a friend sent (points first, then right answers)', () => {
  const { ach, events, unlocked } = fresh();
  events.emit('duel:shared', {});
  assert.ok(ach.isUnlocked('challenger'));
  const duel = (opponent, score = 1500, correct = 15) => game(events, { mode: 'duel', reason: 'complete', score, correct, answered: 20, duel: { seed: 'abcd1234', opponent, marks: 'c'.repeat(correct), total: 20 } });
  duel(null, 3000, 20); // your own challenge: nobody to beat yet
  duel({ score: 1800, correct: 17 }); // lost
  duel({ score: 1500, correct: 15 }); // a draw
  assert.equal(ach.isUnlocked('champion'), false);
  duel({ score: 1500, correct: 14 }); // the same points, more right answers
  assert.ok(ach.isUnlocked('champion'));
  assert.deepEqual(unlocked, ['challenger', 'first-steps', 'champion']);
});

await test('perfect daily: all 20 right on the day’s first go, from the event or the save’s records', () => {
  const { ach, events } = fresh();
  game(events, { mode: 'daily', correct: 20, answered: 20, daily: { ranked: false, total: 20 } }); // practice
  game(events, { mode: 'daily', correct: 19, answered: 20, daily: { ranked: true, total: 20 } });
  assert.equal(ach.isUnlocked('perfect-daily'), false);
  game(events, { mode: 'daily', correct: 20, answered: 20, daily: { ranked: true, total: 20 } });
  assert.ok(ach.isUnlocked('perfect-daily'));
  // a perfect ranked attempt from before achievements existed
  const save = new Save();
  save.data.daily['2026-10-02'] = { n: 300, score: 2600, correct: 20, answered: 20, total: 20, bestStreak: 20, marks: 'c'.repeat(20), done: true, t: 1 };
  save.data.daily['2026-10-03'] = { n: 301, score: 900, correct: 9, answered: 9, total: 20, bestStreak: 9, marks: 'c'.repeat(9), done: false, t: 2 };
  assert.ok(fresh({ save }).ach.isUnlocked('perfect-daily'));
});

await test('sticker album: a completed set, announced or already in the save (another device, an earlier build)', () => {
  const { ach, events } = fresh();
  events.emit('album:complete', { set: 'weather' });
  assert.ok(ach.isUnlocked('sticker-collector'));
  const save = new Save();
  save.data.album = { food: now - 1000 };
  assert.ok(fresh({ save }).ach.isUnlocked('sticker-collector'));
});

await test('which runs count as games', () => {
  assert.equal(isOwnGame({ mode: 'classic', answered: 1 }), true);
  assert.equal(isOwnGame({ mode: 'duel', answered: 20 }), true);
  assert.equal(isOwnGame({ mode: 'relax', answered: 9 }), false);
  assert.equal(isOwnGame({ mode: 'relax', answered: 10 }), true);
  for (const mode of ['retry', 'water', 'party']) assert.equal(isOwnGame({ mode, answered: 20 }), false, mode);
  assert.equal(isOwnGame(null), false);
});

// ── odd saves, cloud syncs, storage ─────────────────────────────────────
await test('a malformed save is repaired; a cloud sync brings badges and counters without repeating toasts', () => {
  const save = new Save();
  save.data.stats = 'oops';
  save.data.ach = [1, 2];
  const { ach, events, toasts } = fresh({ save });
  assert.deepEqual([save.data.stats, save.data.ach], [{}, {}]);
  assert.ok(ach.list().every((a) => Number.isFinite(a.have) && a.have >= 0));
  // another device won Challenger and caught 10 golden cards; cloud saves merge counters by maximum
  assert.ok(save.replaceAll({ ...save.data, ach: { challenger: now - 5000, bogus: 'yes' }, stats: { golden: 10, twists: 'many' } }));
  events.emit('save:replaced');
  assert.ok(ach.isUnlocked('challenger'));
  assert.ok(ach.isUnlocked('golden-touch'), 'its counter reached the goal on the other device');
  assert.equal(ach.isUnlocked('bogus'), false);
  assert.equal(ach.count(), 2);
  assert.deepEqual(toasts.map((t) => t.sub), ['Golden touch'], 'only the badge new to this device is celebrated');
  assert.equal(badge(ach, 'twister').have, 0);
});

await test('counters reach storage: when a game ends, on the next screen, and soon after anything else', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pageEvents = {};
  globalThis.document = { hidden: false, addEventListener: (type, fn) => (pageEvents[type] = fn) };
  try {
    const stored = () => JSON.parse(store.get('phrasefall.save.v1') ?? '{}').stats ?? {};
    const { events, save } = fresh({ writeDelay: 30 });
    // mid-game counters wait for the end of the game
    events.emit('game:intro', { mode: 'classic' });
    right(events, { golden: true });
    await wait(60);
    assert.equal(stored().golden, undefined);
    events.emit('game:ending', { mode: 'classic', reason: 'ko', score: 300, correct: 3, answered: 6, streak: 3 });
    assert.deepEqual([stored().golden, stored().games], [1, 1]);
    // a game left part-way (no results): written when the next screen opens
    events.emit('game:intro', { mode: 'classic' });
    right(events, { golden: true });
    events.emit('ui:screen', 'menu');
    assert.equal(stored().golden, 2);
    // flashcards write the save before the count moves: it follows shortly after
    events.emit('cards:review', { id: 'break-the-ice', knew: true });
    assert.equal(stored().reviews, undefined);
    await wait(60);
    assert.equal(stored().reviews, 1);
    // when something else writes first, the waiting write has nothing left to do, and the next one still comes
    events.emit('cards:review', { id: 'break-the-ice', knew: true });
    save.write();
    assert.equal(stored().reviews, 2);
    await wait(60);
    events.emit('cards:review', { id: 'break-the-ice', knew: true });
    await wait(60);
    assert.equal(stored().reviews, 3);
    // the player leaves the app mid-game: what is waiting is written anyway
    events.emit('game:intro', { mode: 'classic' });
    right(events, { golden: true });
    globalThis.document.hidden = true;
    pageEvents.visibilitychange();
    assert.equal(stored().golden, 3);
  } finally {
    delete globalThis.localStorage;
    delete globalThis.document;
  }
});

await test('after Settings → reset progress, badges can be won (and celebrated) again from scratch', () => {
  const { ach, events, save, toasts } = fresh();
  events.emit('talk:done', { id: 'home-rainy-fete', first: 3, of: 3 }); // its record is not in the save: counted from the event
  assert.ok(ach.isUnlocked('spot-on'));
  save.reset();
  assert.equal(ach.count(), 0);
  assert.equal(badge(ach, 'chatterbox').have, 0, 'the situations finished before the reset are forgotten');
  game(events);
  assert.deepEqual(toasts.map((t) => t.sub), ['Spot on', 'First steps']);
});

Date.now = realNow;
console.log(process.exitCode ? 'FAILED' : `✓ ${passed} tests passed`);
