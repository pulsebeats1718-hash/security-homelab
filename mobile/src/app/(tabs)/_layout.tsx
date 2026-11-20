import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router/tabs";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../theme/tokens";

type TabIcon = React.ComponentProps<typeof Feather>["name"];

const TABS: { name: string; title: string; icon: TabIcon }[] = [
  { name: "index", title: "Home", icon: "home" },
  { name: "expressions", title: "Expressions", icon: "bookmark" },
  { name: "progress", title: "Progress", icon: "trending-up" },
  { name: "settings", title: "Settings", icon: "sliders" },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.ink },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.inkDeep,
          borderTopColor: colors.hairline,
          borderTopWidth: StyleSheet.hairlineWidth,
          // Room for the 28px icon slot + label, plus the gesture-bar inset on Android.
          height: 66 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ color }) => <Feather name={tab.icon} size={22} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
