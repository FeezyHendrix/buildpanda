import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { KpiCard } from "@/components/molecules/kpi-card";
import { ReasonDialog } from "@/components/molecules/reason-dialog";
import {
  useCancelPurchaseOrder,
  useClosePurchaseOrder,
  useCreatePurchaseOrder,
  useDeletePurchaseOrder,
  useIssuePurchaseOrder,
  usePurchaseOrders,
  useReceivePurchaseOrder,
  useUpdatePurchaseOrder,
  type PurchaseOrder,
  type ReceivePurchaseOrderInput,
} from "@/hooks/use-purchase-orders";
import { useProjectContext } from "@/layouts/project-layout";
import { errorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { TabActions } from "./finance-tabs";
import { PurchaseOrderDrawer } from "./purchase-orders/purchase-order-drawer";
import { PurchaseOrdersTable } from "./purchase-orders/purchase-orders-table";
import { ReceivePurchaseOrderDialog } from "./purchase-orders/receive-purchase-order-dialog";
import {
  committedTotal,
  receivedTotal,
  toInput,
  toValues,
  type PurchaseOrderAction,
  type UpsertPurchaseOrderValues,
} from "./purchase-orders/purchase-order-model";
import { UpsertPurchaseOrderDialog } from "./purchase-orders/upsert-purchase-order-dialog";

type PoDialog =
  | { kind: "create" }
  | { kind: "edit"; purchaseOrder: PurchaseOrder }
  | { kind: "detail"; purchaseOrder: PurchaseOrder }
  | { kind: "receive"; purchaseOrder: PurchaseOrder }
  | { kind: "cancel"; purchaseOrder: PurchaseOrder }
  | { kind: "delete"; purchaseOrder: PurchaseOrder }
  | null;

/** Purchase orders — vendor POs that become committed spend once they are issued. */
export function PurchaseOrdersTab() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const currency = project.currency;
  const { data: purchaseOrders = [], isPending } = usePurchaseOrders(project.id);

  const [dialog, setDialog] = useState<PoDialog>(null);
  const [busyAction, setBusyAction] = useState<PurchaseOrderAction | null>(null);

  const createPurchaseOrder = useCreatePurchaseOrder();
  const updatePurchaseOrder = useUpdatePurchaseOrder();
  const deletePurchaseOrder = useDeletePurchaseOrder();
  const issuePurchaseOrder = useIssuePurchaseOrder();
  const receivePurchaseOrder = useReceivePurchaseOrder();
  const cancelPurchaseOrder = useCancelPurchaseOrder();
  const closePurchaseOrder = useClosePurchaseOrder();

  // Both figures are the server's: `committed` and `receivedTotal` are decided
  // by the API, so the page never re-derives which statuses count.
  const committed = committedTotal(purchaseOrders);
  const received = receivedTotal(purchaseOrders);
  const open = purchaseOrders
    .filter((po) => po.status === "Issued" || po.status === "PartiallyReceived")
    .reduce((sum, po) => sum + po.total, 0);

  function close(): void {
    setDialog(null);
  }

  function upsert(values: UpsertPurchaseOrderValues): void {
    if (dialog?.kind === "edit") {
      updatePurchaseOrder.mutate(
        { projectId: project.id, purchaseOrderId: dialog.purchaseOrder.id, ...toInput(values) },
        { onSuccess: close, onError: (error) => toast(errorMessage(error)) },
      );
      return;
    }
    createPurchaseOrder.mutate(
      { projectId: project.id, ...toInput(values) },
      { onSuccess: close },
    );
  }

  function runAction(purchaseOrder: PurchaseOrder, action: PurchaseOrderAction): void {
    if (action === "receive") {
      setDialog({ kind: "receive", purchaseOrder });
      return;
    }
    if (action === "cancel") {
      setDialog({ kind: "cancel", purchaseOrder });
      return;
    }
    const variables = { projectId: project.id, purchaseOrderId: purchaseOrder.id };
    const options = {
      onSuccess: () => {
        setBusyAction(null);
        toast(action === "issue" ? "Purchase order issued" : "Purchase order closed", "success");
      },
      onError: (error: unknown) => {
        setBusyAction(null);
        toast(errorMessage(error));
      },
    };
    setBusyAction(action);
    if (action === "issue") issuePurchaseOrder.mutate(variables, options);
    else closePurchaseOrder.mutate(variables, options);
  }

  function receive(values: ReceivePurchaseOrderInput): void {
    if (dialog?.kind !== "receive") return;
    receivePurchaseOrder.mutate(
      { projectId: project.id, purchaseOrderId: dialog.purchaseOrder.id, ...values },
      {
        onSuccess: (purchaseOrder) => {
          close();
          toast(
            purchaseOrder.overReceipt
              ? "Receipt recorded — flagged as an over-receipt."
              : "Receipt recorded",
            "success",
          );
        },
      },
    );
  }

  const isUpsert = dialog?.kind === "create" || dialog?.kind === "edit";
  const upsertError = dialog?.kind === "edit" ? updatePurchaseOrder.error : createPurchaseOrder.error;

  return (
    <section aria-label="Purchase orders">
      <TabActions>
        {canManage ? (
          <Button variant="primary" size="md" onClick={() => setDialog({ kind: "create" })}>
            <PlusIcon className="size-4" />
            New purchase order
          </Button>
        ) : null}
      </TabActions>

      <section aria-label="Purchase order summary" className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Committed spend"
          value={formatCurrency(committed, currency)}
          helper="Issued onward — drafts and cancelled POs excluded"
        />
        <KpiCard label="Open POs" value={formatCurrency(open, currency)} />
        <KpiCard label="Received value" value={formatCurrency(received, currency)} />
      </section>

      <PurchaseOrdersTable
        purchaseOrders={purchaseOrders}
        isPending={isPending}
        canManage={canManage}
        currency={currency}
        onCreate={() => setDialog({ kind: "create" })}
        onOpen={(purchaseOrder) => setDialog({ kind: "detail", purchaseOrder })}
        onEdit={(purchaseOrder) => setDialog({ kind: "edit", purchaseOrder })}
        onDelete={(purchaseOrder) => setDialog({ kind: "delete", purchaseOrder })}
        onAction={runAction}
      />

      <UpsertPurchaseOrderDialog
        projectId={project.id}
        open={isUpsert}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        mode={dialog?.kind === "edit" ? "edit" : "create"}
        initial={dialog?.kind === "edit" ? toValues(dialog.purchaseOrder) : undefined}
        onSubmit={upsert}
        isSubmitting={createPurchaseOrder.isPending || updatePurchaseOrder.isPending}
        error={upsertError ? errorMessage(upsertError) : null}
        currency={currency}
      />

      {dialog?.kind === "detail" ? (
        <PurchaseOrderDrawer
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          purchaseOrder={dialog.purchaseOrder}
          currency={currency}
          canManage={canManage}
          busyAction={busyAction}
          onEdit={() => setDialog({ kind: "edit", purchaseOrder: dialog.purchaseOrder })}
          onAction={(action) => runAction(dialog.purchaseOrder, action)}
        />
      ) : null}

      {dialog?.kind === "receive" ? (
        <ReceivePurchaseOrderDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          purchaseOrder={dialog.purchaseOrder}
          currency={currency}
          onSubmit={receive}
          isSubmitting={receivePurchaseOrder.isPending}
          error={receivePurchaseOrder.error ? errorMessage(receivePurchaseOrder.error) : null}
        />
      ) : null}

      {dialog?.kind === "cancel" ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          title="Cancel this purchase order?"
          description="The PO stays on file as cancelled with your reason, and stops counting as committed spend. It cannot be un-cancelled."
          label="Why is it being cancelled?"
          placeholder="Raised in error, vendor changed, order superseded…"
          submitLabel="Cancel PO"
          isSubmitting={cancelPurchaseOrder.isPending}
          error={cancelPurchaseOrder.error ? errorMessage(cancelPurchaseOrder.error) : null}
          onSubmit={(reason) =>
            cancelPurchaseOrder.mutate(
              { projectId: project.id, purchaseOrderId: dialog.purchaseOrder.id, reason },
              {
                onSuccess: () => {
                  close();
                  toast("Purchase order cancelled", "success");
                },
              },
            )
          }
        />
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title="Delete this draft PO?"
        description="Only a draft can be deleted. An issued PO is cancelled with a reason so the record survives."
        confirmLabel="Delete"
        variant="danger"
        loading={deletePurchaseOrder.isPending}
        onConfirm={() => {
          if (dialog?.kind !== "delete") return;
          deletePurchaseOrder.mutate(
            { projectId: project.id, purchaseOrderId: dialog.purchaseOrder.id },
            { onSuccess: close, onError: (error) => toast(errorMessage(error)) },
          );
        }}
      />
    </section>
  );
}

PurchaseOrdersTab.displayName = "PurchaseOrdersTab";
