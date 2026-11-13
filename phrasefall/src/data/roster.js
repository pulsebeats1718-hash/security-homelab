/**
 * Collection order and unlock rules. Unlocks are cosmetic rewards only.
 *
 * Three characters are ready from the start. The rest open two at a time, in
 * tiers: a tier opens when the player has earned its points in total across all
 * their games, OR has mastered its number of expressions (answered right three
 * times in a row) — whichever comes first, so playing a lot and learning well
 * both get there. Each step is bigger than the last. Four more characters are
 * only for keeping a daily streak.
 *
 * rule types (checked against lifetime stats after every game):
 *   start                       available from the first launch
 *   tier: { points, mastered }  points in total across all games, or expressions mastered
 *   streakDays: n               reach a daily streak of n days (best ever)
 *   (older types still understood: games, correct, seen, score, streak, stage, mastered, total — each with n)
 *
 * A character listed here without a model file is simply skipped.
 */

/** Two characters per tier. Tune the pace of the whole collection here. */
export const TIERS = [
  { points: 10_000, mastered: 10 },
  { points: 20_000, mastered: 25 },
  { points: 35_000, mastered: 40 },
  { points: 55_000, mastered: 60 },
  { points: 80_000, mastered: 85 },
  { points: 110_000, mastered: 115 },
  { points: 150_000, mastered: 150 },
  { points: 200_000, mastered: 190 },
  { points: 260_000, mastered: 235 },
  { points: 330_000, mastered: 285 },
  { points: 410_000, mastered: 340 },
  { points: 500_000, mastered: 400 },
  { points: 600_000, mastered: 470 },
  { points: 720_000, mastered: 550 },
  { points: 860_000, mastered: 640 },
  { points: 1_000_000, mastered: 750 },
];
const tier = (n) => ({ type: 'tier', tier: n, ...TIERS[n - 1] });

export const ROSTER = [
  { id: 'fox', rule: { type: 'start' } },
  { id: 'astronaut', rule: { type: 'start' } },
  { id: 'robot', rule: { type: 'start' } },
  { id: 'footballer', rule: tier(1) },
  { id: 'chef', rule: tier(1) },
  { id: 'corgi', rule: tier(2) },
  { id: 'penguin', rule: tier(2) },
  { id: 'pirate', rule: tier(3) },
  { id: 'panda', rule: tier(3) },
  { id: 'bunny', rule: tier(4) },
  { id: 'detective', rule: tier(4) },
  { id: 'ghost', rule: tier(5) },
  { id: 'cat', rule: tier(5) },
  { id: 'guard', rule: tier(6) },
  { id: 'ninja', rule: tier(6) },
  { id: 'scientist', rule: tier(7) },
  { id: 'boxer', rule: tier(7) },
  { id: 'owl', rule: tier(8) },
  { id: 'bear', rule: tier(8) },
  { id: 'wizard', rule: tier(9) },
  { id: 'cricketer', rule: tier(9) },
  { id: 'jester', rule: tier(10) },
  { id: 'frog', rule: tier(10) },
  { id: 'hedgehog', rule: tier(11) },
  { id: 'tiger', rule: tier(11) },
  { id: 'bobby', rule: tier(12) },
  { id: 'alien', rule: tier(12) },
  { id: 'diver', rule: tier(13) },
  { id: 'superhero', rule: tier(13) },
  { id: 'mermaid', rule: tier(14) },
  { id: 'bulldog', rule: tier(14) },
  { id: 'knight', rule: tier(15) },
  { id: 'dragon', rule: tier(15) },
  { id: 'lion', rule: tier(16) },
  { id: 'unicorn', rule: tier(16) },
  // daily streak rewards
  { id: 'duck', rule: { type: 'streakDays', n: 7 } },
  { id: 'crier', rule: { type: 'streakDays', n: 30 } },
  { id: 'phoenix', rule: { type: 'streakDays', n: 100 } },
  { id: 'nessie', rule: { type: 'streakDays', n: 365 } },
];

/**
 * How far a player is along a rule, from their lifetime stats (Save.progress()).
 * Returns { frac: 0…1, done, parts: [{ label, have, need, frac }] } — a tier has two
 * parts (points, mastered) and counts as far along as the better of the two.
 */
export function ruleProgress(rule, p) {
  if (rule.type === 'start') return { frac: 1, done: true, parts: [] };
  const part = (label, have, need) => ({ label, have: Math.min(have, need), need, frac: need > 0 ? Math.min(1, have / need) : 1 });
  const parts =
    rule.type === 'tier'
      ? [part('points', p.total ?? 0, rule.points), part('mastered', p.mastered ?? 0, rule.mastered)]
      : [part(rule.type, p[rule.type] ?? 0, rule.n ?? 0)];
  const frac = Math.max(...parts.map((x) => x.frac));
  return { frac, done: frac >= 1, parts };
}

const fmt = (n) => n.toLocaleString('en-GB');

export function describeRule(rule) {
  const n = rule.n?.toLocaleString('en-GB');
  switch (rule.type) {
    case 'start':
      return 'Ready to play';
    case 'tier':
      return `Earn ${fmt(rule.points)} points in total, or master ${fmt(rule.mastered)} expressions`;
    case 'score':
      return `Score ${n} points in one game`;
    case 'streak':
      return `Reach a streak of ${n}`;
    case 'stage':
      return `Reach stage ${n}`;
    case 'games':
      return rule.n === 1 ? 'Finish your first game' : `Finish ${n} games`;
    case 'correct':
      return `Get ${n} answers right in total`;
    case 'seen':
      return `Discover ${n} expressions`;
    case 'mastered':
      return `Master ${n} expressions`;
    case 'total':
      return `Earn ${n} points in total`;
    case 'streakDays':
      return `Keep a ${n}-day streak`;
    default:
      return '';
  }
}
