import assert from "node:assert/strict";
import { test } from "node:test";
import { initialData, learningReducer, mergeMistakes, toPersisted } from "../src/features/learning/reducer";
import { lastSevenDays, mistakesForSophie, streakDays } from "../src/features/learning/selectors";
import { expressionOfTheDay } from "../src/features/learning/starterPack";
import type { SessionRecord } from "../src/features/learning/types";
import type { CoachReport } from "../src/services/api/types";

const DAY = 86_400_000;
const report = (suggestions: string[]): CoachReport => ({
  summary: "",
  strengths: [],
  expressions: [],
  practice: { kind: "rephrase", instruction: "", prompt: "", answer: "" },
  corrections: suggestions.map((s) => ({ original: "x", suggestion: s, explanation: "", category: "grammar", severity: "mistake" })),
});
const session = (id: string, startedAt: number, durationSec = 300): SessionRecord => ({
  id,
  startedAt,
  endedAt: startedAt + durationSec * 1000,
  durationSec,
  turns: [{ id: "t", role: "user", text: "hello", at: startedAt }],
  review: { status: "idle" },
});

test("new data has the starter expression pack", () => {
  const data = initialData("device1234567890ab", 0);
  assert.ok(data.expressions.length >= 10);
  assert.equal(data.settings.correctionStyle, "balanced");
});

test("mistakes are counted per suggestion, case and punctuation insensitive", () => {
  let mistakes = mergeMistakes([], report(["I've been living here for two years."]), 1);
  mistakes = mergeMistakes(mistakes, report(["i've been living here for two years", "I agree"]), 2);
  assert.equal(mistakes[0]?.count, 2);
  assert.equal(mistakes.length, 2);
});

test("less-natural phrasing isn't stored as a mistake", () => {
  const r = report(["Fine"]);
  r.corrections[0]!.severity = "less-natural";
  assert.equal(mergeMistakes([], r, 1).length, 0);
});

test("a review only counts its mistakes once", () => {
  let data = learningReducer(initialData("device1234567890ab", 0), { type: "add-session", session: session("s1", 0) });
  const ready = { status: "ready" as const, report: report(["I agree"]) };
  data = learningReducer(data, { type: "set-review", sessionId: "s1", review: ready, now: 1 });
  data = learningReducer(data, { type: "set-review", sessionId: "s1", review: ready, now: 2 });
  assert.equal(data.mistakes[0]?.count, 1);
  assert.deepEqual(mistakesForSophie(data), [{ original: "x", better: "I agree" }]);
});

test("duplicate expressions aren't saved twice", () => {
  const data = initialData("device1234567890ab", 0);
  const existing = data.expressions[0]!;
  const next = learningReducer(data, { type: "save-expression", entry: { ...existing, id: "new", phrase: existing.phrase.toUpperCase() } });
  assert.equal(next.expressions.length, data.expressions.length);
});

test("transcripts are dropped from disk after review when the learner opts out", () => {
  let data = initialData("device1234567890ab", 0);
  data = learningReducer(data, { type: "update-settings", patch: { saveTranscripts: false } });
  data = learningReducer(data, { type: "add-session", session: session("a", 0) });
  data = learningReducer(data, { type: "add-session", session: { ...session("b", 1), review: { status: "ready", report: report([]) } } });
  const persisted = toPersisted(data);
  assert.equal(persisted.sessions.find((s) => s.id === "a")?.turns.length, 1, "unreviewed keeps its transcript for the review");
  assert.equal(persisted.sessions.find((s) => s.id === "b")?.turns.length, 0);
});

test("streak counts consecutive days ending today or yesterday", () => {
  const now = new Date(2026, 10, 20, 12).getTime();
  assert.equal(streakDays([session("a", now), session("b", now - DAY), session("c", now - 3 * DAY)], now), 2);
  assert.equal(streakDays([session("a", now - DAY), session("b", now - 2 * DAY)], now), 2);
  assert.equal(streakDays([session("a", now - 2 * DAY)], now), 0);
});

test("weekly chart covers 7 days with minutes", () => {
  const now = new Date(2026, 10, 20, 12).getTime();
  const week = lastSevenDays([session("a", now, 600)], now);
  assert.equal(week.length, 7);
  assert.equal(week[6]?.minutes, 10);
});

test("expression of the day prefers the least practised", () => {
  const data = initialData("device1234567890ab", 0);
  const practisedAllButOne = data.expressions.map((e, i) => ({ ...e, practised: i === 3 ? 0 : 2 }));
  assert.equal(expressionOfTheDay(practisedAllButOne)?.id, data.expressions[3]?.id);
});
