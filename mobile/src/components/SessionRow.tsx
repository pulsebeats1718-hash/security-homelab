import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { learnerTurnCount } from "../features/learning/selectors";
import type { SessionRecord } from "../features/learning/types";
import { formatMinutes, relativeDay } from "../lib/time";
import { colors, space } from "../theme/tokens";
import { Chip, Text } from "./ui";

export function SessionRow({ session, last }: { session: SessionRecord; last?: boolean }) {
  const turns = learnerTurnCount(session);
  const review = session.review;
  const status =
    review.status === "ready"
      ? { label: `${review.report.corrections.length} notes`, tone: "sage" as const }
      : review.status === "loading"
        ? { label: "Reviewing…", tone: "default" as const }
        : { label: "Review", tone: "accent" as const };
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/review/[id]", params: { id: session.id } })}
      style={({ pressed }) => [styles.sessionRow, !last && styles.sessionDivider, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={`Conversation ${relativeDay(session.startedAt)}, ${formatMinutes(session.durationSec)}. ${status.label}`}
    >
      <View style={styles.sessionIcon}>
        <Feather name="message-square" size={16} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{relativeDay(session.startedAt)}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {formatMinutes(session.durationSec)} · {turns} {turns === 1 ? "thing you said" : "things you said"}
        </Text>
      </View>
      <Chip label={status.label} tone={status.tone} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sessionRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  sessionDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  sessionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
});
