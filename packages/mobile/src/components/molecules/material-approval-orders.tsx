import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Button, Card, Text } from "@/components/atoms";
import { materialOrderStatusLabel } from "@/api/materials";
import { ICON_FAINT } from "@/constants/colors";
import type { Db } from "@/db/client";
import type { LocalMaterialApproval } from "@/db/material-approvals-repository";
import { useLocalMaterialOrders } from "@/hooks/use-local-materials";
import { useProjectAccess } from "@/hooks/use-project-access";

const qty = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

/** The order form's query string, filled in from the approved request. */
function orderFromApproval(approval: LocalMaterialApproval): string {
  const params = new URLSearchParams({
    approvalId: approval.id,
    approvalTitle: approval.title,
    materialName: approval.materialName,
    quantity: String(approval.quantity),
    unit: approval.unit,
    ...(approval.supplier ? { supplier: approval.supplier } : {}),
    ...(approval.neededBy ? { neededBy: approval.neededBy.slice(0, 10) } : {}),
    ...(approval.phaseId ? { stageId: approval.phaseId } : {}),
  });
  return `/tools/materials/new?${params.toString()}`;
}

/**
 * What became of a sign-off on site: the orders placed against it and how
 * much has arrived. An approved request offers to raise its order.
 */
export function MaterialApprovalOrders({ db, projectId, approval }: { db: Db; projectId: string; approval: LocalMaterialApproval }) {
  const { data: orders } = useLocalMaterialOrders(db, projectId, false);
  const { can } = useProjectAccess();
  const linked = orders.filter((order) => order.approvalId === approval.id);
  const approved = approval.status === "Approved";

  if (linked.length === 0 && !approved) return null;

  return (
    <View className="gap-2">
      <Text weight="semibold" tone="secondary" className="text-xs uppercase tracking-wide">Orders</Text>
      {linked.length > 0 ? (
        <Card>
          {linked.map((order, index) => (
            <Pressable
              key={order.id}
              accessibilityRole="button"
              onPress={() => router.push(`/tools/materials/${order.id}` as never)}
              className={`min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-surface-alt ${index === 0 ? "" : "border-t border-hairline"}`}
            >
              <View className="min-w-0 flex-1">
                <Text weight="semibold" className="text-[15px]" numberOfLines={1}>{order.title || order.materialName}</Text>
                <Text tone="secondary" className="text-xs">
                  {qty(order.deliveredQuantity)} of {qty(order.quantity)} {order.unit} delivered · {materialOrderStatusLabel(order.status)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ICON_FAINT} />
            </Pressable>
          ))}
        </Card>
      ) : (
        <Text tone="secondary" className="text-[13px]">Nothing has been ordered against this approval yet.</Text>
      )}
      {approved && can("materials", "request") ? (
        <Button variant="secondary" onPress={() => router.push(orderFromApproval(approval) as never)}>
          Order this material
        </Button>
      ) : null}
    </View>
  );
}

MaterialApprovalOrders.displayName = "MaterialApprovalOrders";
