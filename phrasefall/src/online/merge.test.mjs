// Unit tests for cloud-save merging, encoding, nicknames and board dates.
//   node src/online/merge.test.mjs
import assert from 'node:assert/strict';
import { mergeSaves, countersOf } from './merge.js';
import { encodeSave, decodeSave, encodedSize } from './pack.js';
import { checkName, defaultName } from './names.js';
import { dayId, weekId, isDayId, msToNextWeek } from './dates.js';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`✗ ${name}\n`, err);
    process.exitCode = 1;
  }
};

const save = (over = {}) => ({
  version: 1,
  settings: { music: 0.6, quality: 'auto' },
  character: 'fox',
  unlocked: ['fox', 'bear'],
  seenUnlocks: [],
  best: { score: 0, streak: 0, stage: 1 },
  totals: { games: 0, correct: 0, wrong: 0, score: 0 },
  expr: {},
  daily: {},
  tutorialDone: false,
  ...over,
});
const rec = (t, over = {}) => ({ seen: 1, correct: 1, wrong: 0, streak: 1, last: 'c', fav: false, practise: false, t, box: 1, due: t + 86400000, ...over });

// ── merge ───────────────────────────────────────────────────────────────
test('per-expression stats keep the record with the later t (whole record, new fields included)', () => {
  const local = save({ expr: { a: rec(100, { seen: 9 }), b: rec(500, { box: 4 }), c: rec(50) } });
  const cloud = save({ expr: { a: rec(200, { seen: 2, extra: 'x' }), b: rec(300), d: rec(10) } });
  const m = mergeSaves(local, cloud);
  assert.equal(m.expr.a.seen, 2);
  assert.equal(m.expr.a.extra, 'x');
  assert.equal(m.expr.b.box, 4);
  assert.ok(m.expr.c && m.expr.d);
});

test('daily records: a finished attempt beats an unfinished one, otherwise later t', () => {
  const local = save({ daily: { '2026-11-12': { score: 900, done: true, t: 5 }, '2026-11-13': { score: 100, done: false, t: 9 } } });
  const cloud = save({ daily: { '2026-11-12': { score: 50, done: false, t: 8 }, '2026-11-13': { score: 700, done: true, t: 2 }, '2026-11-11': { score: 1, done: true, t: 1 } } });
  const m = mergeSaves(local, cloud);
  assert.equal(m.daily['2026-11-12'].score, 900);
  assert.equal(m.daily['2026-11-13'].score, 700);
  assert.equal(m.daily['2026-11-11'].score, 1);
});

test('unions for unlocks, maxima for bests, or for flags', () => {
  const local = save({ unlocked: ['fox', 'cat'], seenUnlocks: ['cat'], best: { score: 1200, streak: 3, stage: 2 }, tutorialDone: false });
  const cloud = save({ unlocked: ['fox', 'robot'], seenUnlocks: ['robot'], best: { score: 900, streak: 8, stage: 4 }, tutorialDone: true });
  const m = mergeSaves(local, cloud);
  assert.deepEqual(m.unlocked.sort(), ['cat', 'fox', 'robot']);
  assert.deepEqual(m.seenUnlocks.sort(), ['cat', 'robot']);
  assert.deepEqual(m.best, { score: 1200, streak: 8, stage: 4 });
  assert.equal(m.tutorialDone, true);
});

test('guest progress carries over: never-synced counts are added to the cloud', () => {
  const local = save({ totals: { games: 5, correct: 40, wrong: 7, score: 4000 } });
  const cloud = save({ totals: { games: 100, correct: 900, wrong: 80, score: 90000 } });
  const m = mergeSaves(local, cloud, { base: null });
  assert.deepEqual(m.totals, { games: 105, correct: 940, wrong: 87, score: 94000 });
});

test('a synced device adds only what it played since its last sync', () => {
  const base = countersOf(save({ totals: { games: 100, correct: 900, wrong: 80, score: 90000 } }));
  const local = save({ totals: { games: 103, correct: 930, wrong: 81, score: 93000 } });
  const cloud = save({ totals: { games: 110, correct: 990, wrong: 85, score: 99000 } }); // another device played 10
  const m = mergeSaves(local, cloud, { base });
  assert.deepEqual(m.totals, { games: 113, correct: 1020, wrong: 86, score: 102000 });
  // merging the same data twice changes nothing
  const again = mergeSaves(m, m, { base: countersOf(m) });
  assert.deepEqual(again.totals, m.totals);
});

test('counters never go below either side (cloud reset or behind)', () => {
  const base = countersOf(save({ totals: { games: 50, correct: 0, wrong: 0, score: 0 } }));
  const m = mergeSaves(save({ totals: { games: 60, correct: 1, wrong: 1, score: 10 } }), save({ totals: { games: 0, correct: 0, wrong: 0, score: 0 } }), { base });
  assert.equal(m.totals.games, 60);
});

test('plain values come from the side changed last; settings always stay local', () => {
  const local = save({ character: 'cat', settings: { music: 0.1, quality: 'low' } });
  const cloud = save({ character: 'robot' });
  delete cloud.settings;
  assert.equal(mergeSaves(local, cloud, { localNewer: true }).character, 'cat');
  assert.equal(mergeSaves(local, cloud, { localNewer: false }).character, 'robot');
  assert.deepEqual(mergeSaves(local, cloud, { localNewer: false }).settings, { music: 0.1, quality: 'low' });
});

test('unknown fields from either side survive and merge generically', () => {
  const local = save({ srs: { reviews: 3, lastDay: '2026-11-12' }, badges: ['a'] });
  const cloud = save({ srs: { reviews: 7, lastDay: '2026-11-13', extra: true }, newThing: { n: 1 } });
  const m = mergeSaves(local, cloud, { localNewer: false });
  assert.deepEqual(m.srs, { reviews: 7, lastDay: '2026-11-13', extra: true });
  assert.deepEqual(m.badges, ['a']);
  assert.deepEqual(m.newThing, { n: 1 });
});

test('no cloud save: the local save is used as is (and is a copy)', () => {
  const local = save({ character: 'cat' });
  const m = mergeSaves(local, null);
  assert.deepEqual(m, local);
  assert.notEqual(m, local);
});

// ── encoding ────────────────────────────────────────────────────────────
const big = (n) => {
  const s = save({ best: { score: 48250, streak: 31, stage: 5 }, totals: { games: 812, correct: 15873, wrong: 2210, score: 1834900 }, tutorialDone: true });
  const now = Date.UTC(2026, 10, 13);
  for (let i = 0; i < n; i++) {
    const t = now - i * 3_600_000;
    s.expr[`some-expression-id-${i}`] = rec(t, { seen: (i % 9) + 1, correct: i % 7, wrong: i % 3, streak: i % 4, last: i % 3 ? 'c' : 'w', fav: i % 11 === 0, practise: i % 13 === 0, box: i % 6, due: t + (i % 6) * 86_400_000 });
  }
  for (let d = 0; d < 400; d++) s.daily[dayId(new Date(now - d * 86_400_000))] = { n: 20, score: 1500 + d, correct: 15, answered: 18, total: 20, bestStreak: 9, marks: 'ccwcccccwccccccw-ccc', done: true, t: now - d * 86_400_000 };
  return s;
};

test('encode → decode round-trips exactly (settings excluded)', () => {
  const s = big(300);
  s.expr['odd\tid'] = rec(1, { note: 'tab\there', nested: { a: [1, 2.5, null] }, neg: -42, float: 0.25 });
  s.expr['§sneaky'] = rec(2);
  s.expr['"quoted'] = rec(3, { Jcol: 'j' });
  s.extraTop = { deep: [1, 'two', { three: 3 }] };
  const { save: back, t } = decodeSave(encodeSave(s, 1234));
  const expected = { ...s };
  delete expected.settings;
  assert.deepEqual(back, expected);
  assert.equal(t, 1234);
});

test('6,000 expression records stay far below the 1 MiB document limit', () => {
  const fields = encodeSave(big(6000));
  const bytes = encodedSize(fields);
  const json = JSON.stringify(big(6000)).length;
  console.log(`  6,000 records + 400 daily days: ${(bytes / 1024).toFixed(0)} KB encoded (plain JSON ${(json / 1024).toFixed(0)} KB)`);
  assert.ok(bytes < 400 * 1024, `encoded ${bytes} bytes`);
  // the rules cap (firestore.rules) is 700,000 characters for rows and 200,000 for data
  assert.ok(fields.rows.length < 700_000 && fields.data.length < 200_000);
});

test('decoding refuses unknown formats and garbage instead of guessing', () => {
  assert.throws(() => decodeSave({ v: 99, data: '{}' }));
  assert.throws(() => decodeSave({ v: 1, data: 'not json' }));
  assert.throws(() => decodeSave({ v: 1, data: '{}', rows: 'orphan\trow' }));
  assert.throws(() => decodeSave(null));
});

// ── nicknames ───────────────────────────────────────────────────────────
test('nickname rules', () => {
  for (const ok of ['Sam', 'Zoë 2', 'José Luis', '李明明', 'Ana Maria 99', 'Hancock', 'Nazir', 'Titus', 'Scunthorpe Fan', 'Matsushita', 'Swanky', 'Pornchai', 'The Therapist']) assert.equal(checkName(ok).ok, true, ok);
  for (const bad of ['Al', 'a'.repeat(17), ' ', 'Sam!', 'x_y', 'fuck', 'F u c k', 'sh1t head', 'Admin', 'big dick', 'Phrasefall HQ', 'wanker', 'Big C0ck', 'n4z1']) assert.equal(checkName(bad).ok, false, bad);
  assert.equal(checkName('  Sam   Smith ').name, 'Sam Smith');
});

test('default nickname from the Google name', () => {
  assert.equal(defaultName('Sam Smith'), 'Sam');
  assert.equal(defaultName("O'Brien Pat"), 'OBrien');
  assert.match(defaultName('Al', 'uid123'), /^Player \d{4}$/);
  assert.match(defaultName('', 'uid123'), /^Player \d{4}$/);
  assert.equal(checkName(defaultName('', 'x')).ok, true);
});

// ── dates ───────────────────────────────────────────────────────────────
test('UTC day ids and ISO weeks', () => {
  assert.equal(dayId(new Date('2026-11-13T23:59:59Z')), '2026-11-13');
  assert.equal(weekId(new Date('2026-11-13T12:00:00Z')), '2026-W46');
  assert.equal(weekId(new Date('2027-01-01T12:00:00Z')), '2026-W53'); // Friday → last ISO week of 2026
  assert.equal(weekId(new Date('2024-12-30T00:00:00Z')), '2025-W01');
  assert.equal(weekId(new Date('2026-11-16T00:00:00Z')), '2026-W47'); // Monday starts a new week
  assert.equal(isDayId('2026-02-30'), false);
  assert.equal(isDayId('2026-11-13'), true);
  assert.equal(msToNextWeek(Date.parse('2026-11-15T23:00:00Z')), 3_600_000);
});

// ── progress: daily streak, day log, XP ─────────────────────────────────
const streak = (over = {}) => ({ count: 0, best: 0, last: '', brollies: 0, lost: 0, lostOn: '', saved: null, t: 0, ...over });

test('the streak that counted the later day wins as a whole; best never drops', () => {
  // the phone was away and ended its old streak; the laptop kept it going
  const phone = save({ streak: streak({ count: 0, best: 4, last: '2026-11-08', lost: 4, lostOn: '2026-11-13', t: 900 }) });
  const laptop = save({ streak: streak({ count: 12, best: 12, last: '2026-11-12', brollies: 1, t: 500 }) });
  const m = mergeSaves(phone, laptop, { localNewer: true });
  assert.equal(m.streak.count, 12);
  assert.equal(m.streak.last, '2026-11-12');
  assert.equal(m.streak.brollies, 1);
  assert.equal(m.streak.lost, 0);
  assert.equal(m.streak.best, 12);
  // same day: the longer streak, then the later change
  const a = save({ streak: streak({ count: 5, best: 9, last: '2026-11-13', brollies: 0, t: 100 }) });
  const b = save({ streak: streak({ count: 5, best: 5, last: '2026-11-13', brollies: 1, t: 200 }) });
  assert.equal(mergeSaves(a, b).streak.brollies, 1);
  assert.equal(mergeSaves(a, b).streak.best, 9);
});

test('per-day activity merges key by key: higher counts, goal and quest flags or-ed, characters joined', () => {
  const day = (over) => ({ right: 0, known: 0, reviews: 0, fresh: 0, mastered: 0, xp: 0, games: 0, goal: false, brolly: false, daily: false, q: { p0: 0, p1: 0, p2: 0, d0: false, d1: false, d2: false, chest: false, chars: [] }, ...over });
  const local = save({ days: { '2026-11-13': day({ right: 9, goal: false, q: { p0: 9, p1: 2, p2: 0, d0: false, d1: false, d2: false, chest: false, chars: ['fox'] } }) } });
  const cloud = save({ days: { '2026-11-13': day({ right: 16, goal: true, q: { p0: 15, p1: 0, p2: 0, d0: true, d1: false, d2: false, chest: false, chars: ['ninja'] } }), '2026-11-12': day({ goal: true }) } });
  const m = mergeSaves(local, cloud);
  assert.equal(m.days['2026-11-13'].right, 16);
  assert.equal(m.days['2026-11-13'].goal, true);
  assert.equal(m.days['2026-11-13'].q.p1, 2);
  assert.equal(m.days['2026-11-13'].q.d0, true);
  assert.deepEqual(m.days['2026-11-13'].q.chars.sort(), ['fox', 'ninja']);
  assert.equal(m.days['2026-11-12'].goal, true);
});

test('XP adds up across devices like the other counters', () => {
  const local = save({ totals: { games: 3, correct: 30, wrong: 2, score: 900, xp: 700 } });
  const cloud = save({ totals: { games: 5, correct: 50, wrong: 4, score: 1500, xp: 1100 } });
  // both started from 400 XP at the last sync
  const m = mergeSaves(local, cloud, { base: { totals: { games: 2, correct: 20, wrong: 1, score: 600, xp: 400 } } });
  assert.equal(m.totals.xp, 1400);
});

console.log(process.exitCode ? 'FAILED' : `✓ ${passed} tests passed`);
