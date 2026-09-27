import { View } from "react-native";
import { Button, Spinner, Text } from "@/components/atoms";
import { useOfflinePlans } from "@/lib/offline-plans-provider";
import { useSyncState } from "@/lib/sync-provider";

/** Each file shows its readiness; only active downloads and errors need a notice. */
export function OfflinePlansStatus() {
  const { syncing, total, completed, error, retry } = useOfflinePlans();
  const { isOnline } = useSyncState();
  if (!syncing && !error) return null;
  return (
    <View className="mb-3 gap-2">
      {syncing ? (
        <View className="flex-row items-center gap-2">
          <Spinner size="xs" />
          <Text tone="secondary" className="flex-1 text-xs">
            {total > 0 ? `Saving for offline use · ${completed} of ${total}` : "Refreshing files…"}
          </Text>
        </View>
      ) : null}
      {error ? (
        <Text tone="danger" className="text-xs">
          {error}
        </Text>
      ) : null}
      {isOnline && !syncing && error ? (
        <Button variant="secondary" onPress={retry}>
          Try again
        </Button>
      ) : null}
    </View>
  );
}
