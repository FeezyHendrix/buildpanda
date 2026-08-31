import Ionicons from "@expo/vector-icons/Ionicons";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { flushOutbox, outboxQuery } from "@/db/outbox";
import { useLocalDb } from "@/db/provider";
import { useSyncState } from "@/lib/sync-provider";

const RESOURCE_LABELS: Record<string, string> = {
  rfis: "RFIs",
  "rfi-comments": "RFI responses",
  "daily-logs": "Daily logs",
  "daily-log-entries": "Daily log entries",
  "daily-log-activities": "Activity logs",
  "change-requests": "Change requests",
  "material-orders": "Material orders",
  "look-aheads": "Look aheads",
};

function labelFor(resource: string): string {
  return RESOURCE_LABELS[resource] ?? resource;
}

function QueueList({ db, ready }: { db: NonNullable<ReturnType<typeof useLocalDb>["db"]>; ready: boolean }) {
  const query = useMemo(() => outboxQuery(db), [db]);
  const live = useLiveQuery(query);
  const rows = (live.data ?? []).toSorted((a, b) => b.createdAt - a.createdAt);
  const pending = rows.filter((row) => row.status === "pending");
  const failed = rows.filter((row) => row.status === "failed");

  if (!ready) {
    return (
      <View className="items-center py-10">
        <Spinner size="md" />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <Text tone="secondary" className="rounded-xl bg-surface-alt px-4 py-3 text-[13px]">
        Nothing is waiting to sync on this device.
      </Text>
    );
  }

  return (
    <Card>
      {[...failed, ...pending].map((item) => (
        <View key={item.id} className="border-b border-hairline px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Text weight="semibold" className="flex-1 text-[15px]">
              {labelFor(item.resource)}
            </Text>
            <View className={item.status === "failed" ? "rounded-full bg-error-50 px-2 py-1" : "rounded-full bg-primary-50 px-2 py-1"}>
              <Text weight="semibold" tone={item.status === "failed" ? "danger" : "brand"} className="text-[10px] uppercase">
                {item.status}
              </Text>
            </View>
          </View>
          {item.lastError ? (
            <Text tone="danger" className="pt-1 text-xs">
              {item.lastError}
            </Text>
          ) : (
            <Text tone="secondary" className="pt-1 text-xs">
              Attempt {item.attempts + 1}
            </Text>
          )}
        </View>
      ))}
    </Card>
  );
}

export default function SyncPage() {
  const { db, ready } = useLocalDb();
  const sync = useSyncState();
  const [flushing, setFlushing] = useState(false);

  async function retryNow() {
    if (!db || flushing) return;
    setFlushing(true);
    try {
      await flushOutbox(db);
    } finally {
      setFlushing(false);
    }
  }

  return (
    <Page
      title="Sync"
      onBack={() => router.back()}
      showSync={false}
      footer={
        <Button onPress={retryNow} loading={flushing} disabled={!ready || !db || !sync.isOnline}>
          Sync now
        </Button>
      }
    >
      <Card className="p-4">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-50">
            <Ionicons name={sync.isOnline ? "cloud-done-outline" : "cloud-offline-outline"} size={22} color="#004DE7" />
          </View>
          <View className="min-w-0 flex-1">
            <Text weight="bold" className="text-base">
              {sync.isOnline ? "Ready to sync" : "Offline"}
            </Text>
            <Text tone="secondary" className="pt-0.5 text-[13px]">
              {sync.pendingCount} pending · {sync.failedCount} failed
            </Text>
          </View>
        </View>
      </Card>

      <View className="pt-4">
        <Text weight="bold" className="pb-2 text-base">
          Queue
        </Text>
        {db ? (
          <QueueList db={db} ready={ready} />
        ) : (
          <Text tone="secondary" className="rounded-xl bg-surface-alt px-4 py-3 text-[13px]">
            Nothing is waiting to sync on this device.
          </Text>
        )}
      </View>
    </Page>
  );
}
