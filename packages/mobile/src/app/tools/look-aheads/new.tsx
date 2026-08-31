import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Field, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { todayIso } from "@/db/daily-logs-repository";
import { useLocalDb } from "@/db/provider";
import { useCreateLookAhead } from "@/hooks/use-local-look-aheads";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function NewLookAhead() {
  const { projectId } = useFieldSession();
  const { db } = useLocalDb();
  const create = useCreateLookAhead(db, projectId);
  const { isOnline } = useSyncState();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(plusDays(todayIso(), 14));
  const [workers, setWorkers] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await create({
        name: name.trim(),
        startDate,
        endDate,
        totalWorkers: Number.parseInt(workers, 10) || null,
      });
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this look-ahead.");
    }
  }

  return (
    <Page
      title="New look-ahead"
      onBack={() => router.back()}
      footer={
        <Button onPress={submit} disabled={!canSubmit} loading={saving}>
          Create look-ahead
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

      <View className="gap-5">
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Weeks 12–13" autoFocus />
        <View className="flex-row gap-3">
          <Field label="Start" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" autoCapitalize="none" className="flex-1" />
          <Field label="End" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" autoCapitalize="none" className="flex-1" />
        </View>
        <Field label="Total crew" value={workers} onChangeText={setWorkers} keyboardType="number-pad" />
      </View>
    </Page>
  );
}
