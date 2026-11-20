import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { SessionRow } from "../../components/SessionRow";
import { SophieAura } from "../../components/SophieAura";
import { Button, Card, Chip, Screen, SectionTitle, Text } from "../../components/ui";
import { useLearning } from "../../features/learning/LearningProvider";
import { streakDays, todaysActivity } from "../../features/learning/selectors";
import { expressionOfTheDay } from "../../features/learning/starterPack";
import { formatMinutes, greetingFor } from "../../lib/time";
import { isApiConfigured } from "../../services/config";
import { colors, radius, space } from "../../theme/tokens";

const OPENERS = [
  "Go on then — how's your week been?",
  "Kettle's on. What's new with you?",
  "I've got a bone to pick about pineapple on pizza.",
  "Tell me something that made you laugh this week.",
  "Right, what's the plan for the weekend?",
];

export default function HomeScreen() {
  const { data } = useLearning();
  const { width } = useWindowDimensions();
  const name = data.settings.firstName;
  const today = todaysActivity(data.sessions);
  const streak = streakDays(data.sessions);
  const expression = expressionOfTheDay(data.expressions);
  const opener = OPENERS[new Date().getDate() % OPENERS.length];
  const recent = data.sessions.slice(0, 3);
  const configured = isApiConfigured();
  const auraSize = Math.min(220, width * 0.52);

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="label" color={colors.accent}>
          {greetingFor()}
          {name ? `, ${name}` : ""}
        </Text>
        <Text variant="hero">Fancy a chat?</Text>
      </View>

      <View style={styles.hero}>
        <LinearGradient colors={[colors.plum, colors.plumDeep, colors.surface]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.heroTop}>
          <View style={styles.presence}>
            <View style={styles.presenceDot} />
            <Text variant="caption" color={colors.textMuted}>
              Sophie · London
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "center" }}>
          <SophieAura size={auraSize} />
        </View>
        <Text variant="quote" align="center" style={{ paddingHorizontal: space.md }}>
          “{opener}”
        </Text>
        <Button
          label="Start conversation"
          icon="mic"
          size="lg"
          onPress={() => router.push("/call")}
          accessibilityHint="Opens a live voice call with Sophie"
          style={{ alignSelf: "stretch" }}
        />
        <Text variant="caption" color={colors.textFaint} align="center">
          Just talk — Sophie saves the corrections for the right moment.
        </Text>
      </View>

      {!configured ? (
        <Card tone="accent" style={{ gap: space.xs }}>
          <Text variant="bodyStrong">Connect the backend</Text>
          <Text variant="callout" color={colors.textMuted}>
            Set EXPO_PUBLIC_API_BASE_URL in mobile/.env to your Sophie Worker URL, then restart Expo. See the README for the full setup.
          </Text>
        </Card>
      ) : null}

      <SectionTitle>Today</SectionTitle>
      <View style={styles.stats}>
        <Stat value={today.seconds ? formatMinutes(today.seconds) : "0 min"} label="practised" />
        <Stat value={String(today.conversations)} label={today.conversations === 1 ? "conversation" : "conversations"} />
        <Stat value={`${streak}`} label={streak === 1 ? "day streak" : "day streak"} highlight={streak > 0} />
      </View>

      {expression ? (
        <>
          <SectionTitle>Expression of the day</SectionTitle>
          <Card style={{ gap: space.sm }}>
            <View style={styles.rowBetween}>
              <Chip label={expression.kind.replace("-", " ")} tone="accent" />
              <Chip label="Sophie will slip this in" icon="message-circle" />
            </View>
            <Text variant="title">{expression.phrase}</Text>
            <Text variant="callout" color={colors.textMuted}>
              {expression.meaning}
            </Text>
            <Text variant="quote" color={colors.text} style={{ fontSize: 16 }}>
              {expression.example}
            </Text>
          </Card>
        </>
      ) : null}

      <SectionTitle
        action={
          data.sessions.length > 3 ? (
            <Pressable onPress={() => router.push("/progress")} hitSlop={8}>
              <Text variant="caption" color={colors.accent}>
                See all
              </Text>
            </Pressable>
          ) : undefined
        }
      >
        Recent conversations
      </SectionTitle>
      {recent.length ? (
        <Card style={{ paddingVertical: space.xs }}>
          {recent.map((session, index) => (
            <SessionRow key={session.id} session={session} last={index === recent.length - 1} />
          ))}
        </Card>
      ) : (
        <Card>
          <Text variant="callout" color={colors.textMuted}>
            Your conversations will show up here, each with a review of what to work on.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

function Stat({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="heading" color={highlight ? colors.accent : colors.text}>
        {value}
      </Text>
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs, paddingTop: space.md },
  hero: {
    borderRadius: radius.xl,
    overflow: "hidden",
    padding: space.lg,
    gap: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between" },
  presence: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(11,13,18,0.45)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  presenceDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.sage },
  stats: { flexDirection: "row", gap: space.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: space.xs },
});
