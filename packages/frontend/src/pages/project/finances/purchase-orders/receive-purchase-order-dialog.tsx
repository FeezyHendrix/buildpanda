import { useEffect, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "@/components/molecules/form-drawer";
import type { PurchaseOrder, ReceivePurchaseOrderInput } from "@/hooks/use-purchase-orders";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface ReceivePurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder;
  currency: string;
  onSubmit: (values: ReceivePurchaseOrderInput) => void;
  isSubmitting: boolean;
  error: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Receiving is per line, against what was ordered. Signing for more than was
 * ordered happens on real sites, so it is allowed — flagged as an over-receipt
 * rather than quietly rewriting the ordered quantity after the fact.
 */
export function ReceivePurchaseOrderDialog({
  open,
  onOpenChange,
  purchaseOrder,
  currency,
  onSubmit,
  isSubmitting,
  error,
}: ReceivePurchaseOrderDialogProps) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [receivedAt, setReceivedAt] = useState(todayIso());
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const item of purchaseOrder.items) {
      next[item.id] = String(item.outstandingQuantity > 0 ? item.outstandingQuantity : 0);
    }
    setQuantities(next);
    setReceivedAt(todayIso());
    setNote("");
  }, [open, purchaseOrder]);

  const lines = purchaseOrder.items.map((item) => {
    const raw = quantities[item.id] ?? "0";
    const value = Number(raw);
    return {
      item,
      raw,
      value: Number.isFinite(value) && value >= 0 ? value : 0,
      over: Number.isFinite(value) && value > item.outstandingQuantity,
    };
  });
  const anyOver = lines.some((line) => line.over);
  const anyReceived = lines.some((line) => line.value > 0);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Receive against ${purchaseOrder.poNumber}`}
      description={`${purchaseOrder.vendorName} — record what actually arrived, line by line.`}
      submitLabel="Record receipt"
      submitDisabled={!anyReceived || receivedAt === ""}
      submitting={isSubmitting}
      error={error}
      width="lg"
      onSubmit={() =>
        onSubmit({
          lines: lines.map((line) => ({
            itemId: line.item.id,
            receivedQuantity: line.value,
          })),
          receivedAt,
          note: note.trim() || undefined,
        })
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="po-received-at">Received on</Label>
        <input
          id="po-received-at"
          type="date"
          value={receivedAt}
          onChange={(event) => setReceivedAt(event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink">Lines</p>
        {lines.map(({ item, raw, over }) => (
          <div
            key={item.id}
            className="grid gap-2 rounded-lg bg-surface-alt p-3 sm:grid-cols-[1fr_140px] sm:items-end"
          >
            <div className="min-w-0">
              <p className="font-medium text-ink">{item.description}</p>
              <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
                {item.quantity} ordered · {item.receivedQuantity} already received ·{" "}
                {item.outstandingQuantity} outstanding · {formatCurrency(item.unitPrice, currency)} each
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`po-receive-${item.id}`}>Received now</Label>
              <input
                id={`po-receive-${item.id}`}
                type="number"
                min={0}
                step="0.01"
                value={raw}
                onChange={(event) =>
                  setQuantities((current) => ({ ...current, [item.id]: event.target.value }))
                }
                className={cn(INPUT_CLASS, over && "ring-1 ring-warning-500")}
              />
              {over ? (
                <Badge tone="warning" size="sm">
                  Over-receipt
                </Badge>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {anyOver ? (
        <p className="rounded-lg border border-warning-500/40 bg-warning-50 p-3 text-sm text-ink text-pretty">
          More is being signed for than was ordered. The PO will be flagged as an over-receipt so it
          can be reconciled — the ordered quantities are not rewritten.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="po-receive-note">Note</Label>
        <textarea
          id="po-receive-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Delivery note number, who signed, condition…"
          rows={3}
          className={cn(INPUT_CLASS, "h-auto min-h-20 py-3")}
        />
      </div>
    </FormDrawer>
  );
}

ReceivePurchaseOrderDialog.displayName = "ReceivePurchaseOrderDialog";
