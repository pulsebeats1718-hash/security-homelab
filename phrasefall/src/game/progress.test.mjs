// Unit tests for levels, the daily streak (with brollies), the daily goal and quests.
//   node src/game/progress.test.mjs
import assert from 'node:assert/strict';
import { Save } from '../core/storage.js';
import { Events } from '../core/events.js';
import { Progress, GOAL, localDay, addDays, daysBetween, questsFor } from './progress.js';
import { levelInfo, xpToNext, xpForLevel } from '../data/levels.js';
import { ROSTER, TIERS, describeRule } from '../data/roster.js';

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

// a fake clock: noon on a given local day
const realNow = Date.now;
let now = new Date(2026, 10, 13, 12).getTime();
Date.now = () => now;
const nextDay = (n = 1) => (now += n * 86_400_000);

function fresh() {
  const save = new Save();
  const events = new Events();
  const log = [];
  for (const name of ['progress:goal', 'progress:level', 'progress:quest', 'progress:streak-lost', 'progress:brolly-used', 'progress:chest-ready']) events.on(name, (p) => log.push([name, p]));
  return { save, events, p: new Progress({ save, events }), log };
}
/** Play `n` right answers through the game's events. */
const rightAnswers = (events, n, extra = {}) => {
  for (let i = 0; i < n; i++) events.emit('game:answered', { correct: true, streak: i + 1, type: 'everyday', ...extra });
};
const reachGoal = (events) => rightAnswers(events, GOAL);

test('local day helpers', () => {
  assert.equal(addDays('2026-11-13', 1), '2026-11-14');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-11-13', '2026-11-16'), 3);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // across a clock change
  assert.equal(localDay(new Date(2026, 10, 13, 23, 59).getTime()), '2026-11-13');
});

test('level curve: fast at first, never more than 2,000 XP a level', () => {
  assert.equal(xpToNext(1), 100);
  assert.equal(xpToNext(2), 150);
  assert.equal(xpToNext(100), 2000);
  assert.equal(xpForLevel(3), 250);
  assert.deepEqual(levelInfo(0), { level: 1, into: 0, need: 100 });
  assert.deepEqual(levelInfo(260), { level: 3, into: 10, need: 200 });
  assert.equal(levelInfo(xpForLevel(20)).level, 20);
});

test('the daily goal starts a streak, the next day extends it', () => {
  const { p, events, save, log } = fresh();
  rightAnswers(events, GOAL - 1);
  assert.equal(p.goal().met, false);
  assert.equal(p.streak.count, 0);
  rightAnswers(events, 1);
  assert.equal(p.goal().met, true);
  assert.equal(p.streak.count, 1);
  assert.equal(log.filter(([n]) => n === 'progress:goal').length, 1);
  rightAnswers(events, 10); // more answers the same day change nothing
  assert.equal(p.streak.count, 1);
  nextDay();
  assert.equal(p.streakAtRisk, true);
  reachGoal(events);
  assert.equal(p.streak.count, 2);
  assert.equal(save.data.streak.best, 2);
});

test('a missed day ends the streak when there is no brolly', () => {
  const { p, events, log } = fresh();
  reachGoal(events);
  nextDay();
  reachGoal(events);
  assert.equal(p.streak.count, 2);
  nextDay(2); // skipped a whole day
  p.touch();
  assert.equal(p.streak.count, 0);
  assert.equal(p.streak.lost, 2);
  assert.deepEqual(p.notice(), { kind: 'lost', count: 2 });
  assert.ok(log.some(([n]) => n === 'progress:streak-lost'));
  reachGoal(events);
  assert.equal(p.streak.count, 1);
  assert.equal(p.notice(), null);
});

test('a brolly every 7 days, used up automatically on a missed day', () => {
  const { p, events, save } = fresh();
  for (let d = 0; d < 7; d++) {
    reachGoal(events);
    nextDay();
  }
  assert.equal(p.streak.count, 7);
  assert.equal(p.streak.brollies, 1);
  assert.ok(save.isUnlocked('duck') || !save.available, 'the 7-day character unlocks (when its model exists)');
  // day 8 skipped entirely; day 9 the player is back
  nextDay();
  p.touch();
  assert.equal(p.streak.count, 7);
  assert.equal(p.streak.brollies, 0);
  assert.equal(p.notice().kind, 'brolly');
  assert.equal(save.data.days[addDays(localDay(), -1)].brolly, true);
  reachGoal(events);
  assert.equal(p.streak.count, 8);
  // two missed days with no brolly left: gone
  nextDay(3);
  p.touch();
  assert.equal(p.streak.count, 0);
});

test('the ranked daily challenge counts as the goal; flashcards count towards it', () => {
  const { p, events } = fresh();
  events.emit('game:intro', {});
  events.emit('game:ending', { mode: 'daily', daily: { ranked: true } });
  assert.equal(p.goal().met, true);
  assert.equal(p.streak.count, 1);
  nextDay();
  for (let i = 0; i < GOAL; i++) events.emit('cards:review', { id: `x${i}`, knew: true });
  assert.equal(p.goal().met, true);
  assert.equal(p.streak.count, 2);
});

test('XP: right answers, golden ×3, fever ×2, game, goal; level-ups announce new places', () => {
  const { p, events, log } = fresh();
  // quests completed along the way add their own XP: leave it out of the sums
  const questXp = () => log.filter(([n]) => n === 'progress:quest').reduce((sum, [, e]) => sum + e.quest.xp, 0);
  events.emit('game:intro', {});
  rightAnswers(events, 1);
  assert.equal(p.xp - questXp(), 10);
  rightAnswers(events, 1, { golden: true });
  assert.equal(p.xp - questXp(), 40);
  rightAnswers(events, 1, { golden: true, fever: true });
  assert.equal(p.xp - questXp(), 100);
  events.emit('game:ending', { mode: 'classic' });
  assert.equal(p.xp - questXp(), 120);
  assert.ok(p.level >= 2);
  rightAnswers(events, GOAL); // +150 for answers, +50 goal, maybe quests
  const ups = log.filter(([n]) => n === 'progress:level').map(([, e]) => e);
  assert.ok(ups.some((e) => e.places.some((pl) => pl.id === 'london')), 'London opens at level 3');
  assert.ok(p.isPlaceOpen('london'));
  assert.equal(p.isPlaceOpen('newyork'), false);
  assert.equal(p.unseenPlaces().map((pl) => pl.id).join(), 'london');
  assert.equal(p.setPlace('newyork'), false);
  assert.equal(p.setPlace('london'), true);
  assert.equal(p.place, 'london');
  assert.equal(p.unseenPlaces().length, 0);
});

test('quests: the same three for everyone on a date, one per tier, all different', () => {
  const a = questsFor('2026-11-13');
  assert.deepEqual(a, questsFor('2026-11-13'));
  assert.deepEqual(a.map((q) => q.tier), ['Easy', 'Medium', 'Hard']);
  assert.equal(new Set(a.map((q) => q.kind)).size, 3);
  let differs = 0;
  for (let d = 1; d < 30; d++) if (JSON.stringify(questsFor(addDays('2026-11-13', d))) !== JSON.stringify(a)) differs++;
  assert.ok(differs > 20);
});

test('finishing all three quests readies the chest; it opens once', () => {
  const { p, log } = fresh();
  for (const q of p.quests()) p._bump(q.kind, q.n, true);
  assert.ok(p.quests().every((q) => q.done));
  assert.ok(log.some(([n]) => n === 'progress:chest-ready'));
  assert.equal(p.chestState(), 'ready');
  const before = p.xp;
  const reward = p.openChest();
  assert.ok(reward.xp >= 100 && reward.xp <= 250);
  assert.equal(p.xp, before + reward.xp);
  assert.equal(p.chestState(), 'opened');
  assert.equal(p.openChest(), null);
  nextDay();
  assert.equal(p.chestState(), 'locked');
});

test('the week report covers the last seven days', () => {
  const { p, events } = fresh();
  reachGoal(events);
  nextDay();
  rightAnswers(events, 3);
  const w = p.week();
  assert.equal(w.days.length, 7);
  assert.equal(w.days[6].today, true);
  assert.equal(w.days[5].goal, true);
  assert.equal(w.played, 2);
  assert.equal(w.right, GOAL + 3);
});

// ── character unlocks: three to start, then pairs by points or mastery ───
test('roster: three starters, then tiers of two that get steadily harder', () => {
  assert.deepEqual(ROSTER.filter((r) => r.rule.type === 'start').map((r) => r.id), ['fox', 'astronaut', 'robot']);
  TIERS.forEach((t, i) => {
    const ids = ROSTER.filter((r) => r.rule.type === 'tier' && r.rule.tier === i + 1);
    assert.equal(ids.length, 2, `tier ${i + 1} has two characters`);
    if (i > 0) {
      assert.ok(t.points > TIERS[i - 1].points && t.mastered > TIERS[i - 1].mastered, `tier ${i + 1} is harder than tier ${i}`);
      assert.ok(t.points - TIERS[i - 1].points >= TIERS[Math.max(0, i - 1)].points - (TIERS[i - 2]?.points ?? 0), 'each step in points is at least as big as the last');
    }
  });
  assert.equal(TIERS[0].points, 10_000);
  assert.equal(TIERS[1].points, 20_000);
});

test('a fresh save has three characters; 10,000 points opens two more, 20,000 two more', () => {
  const save = new Save();
  assert.deepEqual(save.data.unlocked.sort(), ['astronaut', 'fox', 'robot']);
  save.data.totals.score = 9_999;
  assert.deepEqual(save.checkUnlocks(), []);
  save.data.totals.score = 10_000;
  assert.deepEqual(save.checkUnlocks().sort(), ['chef', 'footballer']);
  save.data.totals.score = 19_000;
  assert.deepEqual(save.checkUnlocks(), []);
  save.data.totals.score = 20_500;
  assert.deepEqual(save.checkUnlocks().sort(), ['corgi', 'penguin']);
});

test('mastering expressions opens the same tiers without the points', () => {
  const save = new Save();
  const master = (n) => {
    for (let i = 0; i < n; i++) save.data.expr[`e${i}`] = { seen: 3, correct: 3, wrong: 0, streak: 3, last: 'c', fav: false, practise: false, t: 1 };
  };
  master(TIERS[0].mastered - 1);
  assert.deepEqual(save.checkUnlocks(), []);
  const rp = save.ruleProgress(ROSTER.find((r) => r.id === 'chef').rule);
  assert.equal(rp.parts[1].have, TIERS[0].mastered - 1);
  assert.ok(rp.frac > 0.8 && !rp.done);
  master(TIERS[0].mastered);
  assert.deepEqual(save.checkUnlocks().sort(), ['chef', 'footballer']);
  assert.equal(describeRule(ROSTER.find((r) => r.id === 'corgi').rule), `Earn 20,000 points in total, or master ${TIERS[1].mastered} expressions`);
});

Date.now = realNow;
console.log(process.exitCode ? 'FAILED' : `✓ ${passed} tests passed`);
