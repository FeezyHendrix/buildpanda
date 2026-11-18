import Ionicons from "@/components/atoms/icon";
import { memo, useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "@/platform/safe-area";
import { Text } from "@/components/atoms";
import { ICON_INVERSE } from "@/constants/colors";
import { TabBarHeight } from "@/constants/theme";
import { useSyncState } from "@/lib/sync-provider";
const BACK_ONLINE_MS = 5000;
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
    if (isOnline && !showBackOnline)
        return null;
    const offline = !isOnline;
    return (<div aria-live="polite" className="field-stack absolute left-0 right-0 z-50 px-4" style={{ pointerEvents: "none", bottom: insets.bottom + TabBarHeight + 8 }}>
      <div className={"field-stack " + (offline
        ? "flex-row items-center gap-2 self-center rounded-full bg-black-500 px-4 py-2"
        : "flex-row items-center gap-2 self-center rounded-full bg-success-600 px-4 py-2")}>
        <Ionicons name={offline ? "cloud-offline-outline" : "cloud-done-outline"} size={14} color={ICON_INVERSE}/>
        <Text weight="semibold" tone="inverse" className="text-xs">
          {offline ? "Offline — saved on this device" : "Back online"}
        </Text>
      </div>
    </div>);
});
