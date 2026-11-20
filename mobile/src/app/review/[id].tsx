import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Chip, EmptyState, IconButton, Screen, SectionTitle, Text } from "../../components/ui";
import { useLearning } from "../../features/learning/LearningProvider";
import { normaliseKey } from "../../features/learning/reducer";
import type { SessionRecord } from "../../features/learning/types";
import { formatMinutes, relativeDay } from "../../lib/time";
import type { CoachReport } from "../../services/api/types";
import { colors, radius, space } from "../../theme/tokens";

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, requestReview } = useLearning();
  const session = data.sessions.find((s) => s.id === id);

  useEffect(() => {
    if (session && session.review.status === "idle") void requestReview(session.id);
  }, [requestReview, session]);

  if (!session) {
    return (
      <Screen>
        <TopBar title="Review" />
        <EmptyState icon="alert-circle" title="Conversation not found" body="It may have been deleted from this device." />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="Conversation review" subtitle={`${relativeDay(session.startedAt)} · ${formatMinutes(session.durationSec)}`} />
      <ReviewBody session={session} onRetry={() => void requestReview(session.id)} />
      <Transcript session={session} />
      <Button label="Talk to Sophie again" icon="mic" variant="secondary" onPress={() => router.replace("/call")} />
    </Screen>
  );
}

function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.topBar}>
      <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <View style={{ flex: 1 }}>
        <Text variant="heading">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ReviewBody({ session, onRetry }: { session: SessionRecord; onRetry: () => void }) {
  const review = session.review;
  if (review.status === "idle" || review.status === "loading") {
    return (
      <Card style={{ alignItems: "center", gap: space.sm, paddingVertical: space.xxl }}>
        <ActivityIndicator color={colors.accent} />
        <Text variant="bodyStrong">Sophie’s going through your conversation…</Text>
        <Text variant="caption" color={colors.textMuted} align="center">
          She’s picking out what you nailed and what a native would say differently.
        </Text>
      </Card>
    );
  }
  if (review.status === "error") {
    const notConfigured = review.code === "coach_not_configured";
    const nothing = review.code === "nothing_to_review";
    return (
      <EmptyState
        icon={nothing ? "mic-off" : "cloud-off"}
        title={nothing ? "Not much to review" : notConfigured ? "Reviews aren't switched on" : "Review unavailable"}
        body={notConfigured ? "Add ANTHROPIC_API_KEY to the backend to enable post-call reviews. Your transcript is saved below." : review.message}
        action={nothing || notConfigured ? undefined : <Button label="Try again" icon="refresh-cw" variant="secondary" onPress={onRetry} />}
      />
    );
  }
  return <Report report={review.report} sessionId={session.id} />;
}

function Report({ report, sessionId }: { report: CoachReport; sessionId: string }) {
  const { data, saveExpression } = useLearning();
  const saved = new Set(data.expressions.map((e) => normaliseKey(e.phrase)));
  const [revealed, setRevealed] = useState(false);

  return (
    <>
      <Card tone="accent" style={{ gap: space.sm }}>
        <Text variant="label" color={colors.accent}>
          From Sophie
        </Text>
        <Text variant="quote">{report.summary}</Text>
      </Card>

      {report.strengths.length ? (
        <>
          <SectionTitle>What you nailed</SectionTitle>
          <Card style={{ gap: space.sm }}>
            {report.strengths.map((strength) => (
              <View key={strength} style={styles.bulletRow}>
                <Feather name="check-circle" size={16} color={colors.sage} style={{ marginTop: 3 }} />
                <Text variant="callout" style={{ flex: 1 }}>
                  {strength}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>A native would say…</SectionTitle>
      {report.corrections.length ? (
        report.corrections.map((c, index) => (
          <Card key={`${c.original}-${index}`} style={{ gap: space.sm }}>
            <View style={styles.chips}>
              <Chip label={c.severity === "mistake" ? "Mistake" : "More natural"} tone={c.severity === "mistake" ? "rose" : "sky"} />
              <Chip label={c.category.replace("-", " ")} />
            </View>
            <View style={{ gap: 2 }}>
              <Text variant="label" color={colors.textFaint}>
                You said
              </Text>
              <Text variant="callout" color={colors.textMuted}>
                “{c.original}”
              </Text>
            </View>
            <View style={{ gap: 2 }}>
              <Text variant="label" color={colors.accent}>
                A native would say
              </Text>
              <Text variant="heading">“{c.suggestion}”</Text>
            </View>
            <Text variant="caption" color={colors.textMuted}>
              {c.explanation}
            </Text>
          </Card>
        ))
      ) : (
        <Card>
          <Text variant="callout" color={colors.textMuted}>
            Nothing to correct this time. Proper job.
          </Text>
        </Card>
      )}

      {report.expressions.length ? (
        <>
          <SectionTitle>Expressions to keep</SectionTitle>
          {report.expressions.map((e) => {
            const isSaved = saved.has(normaliseKey(e.phrase));
            return (
              <Card key={e.phrase} style={{ gap: space.xs }}>
                <View style={styles.rowBetween}>
                  <Chip label={e.source === "sophie-used" ? "Sophie used this" : "Try this"} tone="accent" />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isSaved ? `${e.phrase} saved` : `Save ${e.phrase}`}
                    disabled={isSaved}
                    onPress={() => saveExpression(e, sessionId)}
                    hitSlop={8}
                    style={styles.saveButton}
                  >
                    <Feather name={isSaved ? "check" : "bookmark"} size={14} color={isSaved ? colors.sage : colors.accent} />
                    <Text variant="caption" color={isSaved ? colors.sage : colors.accent}>
                      {isSaved ? "Saved" : "Save"}
                    </Text>
                  </Pressable>
                </View>
                <Text variant="heading">{e.phrase}</Text>
                <Text variant="callout" color={colors.textMuted}>
                  {e.meaning}
                </Text>
                <Text variant="quote" style={{ fontSize: 15 }}>
                  {e.example}
                </Text>
                {e.synonyms.length ? (
                  <Text variant="caption" color={colors.textFaint}>
                    Similar: {e.synonyms.join(" · ")}
                  </Text>
                ) : null}
              </Card>
            );
          })}
        </>
      ) : null}

      <SectionTitle>Quick practice</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <Chip label={report.practice.kind.replace(/-/g, " ")} tone="sky" />
        <Text variant="callout" color={colors.textMuted}>
          {report.practice.instruction}
        </Text>
        <Text variant="heading">{report.practice.prompt}</Text>
        {revealed ? (
          <View style={styles.answer}>
            <Text variant="label" color={colors.sage}>
              Answer
            </Text>
            <Text variant="bodyStrong">{report.practice.answer}</Text>
          </View>
        ) : (
          <Button label="Show answer" variant="secondary" icon="eye" onPress={() => setRevealed(true)} />
        )}
      </Card>
    </>
  );
}

function Transcript({ session }: { session: SessionRecord }) {
  const [open, setOpen] = useState(false);
  const turns = session.turns.filter((t) => t.text.trim());
  return (
    <>
      <SectionTitle
        action={
          turns.length ? (
            <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8} accessibilityRole="button">
              <Text variant="caption" color={colors.accent}>
                {open ? "Hide" : `Show (${turns.length})`}
              </Text>
            </Pressable>
          ) : undefined
        }
      >
        Transcript
      </SectionTitle>
      {!turns.length ? (
        <Card>
          <Text variant="callout" color={colors.textMuted}>
            No transcript saved for this call. Transcripts are removed after review if you turned off “Keep transcripts” in Settings.
          </Text>
        </Card>
      ) : open ? (
        <View style={{ gap: space.xs }}>
          {turns.map((turn) => (
            <View key={turn.id} style={[styles.bubble, turn.role === "user" ? styles.userBubble : styles.sophieBubble]}>
              <Text variant="label" color={turn.role === "user" ? colors.sage : colors.accent}>
                {turn.role === "user" ? "You" : "Sophie"}
              </Text>
              <Text variant="callout">{turn.text.trim()}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingTop: space.sm },
  bulletRow: { flexDirection: "row", gap: space.sm },
  chips: { flexDirection: "row", gap: space.xs, flexWrap: "wrap" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  saveButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  answer: { backgroundColor: colors.sageSoft, borderRadius: radius.md, padding: space.md, gap: 4 },
  bubble: { borderRadius: radius.md, padding: space.md, gap: 4, maxWidth: "88%" },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.surfaceRaised },
  sophieBubble: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
});
