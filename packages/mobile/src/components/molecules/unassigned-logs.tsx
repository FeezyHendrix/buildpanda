import { useMemo, useState } from "react";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { View } from "react-native";
import { Button, Card, Text } from "@/components/atoms";
import type { Db } from "@/db/client";
import { unassignedLogsRepository as repository } from "@/db/unassigned-logs-repository";
import { flushOutbox } from "@/db/outbox";
import { useProjectBuilding } from "@/hooks/use-project-building";

export function UnassignedLogs({ db, projectId }: { db: Db; projectId: string }) {
  const { buildingId, building } = useProjectBuilding();
  const daysQuery = useMemo(() => repository.daysQuery(db, projectId), [db, projectId]);
  const entriesQuery = useMemo(() => repository.entriesQuery(db, projectId), [db, projectId]);
  const days = (useLiveQuery(daysQuery, [daysQuery]).data ?? []).filter((row) => row.projectId === projectId);
  const entries = (useLiveQuery(entriesQuery, [entriesQuery]).data ?? []).filter((row) => row.projectId === projectId);
  const dates = [...new Set([...days, ...entries].map((row) => row.logDate))];
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!buildingId || dates.length === 0) return null;

  async function assign(date: string) {
    if (!buildingId || saving) return;
    setError(null);
    setSaving(true);
    try {
      await repository.assign(db, projectId, date, buildingId);
      void flushOutbox(db).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign this log.");
    } finally { setSaving(false); }
  }

  return (
    <Card className="mb-4 gap-3 p-4">
      <Text weight="bold">Older logs need a building</Text>
      <Text tone="secondary" className="text-sm">Review these unsynced records and assign them to the building they belong to.</Text>
      {dates.map((date) => {
        const day = days.find((row) => row.logDate === date);
        return (
          <View key={date} className="gap-2 border-t border-hairline pt-3">
            <Text weight="semibold">{date}</Text>
            {day ? <Text>{day.totalHours}h · {day.summary || "Daily conditions"}</Text> : null}
            {entries.filter((row) => row.logDate === date).map((entry) => <Text key={entry.id}>{entry.bodyText}</Text>)}
            <Button disabled={saving} onPress={() => void assign(date)}>{`Assign to ${building?.name ?? "selected building"}`}</Button>
          </View>
        );
      })}
      {error ? <Text tone="danger">{error}</Text> : null}
    </Card>
  );
}
