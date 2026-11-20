import { dayKey } from "../../lib/time";
import type { CorrectionCategory } from "../../services/api/types";
import type { LearningData, MistakeEntry, SessionRecord } from "./types";

export function recurringMistakes(data: LearningData, limit = 5): MistakeEntry[] {
  return data.mistakes.filter((m) => m.count >= 2).slice(0, limit);
}

/** Mistakes Sophie should keep an ear out for in the next call (most frequent, then most recent). */
export function mistakesForSophie(data: LearningData): { original: string; better: string }[] {
  return [...data.mistakes]
    .sort((a, b) => b.count - a.count || b.lastSeenAt - a.lastSeenAt)
    .slice(0, 5)
    .map((m) => ({ original: m.original, better: m.suggestion }));
}

export function totalPracticeSeconds(sessions: SessionRecord[]): number {
  return sessions.reduce((sum, s) => sum + s.durationSec, 0);
}

/** Consecutive days (ending today or yesterday) with at least one conversation. */
export function streakDays(sessions: SessionRecord[], now = Date.now()): number {
  const days = new Set(sessions.map((s) => dayKey(s.startedAt)));
  let streak = 0;
  let cursor = now;
  if (!days.has(dayKey(cursor))) cursor -= 86_400_000;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor -= 86_400_000;
  }
  return streak;
}

/** Minutes practised on each of the last 7 days, oldest first. */
export function lastSevenDays(sessions: SessionRecord[], now = Date.now()): { key: string; label: string; minutes: number }[] {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const t = now - i * 86_400_000;
    const key = dayKey(t);
    const seconds = sessions.filter((s) => dayKey(s.startedAt) === key).reduce((sum, s) => sum + s.durationSec, 0);
    out.push({ key, label: new Date(t).toLocaleDateString("en-GB", { weekday: "narrow" }), minutes: Math.round(seconds / 60) });
  }
  return out;
}

export function todaysActivity(sessions: SessionRecord[], now = Date.now()) {
  const today = dayKey(now);
  const todays = sessions.filter((s) => dayKey(s.startedAt) === today);
  return { conversations: todays.length, seconds: totalPracticeSeconds(todays) };
}

export function mistakeCategories(mistakes: MistakeEntry[]): { category: CorrectionCategory; count: number }[] {
  const counts = new Map<CorrectionCategory, number>();
  for (const m of mistakes) counts.set(m.category, (counts.get(m.category) ?? 0) + m.count);
  return [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

export function learnerTurnCount(session: SessionRecord): number {
  return session.turns.filter((t) => t.role === "user" && t.text.trim()).length;
}
