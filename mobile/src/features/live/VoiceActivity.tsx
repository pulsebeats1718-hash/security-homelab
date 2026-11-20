import { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { colors } from "../../theme/tokens";

/**
 * A restrained five-bar level indicator driven by the SDK's speaking events.
 * (The SDK reports who is speaking, not raw levels, so bars animate while active
 * and settle when quiet.)
 */
export function VoiceActivity({ active, color = colors.accent, height = 18 }: { active: boolean; color?: string; height?: number }) {
  const [bars] = useState(() => [0, 1, 2, 3, 4].map(() => new Animated.Value(0.25)));

  useEffect(() => {
    if (!active) {
      const settle = Animated.parallel(bars.map((bar) => Animated.timing(bar, { toValue: 0.25, duration: 220, useNativeDriver: true })));
      settle.start();
      return () => settle.stop();
    }
    const loops = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 0.55 + ((index * 37) % 45) / 100, duration: 260 + index * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.3, duration: 240 + index * 50, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [active, bars]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height }} importantForAccessibility="no-hide-descendants">
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={{ width: 3, height, borderRadius: 2, backgroundColor: color, opacity: active ? 1 : 0.5, transform: [{ scaleY: bar }] }}
        />
      ))}
    </View>
  );
}
