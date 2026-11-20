import { Fraunces_400Regular_Italic, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from "@expo-google-fonts/inter";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LearningProvider, useLearning } from "../features/learning/LearningProvider";
import { colors } from "../theme/tokens";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.ink, card: colors.ink, text: colors.text, border: colors.hairline, primary: colors.accent },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <LearningProvider>
          <StatusBar style="light" />
          <Gate ready={fontsLoaded || Boolean(fontError)}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink }, animation: "fade" }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="call" options={{ presentation: "fullScreenModal", gestureEnabled: false, animation: "fade_from_bottom" }} />
              <Stack.Screen name="review/[id]" options={{ animation: "slide_from_right" }} />
            </Stack>
          </Gate>
        </LearningProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Holds the splash screen until fonts and on-device data are ready, so nothing flashes. */
function Gate({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  const { hydrated } = useLearning();
  const show = ready && hydrated;
  useEffect(() => {
    if (show) void SplashScreen.hideAsync().catch(() => undefined);
  }, [show]);
  return show ? <>{children}</> : null;
}
