/**
 * Collection order and unlock rules. Unlocks are cosmetic rewards only.
 *
 * rule types (checked against lifetime stats after every game):
 *   start                  available from the first launch
 *   score:   n             score n or more in a single game
 *   streak:  n             reach a streak of n correct answers
 *   stage:   n             reach stage n
 *   games:   n             finish n games
 *   correct: n             n correct answers in total
 *   mastered:n             master n expressions
 *   total:   n             n points in total across all games
 */
export const ROSTER = [
  { id: 'fox', rule: { type: 'start' } },
  { id: 'astronaut', rule: { type: 'start' } },
  { id: 'robot', rule: { type: 'start' } },
  { id: 'footballer', rule: { type: 'start' } },
  { id: 'chef', rule: { type: 'games', n: 1 } },
  { id: 'penguin', rule: { type: 'correct', n: 10 } },
  { id: 'pirate', rule: { type: 'score', n: 1000 } },
  { id: 'panda', rule: { type: 'streak', n: 5 } },
  { id: 'detective', rule: { type: 'stage', n: 2 } },
  { id: 'cat', rule: { type: 'games', n: 5 } },
  { id: 'ninja', rule: { type: 'streak', n: 10 } },
  { id: 'boxer', rule: { type: 'score', n: 2500 } },
  { id: 'bear', rule: { type: 'mastered', n: 10 } },
  { id: 'wizard', rule: { type: 'stage', n: 3 } },
  { id: 'frog', rule: { type: 'correct', n: 100 } },
  { id: 'tiger', rule: { type: 'streak', n: 15 } },
  { id: 'alien', rule: { type: 'stage', n: 4 } },
  { id: 'superhero', rule: { type: 'score', n: 5000 } },
  { id: 'knight', rule: { type: 'mastered', n: 40 } },
  { id: 'dragon', rule: { type: 'stage', n: 5 } },
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
    case 'mastered':
      return `Master ${n} expressions`;
    case 'total':
      return `Earn ${n} points in total`;
    default:
      return '';
  }
}
