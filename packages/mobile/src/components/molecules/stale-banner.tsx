import { View } from "react-native";
import { Text } from "@/components/atoms";

/**
 * The one notice for data served from the last sync because there is no
 * signal. Same box as the offline notice on a form, so "you're offline" looks
 * the same whether the crew member is reading or writing.
 */
export function StaleBanner({ what = "data" }: { what?: string }) {
  return (
    <View className="mb-3 rounded-xl bg-surface-alt px-4 py-3">
      <Text tone="secondary" className="text-[13px]">
        Showing your last synced {what} — you&apos;re offline.
      </Text>
    </View>
  );
}

StaleBanner.displayName = "StaleBanner";
