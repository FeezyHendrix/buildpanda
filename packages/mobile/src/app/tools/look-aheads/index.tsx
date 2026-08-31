import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Card, Spinner, Text } from "@/components/atoms";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useLocalLookAheads } from "@/hooks/use-local-look-aheads";
import { useFieldSession } from "@/lib/field-session";

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function List({ db, projectId }: { db: Db; projectId: string }) {
  const { data, isPending } = useLocalLookAheads(db, projectId);

  if (isPending) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View className="items-center py-12">
        <Text weight="semibold" className="text-center text-base">
          No look-aheads
        </Text>
        <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
          Plan the next window of work with the crew.
        </Text>
      </View>
    );
  }

  return (
    <Card>
      {data.map((row) => (
        <View
          key={row.id}
          className="min-h-16 flex-row items-center gap-3 border-b border-hairline px-4 py-3"
        >
          <View className="min-w-0 flex-1">
            <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
              {row.name}
            </Text>
            <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>
              {row.status} · {row.startDate} → {row.endDate}
              {row.totalWorkers ? ` · ${row.totalWorkers} crew` : ""}
            </Text>
          </View>
          {row.isPendingSync ? (
            <Ionicons name="cloud-upload-outline" size={16} color="#717171" />
          ) : null}
        </View>
      ))}
    </Card>
  );
}

export default function LookAheads() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page
      title="Look Aheads"
      onBack={() => router.back()}
      rightButtons={
        <HeaderIconButton icon="add" label="New look-ahead" onPress={() => router.push("/tools/look-aheads/new")} />
      }
    >
      {ready && db && projectId ? (
        <List db={db} projectId={projectId} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}

    </Page>
  );
}
