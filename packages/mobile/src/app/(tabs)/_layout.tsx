import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ConnectionBanner } from "@/components/molecules/connection-banner";
import { MicTabButton } from "@/components/molecules/mic-tab-button";
import { VoiceCaptureSheet } from "@/components/molecules/voice-capture-sheet";
import { palette } from "@/constants/colors";
import { NavColors } from "@/constants/theme";
import { useSyncState } from "@/lib/sync-provider";
import { useFieldSession } from "@/lib/field-session";
import { useAuthGate } from "@/lib/use-auth-gate";

// Split so the raised mic button can hold the centre slot, Ernest-style:
// Plans · Schedule · [mic] · Tools · Account.
const LEFT_TABS = [
  { name: "index", title: "Plans", icon: "document-outline", iconActive: "document" },
  { name: "schedule", title: "Schedule", icon: "list-outline", iconActive: "list" },
] as const;

const RIGHT_TABS = [
  { name: "tools", title: "Tools", icon: "grid-outline", iconActive: "grid" },
  { name: "account", title: "Account", icon: "person-outline", iconActive: "person" },
] as const;

export default function TabsLayout() {
  const { user, isResolving } = useAuthGate();
  const [recording, setRecording] = useState(false);
  const { state: syncState, pendingCount } = useSyncState();
  const { projectId, isReady } = useFieldSession();

  if (isResolving || !isReady) return null;
  if (!user || !projectId) return <Redirect href="/" />;

  return (
    <View className="flex-1">
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: NavColors.primary,
        tabBarInactiveTintColor: NavColors.inactive,
        tabBarStyle: {
          backgroundColor: NavColors.surface,
          borderTopColor: syncState === "synced" ? NavColors.border : syncState === "error" ? palette.error600 : syncState === "syncing" ? palette.primary500 : palette.warning600,
          borderTopWidth: syncState === "synced" ? 0.5 : 2,
        },
        sceneStyle: { backgroundColor: NavColors.background },
      }}
    >
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
