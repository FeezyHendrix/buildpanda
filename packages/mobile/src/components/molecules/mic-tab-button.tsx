import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";

/**
 * The raised centre action on the tab bar — BuildPanda's take on Ernest's "+".
 * Tapping it starts a voice note that Panda AI turns into reviewable field
 * records. Rendered as a `Tabs.Screen` `tabBarButton`, so it holds the centre
 * slot but pushes to `/capture` rather than navigating to a route of its own.
 */
export function MicTabButton({ onPress }: { onPress: () => void }) {
  return (
    <View className="flex-1 items-center justify-start" style={{ top: -18 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Record a field update"
        className="h-16 w-16 items-center justify-center rounded-full bg-primary-500 active:bg-primary-600"
        style={{
          shadowColor: "#004DE7",
          shadowOpacity: 0.35,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Ionicons name="mic" size={26} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
