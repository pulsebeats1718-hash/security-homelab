/**
 * Player level. Everything the player does earns XP (see XP below); levels
 * unlock new places for the island (src/data/places.js). Early levels come
 * quickly, later ones need more, and no level needs more than 2,000 XP.
 *
 * A typical game of 20 right answers earns about 220 XP, so level 2 arrives
 * in the first game, London (level 3) in the first session, New York (level 10)
 * after a few days and Sydney (level 20) after a couple of weeks of play.
 */

/** XP awarded for each thing the player does. */
export const XP = {
  right: 10, // each right answer (×3 for a golden card, ×2 in fever mode)
  game: 20, // finishing any game, however it went
  daily: 50, // finishing the ranked daily challenge
  goal: 50, // reaching the daily goal
  review: 2, // each flashcard rated "I knew it" / "Not yet"…
  reviewCap: 50, // …for the first 50 ratings a day
};

/** XP needed to go from `level` to `level + 1`. */
export const xpToNext = (level) => Math.min(2000, 100 + 50 * (Math.max(1, level) - 1));

/** Total XP at which `level` starts. */
export function xpForLevel(level) {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

/** { level, into, need } for a lifetime XP total: `into` XP of the `need` for the next level. */
export function levelInfo(xp) {
  let level = 1;
  let left = Math.max(0, Math.floor(Number(xp) || 0));
  while (left >= xpToNext(level)) {
    left -= xpToNext(level);
    level++;
  }
  return { level, into: left, need: xpToNext(level) };
}
