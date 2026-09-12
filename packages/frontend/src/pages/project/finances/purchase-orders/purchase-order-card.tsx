import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  useDeletePurchaseOrder,
  useUpdatePurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from "@/hooks/use-purchase-orders";
import { formatCurrency } from "@/lib/formatters";
import { PoMetric } from "./po-metric";
import { PO_STATUS_TONE, toInput, toValues, type UpsertPurchaseOrderValues } from "./purchase-order-model";
import { UpsertPurchaseOrderDialog } from "./upsert-purchase-order-dialog";

function LineItem({ item, currency }: { item: PurchaseOrderItem; currency: string }) {
  return (
    <div className="grid gap-2 rounded-xl bg-[#FAFAFA] px-3 py-2 text-sm sm:grid-cols-[1fr_96px_132px_132px] sm:items-center">
      <span className="font-medium text-gray-900">{item.description}</span>
      <span className="text-gray-500 tabular-nums">Qty {item.quantity}</span>
      <span className="text-gray-500 tabular-nums">{formatCurrency(item.unitPrice, currency)}</span>
      <span className="font-semibold text-gray-900 tabular-nums sm:text-right">
        {formatCurrency(item.lineTotal, currency)}
      </span>
    </div>
  );
}

export function PurchaseOrderCard({
  purchaseOrder,
  projectId,
  currency,
  canManage,
}: {
  purchaseOrder: PurchaseOrder;
  projectId: string;
  currency: string;
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const updatePurchaseOrder = useUpdatePurchaseOrder();
  const deletePurchaseOrder = useDeletePurchaseOrder();

  function handleEdit(values: UpsertPurchaseOrderValues): void {
    updatePurchaseOrder.mutate(
      { projectId, purchaseOrderId: purchaseOrder.id, ...toInput(values) },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-gray-900">{purchaseOrder.vendorName}</p>
            <Badge tone={PO_STATUS_TONE[purchaseOrder.status]} size="md">
              {purchaseOrder.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {purchaseOrder.poNumber}
            {purchaseOrder.orderDate ? ` · Ordered ${purchaseOrder.orderDate}` : ""}
            {purchaseOrder.expectedDate ? ` · Expected ${purchaseOrder.expectedDate}` : ""}
            {purchaseOrder.stageName ? ` · Stage: ${purchaseOrder.stageName}` : ""}
          </p>
        </div>
        {canManage ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>Delete</Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <PoMetric label="Committed spend" value={formatCurrency(purchaseOrder.total, currency)} accent />
        <PoMetric label="Line items" value={String(purchaseOrder.items.length)} />
        <PoMetric label="Status" value={purchaseOrder.status} />
      </div>

      {purchaseOrder.notes ? <p className="text-sm text-gray-600 text-pretty">{purchaseOrder.notes}</p> : null}

      <div className="flex flex-col gap-2 border-t border-[#F0F0F0] pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Line items</p>
        {purchaseOrder.items.map((item) => (
          <LineItem key={item.id} item={item} currency={currency} />
        ))}
      </div>

      <UpsertPurchaseOrderDialog
        projectId={projectId}
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={toValues(purchaseOrder)}
        onSubmit={handleEdit}
        isSubmitting={updatePurchaseOrder.isPending}
        error={(updatePurchaseOrder.error as Error | undefined)?.message ?? null}
        currency={currency}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete purchase order?"
        description="This will remove the PO and all of its line items. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deletePurchaseOrder.isPending}
        onConfirm={() =>
          deletePurchaseOrder.mutate(
            { projectId, purchaseOrderId: purchaseOrder.id },
            { onSuccess: () => setDeleteOpen(false) },
          )
        }
      />
    </Card>
  );
}

PurchaseOrderCard.displayName = "PurchaseOrderCard";
