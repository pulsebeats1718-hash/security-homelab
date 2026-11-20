import { Feather } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Alert, LayoutAnimation, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Card, Chip, EmptyState, Screen, ScreenHeader, Text } from "../../components/ui";
import { useLearning } from "../../features/learning/LearningProvider";
import type { ExpressionEntry } from "../../features/learning/types";
import type { ExpressionKind } from "../../services/api/types";
import { colors, radius, space } from "../../theme/tokens";

const FILTERS: { key: ExpressionKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "idiom", label: "Idioms" },
  { key: "phrasal-verb", label: "Phrasal verbs" },
  { key: "collocation", label: "Collocations" },
  { key: "expression", label: "Everyday" },
];

export default function ExpressionsScreen() {
  const { data, markPractised, removeExpression } = useLearning();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const entries = useMemo(
    () => data.expressions.filter((e) => filter === "all" || e.kind === filter).sort((a, b) => b.savedAt - a.savedAt),
    [data.expressions, filter],
  );
  const fromCalls = data.expressions.filter((e) => e.origin === "conversation").length;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Expression bank"
        title="Say it like a Londoner"
        subtitle={`${data.expressions.length} saved${fromCalls ? ` · ${fromCalls} from your conversations` : ""}`}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }} style={{ marginHorizontal: -space.lg }}>
        <View style={{ width: space.lg - space.xs }} />
        {FILTERS.map((f) => {
          const selected = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.filter, selected && styles.filterSelected]}
            >
              <Text variant="caption" color={selected ? colors.accentInk : colors.textMuted} style={{ fontFamily: "Inter_600SemiBold" }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ width: space.lg - space.xs }} />
      </ScrollView>

      {entries.length ? (
        entries.map((entry) => (
          <ExpressionCard
            key={entry.id}
            entry={entry}
            open={openId === entry.id}
            onToggle={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setOpenId((current) => (current === entry.id ? null : entry.id));
            }}
            onPractised={() => markPractised(entry.id)}
            onRemove={() =>
              Alert.alert("Remove expression?", `“${entry.phrase}” will be removed from your bank.`, [
                { text: "Cancel", style: "cancel" },
                { text: "Remove", style: "destructive", onPress: () => removeExpression(entry.id) },
              ])
            }
          />
        ))
      ) : (
        <EmptyState icon="bookmark" title="Nothing here yet" body="Save expressions from your conversation reviews and they'll appear here." />
      )}
    </Screen>
  );
}

function ExpressionCard({
  entry,
  open,
  onToggle,
  onPractised,
  onRemove,
}: {
  entry: ExpressionEntry;
  open: boolean;
  onToggle: () => void;
  onPractised: () => void;
  onRemove: () => void;
}) {
  return (
    <Card style={{ padding: 0 }}>
      <Pressable onPress={onToggle} style={styles.cardHead} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityHint="Shows the meaning and examples">
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="heading">{entry.phrase}</Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={open ? undefined : 1}>
            {entry.meaning}
          </Text>
        </View>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textFaint} />
      </Pressable>
      {open ? (
        <View style={styles.cardBody}>
          <View style={{ flexDirection: "row", gap: space.xs, flexWrap: "wrap" }}>
            <Chip label={entry.kind.replace("-", " ")} tone="accent" />
            <Chip label={entry.origin === "starter" ? "Starter pack" : "From a conversation"} />
            {entry.practised ? <Chip label={`Used ${entry.practised}×`} tone="sage" icon="check" /> : null}
          </View>
          <View style={styles.example}>
            <Text variant="quote" style={{ fontSize: 16 }}>
              {entry.example}
            </Text>
          </View>
          {entry.synonyms.length ? (
            <View style={{ gap: 4 }}>
              <Text variant="label" color={colors.textFaint}>
                Similar
              </Text>
              <Text variant="callout">{entry.synonyms.join(" · ")}</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Pressable onPress={onPractised} style={styles.action} accessibilityRole="button" accessibilityLabel={`I used ${entry.phrase}`}>
              <Feather name="check-circle" size={16} color={colors.sage} />
              <Text variant="caption" color={colors.sage}>
                I used it
              </Text>
            </Pressable>
            <Pressable onPress={onRemove} style={styles.action} accessibilityRole="button" accessibilityLabel={`Remove ${entry.phrase}`}>
              <Feather name="trash-2" size={16} color={colors.textFaint} />
              <Text variant="caption" color={colors.textFaint}>
                Remove
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairlineStrong },
  filterSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.lg },
  cardBody: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  example: { borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: space.md },
  actions: { flexDirection: "row", gap: space.xl },
  action: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
});
