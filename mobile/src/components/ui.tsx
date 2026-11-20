import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, radius, space, type, type TypeVariant } from "../theme/tokens";

export type IconName = ComponentProps<typeof Feather>["name"];

// ---- Text ------------------------------------------------------------------

interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  color?: string;
  align?: TextStyle["textAlign"];
}

export function Text({ variant = "body", color = colors.text, align, style, ...rest }: TextProps) {
  return <RNText maxFontSizeMultiplier={1.6} {...rest} style={[type[variant], { color, textAlign: align }, style]} />;
}

// ---- Screen ----------------------------------------------------------------

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, scroll = true, edges = ["top"], contentStyle }: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={styles.screen}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, contentStyle]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, { flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function ScreenHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.header} accessibilityRole="header">
      {eyebrow ? (
        <Text variant="label" color={colors.accent}>
          {eyebrow}
        </Text>
      ) : null}
      <Text variant="title">{title}</Text>
      {subtitle ? (
        <Text variant="callout" color={colors.textMuted}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// ---- Card ------------------------------------------------------------------

export function Card({ children, style, tone = "default" }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: "default" | "raised" | "accent" }) {
  return (
    <View
      style={[
        styles.card,
        tone === "raised" && { backgroundColor: colors.surfaceRaised },
        tone === "accent" && { backgroundColor: colors.accentSoft, borderColor: "rgba(233,182,138,0.25)" },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text variant="label" color={colors.textFaint}>
        {children}
      </Text>
      {action}
    </View>
  );
}

// ---- Buttons ---------------------------------------------------------------

interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  icon?: IconName;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: "md" | "lg";
}

export function Button({ label, icon, variant = "primary", loading, style, size = "md", disabled, onPress, ...rest }: ButtonProps) {
  const palette = {
    primary: { bg: colors.accent, fg: colors.accentInk, border: colors.accent },
    secondary: { bg: colors.surfaceRaised, fg: colors.text, border: colors.hairlineStrong },
    ghost: { bg: "transparent", fg: colors.text, border: "transparent" },
    danger: { bg: colors.danger, fg: "#fff", border: colors.danger },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={(event) => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.button,
        size === "lg" && styles.buttonLarge,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        pressed && { transform: [{ scale: 0.985 }] },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={size === "lg" ? 20 : 18} color={palette.fg} /> : null}
          <Text variant="bodyStrong" color={palette.fg}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  size = 44,
  tone = "default",
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  tone?: "default" | "accent" | "danger" | "muted";
  disabled?: boolean;
}) {
  const bg = { default: colors.surfaceRaised, accent: colors.accent, danger: colors.danger, muted: "rgba(255,255,255,0.08)" }[tone];
  const fg = tone === "accent" ? colors.accentInk : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}
    >
      <Feather name={icon} size={Math.round(size * 0.42)} color={fg} />
    </Pressable>
  );
}

export function Chip({ label, tone = "default", icon }: { label: string; tone?: "default" | "accent" | "sage" | "rose" | "sky"; icon?: IconName }) {
  const map = {
    default: [colors.surfaceRaised, colors.textMuted],
    accent: [colors.accentSoft, colors.accent],
    sage: [colors.sageSoft, colors.sage],
    rose: [colors.roseSoft, colors.rose],
    sky: [colors.skySoft, colors.sky],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon ? <Feather name={icon} size={12} color={fg} /> : null}
      <Text variant="caption" color={fg} style={{ fontFamily: "Inter_500Medium" }}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: space.xxl, gap: space.sm }}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={22} color={colors.accent} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="callout" color={colors.textMuted} align="center" style={{ maxWidth: 300 }}>
        {body}
      </Text>
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </Card>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  screenContent: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  header: { gap: space.xs, paddingTop: space.md, paddingBottom: space.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: space.lg,
  },
  sectionTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xs },
  button: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    borderWidth: 1,
  },
  buttonLarge: { minHeight: 58, paddingHorizontal: space.xxl },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, alignSelf: "flex-start" },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
});
