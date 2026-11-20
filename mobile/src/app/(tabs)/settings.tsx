import Constants from "expo-constants";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, TextInput, View } from "react-native";
import { Button, Card, Divider, Screen, ScreenHeader, SectionTitle, Text } from "../../components/ui";
import { useLearning } from "../../features/learning/LearningProvider";
import { api, type HealthResponse } from "../../services/api/client";
import type { CorrectionStyle, EnglishLevel } from "../../services/api/types";
import { config, isApiConfigured } from "../../services/config";
import { colors, fonts, radius, space } from "../../theme/tokens";

const CORRECTION_STYLES: { key: CorrectionStyle; title: string; body: string }[] = [
  { key: "relaxed", title: "Relaxed", body: "Only mistakes that would confuse someone. The rest waits for your review." },
  { key: "balanced", title: "Balanced", body: "At most one quick “a native would say…” after Sophie replies." },
  { key: "detailed", title: "Detailed", body: "More feedback during the chat, including phrasing that's correct but unnatural." },
];

const LEVELS: { key: EnglishLevel; label: string }[] = [
  { key: "intermediate", label: "Intermediate" },
  { key: "upper-intermediate", label: "Upper-int." },
  { key: "advanced", label: "Advanced" },
];

export default function SettingsScreen() {
  const { data, updateSettings, deleteTranscripts, resetAll } = useLearning();
  const { settings } = data;
  const [health, setHealth] = useState<{ state: "idle" | "checking" | "ok" | "error"; result?: HealthResponse; message?: string }>({ state: "idle" });

  const checkConnection = async () => {
    setHealth({ state: "checking" });
    try {
      setHealth({ state: "ok", result: await api.health() });
    } catch (error) {
      setHealth({ state: "error", message: error instanceof Error ? error.message : "Couldn't reach the server." });
    }
  };

  return (
    <Screen>
      <ScreenHeader eyebrow="Settings" title="Make Sophie yours" />

      <SectionTitle>About you</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Field label="First name" hint="So Sophie knows what to call you.">
          <TextInput
            value={settings.firstName ?? ""}
            onChangeText={(firstName) => updateSettings({ firstName: firstName.slice(0, 40) })}
            placeholder="e.g. Ana"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoCapitalize="words"
            autoComplete="given-name"
            maxLength={40}
          />
        </Field>
        <Field label="Your level">
          <Segmented options={LEVELS.map((l) => ({ key: l.key, label: l.label }))} value={settings.level} onChange={(level) => updateSettings({ level })} />
        </Field>
        <Field label="What would you like to talk about?" hint="Job interviews, travel, small talk at work… Sophie will steer towards it.">
          <TextInput
            value={settings.focus ?? ""}
            onChangeText={(focus) => updateSettings({ focus: focus.slice(0, 200) })}
            placeholder="Anything goes"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
            multiline
            maxLength={200}
          />
        </Field>
      </Card>

      <SectionTitle>Corrections</SectionTitle>
      <Card style={{ gap: space.xs, padding: space.sm }}>
        {CORRECTION_STYLES.map((style) => {
          const selected = settings.correctionStyle === style.key;
          return (
            <Pressable
              key={style.key}
              onPress={() => updateSettings({ correctionStyle: style.key })}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{style.title}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {style.body}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </Card>

      <SectionTitle>Sophie’s voice</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Row title="Language" value="British English" />
        <Divider />
        <Text variant="caption" color={colors.textMuted}>
          Sophie’s look and voice come from the avatar provider’s persona, chosen on the server. The provider doesn’t currently offer in-app voice or accent options, so this can’t be changed here yet.
        </Text>
        <Divider />
        <ToggleRow
          title="Captions during calls"
          body="Show Sophie's words on screen while she talks."
          value={settings.captions}
          onChange={(captions) => updateSettings({ captions })}
        />
      </Card>

      <SectionTitle>Privacy</SectionTitle>
      <Card style={{ gap: space.md }}>
        <ToggleRow
          title="Keep transcripts"
          body="Store what was said on this phone after the review is ready. Off: transcripts are deleted once reviewed."
          value={settings.saveTranscripts}
          onChange={(saveTranscripts) => updateSettings({ saveTranscripts })}
        />
        <Divider />
        <Text variant="caption" color={colors.textMuted}>
          During a call your voice is streamed to Nuance Labs, who power Sophie’s avatar; your camera is never used. For reviews, the transcript is sent to Sophie’s server and analysed by Anthropic’s Claude; it isn’t stored there. Your progress, expressions and transcripts live only on this device.
        </Text>
        <Button
          label="Delete all transcripts"
          variant="secondary"
          icon="file-minus"
          onPress={() =>
            Alert.alert("Delete all transcripts?", "Your reviews, expressions and progress stay. This can't be undone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: deleteTranscripts },
            ])
          }
        />
        <Button
          label="Erase everything"
          variant="ghost"
          icon="trash-2"
          onPress={() =>
            Alert.alert("Erase everything?", "All conversations, reviews, saved expressions and settings will be removed from this phone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Erase", style: "destructive", onPress: () => void resetAll() },
            ])
          }
        />
      </Card>

      <SectionTitle>Connection</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Row title="Server" value={isApiConfigured() ? config.apiBaseUrl.replace(/^https?:\/\//, "") : "Not set"} />
        {health.state === "ok" && health.result ? (
          <Text variant="caption" color={colors.sage}>
            Connected · live calls {health.result.integrations.nuance ? "ready" : "not configured (NUANCE_API_KEY)"} · reviews{" "}
            {health.result.integrations.coach ? "ready" : "not configured (ANTHROPIC_API_KEY)"}
          </Text>
        ) : health.state === "error" ? (
          <Text variant="caption" color={colors.rose}>
            {health.message}
          </Text>
        ) : null}
        <Button label="Check connection" variant="secondary" icon="activity" loading={health.state === "checking"} onPress={checkConnection} />
      </Card>

      <Text variant="caption" color={colors.textFaint} align="center">
        Sophie {Constants.expoConfig?.version ?? ""}
      </Text>
    </Screen>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="label" color={colors.textFaint}>
        {label}
      </Text>
      {children}
      {hint ? (
        <Text variant="caption" color={colors.textFaint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value?: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text variant="caption" color={selected ? colors.accentInk : colors.textMuted} style={{ fontFamily: fonts.bodySemi }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="callout">{title}</Text>
      <Text variant="callout" color={colors.textMuted} numberOfLines={1} style={{ flexShrink: 1, marginLeft: space.md }}>
        {value}
      </Text>
    </View>
  );
}

function ToggleRow({ title, body, value, onChange }: { title: string; body: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2, paddingRight: space.md }}>
        <Text variant="callout">{title}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {body}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={title}
        trackColor={{ false: colors.surfacePressed, true: colors.accent }}
        thumbColor={value ? colors.text : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  option: { flexDirection: "row", gap: space.md, padding: space.md, borderRadius: radius.md, alignItems: "flex-start" },
  optionSelected: { backgroundColor: colors.surfaceRaised },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textFaint, marginTop: 2, alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  segmented: { flexDirection: "row", backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: radius.pill },
  segmentSelected: { backgroundColor: colors.accent },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
