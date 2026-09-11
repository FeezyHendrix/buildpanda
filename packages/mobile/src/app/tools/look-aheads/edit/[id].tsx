import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Field, Spinner, Text } from "@/components/atoms";
import { ActivityChecklist } from "@/components/molecules/activity-checklist";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useActivities } from "@/hooks/use-activities";
import { useLocalLookAhead, useUpdateLookAhead } from "@/hooks/use-local-look-aheads";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";

const TITLE = "Edit look ahead";

function Editor({ db, projectId, lookAheadId }: { db: Db; projectId: string; lookAheadId: string }) {
  const { data: existing } = useLocalLookAhead(db, lookAheadId);

  const update = useUpdateLookAhead(db, projectId);
  const { isOnline } = useSyncState();
  const activities = useActivities(projectId);
  const [name, setName] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [workers, setWorkers] = useState<string | null>(null);
  const [activityIds, setActivityIds] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Null means untouched, so the saved record keeps whatever the row already
  // holds rather than being overwritten by a stale render.
  const nameValue = name ?? existing?.name ?? "";
  const startValue = startDate ?? existing?.startDate ?? "";
  const endValue = endDate ?? existing?.endDate ?? "";
  const workersValue = workers ?? (existing?.totalWorkers?.toString() ?? "");
  const activityIdsValue = activityIds ?? existing?.activityIds ?? [];
  const canSubmit = Boolean(existing) && nameValue.trim().length > 0 && !saving;

  function toggleActivity(activityId: string) {
    const current = activityIdsValue;
    setActivityIds(
      current.includes(activityId) ? current.filter((id) => id !== activityId) : [...current, activityId],
    );
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await update(lookAheadId, {
        name: nameValue.trim(),
        startDate: startValue,
        endDate: endValue,
        totalWorkers: Number.parseInt(workersValue, 10) || null,
        // Only sent when touched: an untouched list must not turn into a
        // re-assignment push (see the limitation in outbox-look-aheads).
        ...(activityIds !== null ? { activityIds } : {}),
      });
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this look ahead.");
    }
  }

  return (
    <Page
      title={TITLE}
      onBack={() => router.back()}
      footer={
        <Button onPress={submit} disabled={!canSubmit} loading={saving}>
          Save changes
        </Button>
      }
    >
      {error ? (
        <View className="mb-4 rounded-xl bg-error-50 px-4 py-3">
          <Text tone="danger" className="text-sm">
            {error}
          </Text>
        </View>
      ) : null}

      {!isOnline ? (
        <View className="mb-4 rounded-xl bg-surface-alt px-4 py-3">
          <Text tone="secondary" className="text-[13px]">
            You&apos;re offline. This is saved on your device and uploads when you get signal.
          </Text>
        </View>
      ) : null}

      {!existing ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : (
        <View className="gap-5">
          <Field label="Name" value={nameValue} onChangeText={setName} />
          <View className="flex-row gap-3">
            <Field label="Start" value={startValue} onChangeText={setStartDate} placeholder="YYYY-MM-DD" autoCapitalize="none" className="flex-1" />
            <Field label="End" value={endValue} onChangeText={setEndDate} placeholder="YYYY-MM-DD" autoCapitalize="none" className="flex-1" />
          </View>
          <Field label="Total crew" value={workersValue} onChangeText={setWorkers} keyboardType="number-pad" />
          <ActivityChecklist
            activities={activities.data ?? []}
            selectedIds={activityIdsValue}
            onToggle={toggleActivity}
            isLoading={activities.isPending}
          />
          <Text tone="muted" className="text-xs">
            Adding activities syncs from here. Removing one is done on the web — an unticked activity comes back on the next sync.
          </Text>
        </View>
      )}
    </Page>
  );
}

export default function EditLookAhead() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  if (!ready || !db || !projectId || !id) {
    return (
      <Page title={TITLE} onBack={() => router.back()}>
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      </Page>
    );
  }

  return <Editor db={db} projectId={projectId} lookAheadId={id} />;
}
