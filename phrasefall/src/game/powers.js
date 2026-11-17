/**
 * Power-ups: rare items the player collects and spends in classic games.
 *
 *   shield  the next miss costs no life
 *   slow    this card and the next two fall much more slowly
 *   fifty   takes away two wrong answers on this card
 *   hint    shows this card's example sentence
 *
 * Found on golden cards, now and then after a right answer, from beaten bosses, and one of each
 * as a welcome gift. Kept in save.data.items ({ kind: count }, at most POWER_MAX each). Not used
 * in the daily challenge, friend challenges or party games, so those stay fair.
 */
export const POWERS = {
  shield: { name: 'Shield', icon: 'shield', text: 'Your next miss costs no life' },
  slow: { name: 'Slow-mo', icon: 'hourglass', text: 'This card and the next two fall slowly' },
  fifty: { name: '50/50', icon: 'half', text: 'Takes away two wrong answers' },
  hint: { name: 'Hint', icon: 'book', text: 'Shows the example sentence' },
};
export const POWER_IDS = Object.keys(POWERS);
export const POWER_MAX = 9;
/** Chance of finding a power-up after a right answer in a classic game. */
export const DROP_CHANCE = 0.035;
/** How much slower a slowed card falls. */
export const SLOW_FACTOR = 1.7;
/** Cards slowed by one Slow-mo (the current one included). */
export const SLOW_CARDS = 3;

const WEIGHTS = { shield: 3, slow: 3, fifty: 2, hint: 2 };

/** A random kind, shields and slow-mos a little more often. */
export function rollPower(rng = Math.random) {
  let r = rng() * POWER_IDS.reduce((s, k) => s + WEIGHTS[k], 0);
  for (const k of POWER_IDS) {
    r -= WEIGHTS[k];
    if (r <= 0) return k;
  }
  return POWER_IDS[0];
}

const items = (save) => (save.data.items ??= {});

/** How many of `kind` the player has. */
export const powerCount = (save, kind) => Math.max(0, Math.floor(items(save)[kind] ?? 0));

/** Total power-ups held. */
export const powerTotal = (save) => POWER_IDS.reduce((n, k) => n + powerCount(save, k), 0);

/** Add `n` of `kind` (capped). Returns how many were actually added. */
export function addPower(save, kind, n = 1) {
  if (!POWERS[kind]) return 0;
  const have = powerCount(save, kind);
  const add = Math.max(0, Math.min(n, POWER_MAX - have));
  items(save)[kind] = have + add;
  return add;
}

/** Spend one of `kind`. Returns false if there is none. */
export function spendPower(save, kind) {
  const have = powerCount(save, kind);
  if (have <= 0) return false;
  items(save)[kind] = have - 1;
  return true;
}

/** The welcome gift: one of each, once (save.data.itemsGift marks it given). Returns true if given now. */
export function welcomeGift(save) {
  if (save.data.itemsGift) return false;
  save.data.itemsGift = Date.now();
  for (const k of POWER_IDS) addPower(save, k, 1);
  return true;
}
