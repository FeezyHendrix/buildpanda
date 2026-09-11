import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { canRecordDelivery, materialOrderStatusLabel, type MaterialOrderStatus } from "@/api/materials";
import { Button, Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import { ABSENT_VALUE } from "@/components/molecules/schedule/detail-fields";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useDeleteMaterialOrder, useLocalMaterialOrder, useSetMaterialOrderStatus } from "@/hooks/use-local-materials";
import { formatDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";

const DELIVERY_ACTIONS: { status: MaterialOrderStatus; label: string; prompt: string }[] = [
  {
    status: "Delivered",
    label: "Mark delivered",
    prompt: "This records that the full order arrived on site. The office sees it at once.",
  },
  {
    status: "PartiallyDelivered",
    label: "Partially delivered",
    prompt: "This records that some of the order arrived on site. The rest stays outstanding.",
  },
];

function MaterialDetail({ db, projectId, orderId }: { db: Db; projectId: string; orderId: string }) {
  const { data: order } = useLocalMaterialOrder(db, orderId);
  const setStatus = useSetMaterialOrderStatus(db, projectId);
  const [busy, setBusy] = useState<MaterialOrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A delivery is a contractual record the office acts on, so it is confirmed
  // rather than recorded on a single stray tap.
  function confirmDelivery(action: (typeof DELIVERY_ACTIONS)[number]) {
    Alert.alert(`${action.label}?`, action.prompt, [
      { text: "Cancel", style: "cancel" },
      {
        text: action.label,
        onPress: () => {
          setBusy(action.status);
          setError(null);
          void setStatus(orderId, action.status)
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Could not record this delivery.");
            })
            .finally(() => setBusy(null));
        },
      },
    ]);
  }

  if (!order) {
    return (
      <View className="items-center py-12">
        <Text tone="secondary" className="text-[13px]">This order may not have synced yet.</Text>
      </View>
    );
  }

  // Only a full delivery is offered once part of the order has already landed.
  const actions = DELIVERY_ACTIONS.filter((action) => action.status !== order.status);

  return (
    <View className="gap-5">
      <View className="flex-row flex-wrap items-center gap-2">
        <View className="rounded-full bg-surface-alt px-2.5 py-1">
          <Text weight="semibold" tone="secondary" className="text-[11px] uppercase">{materialOrderStatusLabel(order.status)}</Text>
        </View>
        {order.isPendingSync ? <PendingBadge /> : null}
      </View>

      <Text weight="bold" className="text-lg">{order.title || order.materialName}</Text>

      {error ? (
        <View className="rounded-xl bg-error-50 px-4 py-3">
          <Text tone="danger" className="text-sm">{error}</Text>
        </View>
      ) : null}

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
            <Text className="pt-0.5 text-[15px]">{order.supplier || ABSENT_VALUE}</Text>
          </View>
        </View>
        <View className="px-4 py-3">
          <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Needed by</Text>
          <Text className="pt-0.5 text-[15px]">{formatDate(order.neededBy) || ABSENT_VALUE}</Text>
        </View>
      </Card>

      {canRecordDelivery(order.status) ? (
        <View className="gap-3">
          <Text weight="semibold" tone="secondary" className="text-xs uppercase tracking-wide">Record a delivery</Text>
          {actions.map((action, index) => (
            <Button
              key={action.status}
              variant={index === 0 ? "primary" : "secondary"}
              onPress={() => confirmDelivery(action)}
              loading={busy === action.status}
              disabled={busy !== null}
            >
              {action.label}
            </Button>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function MaterialOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const removeRecord = useDeleteMaterialOrder(db, projectId);

  // Native confirm: deleting a site record is destructive and the app has no
  // undo, so it must not happen on a single stray tap.
  function confirmDelete() {
    if (!id) return;
    Alert.alert("Delete this order?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void removeRecord(id).then(() => router.back()).catch(() => undefined);
        },
      },
    ]);
  }

  return (
    <Page
      title="Material order"
      onBack={() => router.back()}
      rightButtons={
        id ? (
          <>
            <HeaderIconButton icon="create-outline" label="Edit material order" onPress={() => router.push(`/tools/materials/edit/${id}` as never)} />
            <HeaderIconButton icon="trash-outline" label="Delete material order" onPress={confirmDelete} />
          </>
        ) : null
      }
    >
      {ready && db && projectId && id ? (
        <MaterialDetail db={db} projectId={projectId} orderId={id} />
      ) : (
        <View className="items-center py-12"><Spinner size="md" /></View>
      )}
    </Page>
  );
}
