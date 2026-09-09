import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Button, Field, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { lookAheadsRepository, toLookAhead } from "@/db/look-aheads-repository";
import { useLocalDb } from "@/db/provider";
import { useUpdateLookAhead } from "@/hooks/use-local-look-aheads";
import { useFieldSession } from "@/lib/field-session";

function Editor({ db, projectId, lookAheadId }: { db: Db; projectId: string; lookAheadId: string }) {
  const query = useMemo(() => lookAheadsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);
  const existing = useMemo(
    () => (live.data ?? []).map(toLookAhead).find((row) => row.id === lookAheadId),
    [live.data, lookAheadId],
  );

  const update = useUpdateLookAhead(db, projectId);
  const [name, setName] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [workers, setWorkers] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!existing) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  // Null means untouched, so the saved record keeps whatever the row already
  // holds rather than being overwritten by a stale render.
  const nameValue = name ?? existing.name;
  const startValue = startDate ?? existing.startDate;
  const endValue = endDate ?? existing.endDate;
  const workersValue = workers ?? (existing.totalWorkers?.toString() ?? "");

  async function submit() {
    if (saving || nameValue.trim().length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await update(lookAheadId, {
        name: nameValue.trim(),
        startDate: startValue,
        endDate: endValue,
        totalWorkers: Number.parseInt(workersValue, 10) || null,
      });
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this look-ahead.");
    }
  }

  return (
    <View className="gap-5">
      {error ? (
        <Text tone="danger" className="text-[13px]">
          {error}
        </Text>
      ) : null}

      <Field label="Name" value={nameValue} onChangeText={setName} />
      <View className="flex-row gap-3">
        <Field label="Start" value={startValue} onChangeText={setStartDate} placeholder="YYYY-MM-DD" autoCapitalize="none" className="flex-1" />
        <Field label="End" value={endValue} onChangeText={setEndDate} placeholder="YYYY-MM-DD" autoCapitalize="none" className="flex-1" />
      </View>
      <Field label="Total crew" value={workersValue} onChangeText={setWorkers} keyboardType="number-pad" />

      <Button onPress={submit} loading={saving} disabled={nameValue.trim().length === 0}>
        Save changes
      </Button>
    </View>
  );
}

export default function EditLookAhead() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page title="Edit look-ahead" onBack={() => router.back()}>
      {ready && db && projectId && id ? (
        <Editor db={db} projectId={projectId} lookAheadId={id} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}
    </Page>
  );
}
