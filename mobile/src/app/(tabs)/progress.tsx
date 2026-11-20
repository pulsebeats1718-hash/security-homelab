import { StyleSheet, View } from "react-native";
import { SessionRow } from "../../components/SessionRow";
import { Card, Chip, EmptyState, Screen, ScreenHeader, SectionTitle, Text } from "../../components/ui";
import { useLearning } from "../../features/learning/LearningProvider";
import { lastSevenDays, mistakeCategories, recurringMistakes, streakDays, totalPracticeSeconds } from "../../features/learning/selectors";
import { formatMinutes } from "../../lib/time";
import { colors, radius, space } from "../../theme/tokens";

export default function ProgressScreen() {
  const { data } = useLearning();
  const sessions = data.sessions;
  const week = lastSevenDays(sessions);
  const maxMinutes = Math.max(10, ...week.map((d) => d.minutes));
  const weekMinutes = week.reduce((sum, d) => sum + d.minutes, 0);
  const recurring = recurringMistakes(data);
  const categories = mistakeCategories(data.mistakes).slice(0, 4);
  const categoryTotal = categories.reduce((sum, c) => sum + c.count, 0);
  const practisedExpressions = data.expressions.filter((e) => e.practised > 0).length;

  return (
    <Screen>
      <ScreenHeader eyebrow="Progress" title="How you're getting on" />

      <View style={styles.grid}>
        <Metric value={formatMinutes(totalPracticeSeconds(sessions))} label="total speaking" />
        <Metric value={String(sessions.length)} label="conversations" />
        <Metric value={`${streakDays(sessions)}`} label="day streak" />
        <Metric value={`${practisedExpressions}/${data.expressions.length}`} label="expressions used" />
      </View>

      <SectionTitle>This week</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Text variant="callout" color={colors.textMuted}>
          {weekMinutes ? `${weekMinutes} minutes of conversation in the last 7 days.` : "No conversations in the last 7 days yet."}
        </Text>
        <View style={styles.chart} accessible accessibilityLabel={`Minutes per day: ${week.map((d) => `${d.label} ${d.minutes}`).join(", ")}`}>
          {week.map((day, index) => (
            <View key={day.key} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: `${Math.max(4, (day.minutes / maxMinutes) * 100)}%`, backgroundColor: day.minutes ? colors.accent : colors.surfacePressed },
                    index === week.length - 1 && day.minutes ? { backgroundColor: colors.accentStrong } : null,
                  ]}
                />
              </View>
              <Text variant="caption" color={index === week.length - 1 ? colors.text : colors.textFaint}>
                {day.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <SectionTitle>Recurring mistakes</SectionTitle>
      {recurring.length ? (
        recurring.map((m) => (
          <Card key={m.key} style={{ gap: space.xs }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Chip label={m.category.replace("-", " ")} tone="rose" />
              <Text variant="caption" color={colors.textMuted}>
                {m.count}× · Sophie’s keeping an ear out
              </Text>
            </View>
            <Text variant="caption" color={colors.textFaint}>
              “{m.original}”
            </Text>
            <Text variant="bodyStrong">“{m.suggestion}”</Text>
            <Text variant="caption" color={colors.textMuted}>
              {m.explanation}
            </Text>
          </Card>
        ))
      ) : (
        <EmptyState
          icon="target"
          title={data.mistakes.length ? "No repeat offenders" : "Nothing yet"}
          body={
            data.mistakes.length
              ? "Mistakes that come up more than once will show here so you can focus on them."
              : "After a few reviewed conversations, the mistakes you make most often will appear here."
          }
        />
      )}

      {categories.length ? (
        <>
          <SectionTitle>Where the mistakes are</SectionTitle>
          <Card style={{ gap: space.md }}>
            {categories.map((c) => (
              <View key={c.category} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text variant="callout" style={{ textTransform: "capitalize" }}>
                    {c.category.replace("-", " ")}
                  </Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {Math.round((c.count / categoryTotal) * 100)}%
                  </Text>
                </View>
                <View style={styles.meterTrack}>
                  <View style={[styles.meterFill, { width: `${(c.count / categoryTotal) * 100}%` }]} />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {sessions.length ? (
        <>
          <SectionTitle>All conversations</SectionTitle>
          <Card style={{ paddingVertical: space.xs }}>
            {sessions.slice(0, 30).map((s, i, arr) => (
              <SessionRow key={s.id} session={s} last={i === arr.length - 1} />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="title">{value}</Text>
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  metric: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  chart: { flexDirection: "row", justifyContent: "space-between", height: 120, gap: space.xs },
  barColumn: { flex: 1, alignItems: "center", gap: 6 },
  barTrack: { flex: 1, width: "100%", maxWidth: 28, justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 6 },
  meterTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfacePressed, overflow: "hidden" },
  meterFill: { height: 6, borderRadius: 3, backgroundColor: colors.rose },
});
