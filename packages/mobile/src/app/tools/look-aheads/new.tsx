import { isIsoDate, localIsoDate } from "@/lib/dates";
import { goBack } from "@/lib/navigation";

import { useState } from "react";
import { View } from "react-native";
import { Button, Field, Text } from "@/components/atoms";
import { ActivityChecklist } from "@/components/molecules/activity-checklist";
import { Page } from "@/components/molecules/page";
import { todayIso } from "@/db/daily-logs-repository";
import { useLocalDb } from "@/db/provider";
import { useActivities } from "@/hooks/use-activities";
import { useCreateLookAhead } from "@/hooks/use-local-look-aheads";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

function NewLookAheadForm() {
  const { projectId } = useFieldSession();
  const { db } = useLocalDb();
  const create = useCreateLookAhead(db, projectId);
  const { isOnline } = useSyncState();
  const activities = useActivities(projectId);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(plusDays(todayIso(), 14));
  const [workers, setWorkers] = useState("");
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { buildingId } = useProjectBuilding();

  const workersNumber = workers.trim() === "" ? null : Number(workers);
  const workersValid = workersNumber === null || (Number.isInteger(workersNumber) && workersNumber >= 0);
  const datesValid = isIsoDate(startDate.trim()) && isIsoDate(endDate.trim()) && endDate.trim() >= startDate.trim();
  const canSubmit = Boolean(buildingId) && name.trim().length > 0 && workersValid && datesValid && !saving;

  function toggleActivity(activityId: string) {
    setActivityIds((prev) =>
      prev.includes(activityId) ? prev.filter((id) => id !== activityId) : [...prev, activityId],
    );
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await create({
        name: name.trim(),
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        totalWorkers: workersNumber,
        buildingId,
        activityIds,
      });
      goBack();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save this look ahead.");
    }
  }

  return (
    <Page
      buildingScope
      title="New look ahead"
      onBack={() => goBack()}
      footer={
        <Button onPress={submit} disabled={!canSubmit} loading={saving}>
          Create look ahead
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
        {!datesValid ? <Text tone="danger" className="text-sm">Use YYYY-MM-DD dates, with the end on or after the start.</Text> : null}
        {!workersValid ? <Text tone="danger" className="text-sm">Enter a whole number of crew members, zero or more.</Text> : null}
        <Field label="Total crew" value={workers} onChangeText={setWorkers} keyboardType="number-pad" />
        <ActivityChecklist
          activities={activities.data ?? []}
          selectedIds={activityIds}
          onToggle={toggleActivity}
          isLoading={activities.isPending}
        />
      </View>


    </Page>
  );
}

export default function NewLookAhead() {
  const { projectId } = useFieldSession();
  const { buildingId } = useProjectBuilding();
  return <NewLookAheadForm key={`${projectId}:${buildingId}`} />;
}
