import { useNavigate } from "react-router-dom";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { ReasonDialog } from "@/components/molecules/reason-dialog";
import {
  useCreateMaterialOrder,
  useDeleteMaterialOrder,
  useRecordDelivery,
  useUpdateMaterialOrder,
  type MaterialOrderInput,
  type RecordDeliveryInput,
} from "@/hooks/use-materials-equipment";
import { useRaisePurchaseOrderFromOrder } from "@/hooks/use-purchase-orders";
import { errorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import type { MaterialOrder } from "@/lib/project-types";
import { ForceOrderDialog } from "./force-order-dialog";
import { MaterialOrderDialog } from "./material-order-dialog";
import { MaterialOrderDrawer } from "./material-order-drawer";
import { RecordDeliveryDialog } from "./record-delivery-dialog";

/**
 * One dialog is open at a time, so the page holds one value rather than eight
 * booleans, and every mutation that a dialog owns lives here with it.
 */
export type OrderDialog =
  | { kind: "create" }
  | { kind: "edit"; order: MaterialOrder }
  | { kind: "delete"; order: MaterialOrder }
  | { kind: "detail"; order: MaterialOrder }
  | { kind: "delivery"; order: MaterialOrder }
  | { kind: "close"; order: MaterialOrder; status: "Cancelled" | "Rejected" }
  | { kind: "force"; order: MaterialOrder; message: string }
  | { kind: "purchase-order"; order: MaterialOrder }
  | null;

const CLOSE_COPY = {
  Cancelled: {
    title: "Cancel this order?",
    description:
      "The order stays on file as cancelled with your reason. Nothing is deleted, and the reason shows on the row.",
    label: "Why is it being cancelled?",
    placeholder: "Supplier could not deliver, scope dropped, duplicate request…",
    submitLabel: "Cancel order",
  },
  Rejected: {
    title: "Reject this order?",
    description:
      "Rejecting records the refusal against the supplier and keeps the request for the audit trail.",
    label: "Why is it being rejected?",
    placeholder: "CBR fail on the source sample, over budget, wrong specification…",
    submitLabel: "Reject order",
  },
} as const;

interface MaterialOrderDialogsProps {
  projectId: string;
  currency: string;
  dialog: OrderDialog;
  onClose: () => void;
}

export function MaterialOrderDialogs({
  projectId,
  currency,
  dialog,
  onClose,
}: MaterialOrderDialogsProps) {
  const navigate = useNavigate();
  const createOrder = useCreateMaterialOrder();
  const updateOrder = useUpdateMaterialOrder();
  const deleteOrder = useDeleteMaterialOrder();
  const recordDelivery = useRecordDelivery();
  const raisePurchaseOrder = useRaisePurchaseOrderFromOrder();

  function upsert(values: MaterialOrderInput): void {
    if (dialog?.kind === "edit") {
      updateOrder.mutate(
        { projectId, orderId: dialog.order.id, ...values },
        { onSuccess: onClose },
      );
      return;
    }
    createOrder.mutate({ projectId, ...values }, { onSuccess: onClose });
  }

  function close(reason: string): void {
    if (dialog?.kind !== "close") return;
    updateOrder.mutate(
      { projectId, orderId: dialog.order.id, status: dialog.status, reason },
      {
        onSuccess: () => {
          onClose();
          toast(dialog.status === "Cancelled" ? "Order cancelled" : "Order rejected", "success");
        },
      },
    );
  }

  function deliver(values: RecordDeliveryInput): void {
    if (dialog?.kind !== "delivery") return;
    recordDelivery.mutate(
      { projectId, orderId: dialog.order.id, ...values },
      {
        onSuccess: (order) => {
          onClose();
          toast(
            order.status === "Delivered"
              ? "Delivery recorded — the order is complete."
              : "Delivery recorded — stock and stage cost updated.",
            "success",
          );
        },
      },
    );
  }

  const isUpsert = dialog?.kind === "create" || dialog?.kind === "edit";

  return (
    <>
      <MaterialOrderDialog
        open={isUpsert}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        projectId={projectId}
        initial={dialog?.kind === "edit" ? dialog.order : null}
        onSubmit={upsert}
        isSubmitting={createOrder.isPending || updateOrder.isPending}
        error={
          dialog?.kind === "edit"
            ? updateOrder.error
              ? errorMessage(updateOrder.error)
              : null
            : createOrder.error
              ? errorMessage(createOrder.error)
              : null
        }
        currency={currency}
      />

      {dialog?.kind === "detail" ? (
        <MaterialOrderDrawer
          open
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
          projectId={projectId}
          order={dialog.order}
        />
      ) : null}

      {dialog?.kind === "delivery" ? (
        <RecordDeliveryDialog
          open
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
          projectId={projectId}
          order={dialog.order}
          onSubmit={deliver}
          isSubmitting={recordDelivery.isPending}
          error={recordDelivery.error ? errorMessage(recordDelivery.error) : null}
        />
      ) : null}

      {dialog?.kind === "close" ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
          {...CLOSE_COPY[dialog.status]}
          onSubmit={close}
          isSubmitting={updateOrder.isPending}
          error={updateOrder.error ? errorMessage(updateOrder.error) : null}
        />
      ) : null}

      {dialog?.kind === "force" ? (
        <ForceOrderDialog
          open
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
          order={dialog.order}
          serverMessage={dialog.message}
          isSubmitting={updateOrder.isPending}
          error={updateOrder.error ? errorMessage(updateOrder.error) : null}
          onSubmit={(forceNote) =>
            updateOrder.mutate(
              {
                projectId,
                orderId: dialog.order.id,
                status: "Ordered",
                force: true,
                forceNote,
              },
              {
                onSuccess: () => {
                  onClose();
                  toast("Ordered — the override is recorded on the order.", "success");
                },
              },
            )
          }
        />
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === "purchase-order"}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title="Raise a purchase order?"
        description="The PO copies this request's lines, supplier and stage. It is born Draft, and only counts as committed spend once you issue it."
        confirmLabel="Raise PO"
        loading={raisePurchaseOrder.isPending}
        onConfirm={() => {
          if (dialog?.kind !== "purchase-order") return;
          raisePurchaseOrder.mutate(
            { projectId, orderId: dialog.order.id },
            {
              onSuccess: (purchaseOrder) => {
                onClose();
                toast(`${purchaseOrder.poNumber} raised as a draft. Review it before issuing.`, "success");
                navigate(`/project/${projectId}/finances/expenses?tab=purchase-orders&po=${purchaseOrder.id}`);
              },
              onError: (error) => toast(errorMessage(error)),
            },
          );
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title="Delete this draft?"
        description="Only a draft can be deleted. Anything further along is cancelled or rejected with a reason so the record survives."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteOrder.isPending}
        onConfirm={() => {
          if (dialog?.kind !== "delete") return;
          deleteOrder.mutate(
            { projectId, orderId: dialog.order.id },
            {
              onSuccess: onClose,
              onError: (error) => toast(errorMessage(error)),
            },
          );
        }}
      />
    </>
  );
}

MaterialOrderDialogs.displayName = "MaterialOrderDialogs";
