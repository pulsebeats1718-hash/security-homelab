import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { colors } from "../theme/tokens";
import { Text } from "./ui";

/**
 * Sophie's presence when her live video isn't on screen: a soft, breathing glow
 * with her monogram. It deliberately doesn't pretend to be her face — the real
 * avatar only appears once a call connects.
 *
 * `activity` (0–1) brightens and quickens the glow, e.g. while she's speaking.
 */
export function SophieAura({ size = 220, activity = 0, label = true }: { size?: number; activity?: number; label?: boolean }) {
  const [breathe] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      breathe.setValue(0.5);
      return;
    }
    const duration = activity > 0.5 ? 900 : 2800;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [activity, breathe, reduceMotion]);

  const outerScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.04 + activity * 0.06] });
  const outerOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessible accessibilityLabel="Sophie">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: outerOpacity, transform: [{ scale: outerScale }] }]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.55} />
              <Stop offset="45%" stopColor="#B9789A" stopOpacity={0.28} />
              <Stop offset="75%" stopColor={colors.plum} stopOpacity={0.18} />
              <Stop offset="100%" stopColor={colors.ink} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#halo)" />
        </Svg>
      </Animated.View>
      <View
        style={{
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: size * 0.25,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(11,13,18,0.55)",
          borderWidth: 1,
          borderColor: "rgba(233,182,138,0.35)",
        }}
      >
        {label ? (
          <Text style={{ fontFamily: "Fraunces_400Regular_Italic", fontSize: size * 0.2, lineHeight: size * 0.25 }} color={colors.text}>
            S
          </Text>
        ) : null}
      </View>
    </View>
  );
}
