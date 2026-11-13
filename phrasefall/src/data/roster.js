/**
 * Collection order and unlock rules. Unlocks are cosmetic rewards only.
 *
 * rule types (checked against lifetime stats after every game):
 *   start                  available from the first launch
 *   games:    n            finish n games
 *   correct:  n            n correct answers in total
 *   seen:     n            discover n different expressions
 *   score:    n            score n or more in a single game
 *   streak:   n            reach a streak of n correct answers
 *   stage:    n            reach stage n
 *   mastered: n            master n expressions
 *   total:    n            n points in total across all games
 *   streakDays: n          reach a daily streak of n days (best ever)
 *
 * A character listed here without a model file is simply skipped.
 */
export const ROSTER = [
  { id: 'fox', rule: { type: 'start' } },
  { id: 'astronaut', rule: { type: 'start' } },
  { id: 'robot', rule: { type: 'start' } },
  { id: 'footballer', rule: { type: 'start' } },
  { id: 'chef', rule: { type: 'games', n: 1 } },
  { id: 'corgi', rule: { type: 'correct', n: 10 } },
  { id: 'penguin', rule: { type: 'seen', n: 20 } },
  { id: 'pirate', rule: { type: 'score', n: 1000 } },
  { id: 'panda', rule: { type: 'streak', n: 5 } },
  { id: 'bunny', rule: { type: 'games', n: 3 } },
  { id: 'detective', rule: { type: 'stage', n: 2 } },
  { id: 'ghost', rule: { type: 'seen', n: 50 } },
  { id: 'cat', rule: { type: 'games', n: 5 } },
  { id: 'guard', rule: { type: 'correct', n: 50 } },
  { id: 'ninja', rule: { type: 'streak', n: 10 } },
  { id: 'scientist', rule: { type: 'score', n: 2000 } },
  { id: 'boxer', rule: { type: 'score', n: 2500 } },
  { id: 'owl', rule: { type: 'mastered', n: 10 } },
  { id: 'bear', rule: { type: 'seen', n: 100 } },
  { id: 'wizard', rule: { type: 'stage', n: 3 } },
  { id: 'cricketer', rule: { type: 'correct', n: 100 } },
  { id: 'jester', rule: { type: 'games', n: 12 } },
  { id: 'frog', rule: { type: 'total', n: 10000 } },
  { id: 'hedgehog', rule: { type: 'seen', n: 175 } },
  { id: 'tiger', rule: { type: 'streak', n: 15 } },
  { id: 'bobby', rule: { type: 'mastered', n: 25 } },
  { id: 'alien', rule: { type: 'stage', n: 4 } },
  { id: 'diver', rule: { type: 'correct', n: 250 } },
  { id: 'superhero', rule: { type: 'score', n: 5000 } },
  { id: 'mermaid', rule: { type: 'games', n: 25 } },
  { id: 'bulldog', rule: { type: 'mastered', n: 50 } },
  { id: 'knight', rule: { type: 'streak', n: 20 } },
  { id: 'dragon', rule: { type: 'stage', n: 5 } },
  { id: 'lion', rule: { type: 'score', n: 7500 } },
  { id: 'unicorn', rule: { type: 'mastered', n: 150 } },
  // daily streak rewards
  { id: 'duck', rule: { type: 'streakDays', n: 7 } },
  { id: 'crier', rule: { type: 'streakDays', n: 30 } },
  { id: 'phoenix', rule: { type: 'streakDays', n: 100 } },
  { id: 'nessie', rule: { type: 'streakDays', n: 365 } },
];

export function describeRule(rule) {
  const n = rule.n?.toLocaleString('en-GB');
  switch (rule.type) {
    case 'start':
      return 'Ready to play';
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
