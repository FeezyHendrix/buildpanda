import { goBack } from "@/lib/navigation";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, View } from "react-native";
import { canRecordDelivery, materialOrderStatusLabel } from "@/api/materials";
import { Button, Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { MaterialApprovalStatusBadge } from "@/components/molecules/material-approval-status";
import { Page } from "@/components/molecules/page";
import { ABSENT_VALUE } from "@/components/molecules/schedule/detail-fields";
import { ICON_FAINT } from "@/constants/colors";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useDeleteMaterialOrder, useLocalMaterialOrder } from "@/hooks/use-local-materials";
import { useProjectAccess } from "@/hooks/use-project-access";
import { isApprovalStatus } from "@/api/material-approvals";
import { formatDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";

const qty = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

/** The sign-off this order relies on, or a plain note that there is none. */
function ApprovalLink({ approvalId, title, status }: { approvalId: string | null; title: string | null; status: string | null }) {
  if (!approvalId) {
    return (
      <View className="rounded-xl bg-surface-alt px-4 py-3">
        <Text tone="secondary" className="text-[13px]">No material approval covers this material.</Text>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/tools/material-approvals/${approvalId}` as never)}
      className="min-h-14 flex-row items-center gap-3 rounded-xl border border-hairline bg-white px-4 py-3 active:bg-surface-alt"
    >
      <View className="min-w-0 flex-1">
        <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Material approval</Text>
        <Text weight="semibold" className="pt-0.5 text-[15px]" numberOfLines={1}>{title ?? "View approval"}</Text>
      </View>
      {status && isApprovalStatus(status) ? <MaterialApprovalStatusBadge status={status} /> : null}
      <Ionicons name="chevron-forward" size={18} color={ICON_FAINT} />
    </Pressable>
  );
}

function MaterialDetail({ db, orderId }: { db: Db; orderId: string }) {
  const { data: order } = useLocalMaterialOrder(db, orderId);
  const { can } = useProjectAccess();

  if (!order) {
    return (
      <View className="items-center py-12">
        <Text tone="secondary" className="text-[13px]">This order may not have synced yet.</Text>
      </View>
    );
  }

  const receivable = canRecordDelivery(order.status) && !order.id.startsWith("local_");
  // Signing for goods books stock and cost, so it is the approver's act; the
  // crew logs what arrived and a manager accepts it onto the order.
  const canSign = can("materials", "approve");

  return (
    <View className="gap-5">
      <View className="flex-row flex-wrap items-center gap-2">
        <View className="rounded-full bg-surface-alt px-2.5 py-1">
          <Text weight="semibold" tone="secondary" className="text-[11px] uppercase">{materialOrderStatusLabel(order.status)}</Text>
        </View>
        {order.isPendingSync ? <PendingBadge /> : null}
      </View>

      <Text weight="bold" className="text-lg">{order.title || order.materialName}</Text>

      <ApprovalLink approvalId={order.approvalId} title={order.approvalTitle} status={order.approvalStatus} />

      <Card>
        <View className="border-b border-hairline px-4 py-3">
          <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Material</Text>
          <Text className="pt-0.5 text-[15px]">{order.materialName}</Text>
        </View>
        <View className="flex-row border-b border-hairline">
          <View className="flex-1 border-r border-hairline px-4 py-3">
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Ordered</Text>
            <Text className="pt-0.5 text-[15px]">{qty(order.quantity)} {order.unit}</Text>
          </View>
          <View className="flex-1 px-4 py-3">
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Delivered</Text>
            <Text className="pt-0.5 text-[15px]">{qty(order.deliveredQuantity)} of {qty(order.quantity)}</Text>
            {order.pendingDeliveryQty > 0 ? (
              <Text tone="secondary" className="text-xs">{qty(order.pendingDeliveryQty)} waiting to upload</Text>
            ) : null}
          </View>
        </View>
        <View className="flex-row">
          <View className="flex-1 border-r border-hairline px-4 py-3">
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Supplier</Text>
            <Text className="pt-0.5 text-[15px]">{order.supplier || ABSENT_VALUE}</Text>
          </View>
          <View className="flex-1 px-4 py-3">
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Needed by</Text>
            <Text className="pt-0.5 text-[15px]">{formatDate(order.neededBy) || ABSENT_VALUE}</Text>
          </View>
        </View>
      </Card>

      {receivable && canSign ? (
        <Button onPress={() => router.push(`/tools/materials/deliver/${order.id}` as never)}>Record a delivery</Button>
      ) : receivable && can("materials", "request") ? (
        <View className="gap-2">
          <Button variant="secondary" onPress={() => router.push(`/tools/material-log/new?orderId=${order.id}` as never)}>
            Log a delivery
          </Button>
          <Text tone="secondary" className="text-center text-xs">A manager approves it before it counts against this order.</Text>
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
          void removeRecord(id).then(() => goBack()).catch((error: unknown) => {
            Alert.alert("Could not delete this record", error instanceof Error ? error.message : "Please try again.");
          });
        },
      },
    ]);
  }

  return (
    <Page
      title="Material order"
      onBack={() => goBack()}
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
        <MaterialDetail db={db} orderId={id} />
      ) : (
        <View className="items-center py-12"><Spinner size="md" /></View>
      )}
    </Page>
  );
}
