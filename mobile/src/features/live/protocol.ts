/**
 * Message protocol between the Sophie app (React Native) and the live host page
 * running the official Nuance SDK inside a WebView.
 *
 * Mirrored from backend/live/protocol.ts (the host page side). Bump BRIDGE_VERSION on any
 * breaking change; the app refuses to talk to a host page with another version.
 */
export const BRIDGE_VERSION = 1;

export type ConnectionState = "idle" | "queued" | "connecting" | "connected" | "disconnected" | "failed";
export type NetworkQuality = "good" | "poor" | "lost";
export type Speaker = "user" | "sophie";

export type HostErrorCode =
  | "mic-permission-denied"
  | "mic-not-found"
  | "mic-in-use"
  | "media-unknown"
  | "token-failed"
  | "session-expired"
  | "provider-busy"
  | "provider-quota"
  | "provider-maintenance"
  | "provider-terms"
  | "policy-curfew"
  | "already-active"
  | "provider-error"
  | "unknown";

/** Host page → app */
export type HostMessage =
  | { type: "ready"; version: number; sdkVersion: string }
  | { type: "token-request"; requestId: string }
  | { type: "state"; state: ConnectionState }
  | { type: "avatar"; event: "preparing" | "connected" | "ready" | "presented" | "disconnected" }
  | { type: "queue"; position: number; estimatedWaitSeconds: number | null }
  | { type: "speaking"; who: Speaker; isSpeaking: boolean }
  | { type: "mic-silent"; silent: boolean }
  | { type: "muted"; muted: boolean }
  | { type: "network"; quality: NetworkQuality }
  | { type: "link-poor" }
  | { type: "time-remaining"; seconds: number }
  /** `final: false` carries a delta to append; `final: true` closes the current turn for that speaker. */
  | { type: "transcript"; who: Speaker; text: string; final: boolean }
  | { type: "session-ended"; reason: string; endReason?: string; message?: string }
  | { type: "error"; code: HostErrorCode; message: string; retryable: boolean }
  /** Development aid: the first time each Nuance Live event type is seen. */
  | { type: "event-seen"; eventType: string };

/** App → host page */
export type AppMessage =
  | { type: "start" }
  | { type: "token"; requestId: string; token: string }
  | { type: "token-error"; requestId: string; message: string }
  | { type: "set-muted"; muted: boolean }
  | { type: "end" };
