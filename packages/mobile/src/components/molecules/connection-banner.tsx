import Ionicons from "@expo/vector-icons/Ionicons";
import { memo, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/atoms";
import { useSyncState } from "@/lib/sync-provider";

const BACK_ONLINE_MS = 5_000;
/** Tab bar height, so the banner sits directly on top of it rather than over it. */
const TAB_BAR_HEIGHT = 49;

/**
 * Connectivity badge above the tab bar, following Ernest's two-banner split:
 * offline shows persistently, coming back online flashes briefly then hides.
 */
export const ConnectionBanner = memo(function ConnectionBanner() {
  const insets = useSafeAreaInsets();
  // Reads the one connectivity source in the app rather than probing again, so
  // the banner and the tab-bar sync indicator can never disagree.
  const { isOnline } = useSyncState();

  // Guards the first resolution, otherwise "back online" flashes on every cold
  // start — the app has technically just transitioned into being online.
  const hasResolved = useRef(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    if (hasResolved.current && isOnline) {
      setShowBackOnline(true);
      const timer = setTimeout(() => setShowBackOnline(false), BACK_ONLINE_MS);
      return () => clearTimeout(timer);
    }

    hasResolved.current = true;
    return undefined;
  }, [isOnline]);

  if (isOnline && !showBackOnline) return null;

  const offline = !isOnline;

  return (
    <Animated.View
      entering={SlideInDown.duration(300)}
      exiting={SlideOutDown.duration(300)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      className="absolute left-0 right-0 z-50 px-4"
      style={{ bottom: insets.bottom + TAB_BAR_HEIGHT + 8 }}
    >
      <View
        className={
          offline
            ? "flex-row items-center gap-2 self-center rounded-full bg-black-500 px-4 py-2"
            : "flex-row items-center gap-2 self-center rounded-full bg-success-600 px-4 py-2"
        }
      >
        <Ionicons
          name={offline ? "cloud-offline-outline" : "cloud-done-outline"}
          size={14}
          color="#FFFFFF"
        />
        <Text weight="semibold" tone="inverse" className="text-xs">
          {offline ? "Offline — saved on this device" : "Back online"}
        </Text>
      </View>
    </Animated.View>
  );
});
