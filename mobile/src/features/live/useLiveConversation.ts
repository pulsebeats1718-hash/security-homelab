import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Linking, PermissionsAndroid, Platform } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import { api, ApiError } from "../../services/api/client";
import type { SessionRequest } from "../../services/api/types";
import { useLearning } from "../learning/LearningProvider";
import { mistakesForSophie } from "../learning/selectors";
import { expressionOfTheDay } from "../learning/starterPack";
import type { SessionRecord } from "../learning/types";
import type { HostWebView } from "./LiveAvatarView";
import { initialLiveState, liveReducer } from "./liveReducer";
import { BRIDGE_VERSION, type AppMessage, type HostMessage } from "./protocol";

const DEFAULT_MAX_SESSION_SECONDS = 900;

/**
 * Drives one live call: microphone permission, the WebView bridge to the Nuance
 * host page, token minting via our backend, mute/end controls, the session cap,
 * and saving the finished conversation for review.
 */
export function useLiveConversation() {
  const learning = useLearning();
  const [state, dispatch] = useReducer(liveReducer, initialLiveState);
  const webViewRef = useRef<HostWebView>(null);
  const [hostKey, setHostKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const maxSessionSeconds = useRef(DEFAULT_MAX_SESSION_SECONDS);
  const savedSessionId = useRef<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const stateRef = useRef(state);
  const learningRef = useRef(learning);
  useEffect(() => {
    stateRef.current = state;
    learningRef.current = learning;
  }, [learning, state]);
  const [secondsLeft, setSecondsLeft] = useState(Number.POSITIVE_INFINITY);

  // ---- microphone permission ----------------------------------------------
  const requestMicrophone = useCallback(async () => {
    if (Platform.OS !== "android") {
      // iOS: the WebView prompts on first use (NSMicrophoneUsageDescription in app.json).
      dispatch({ type: "permission-granted" });
      return;
    }
    try {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: "Talk to Sophie",
        message: "Sophie needs your microphone so she can hear you. Audio is streamed only while you're on a call.",
        buttonPositive: "Allow",
        buttonNegative: "Not now",
      });
      dispatch({ type: result === PermissionsAndroid.RESULTS.GRANTED ? "permission-granted" : "permission-denied" });
    } catch {
      dispatch({ type: "permission-denied" });
    }
  }, []);

  useEffect(() => {
    void requestMicrophone();
  }, [requestMicrophone]);

  // ---- bridge -----------------------------------------------------------------
  const send = useCallback((message: AppMessage) => {
    const payload = JSON.stringify(message);
    webViewRef.current?.injectJavaScript(`window.__sophieBridge && window.__sophieBridge.receive(${payload}); true;`);
  }, []);

  const buildSessionRequest = useCallback((): SessionRequest => {
    const { data } = learningRef.current;
    const today = expressionOfTheDay(data.expressions);
    return {
      deviceId: data.deviceId,
      preferences: { correctionStyle: data.settings.correctionStyle, focus: data.settings.focus || undefined },
      learner: {
        firstName: data.settings.firstName || undefined,
        level: data.settings.level,
        recentMistakes: mistakesForSophie(data),
        expressionOfTheDay: today ? { phrase: today.phrase, meaning: today.meaning } : undefined,
      },
    };
  }, []);

  const fetchToken = useCallback(
    async (requestId: string) => {
      try {
        const session = await api.createSession(buildSessionRequest());
        maxSessionSeconds.current = session.maxSessionSeconds || DEFAULT_MAX_SESSION_SECONDS;
        send({ type: "token", requestId, token: session.token });
      } catch (error) {
        const code = error instanceof ApiError ? error.code : "unknown";
        const message = error instanceof Error ? error.message : "Couldn't start a session.";
        dispatch({ type: "token-error", code, message });
        send({ type: "token-error", requestId, message });
      }
    },
    [buildSessionRequest, send],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let message: HostMessage;
      try {
        message = JSON.parse(event.nativeEvent.data) as HostMessage;
      } catch {
        return;
      }
      if (!message || typeof message.type !== "string") return;

      if (message.type === "ready") {
        if (message.version !== BRIDGE_VERSION) {
          dispatch({ type: "bridge-mismatch", version: message.version });
          return;
        }
        send({ type: "start" });
      } else if (message.type === "token-request") {
        void fetchToken(message.requestId);
      }
      dispatch({ type: "host", message, now: Date.now() });
    },
    [fetchToken, send],
  );

  // ---- controls -----------------------------------------------------------------
  const toggleMute = useCallback(() => {
    send({ type: "set-muted", muted: !stateRef.current.muted });
  }, [send]);

  const endCall = useCallback(() => {
    dispatch({ type: "user-end" });
    send({ type: "end" });
  }, [send]);

  const retry = useCallback(() => {
    send({ type: "end" });
    savedSessionId.current = null;
    setSavedId(null);
    setElapsed(0);
    dispatch({ type: "retry" });
    setHostKey((key) => key + 1); // fresh WebView → fresh SDK instance
  }, [send]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  // If the host never confirms the hang-up, finish anyway so the user isn't stuck.
  useEffect(() => {
    if (state.phase !== "ending") return;
    const timer = setTimeout(() => dispatch({ type: "host", message: { type: "state", state: "disconnected" }, now: Date.now() }), 4_000);
    return () => clearTimeout(timer);
  }, [state.phase]);

  // Call clock + our own cap on session length (cost control).
  useEffect(() => {
    if (state.phase !== "live" || !state.connectedAt) return;
    const connectedAt = state.connectedAt;
    const providerDeadline = state.providerDeadline;
    const tick = () => {
      const now = Date.now();
      const seconds = Math.floor((now - connectedAt) / 1000);
      setElapsed(seconds);
      setSecondsLeft(
        Math.min(
          maxSessionSeconds.current - seconds,
          providerDeadline ? Math.floor((providerDeadline - now) / 1000) : Number.POSITIVE_INFINITY,
        ),
      );
      if (seconds >= maxSessionSeconds.current) {
        dispatch({ type: "session-cap-reached" });
        send({ type: "end" });
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [send, state.connectedAt, state.phase, state.providerDeadline]);

  // Save the conversation once it's over (whether it ended normally or dropped).
  useEffect(() => {
    const finished = state.phase === "ended" || (state.phase === "error" && state.connectedAt !== null);
    if (!finished || savedSessionId.current || !state.connectedAt) return;
    const endedAt = Date.now();
    const record: SessionRecord = {
      id: `s-${state.connectedAt}`,
      startedAt: state.connectedAt,
      endedAt,
      durationSec: Math.max(1, Math.round((endedAt - state.connectedAt) / 1000)),
      turns: state.turns.filter((t) => t.text.trim()),
      endReason: state.endReason ?? undefined,
      review: { status: "idle" },
    };
    savedSessionId.current = record.id;
    learningRef.current.addSession(record);
    setSavedId(record.id);
  }, [state.connectedAt, state.endReason, state.phase, state.turns]);

  return {
    state,
    webViewRef,
    hostKey,
    elapsed,
    secondsLeft,
    savedSessionId: savedId,
    onMessage,
    toggleMute,
    endCall,
    retry,
    openSettings,
    requestMicrophone,
    hostLoadFailed: (message: string) => dispatch({ type: "host-load-failed", message }),
    hostCrashed: () => dispatch({ type: "host-crashed" }),
  };
}
