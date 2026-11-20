import { Feather } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect } from "react";
import { Alert, BackHandler, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SophieAura } from "../components/SophieAura";
import { Button, IconButton, Text } from "../components/ui";
import { useLearning } from "../features/learning/LearningProvider";
import { LiveAvatarView } from "../features/live/LiveAvatarView";
import type { LiveState } from "../features/live/liveReducer";
import { useLiveConversation } from "../features/live/useLiveConversation";
import { VoiceActivity } from "../features/live/VoiceActivity";
import { formatClock } from "../lib/time";
import { isApiConfigured } from "../services/config";
import { colors, radius, space } from "../theme/tokens";

export default function CallScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { data, updateSettings } = useLearning();
  const call = useLiveConversation();
  const { state } = call;
  const captions = data.settings.captions;

  const active = state.phase === "loading" || state.phase === "connecting" || state.phase === "queued" || state.phase === "live";
  const showHost = state.phase !== "permission" && state.phase !== "permission-denied" && isApiConfigured();
  const avatarVisible = state.phase === "live" && (state.avatar === "ready" || state.avatar === "presented");

  // Leave the call screen once it's over: straight to the review if anything was said.
  useEffect(() => {
    if (state.phase !== "ended") return;
    const timer = setTimeout(() => {
      if (call.savedSessionId) router.replace({ pathname: "/review/[id]", params: { id: call.savedSessionId } });
      else if (router.canGoBack()) router.back();
      else router.replace("/");
    }, 500);
    return () => clearTimeout(timer);
  }, [call.savedSessionId, state.phase]);

  // Hardware back: confirm before hanging up.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!active) return false;
      Alert.alert("End the call?", "Sophie will save what you talked about for your review.", [
        { text: "Keep talking", style: "cancel" },
        { text: "End call", style: "destructive", onPress: call.endCall },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [active, call.endCall]);

  const lastSophieLine = [...state.turns].reverse().find((turn) => turn.role === "sophie")?.text.trim() ?? "";

  if (!isApiConfigured()) {
    return (
      <ErrorPanel
        insetsTop={insets.top}
        title="Setup needed"
        message="The app doesn't know where Sophie's server is. Set EXPO_PUBLIC_API_BASE_URL in mobile/.env and restart Expo."
        primary={{ label: "Back", onPress: () => router.back() }}
      />
    );
  }

  return (
    <View style={styles.root}>
      {/* Avatar stage */}
      <View style={StyleSheet.absoluteFill}>
        {showHost ? (
          <LiveAvatarView
            key={call.hostKey}
            webViewRef={call.webViewRef}
            onMessage={call.onMessage}
            onLoadFailed={call.hostLoadFailed}
            onCrashed={call.hostCrashed}
          />
        ) : null}
      </View>

      {/* Waiting state, drawn over the (still dark) video */}
      {!avatarVisible && state.phase !== "error" && state.phase !== "permission-denied" ? (
        <View style={[StyleSheet.absoluteFill, styles.waiting]} pointerEvents="none">
          <SophieAura size={240} activity={state.phase === "connecting" ? 0.6 : 0.2} />
          <Text variant="heading" align="center">
            {waitingTitle(state)}
          </Text>
          <Text variant="callout" color={colors.textMuted} align="center" style={{ maxWidth: 280 }}>
            {waitingSubtitle(state)}
          </Text>
        </View>
      ) : null}

      {/* Top bar */}
      <LinearGradient colors={["rgba(7,8,12,0.75)", "rgba(7,8,12,0)"]} style={[styles.topBar, { paddingTop: insets.top + space.xs }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={{ gap: 4 }}>
            <Text variant="heading">Sophie</Text>
            <StatusPill state={state} elapsed={call.elapsed} />
          </View>
          <IconButton
            icon={captions ? "type" : "eye-off"}
            label={captions ? "Hide captions" : "Show captions"}
            tone="muted"
            onPress={() => updateSettings({ captions: !captions })}
          />
        </View>
        <Banner state={state} secondsLeft={call.secondsLeft} />
      </LinearGradient>

      {/* Captions + controls */}
      <LinearGradient
        colors={["rgba(7,8,12,0)", "rgba(7,8,12,0.82)", colors.inkDeep]}
        style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}
        pointerEvents="box-none"
      >
        {captions && state.phase === "live" && lastSophieLine ? (
          <View style={styles.caption} accessibilityLiveRegion="polite">
            <Text variant="callout" numberOfLines={3}>
              {lastSophieLine}
            </Text>
          </View>
        ) : null}

        {state.phase === "live" || state.phase === "ending" ? (
          <View style={styles.controls}>
            <View style={styles.controlColumn}>
              <IconButton
                icon={state.muted ? "mic-off" : "mic"}
                label={state.muted ? "Unmute microphone" : "Mute microphone"}
                tone={state.muted ? "accent" : "muted"}
                size={60}
                onPress={call.toggleMute}
              />
              <Text variant="caption" color={colors.textMuted}>
                {state.muted ? "Muted" : "Mic on"}
              </Text>
            </View>
            <View style={styles.controlColumn}>
              <IconButton icon="phone-off" label="End call" tone="danger" size={72} onPress={call.endCall} disabled={state.phase === "ending"} />
              <Text variant="caption" color={colors.textMuted}>
                {state.phase === "ending" ? "Ending…" : "End"}
              </Text>
            </View>
            <View style={styles.controlColumn}>
              <View style={styles.activityBox} accessible accessibilityLabel={state.sophieSpeaking ? "Sophie is speaking" : state.userSpeaking ? "You're speaking" : "Listening"}>
                <VoiceActivity active={state.sophieSpeaking || state.userSpeaking} color={state.sophieSpeaking ? colors.accent : colors.sage} height={22} />
              </View>
              <Text variant="caption" color={colors.textMuted}>
                {state.sophieSpeaking ? "Sophie" : state.userSpeaking ? "You" : "Listening"}
              </Text>
            </View>
          </View>
        ) : active ? (
          <Button label="Cancel" variant="secondary" icon="x" onPress={call.endCall} style={{ alignSelf: "center", minWidth: 180 }} />
        ) : null}
      </LinearGradient>

      {state.phase === "error" || state.phase === "permission-denied" ? (
        <ErrorPanel
          insetsTop={insets.top}
          title={state.error?.title ?? "Something went wrong"}
          message={state.error?.message ?? "The call couldn't continue."}
          primary={
            state.error?.action === "settings"
              ? { label: "Open settings", onPress: call.openSettings }
              : state.error?.action === "retry"
                ? { label: state.connectedAt ? "Reconnect" : "Try again", onPress: call.retry }
                : { label: "Back home", onPress: () => router.back() }
          }
          secondary={
            state.connectedAt && call.savedSessionId
              ? { label: "Review this call", onPress: () => router.replace({ pathname: "/review/[id]", params: { id: call.savedSessionId! } }) }
              : state.error?.action !== "home"
                ? { label: "Back home", onPress: () => router.back() }
                : undefined
          }
          detail={__DEV__ && state.error ? `code: ${state.error.code}` : undefined}
        />
      ) : null}

      {__DEV__ && state.seenEvents.length ? (
        <View style={[styles.devEvents, { top: insets.top + 96 }]} pointerEvents="none">
          <Text variant="caption" color={colors.textFaint}>
            events: {state.seenEvents.join(", ")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function waitingTitle(state: LiveState): string {
  switch (state.phase) {
    case "permission":
      return "Checking your microphone";
    case "queued":
      return "Sophie's just finishing up";
    case "ending":
    case "ended":
      return "Saying goodbye…";
    default:
      return state.avatar === "preparing" ? "Sophie's getting ready" : "Calling Sophie…";
  }
}

function waitingSubtitle(state: LiveState): string {
  if (state.phase === "queued" && state.queuePosition) return `You're number ${state.queuePosition} in the queue.`;
  if (state.phase === "ended" || state.phase === "ending") return "Putting your review together.";
  if (state.avatar === "preparing") return "This can take up to half a minute.";
  return "Find a quiet spot and say hello when she picks up.";
}

function StatusPill({ state, elapsed }: { state: LiveState; elapsed: number }) {
  let label = "Connecting";
  let dot: string = colors.accent;
  if (state.phase === "live") {
    if (state.network === "lost") {
      label = "Reconnecting";
      dot = colors.rose;
    } else {
      label = `Live · ${formatClock(elapsed)}`;
      dot = state.network === "poor" ? colors.accent : colors.sage;
    }
  } else if (state.phase === "queued") label = "In the queue";
  else if (state.phase === "ending" || state.phase === "ended") label = "Call ended";
  else if (state.phase === "error" || state.phase === "permission-denied") {
    label = "Disconnected";
    dot = colors.rose;
  }
  return (
    <View style={styles.pill} accessibilityRole="text" accessibilityLabel={`Status: ${label}`}>
      <View style={[styles.pillDot, { backgroundColor: dot }]} />
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

function Banner({ state, secondsLeft }: { state: LiveState; secondsLeft: number }) {
  if (state.phase !== "live") return null;
  let message: string | null = null;
  let icon: React.ComponentProps<typeof Feather>["name"] = "info";
  if (state.network === "lost") {
    message = "Connection lost — trying to get Sophie back…";
    icon = "wifi-off";
  } else if (state.network === "poor" || state.linkPoor) {
    message = "Your connection's a bit wobbly. Sophie might sound choppy.";
    icon = "wifi";
  } else if (state.micSilent && !state.muted) {
    message = "Sophie can't hear anything from your microphone.";
    icon = "mic-off";
  } else if (Number.isFinite(secondsLeft) && secondsLeft <= 60) {
    message = `${formatClock(secondsLeft)} left on this call.`;
    icon = "clock";
  }
  if (!message) return null;
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Feather name={icon} size={14} color={colors.accent} />
      <Text variant="caption" color={colors.text} style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}

function ErrorPanel({
  title,
  message,
  primary,
  secondary,
  detail,
  insetsTop,
}: {
  title: string;
  message: string;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  detail?: string;
  insetsTop: number;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.errorRoot, { paddingTop: insetsTop }]}>
      <SophieAura size={160} />
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text variant="callout" color={colors.textMuted} align="center" style={{ maxWidth: 320 }}>
        {message}
      </Text>
      {detail ? (
        <Text variant="caption" color={colors.textFaint}>
          {detail}
        </Text>
      ) : null}
      <View style={{ gap: space.sm, alignSelf: "stretch", marginTop: space.md }}>
        <Button label={primary.label} onPress={primary.onPress} />
        {secondary ? <Button label={secondary.label} variant="ghost" onPress={secondary.onPress} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.inkDeep },
  waiting: { alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.xl, backgroundColor: colors.inkDeep },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    backgroundColor: "rgba(24,28,37,0.9)",
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.xxxl, gap: space.lg },
  caption: { backgroundColor: "rgba(11,13,18,0.6)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, alignSelf: "center", maxWidth: 520 },
  controls: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "flex-start" },
  controlColumn: { alignItems: "center", gap: space.xs, minWidth: 80 },
  activityBox: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  errorRoot: { backgroundColor: colors.inkDeep, alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.xl },
  devEvents: { position: "absolute", left: space.lg, right: space.lg, opacity: 0.8 },
});
