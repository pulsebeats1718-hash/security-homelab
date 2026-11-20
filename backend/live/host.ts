/**
 * Live host page: runs the official Nuance SDK (a browser SDK built on LiveKit)
 * inside the app's WebView, renders Sophie's video/audio, and relays state to
 * the native app over a small JSON bridge. All provider-specific behaviour on the
 * client lives in this file.
 */
import {
  ActiveSessionError,
  ApiError,
  GuestLimitError,
  LegalRequiredError,
  MaintenanceError,
  MediaAccessError,
  PolicyCurfewError,
  createNuanceConversation,
  type Conversation,
  type ConversationEvent,
} from "@nuancelabs/js-sdk";
import { BRIDGE_VERSION, type AppMessage, type HostErrorCode, type HostMessage } from "./protocol";

const SDK_VERSION = "0.37.1";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
    __sophieBridge?: { receive(message: AppMessage | string): void };
  }
}

const video = document.getElementById("avatar") as HTMLVideoElement;
const audio = document.getElementById("voice") as HTMLAudioElement;

let conversation: Conversation | null = null;
let starting = false;
/** One error report per call attempt: the SDK can surface the same refusal twice. */
let errorReported = false;
let tokenRequests = 0;
const pendingTokens = new Map<string, { resolve(token: string): void; reject(error: Error): void }>();
const seenEventTypes = new Set<string>();

// ---- bridge ---------------------------------------------------------------

function post(message: HostMessage): void {
  const text = JSON.stringify(message);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
  else window.parent?.postMessage(text, "*"); // plain-browser testing
}

function receive(raw: AppMessage | string): void {
  let message: AppMessage;
  try {
    message = typeof raw === "string" ? (JSON.parse(raw) as AppMessage) : raw;
  } catch {
    return;
  }
  switch (message.type) {
    case "start":
      void start();
      break;
    case "token":
      pendingTokens.get(message.requestId)?.resolve(message.token);
      pendingTokens.delete(message.requestId);
      break;
    case "token-error":
      pendingTokens.get(message.requestId)?.reject(new TokenError(message.message));
      pendingTokens.delete(message.requestId);
      break;
    case "set-muted":
      void setMuted(message.muted);
      break;
    case "end":
      void end();
      break;
  }
}

window.__sophieBridge = { receive };
// Browser testing: accept messages from a parent frame too.
window.addEventListener("message", (event) => {
  if (typeof event.data === "string" && event.data.includes('"type"')) receive(event.data);
});

class TokenError extends Error {}

/** The SDK calls this for every new conversation; the app fetches a fresh token from our backend. */
function requestToken(): Promise<string> {
  const requestId = `t${++tokenRequests}`;
  return new Promise<string>((resolve, reject) => {
    pendingTokens.set(requestId, { resolve, reject });
    post({ type: "token-request", requestId });
    setTimeout(() => {
      if (pendingTokens.delete(requestId)) reject(new TokenError("Timed out waiting for a session token."));
    }, 20_000);
  });
}

// ---- conversation ---------------------------------------------------------

async function start(): Promise<void> {
  if (starting) return;
  if (conversation && (conversation.state === "connecting" || conversation.state === "connected" || conversation.state === "queued")) return;
  starting = true;
  errorReported = false;
  resetTranscript();

  const next = createNuanceConversation({
    token: requestToken,
    // Microphone only: Sophie never sees the learner's camera.
    mediaDevices: { cameraEnabled: false },
    startOn: "first-frame",
  });
  conversation = next;
  next.onChange((event) => handleChange(next, event));
  next.onInterfaceEvent(handleInterfaceEvent);

  try {
    await next.connect();
  } catch (error) {
    reportConnectError(error);
  } finally {
    starting = false;
  }
}

function handleChange(current: Conversation, event: ConversationEvent): void {
  if (current !== conversation) return;
  switch (event.type) {
    case "state-changed":
      post({ type: "state", state: event.state });
      if (event.state === "disconnected" || event.state === "failed") detachMedia();
      break;
    case "avatar-preparing":
      post({ type: "avatar", event: "preparing" });
      break;
    case "avatar-connected":
      post({ type: "avatar", event: "connected" });
      break;
    case "avatar-ready":
      document.body.classList.add("ready");
      post({ type: "avatar", event: "ready" });
      break;
    case "avatar-presented":
      post({ type: "avatar", event: "presented" });
      // The persona doesn't speak first; ask Sophie to open the conversation.
      current.sendInterfaceEvent({ type: "response.create" }).catch(() => undefined);
      break;
    case "avatar-disconnected":
      post({ type: "avatar", event: "disconnected" });
      break;
    case "tracks-changed":
      attachMedia(current);
      break;
    case "speaking-changed":
      post({ type: "speaking", who: event.participant === "avatar" ? "sophie" : "user", isSpeaking: event.isSpeaking });
      break;
    case "mic-silent-changed":
      post({ type: "mic-silent", silent: event.silent });
      break;
    case "network-changed":
      post({ type: "network", quality: event.quality });
      break;
    case "link-poor":
      post({ type: "link-poor" });
      break;
    case "time-remaining":
      post({ type: "time-remaining", seconds: event.secondsRemaining });
      break;
    case "queue-changed":
      post({ type: "queue", position: event.position, estimatedWaitSeconds: event.estimatedWaitSeconds });
      break;
    case "session-ended":
      flushTranscript();
      post({ type: "session-ended", reason: event.reason, endReason: event.endReason, message: event.message });
      if (event.error) reportConnectError(event.error);
      break;
    default:
      break;
  }
}

function attachMedia(current: Conversation): void {
  if (current.state !== "connected" && current.state !== "connecting") return;
  try {
    current.avatar.videoTrack?.attach(video);
    current.avatar.audioTrack?.attach(audio);
    void video.play().catch(() => undefined);
    void audio.play().catch(() => undefined);
  } catch {
    // `avatar` throws before the conversation is connected; the next tracks-changed retries.
  }
}

function detachMedia(): void {
  document.body.classList.remove("ready");
  video.srcObject = null;
  audio.srcObject = null;
}

async function setMuted(muted: boolean): Promise<void> {
  const current = conversation;
  if (!current || current.state !== "connected") return;
  try {
    if (muted) await current.user.muteAudio();
    else await current.user.unmuteAudio();
    post({ type: "muted", muted: current.user.isMuted });
  } catch {
    post({ type: "error", code: "unknown", message: "Couldn't change the microphone.", retryable: true });
  }
}

async function end(): Promise<void> {
  const current = conversation;
  for (const pending of pendingTokens.values()) pending.reject(new TokenError("Call ended."));
  pendingTokens.clear();
  if (!current) {
    post({ type: "state", state: "disconnected" });
    return;
  }
  flushTranscript();
  try {
    await current.disconnect();
  } finally {
    detachMedia();
    post({ type: "state", state: "disconnected" });
  }
}

// ---- transcripts ----------------------------------------------------------
//
// Verified in SDK 0.37.1: Sophie's words arrive as `session.output_transcript.delta`
// ({ delta }) and her spoken turn ends with `session.output_audio.done`.
// The learner's transcript event names are not documented in the SDK package, so
// any `*input_transcript*` / `*input_audio_transcription*` event is handled
// defensively below, and every new event type is reported to the app (`event-seen`)
// so the mapping can be confirmed against https://docs.nuancelabs.ai.

let sophieOpen = false;
let userBuffer = "";

function handleInterfaceEvent(event: Record<string, unknown>): void {
  const type = typeof event.type === "string" ? event.type : "";
  if (!type) return;
  if (!seenEventTypes.has(type)) {
    seenEventTypes.add(type);
    post({ type: "event-seen", eventType: type });
  }

  if (type === "session.output_transcript.delta") {
    closeUserTurn();
    const delta = typeof event.delta === "string" ? event.delta : "";
    if (delta) {
      sophieOpen = true;
      post({ type: "transcript", who: "sophie", text: delta, final: false });
    }
    return;
  }
  if (type === "session.output_audio.done" || type === "session.output_transcript.done") {
    closeSophieTurn();
    return;
  }
  if (/input_(audio_)?transcri/.test(type)) {
    const delta = typeof event.delta === "string" ? event.delta : "";
    const full =
      typeof event.transcript === "string" ? event.transcript : typeof event.text === "string" ? event.text : "";
    if (/\.delta$/.test(type) && delta) {
      closeSophieTurn();
      userBuffer += delta;
      post({ type: "transcript", who: "user", text: delta, final: false });
    } else if (/\.(done|completed|final)$/.test(type)) {
      closeSophieTurn();
      if (!userBuffer && full) post({ type: "transcript", who: "user", text: full, final: false });
      userBuffer = "";
      post({ type: "transcript", who: "user", text: "", final: true });
    }
  }
}

function closeSophieTurn(): void {
  if (!sophieOpen) return;
  sophieOpen = false;
  post({ type: "transcript", who: "sophie", text: "", final: true });
}

function closeUserTurn(): void {
  if (!userBuffer) return;
  userBuffer = "";
  post({ type: "transcript", who: "user", text: "", final: true });
}

function flushTranscript(): void {
  closeUserTurn();
  closeSophieTurn();
}

function resetTranscript(): void {
  sophieOpen = false;
  userBuffer = "";
}

// ---- errors ---------------------------------------------------------------

function reportConnectError(error: unknown): void {
  if (errorReported) return;
  errorReported = true;
  const send = (code: HostErrorCode, message: string, retryable: boolean) =>
    post({ type: "error", code, message, retryable });

  if (error instanceof MediaAccessError) {
    if (error.reason === "permission-denied") return send("mic-permission-denied", "Microphone access was blocked.", false);
    if (error.reason === "device-not-found") return send("mic-not-found", "No microphone was found.", false);
    if (error.reason === "device-in-use") return send("mic-in-use", "Another app is using the microphone.", true);
    return send("media-unknown", "The microphone couldn't be started.", true);
  }
  if (error instanceof TokenError) return send("token-failed", error.message, true);
  if (error instanceof ActiveSessionError) return send("already-active", "A previous call is still closing.", true);
  if (error instanceof MaintenanceError) return send("provider-maintenance", error.message, true);
  if (error instanceof LegalRequiredError) return send("provider-terms", "The Nuance account hasn't accepted the API terms yet.", false);
  if (error instanceof PolicyCurfewError) return send("policy-curfew", error.message, false);
  if (error instanceof GuestLimitError) return send("provider-quota", error.message, false);
  if (error instanceof ApiError) {
    if (error.status === 401) return send("session-expired", "The session token expired before the call started.", true);
    if (error.status === 409) return send("provider-busy", "Sophie is busy on other calls right now.", true);
    if (error.status === 429) return send("provider-quota", "Today's conversation allowance has been used up.", false);
    if (error.status >= 500) return send("provider-error", "The conversation service is having a moment.", true);
    return send("provider-error", `The conversation service refused the call (${error.status}${error.code ? ` ${error.code}` : ""}).`, true);
  }
  send("unknown", error instanceof Error ? error.message : "Something went wrong.", true);
}

post({ type: "ready", version: BRIDGE_VERSION, sdkVersion: SDK_VERSION });
