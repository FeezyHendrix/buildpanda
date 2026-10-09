import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConnectionBanner } from "@/components/molecules/connection-banner";
import { MicTabButton } from "@/components/molecules/mic-tab-button";
import { VoiceCaptureSheet } from "@/components/molecules/voice-capture-sheet";
import { palette } from "@/constants/colors";
import { NavColors, TabBarHeight } from "@/constants/theme";
import { useSyncState } from "@/lib/sync-provider";
import { useFieldSession } from "@/lib/field-session";
import { useAuthGate } from "@/lib/use-auth-gate";
import { useMessagingChannels } from "@/hooks/use-messaging";

// The v2 workspace opens at Overview; field capture remains one tap away.
const LEFT_TABS = [
  { name: "overview", title: "Overview", icon: "grid-outline", iconActive: "grid" },
  { name: "index", title: "Files", icon: "document-outline", iconActive: "document" },

] as const;

const RIGHT_TABS = [
  { name: "tools", title: "Site", icon: "construct-outline", iconActive: "construct" },
  { name: "messages", title: "Messages", icon: "chatbubbles-outline", iconActive: "chatbubbles" },
] as const;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user, isResolving } = useAuthGate();
  const [recording, setRecording] = useState(false);
  const { state: syncState } = useSyncState();
  const { projectId, isReady } = useFieldSession();
  const { unread } = useMessagingChannels();

  if (isResolving || !isReady) return null;
  if (!user || !projectId) return <Redirect href="/" />;

  return (
    <View className="flex-1">
    <Tabs
      initialRouteName="overview"
      screenOptions={{
        headerShown: false,
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11, lineHeight: 16 },
        tabBarItemStyle: { paddingTop: 6, paddingBottom: 4 },
        tabBarActiveTintColor: NavColors.primary,
        tabBarInactiveTintColor: NavColors.inactive,
        tabBarStyle: {
          height: TabBarHeight + insets.bottom,
          paddingBottom: insets.bottom + 4,
          backgroundColor: NavColors.surface,
          borderTopColor: syncState === "synced" ? NavColors.border : syncState === "error" ? palette.error600 : syncState === "syncing" ? palette.primary500 : palette.warning600,
          borderTopWidth: syncState === "synced" ? 0.5 : 2,
        },
        sceneStyle: { backgroundColor: NavColors.background },
      }}
    >
      <Tabs.Screen name="schedule" options={{ href: null }} />
      <Tabs.Screen name="account" options={{ href: null }} />
      {LEFT_TABS.map(({ name, title, icon, iconActive }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? iconActive : icon} size={size} color={color} />
            ),
          }}
        />
      ))}

      <Tabs.Screen
        name="record"
        options={{
          title: "Capture",
          tabBarButton: () => <MicTabButton onPress={() => setRecording(true)} />,
        }}
      />

      {RIGHT_TABS.map(({ name, title, icon, iconActive }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarBadge: name === "messages" && unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
            tabBarBadgeStyle: { backgroundColor: palette.primary500, color: "white", fontFamily: "Inter_600SemiBold" },
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? iconActive : icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
    <ConnectionBanner />
    <VoiceCaptureSheet
      visible={recording}
      onClose={() => setRecording(false)}
      onRecorded={(result) => {
        setRecording(false);
        // the page opens once there is something to transcribe and review
        router.push(`/capture?uri=${encodeURIComponent(result.uri)}&seconds=${result.durationSeconds}` as never);
      }}
    />
    </View>
  );
}
