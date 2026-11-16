/**
 * Daily challenge — the same run for everyone on the same UTC day.
 *
 *   • 20 expressions mixed across the five stages, mostly level 1–2, in a fixed
 *     order that ramps gently from everyday expressions to advanced ones.
 *   • Everything is derived from the date (see run.js, shared with friend
 *     challenges): every player sees exactly the same cards with the answers
 *     in the same places. Adding expressions can change a day's picks, so
 *     players on different builds that day could see different cards.
 *   • Same core rules as a classic game (three lives, +100 per correct answer,
 *     streak bonuses) plus a small speed bonus — see `speedBonus`. Always played
 *     at standard pace so scores are comparable. The run ends after the last
 *     card or when the lives run out.
 *   • The first run of the day is the ranked one (stored in save.daily[dateId]);
 *     later runs are practice.
 */
import { BY_STAGE } from '../data/expressions/index.js';
import { STAGES } from '../data/stages.js';
import { hash32 } from '../core/utils.js';
import { pickRun, RUN_CARDS } from './run.js';

export const DAILY_CARDS = RUN_CARDS;
const DAY_MS = 86400000;
/** Daily challenge #1. Only the number shown to players depends on it; the cards come from the date. */
const EPOCH = Date.UTC(2026, 10, 13);

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

/**
 * Build the challenge for a UTC day. Needs the expression database loaded
 * (or `byStage` passed in). Returns { dateId, n, seed, cards: [{ expr, options }] }.
 */
export function buildDaily(dateId, byStage = BY_STAGE) {
  const seed = hash32(`phrasefall:daily:${dateId}`);
  const cards = pickRun(byStage, { seed, rankKey: (id) => `${dateId}|${id}`, cards: DAILY_CARDS });
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
