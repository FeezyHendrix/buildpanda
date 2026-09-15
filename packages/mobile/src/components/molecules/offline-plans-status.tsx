import { View } from "react-native";
import { Button, Spinner, Text } from "@/components/atoms";
import type { Db } from "@/db/client";
import { DOCUMENT_GROUP } from "@/db/documents-repository";
import { useLocalDocuments } from "@/hooks/use-local-documents";
import { useOfflinePlans } from "@/lib/offline-plans-provider";
import { useSyncState } from "@/lib/sync-provider";

export function OfflinePlansStatus({ db, projectId }: { db: Db; projectId: string }) {
  const { data } = useLocalDocuments(db, projectId, DOCUMENT_GROUP.PLAN);
  const { syncing, error, retry } = useOfflinePlans();
  const { isOnline } = useSyncState();
  const attached = data.filter((row) => row.currentVersionId || row.stagedUri);
  const available = attached.filter((row) => row.isAvailableOffline || row.stagedUri).length;
  const missing = data.length - attached.length;
  if (data.length === 0 && !syncing && !error) return null;

  return (
    <View className="mb-3 gap-2 rounded-xl border border-hairline bg-surface px-4 py-3">
      <View className="flex-row items-center gap-2">
        {syncing ? <Spinner size="xs" /> : null}
        <Text weight="semibold" className="flex-1 text-sm">
          {syncing ? "Preparing plans for offline use…" : "Offline plans"}
        </Text>
      </View>
      {attached.length > 0 ? <Text tone="secondary" className="text-xs">{available} of {attached.length} attached plans available offline</Text> : null}
      {missing > 0 ? <Text tone="secondary" className="text-xs">{missing} {missing === 1 ? "plan has" : "plans have"} no file attached.</Text> : null}
      {!isOnline && available < attached.length ? <Text tone="secondary" className="text-xs">Connect to finish downloading this project's plans.</Text> : null}
      {error ? <Text tone="danger" className="text-xs">{error}</Text> : null}
      {isOnline && !syncing && (error || available < attached.length) ? <Button variant="secondary" onPress={retry}>Retry downloads</Button> : null}
    </View>
  );
}
