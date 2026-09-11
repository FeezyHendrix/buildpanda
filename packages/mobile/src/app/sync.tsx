import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Button, Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { ICON_BRAND } from "@/constants/colors";
import type { Db } from "@/db/client";
import { discardOutboxItem, flushOutbox, retryOutboxItem } from "@/db/outbox";
import { useLocalDb } from "@/db/provider";
import { useOutboxRows } from "@/hooks/use-outbox";
import { useSyncState } from "@/lib/sync-provider";

const RESOURCE_LABELS: Record<string, string> = {
  rfis: "RFIs",
  "rfi-comments": "RFI responses",
  "daily-logs": "Daily logs",
  "daily-log-entries": "Daily log entries",
  "daily-log-activities": "Activity logs",
  "change-requests": "Change requests",
  "change-request-comments": "Change request comments",
  documents: "Document uploads",
  "material-orders": "Material orders",
  "look-aheads": "Look aheads",
  "material-approvals": "Material approvals",
  "material-approval-comments": "Approval comments",
  "drawing-markups": "Drawing markups",
  "drawing-markup-comments": "Markup comments",
};

function labelFor(resource: string): string {
  return RESOURCE_LABELS[resource] ?? resource;
}

function QueueList({ db, ready }: { db: Db; ready: boolean }) {
  const sync = useSyncState();
  const { data: rows } = useOutboxRows(db);
  const pending = rows.filter((row) => row.status === "pending");
  const failed = rows.filter((row) => row.status === "failed");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function retry(id: string) {
    setBusyId(id);
    try {
      await retryOutboxItem(db, id);
      await flushOutbox(db).catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  // Native confirm: discarding drops a record the crew member wrote and the
  // app has no dialog molecule; the same pattern the delete screens use.
  function confirmDiscard(id: string, label: string) {
    Alert.alert(
      "Discard this change?",
      `The ${label.toLowerCase()} change on this device will be removed and will not reach the server.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setBusyId(id);
            discardOutboxItem(db, id).finally(() => setBusyId(null));
          },
        },
      ],
    );
  }

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
          {item.status === "failed" ? (
            <View className="flex-row gap-2 pt-3">
              <Button
                variant="secondary"
                onPress={() => retry(item.id)}
                loading={busyId === item.id}
                disabled={busyId !== null || !sync.isOnline}
                className="flex-1"
              >
                Retry
              </Button>
              <Button
                variant="danger"
                onPress={() => confirmDiscard(item.id, labelFor(item.resource))}
                disabled={busyId !== null}
                className="flex-1"
              >
                Discard
              </Button>
            </View>
          ) : null}
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
            <Ionicons name={sync.isOnline ? "cloud-done-outline" : "cloud-offline-outline"} size={22} color={ICON_BRAND} />
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
