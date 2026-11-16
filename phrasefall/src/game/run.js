/**
 * Fixed runs: the same 20 cards for everyone who has the same key. Used by the
 * daily challenge (the key is the date) and by friend challenges (the key is
 * the challenge's seed), so both players get exactly the same cards with the
 * answers in the same places.
 *
 *   • 20 expressions mixed across the five stages, mostly level 1–2, in an
 *     order that ramps gently from everyday expressions to advanced ones.
 *   • A seeded PRNG (mulberry32) orders the cards and shuffles each card's
 *     options. Picks are ranked by a hash of (key, expression id), not by
 *     position in the data files, so reordering or splitting files never
 *     changes a run. Adding expressions can (a new one may outrank an old pick).
 *
 * Pure: takes the expression lists, so it runs in tests without the data loader.
 */
import { mulberry32, shuffle, hash32 } from '../core/utils.js';

export const RUN_CARDS = 20;

/**
 * Cards per stage: `easy` from levels 1–2, `hard` from level 3. 17 of the 20
 * cards are level 1–2.
 */
const PLAN = [
  { easy: 4, hard: 0 },
  { easy: 4, hard: 0 },
  { easy: 3, hard: 1 },
  { easy: 3, hard: 1 },
  { easy: 3, hard: 1 },
];

/** The four options for a card, in the same order for every player. */
export function seededOptions(expr, seed) {
  const opts = [{ text: expr.meaning, correct: true }, ...expr.distractors.map((text) => ({ text, correct: false }))];
  return shuffle(opts, mulberry32(seed ^ hash32(expr.id)));
}

/**
 * Pick and order a fixed run.
 * @param {Array<Array<object>>} byStage expressions per stage (index 0 = stage 1)
 * @param {{ seed: number, rankKey: (id: string) => string, cards?: number }} o
 *        seed: orders the cards and shuffles the options; rankKey(id): the string hashed to rank an expression
 * @returns {Array<{ expr: object, options: Array<{ text: string, correct: boolean }> }>}
 */
export function pickRun(byStage, { seed, rankKey, cards = RUN_CARDS }) {
  const rng = mulberry32(seed);
  const rank = new Map();
  const score = (e) => {
    if (!rank.has(e.id)) rank.set(e.id, hash32(rankKey(e.id)));
    return rank.get(e.id);
  };
  const byRank = (list) => list.slice().sort((a, b) => score(a) - score(b) || (a.id < b.id ? -1 : 1));

  const picked = new Set();
  const picks = [];
  const take = (list, n) => {
    for (const e of list) {
      if (n <= 0) break;
      if (picked.has(e.id)) continue;
      picked.add(e.id);
      picks.push(e);
      n--;
    }
    return n;
  };
  PLAN.forEach(({ easy, hard }, i) => {
    const pool = byRank(byStage[i] ?? []);
    const easyList = pool.filter((e) => e.level <= 2);
    const hardList = pool.filter((e) => e.level >= 3);
    const leftHard = take(hardList, hard);
    const leftEasy = take(easyList, easy + leftHard);
    take(pool, leftEasy); // a small stage: whatever it has
  });
  // still short (a tiny database): top up from anywhere
  if (picks.length < cards) take(byRank(byStage.flat()), cards - picks.length);

  // a gentle ramp: sorted by stage with seeded jitter so neighbouring stages mix
  const order = picks.map((e) => ({ e, k: e.stage + rng() * 1.6 })).sort((a, b) => a.k - b.k);
  return order.slice(0, cards).map(({ e }) => ({ expr: e, options: seededOptions(e, seed) }));
}
