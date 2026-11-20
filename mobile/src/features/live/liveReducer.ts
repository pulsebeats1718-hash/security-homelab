import type { Turn } from "../learning/types";
import type { HostErrorCode, HostMessage, NetworkQuality } from "./protocol";

/**
 * Pure state machine for one live call. Fed by messages from the host page
 * (Nuance SDK) and by app-side events (permissions, WebView failures, user actions).
 */

export type LivePhase =
  | "permission" // asking for the microphone
  | "permission-denied"
  | "loading" // host page loading
  | "connecting"
  | "queued"
  | "live"
  | "ending"
  | "ended"
  | "error";

export type ErrorAction = "retry" | "settings" | "setup" | "home";

export interface LiveError {
  code: string;
  title: string;
  message: string;
  action: ErrorAction;
}

export interface LiveState {
  phase: LivePhase;
  avatar: "none" | "preparing" | "connected" | "ready" | "presented";
  sophieSpeaking: boolean;
  userSpeaking: boolean;
  muted: boolean;
  micSilent: boolean;
  network: NetworkQuality;
  linkPoor: boolean;
  queuePosition: number | null;
  /** When the provider says the session will be cut off (epoch ms), counted down from its latest report. */
  providerDeadline: number | null;
  connectedAt: number | null;
  turns: Turn[];
  open: { user: number | null; sophie: number | null };
  error: LiveError | null;
  endReason: string | null;
  endedByUser: boolean;
  /** Details of the last failed token request, to explain a `token-failed` host error. */
  tokenError: { code: string; message: string } | null;
  seenEvents: string[];
}

export type LiveEvent =
  | { type: "host"; message: HostMessage; now: number }
  | { type: "permission-granted" }
  | { type: "permission-denied" }
  | { type: "host-load-failed"; message: string }
  | { type: "host-crashed" }
  | { type: "bridge-mismatch"; version: number }
  | { type: "token-error"; code: string; message: string }
  | { type: "user-end" }
  | { type: "session-cap-reached" }
  | { type: "retry" };

export const initialLiveState: LiveState = {
  phase: "permission",
  avatar: "none",
  sophieSpeaking: false,
  userSpeaking: false,
  muted: false,
  micSilent: false,
  network: "good",
  linkPoor: false,
  queuePosition: null,
  providerDeadline: null,
  connectedAt: null,
  turns: [],
  open: { user: null, sophie: null },
  error: null,
  endReason: null,
  endedByUser: false,
  tokenError: null,
  seenEvents: [],
};

const TERMINAL: LivePhase[] = ["ended", "error", "permission-denied"];

export function liveReducer(state: LiveState, event: LiveEvent): LiveState {
  switch (event.type) {
    case "permission-granted":
      return state.phase === "permission" ? { ...state, phase: "loading" } : state;
    case "permission-denied":
      return {
        ...state,
        phase: "permission-denied",
        error: {
          code: "mic-permission-denied",
          title: "Sophie can't hear you",
          message: "Microphone access is off for Sophie. Turn it on in your phone's settings to start talking.",
          action: "settings",
        },
      };
    case "host-load-failed":
      return fail(state, {
        code: "host-unreachable",
        title: "Can't reach Sophie",
        message: `The call screen couldn't load. Check your connection and try again. (${event.message})`,
        action: "retry",
      });
    case "host-crashed":
      return fail(state, { code: "host-crashed", title: "The call stopped unexpectedly", message: "Your phone closed the call view to save memory. Try again.", action: "retry" });
    case "bridge-mismatch":
      return fail(state, {
        code: "bridge-mismatch",
        title: "Update needed",
        message: `This version of the app doesn't match the server (bridge v${event.version}). Update the app or redeploy the backend.`,
        action: "home",
      });
    case "token-error":
      return { ...state, tokenError: { code: event.code, message: event.message } };
    case "user-end":
      if (TERMINAL.includes(state.phase)) return state;
      return { ...closeOpenTurns(state), phase: state.connectedAt ? "ending" : "ended", endedByUser: true, endReason: "user" };
    case "session-cap-reached":
      if (state.phase !== "live") return state;
      return { ...closeOpenTurns(state), phase: "ending", endedByUser: true, endReason: "time-limit" };
    case "retry":
      return { ...initialLiveState, phase: "loading", seenEvents: state.seenEvents };
    case "host":
      return onHostMessage(state, event.message, event.now);
  }
}

function onHostMessage(state: LiveState, message: HostMessage, now: number): LiveState {
  switch (message.type) {
    case "ready":
    case "token-request":
      return state;
    case "state":
      switch (message.state) {
        case "queued":
          return isActive(state) ? { ...state, phase: "queued" } : state;
        case "connecting":
          return isActive(state) ? { ...state, phase: "connecting" } : state;
        case "connected":
          return isActive(state) ? { ...state, phase: "live", connectedAt: state.connectedAt ?? now, queuePosition: null } : state;
        case "disconnected":
          if (state.phase === "error" || state.phase === "permission-denied") return state;
          if (state.phase === "ended") return state;
          if (!state.connectedAt && !state.endedByUser) return state; // a failed start reports its own error
          return { ...closeOpenTurns(state), phase: "ended", sophieSpeaking: false, userSpeaking: false };
        case "failed":
          if (TERMINAL.includes(state.phase)) return state;
          return fail(state, { code: "failed", title: "Couldn't connect", message: "The call couldn't be set up. Try again in a moment.", action: "retry" });
        default:
          return state;
      }
    case "avatar":
      return { ...state, avatar: message.event === "disconnected" ? "none" : message.event };
    case "queue":
      return { ...state, queuePosition: message.position };
    case "speaking":
      return message.who === "sophie" ? { ...state, sophieSpeaking: message.isSpeaking } : { ...state, userSpeaking: message.isSpeaking };
    case "mic-silent":
      return { ...state, micSilent: message.silent };
    case "muted":
      return { ...state, muted: message.muted };
    case "network":
      return { ...state, network: message.quality };
    case "link-poor":
      return { ...state, linkPoor: true };
    case "time-remaining":
      return { ...state, providerDeadline: now + message.seconds * 1000 };
    case "transcript":
      return applyTranscript(state, message.who, message.text, message.final, now);
    case "event-seen":
      return state.seenEvents.includes(message.eventType) ? state : { ...state, seenEvents: [...state.seenEvents, message.eventType] };
    case "session-ended":
      return onSessionEnded(state, message.reason, message.message);
    case "error":
      if (state.phase === "ended" && state.endedByUser) return state;
      return fail(state, describeHostError(message.code, message.message, state.tokenError));
  }
}

function onSessionEnded(state: LiveState, reason: string, message?: string): LiveState {
  const closed = closeOpenTurns({ ...state, endReason: state.endReason ?? reason, sophieSpeaking: false, userSpeaking: false });
  switch (reason) {
    case "refused":
      return closed; // the matching `error` message explains why
    case "connection-lost":
      return fail(closed, { code: "connection-lost", title: "The call dropped", message: "Your connection to Sophie was lost. Check your signal and reconnect.", action: "retry" });
    case "policy-violation":
      return fail(closed, { code: "policy", title: "Call ended", message: message ?? "This call was ended by a safety check.", action: "home" });
    case "age-check":
      return fail(closed, { code: "age-check", title: "Call ended", message: message ?? "This call was ended by an age check.", action: "home" });
    default:
      // "ended" (Sophie said goodbye) or "time-limit": a normal finish.
      return state.connectedAt ? { ...closed, phase: "ended" } : closed;
  }
}

function applyTranscript(state: LiveState, who: "user" | "sophie", text: string, final: boolean, now: number): LiveState {
  const openIndex = state.open[who];
  if (final) {
    return openIndex === null ? state : { ...state, open: { ...state.open, [who]: null } };
  }
  if (!text) return state;
  if (openIndex === null) {
    const turn: Turn = { id: `${who}-${now}-${state.turns.length}`, role: who, text, at: now };
    return { ...state, turns: [...state.turns, turn], open: { ...state.open, [who]: state.turns.length } };
  }
  const turns = state.turns.slice();
  const current = turns[openIndex];
  if (!current) return state;
  turns[openIndex] = { ...current, text: current.text + text };
  return { ...state, turns };
}

function closeOpenTurns(state: LiveState): LiveState {
  return { ...state, open: { user: null, sophie: null } };
}

function isActive(state: LiveState): boolean {
  return state.phase === "loading" || state.phase === "connecting" || state.phase === "queued" || state.phase === "live";
}

function fail(state: LiveState, error: LiveError): LiveState {
  return { ...closeOpenTurns(state), phase: "error", error, sophieSpeaking: false, userSpeaking: false };
}

export function describeHostError(code: HostErrorCode, raw: string, tokenError: LiveState["tokenError"]): LiveError {
  switch (code) {
    case "mic-permission-denied":
      return { code, title: "Sophie can't hear you", message: "Microphone access is blocked. Turn it on in your phone's settings.", action: "settings" };
    case "mic-not-found":
      return { code, title: "No microphone found", message: "Plug in or enable a microphone, then try again.", action: "retry" };
    case "mic-in-use":
      return { code, title: "Microphone busy", message: "Another app is using the microphone. Close it and try again.", action: "retry" };
    case "token-failed":
      return describeTokenError(tokenError, raw);
    case "session-expired":
      return { code, title: "That took too long", message: "The secure session expired before the call started. Try again.", action: "retry" };
    case "provider-busy":
    case "already-active":
      return { code, title: "Sophie's on another call", message: "She'll be free in a moment. Try again shortly.", action: "retry" };
    case "provider-quota":
      return { code, title: "That's all for today", message: raw || "Today's conversation allowance has been used up. Come back tomorrow.", action: "home" };
    case "provider-maintenance":
      return { code, title: "Down for maintenance", message: raw || "The conversation service is under maintenance.", action: "home" };
    case "provider-terms":
      return { code, title: "Setup needed", message: "The Nuance account behind this app hasn't accepted the API Developer Agreement yet.", action: "setup" };
    case "policy-curfew":
      return { code, title: "Taking a short break", message: raw, action: "home" };
    case "provider-error":
    case "media-unknown":
    case "unknown":
    default:
      return { code, title: "Something went wrong", message: raw || "The call couldn't start. Try again.", action: "retry" };
  }
}

function describeTokenError(tokenError: LiveState["tokenError"], raw: string): LiveError {
  const code = tokenError?.code ?? "token-failed";
  const message = tokenError?.message ?? raw;
  switch (code) {
    case "app_not_configured":
    case "provider_not_configured":
    case "provider_auth":
    case "provider_config":
    case "server_not_configured":
    case "unauthorised_client":
      return { code, title: "Setup needed", message, action: "setup" };
    case "provider_quota":
      return { code, title: "That's all for today", message, action: "home" };
    case "rate_limited":
    case "provider_busy":
      return { code, title: "Hang on a sec", message, action: "retry" };
    case "network":
      return { code, title: "You're offline", message, action: "retry" };
    default:
      return { code, title: "Couldn't start the call", message, action: "retry" };
  }
}
