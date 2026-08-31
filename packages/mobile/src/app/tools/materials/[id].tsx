import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { materialsRepository, toMaterialOrder } from "@/db/materials-repository";
import { useLocalDb } from "@/db/provider";
import { useFieldSession } from "@/lib/field-session";

function MaterialDetail({ db, projectId, orderId }: { db: Db; projectId: string; orderId: string }) {
  const query = useMemo(() => materialsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);
  const order = useMemo(() => (live.data ?? []).map(toMaterialOrder).find((r) => r.id === orderId), [live.data, orderId]);

  if (!order) {
    return (
      <View className="items-center py-12">
        <Text tone="secondary" className="text-[13px]">This order may not have synced yet.</Text>
      </View>
    );
  }

  return (
    <View className="gap-5">
      <View className="flex-row flex-wrap items-center gap-2">
        <View className="rounded-full bg-surface-alt px-2.5 py-1">
          <Text weight="semibold" tone="secondary" className="text-[11px] uppercase">{order.status}</Text>
        </View>
        {order.isPendingSync ? (
          <View className="flex-row items-center gap-1 rounded-full bg-surface-alt px-2 py-1">
            <Ionicons name="cloud-upload-outline" size={12} color="#717171" />
            <Text weight="semibold" tone="secondary" className="text-[10px] uppercase">Pending</Text>
          </View>
        ) : null}
      </View>

      <Text weight="bold" className="text-lg">{order.title || order.materialName}</Text>

      <Card>
        <View className="border-b border-hairline px-4 py-3">
          <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Material</Text>
          <Text className="pt-0.5 text-[15px]">{order.materialName}</Text>
        </View>
        <View className="flex-row border-b border-hairline">
          <View className="flex-1 border-r border-hairline px-4 py-3">
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Quantity</Text>
            <Text className="pt-0.5 text-[15px]">{order.quantity} {order.unit}</Text>
          </View>
          <View className="flex-1 px-4 py-3">
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Supplier</Text>
            <Text className="pt-0.5 text-[15px]">{order.supplier ?? "Not specified"}</Text>
          </View>
        </View>
      </Card>
    </View>
  );
}

export default function MaterialOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page title="Material Order" onBack={() => router.back()}>
      {ready && db && projectId && id ? (
        <MaterialDetail db={db} projectId={projectId} orderId={id} />
      ) : (
        <View className="items-center py-12"><Spinner size="md" /></View>
      )}
    </Page>
  );
}
