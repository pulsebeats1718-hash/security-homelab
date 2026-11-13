/**
 * Leaderboard periods. Everything is UTC so every player shares the same day and week:
 * the daily challenge rolls over at 00:00 UTC, the weekly board on Monday 00:00 UTC (ISO weeks).
 * Pure functions — also used by the Node tests.
 */
const pad = (n) => String(n).padStart(2, '0');
const DAY = 86_400_000;

/** 'YYYY-MM-DD' (UTC). */
export function dayId(d = new Date()) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** ISO 8601 week, 'YYYY-Www' (UTC). Week 1 is the week with the year's first Thursday. */
export function weekId(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); // the Thursday of this week decides the year
  const week = Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / DAY + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

export const isDayId = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && dayId(new Date(`${s}T00:00:00Z`)) === s;

/** Firestore board ids: boards/{id}/scores/{uid}. */
export const boardId = {
  daily: (day = dayId()) => `daily-${day}`,
  week: (d = new Date()) => `week-${weekId(d)}`,
  all: () => 'all',
};

/** Milliseconds until the next UTC midnight / next Monday 00:00 UTC. */
export function msToNextDay(now = Date.now()) {
  return DAY - (now % DAY);
}
export function msToNextWeek(now = Date.now()) {
  const dow = (new Date(now).getUTCDay() + 6) % 7; // Monday = 0
  return (7 - dow) * DAY - (now % DAY);
}

/** "5h 12m", "3d 4h", "12m". */
export function formatSpan(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

/** "Thursday 13 November" for a 'YYYY-MM-DD' id. */
export function formatDay(id, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const d = new Date(`${id}T12:00:00Z`);
  return Number.isNaN(+d) ? id : d.toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}
