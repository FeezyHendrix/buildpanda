import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { lookAheadsRepository, toLookAhead } from "@/db/look-aheads-repository";
import { useLocalDb } from "@/db/provider";
import { useFieldSession } from "@/lib/field-session";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, { bg: string; text: string }> = {
  Draft: { bg: "bg-grey-50", text: "text-grey-500" },
  UnderReview: { bg: "bg-[#FFF3DE]", text: "text-[#8E6B00]" },
  Approved: { bg: "bg-success-50", text: "text-success-700" },
};

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function LookAheadDetail({ db, projectId, lookAheadId }: { db: Db; projectId: string; lookAheadId: string }) {
  const query = useMemo(() => lookAheadsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);
  const la = useMemo(() => (live.data ?? []).map(toLookAhead).find((r) => r.id === lookAheadId), [live.data, lookAheadId]);

  if (!la) {
    return (
      <View className="items-center py-12">
        <Text tone="secondary" className="text-[13px]">This look-ahead may not have synced yet.</Text>
      </View>
    );
  }

  const tone = STATUS_TONE[la.status] ?? STATUS_TONE.Draft;

  return (
    <View className="gap-5">
      <View className="flex-row flex-wrap items-center gap-2">
        <View className={cn("rounded-full px-2.5 py-1", tone.bg)}>
          <Text weight="semibold" className={cn("text-[11px] uppercase", tone.text)}>{la.status}</Text>
        </View>
        {la.isPendingSync ? (
          <View className="flex-row items-center gap-1 rounded-full bg-surface-alt px-2 py-1">
            <Ionicons name="cloud-upload-outline" size={12} color="#717171" />
            <Text weight="semibold" tone="secondary" className="text-[10px] uppercase">Pending</Text>
          </View>
        ) : null}
      </View>

      <Text weight="bold" className="text-lg">{la.name}</Text>

      {la.description ? (
        <Text tone="secondary" className="text-[14px] leading-5">{la.description}</Text>
      ) : null}

      <Card>
        <View className="flex-row border-b border-hairline">
          <View className="flex-1 border-r border-hairline px-4 py-3">
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Start</Text>
            <Text className="pt-0.5 text-[15px]">{dayLabel(la.startDate)}</Text>
          </View>
          <View className="flex-1 px-4 py-3">
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">End</Text>
            <Text className="pt-0.5 text-[15px]">{dayLabel(la.endDate)}</Text>
          </View>
        </View>
        {la.totalWorkers ? (
          <View className="px-4 py-3">
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Total crew</Text>
            <Text className="pt-0.5 text-[15px]">{la.totalWorkers} workers</Text>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

export default function LookAheadDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page
      title="Look Ahead"
      onBack={() => router.back()}
      rightButtons={
        id ? (
          <Pressable
            onPress={() => router.push(`/tools/look-aheads/edit/${id}` as never)}
            accessibilityRole="button"
            accessibilityLabel="Edit look-ahead"
            className="h-11 w-11 items-center justify-center rounded-full active:bg-white/20"
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          </Pressable>
        ) : null
      }
    >
      {ready && db && projectId && id ? (
        <LookAheadDetail db={db} projectId={projectId} lookAheadId={id} />
      ) : (
        <View className="items-center py-12"><Spinner size="md" /></View>
      )}
    </Page>
  );
}
