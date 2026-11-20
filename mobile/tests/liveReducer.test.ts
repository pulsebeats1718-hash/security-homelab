import assert from "node:assert/strict";
import { test } from "node:test";
import { initialLiveState, liveReducer, type LiveEvent, type LiveState } from "../src/features/live/liveReducer";
import type { HostMessage } from "../src/features/live/protocol";

const host = (message: HostMessage, now = 1_000): LiveEvent => ({ type: "host", message, now });
const run = (events: LiveEvent[], from: LiveState = initialLiveState) => events.reduce(liveReducer, from);

const connected = () =>
  run([
    { type: "permission-granted" },
    host({ type: "ready", version: 1, sdkVersion: "0.37.1" }),
    host({ type: "state", state: "connecting" }),
    host({ type: "state", state: "connected" }, 5_000),
  ]);

test("happy path: permission → loading → connecting → live", () => {
  const s = connected();
  assert.equal(s.phase, "live");
  assert.equal(s.connectedAt, 5_000);
});

test("denied microphone permission shows a settings action", () => {
  const s = run([{ type: "permission-denied" }]);
  assert.equal(s.phase, "permission-denied");
  assert.equal(s.error?.action, "settings");
});

test("transcript deltas are grouped into turns and closed by final", () => {
  let s = connected();
  s = run(
    [
      host({ type: "transcript", who: "sophie", text: "Hiya! ", final: false }, 6_000),
      host({ type: "transcript", who: "sophie", text: "How are you?", final: false }),
      host({ type: "transcript", who: "sophie", text: "", final: true }),
      host({ type: "transcript", who: "user", text: "I am fine", final: false }),
      host({ type: "transcript", who: "user", text: "", final: true }),
      host({ type: "transcript", who: "sophie", text: "Lovely.", final: false }),
    ],
    s,
  );
  assert.deepEqual(
    s.turns.map((t) => [t.role, t.text]),
    [
      ["sophie", "Hiya! How are you?"],
      ["user", "I am fine"],
      ["sophie", "Lovely."],
    ],
  );
  assert.equal(s.open.sophie, 2);
});

test("user ending the call goes ending → ended when the host confirms", () => {
  let s = liveReducer(connected(), { type: "user-end" });
  assert.equal(s.phase, "ending");
  s = liveReducer(s, host({ type: "state", state: "disconnected" }));
  assert.equal(s.phase, "ended");
  assert.equal(s.endReason, "user");
});

test("cancelling before connecting ends immediately", () => {
  const s = run([{ type: "permission-granted" }, host({ type: "state", state: "connecting" }), { type: "user-end" }]);
  assert.equal(s.phase, "ended");
});

test("Sophie hanging up is a normal end, not an error", () => {
  const s = run([host({ type: "session-ended", reason: "ended", endReason: "end_call" }), host({ type: "state", state: "disconnected" })], connected());
  assert.equal(s.phase, "ended");
  assert.equal(s.error, null);
});

test("connection lost mid-call offers reconnect", () => {
  const s = liveReducer(connected(), host({ type: "session-ended", reason: "connection-lost" }));
  assert.equal(s.phase, "error");
  assert.equal(s.error?.action, "retry");
});

test("token failures explain server setup problems", () => {
  const s = run([
    { type: "permission-granted" },
    { type: "token-error", code: "provider_not_configured", message: "NUANCE_API_KEY is missing." },
    host({ type: "session-ended", reason: "refused" }),
    host({ type: "error", code: "token-failed", message: "x", retryable: true }),
    host({ type: "state", state: "disconnected" }),
    host({ type: "state", state: "failed" }),
  ]);
  assert.equal(s.phase, "error");
  assert.equal(s.error?.action, "setup");
  assert.equal(s.error?.message, "NUANCE_API_KEY is missing.");
});

test("errors after the user ended the call are ignored", () => {
  const ended = run([{ type: "user-end" }, host({ type: "state", state: "disconnected" })], connected());
  const s = liveReducer(ended, host({ type: "error", code: "unknown", message: "late", retryable: true }));
  assert.equal(s.phase, "ended");
});

test("session cap ends a live call", () => {
  const s = liveReducer(connected(), { type: "session-cap-reached" });
  assert.equal(s.phase, "ending");
  assert.equal(s.endReason, "time-limit");
});

test("retry resets the call but keeps event discovery", () => {
  let s = liveReducer(connected(), host({ type: "event-seen", eventType: "session.output_transcript.delta" }));
  s = liveReducer(liveReducer(s, host({ type: "session-ended", reason: "connection-lost" })), { type: "retry" });
  assert.equal(s.phase, "loading");
  assert.equal(s.turns.length, 0);
  assert.deepEqual(s.seenEvents, ["session.output_transcript.delta"]);
});

test("provider time-remaining is stored as a deadline", () => {
  const s = liveReducer(connected(), host({ type: "time-remaining", seconds: 30 }, 10_000));
  assert.equal(s.providerDeadline, 40_000);
});
