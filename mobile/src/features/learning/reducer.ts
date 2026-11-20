import type { CoachReport } from "../../services/api/types";
import { STARTER_EXPRESSIONS } from "./starterPack";
import type { ExpressionEntry, LearningData, MistakeEntry, ReviewState, SessionRecord, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

/** Pure state transitions for the learner's on-device data. */

export type LearningAction =
  | { type: "hydrate"; data: LearningData }
  | { type: "update-settings"; patch: Partial<Settings> }
  | { type: "add-session"; session: SessionRecord }
  | { type: "set-review"; sessionId: string; review: ReviewState; now: number }
  | { type: "save-expression"; entry: ExpressionEntry }
  | { type: "remove-expression"; id: string }
  | { type: "practised-expression"; id: string }
  | { type: "delete-transcripts" }
  | { type: "reset"; deviceId: string; now: number };

export function initialData(deviceId: string, now: number): LearningData {
  return {
    version: 1,
    deviceId,
    settings: { ...DEFAULT_SETTINGS },
    sessions: [],
    mistakes: [],
    expressions: STARTER_EXPRESSIONS.map((starter, index) => ({
      ...starter,
      id: `starter-${index}`,
      savedAt: now,
      origin: "starter",
      practised: 0,
    })),
  };
}

export function normaliseKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mergeMistakes(existing: MistakeEntry[], report: CoachReport, now: number): MistakeEntry[] {
  const byKey = new Map(existing.map((entry) => [entry.key, entry]));
  for (const correction of report.corrections) {
    if (correction.severity !== "mistake") continue;
    const key = normaliseKey(correction.suggestion);
    if (!key) continue;
    const previous = byKey.get(key);
    byKey.set(key, {
      key,
      original: correction.original,
      suggestion: correction.suggestion,
      explanation: correction.explanation,
      category: correction.category,
      count: (previous?.count ?? 0) + 1,
      firstSeenAt: previous?.firstSeenAt ?? now,
      lastSeenAt: now,
    });
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || b.lastSeenAt - a.lastSeenAt);
}

export function learningReducer(state: LearningData, action: LearningAction): LearningData {
  switch (action.type) {
    case "hydrate":
      return action.data;
    case "update-settings":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "add-session":
      return { ...state, sessions: [action.session, ...state.sessions.filter((s) => s.id !== action.session.id)].slice(0, 200) };
    case "set-review": {
      const session = state.sessions.find((s) => s.id === action.sessionId);
      if (!session) return state;
      const wasReady = session.review.status === "ready";
      const sessions = state.sessions.map((s) => (s.id === action.sessionId ? { ...s, review: action.review } : s));
      // Count mistakes once per session, the first time its review completes.
      const mistakes =
        action.review.status === "ready" && !wasReady ? mergeMistakes(state.mistakes, action.review.report, action.now) : state.mistakes;
      return { ...state, sessions, mistakes };
    }
    case "save-expression": {
      const key = normaliseKey(action.entry.phrase);
      if (state.expressions.some((entry) => normaliseKey(entry.phrase) === key)) return state;
      return { ...state, expressions: [action.entry, ...state.expressions] };
    }
    case "remove-expression":
      return { ...state, expressions: state.expressions.filter((entry) => entry.id !== action.id) };
    case "practised-expression":
      return {
        ...state,
        expressions: state.expressions.map((entry) => (entry.id === action.id ? { ...entry, practised: entry.practised + 1 } : entry)),
      };
    case "delete-transcripts":
      return { ...state, sessions: state.sessions.map((s) => ({ ...s, turns: [] })) };
    case "reset":
      return initialData(action.deviceId, action.now);
  }
}

/** What actually gets written to disk, honouring the learner's privacy settings. */
export function toPersisted(state: LearningData): LearningData {
  if (state.settings.saveTranscripts) return state;
  // Keep the transcript of a session until its review is done, then drop it.
  return {
    ...state,
    sessions: state.sessions.map((s) => (s.review.status === "ready" ? { ...s, turns: [] } : s)),
  };
}
