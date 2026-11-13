/**
 * Daily challenge — the same run for everyone on the same UTC day.
 *
 *   • 20 expressions mixed across the five stages, mostly level 1–2, in a fixed
 *     order that ramps gently from everyday expressions to advanced ones.
 *   • Everything is derived from the date: a seeded PRNG (mulberry32) picks and
 *     orders the cards and shuffles each card's four options, so every player
 *     sees exactly the same cards with the answers in the same places.
 *   • Picks are ranked by a hash of (date, expression id), not by position in
 *     the data files, so reordering or splitting files never changes a day's
 *     challenge. Adding expressions can (a new one may outrank an old pick) —
 *     players on different builds that day could then see different cards.
 *   • Same core rules as a classic game (three lives, +100 per correct answer,
 *     streak bonuses) plus a small speed bonus — see `speedBonus`. Always played
 *     at standard pace so scores are comparable. The run ends after the last
 *     card or when the lives run out.
 *   • The first run of the day is the ranked one (stored in save.daily[dateId]);
 *     later runs are practice.
 */
import { BY_STAGE } from '../data/expressions/index.js';
import { STAGES } from '../data/stages.js';
import { mulberry32, shuffle, hash32 } from '../core/utils.js';

export const DAILY_CARDS = 20;
const DAY_MS = 86400000;
/** Daily challenge #1. Only the number shown to players depends on it; the cards come from the date. */
const EPOCH = Date.UTC(2026, 10, 13);

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

/**
 * Speed bonus for a correct daily-challenge answer: +50 when answered within
 * 2 seconds of the card appearing, falling linearly to 0 at 6 seconds, rounded
 * to the nearest 5 points. Pauses do not count towards the time.
 */
export const SPEED_BONUS = { max: 50, full: 2, none: 6 };
export function speedBonus(seconds) {
  const { max, full, none } = SPEED_BONUS;
  const u = Math.min(1, Math.max(0, (none - seconds) / (none - full)));
  return Math.round((max * u) / 5) * 5;
}

/** 32-bit string hash — lives in core/utils.js (also used by the daily quests). */
export { hash32 };

/** Today's challenge id: the UTC date as 'YYYY-MM-DD'. */
export const utcDateId = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

/** Challenge number shown to players ("Daily challenge #N"). */
export const dailyNumber = (dateId) => Math.floor((Date.parse(`${dateId}T00:00:00Z`) - EPOCH) / DAY_MS) + 1;

/** Milliseconds until the next challenge (the next UTC midnight). */
export function msToNextDaily(t = Date.now()) {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - t;
}

/** "5h 12m" (or "12m 05s" in the last hour). */
export function formatCountdown(ms, seconds = false) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (seconds) return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return hh ? `${hh}h ${String(mm).padStart(2, '0')}m` : `${mm}m ${String(ss).padStart(2, '0')}s`;
}

/** The four options for a card, in the order every player sees them that day. */
function optionsFor(expr, seed) {
  const opts = [{ text: expr.meaning, correct: true }, ...expr.distractors.map((text) => ({ text, correct: false }))];
  return shuffle(opts, mulberry32(seed ^ hash32(expr.id)));
}

/**
 * Build the challenge for a UTC day. Needs the expression database loaded.
 * Returns { dateId, n, seed, cards: [{ expr, options }] }.
 */
export function buildDaily(dateId) {
  const seed = hash32(`phrasefall:daily:${dateId}`);
  const rng = mulberry32(seed);
  const rank = new Map();
  const score = (e) => {
    if (!rank.has(e.id)) rank.set(e.id, hash32(`${dateId}|${e.id}`));
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
    const pool = byRank(BY_STAGE[i] ?? []);
    const easyList = pool.filter((e) => e.level <= 2);
    const hardList = pool.filter((e) => e.level >= 3);
    const leftHard = take(hardList, hard);
    const leftEasy = take(easyList, easy + leftHard);
    take(pool, leftEasy); // a small stage: whatever it has
  });
  // still short (a tiny database): top up from anywhere
  if (picks.length < DAILY_CARDS) take(byRank(BY_STAGE.flat()), DAILY_CARDS - picks.length);

  // a gentle ramp: sorted by stage with seeded jitter so neighbouring stages mix
  const order = picks.map((e) => ({ e, k: e.stage + rng() * 1.6 })).sort((a, b) => a.k - b.k);
  const cards = order.slice(0, DAILY_CARDS).map(({ e }) => ({ expr: e, options: optionsFor(e, seed) }));
  return { dateId, n: dailyNumber(dateId), seed, cards };
}

/** Which part of the day (0–4, the stage themes) a card position falls in. */
export const dailySegment = (index, total) => Math.min(STAGES.length - 1, Math.floor((index * STAGES.length) / Math.max(1, total)));

/**
 * Share text: a header, one emoji per card (🟩 right, 🟥 missed, ⬜ not reached), the score,
 * and the player's daily streak when they have one going (`days`).
 */
export function shareText({ n, dateId, marks, total, score, correct, bestStreak, days = 0 }, url = '') {
  const cells = Array.from({ length: total }, (_, i) => (marks[i] === 'c' ? '🟩' : marks[i] === 'w' ? '🟥' : '⬜'));
  const rows = [];
  for (let i = 0; i < cells.length; i += 10) rows.push(cells.slice(i, i + 10).join(''));
  const lines = [`Phrasefall Daily #${n} · ${dateId}`, ...rows, `${correct}/${total} · ${score.toLocaleString('en-GB')} points${bestStreak >= 2 ? ` · streak ×${bestStreak}` : ''}`];
  if (days >= 2) lines.push(`🔥 ${days}-day streak`);
  if (url) lines.push(url);
  return lines.join('\n');
}
