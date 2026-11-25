import { useEffect, useState } from "react";
import { DRAWER_FIELD_CLASS, DRAWER_LABEL_CLASS } from "@/components/molecules/drawer-fields";
import { FormDrawer } from "@/components/molecules/form-drawer";
import type { PurchaseOrder, ReceivePurchaseOrderInput } from "@/hooks/use-purchase-orders";
import { cn } from "@/lib/utils";
import { AddImageButton, FileLink, LinesHeading, PO_HEADER_PLAIN, PO_SHEET } from "./po-parts";
import { PoLinesTable } from "./po-lines-table";

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
 *
 * The design lists the lines read-only; the "Received now" quantity per line
 * is added in the table's last column because the API needs it. Images are
 * picked but not sent (docs/purchase-orders-backend.md).
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
  const [images, setImages] = useState<File[]>([]);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const item of purchaseOrder.items) {
      next[item.id] = String(item.outstandingQuantity > 0 ? item.outstandingQuantity : 0);
    }
    setQuantities(next);
    setReceivedAt(todayIso());
    setNote("");
    setImages([]);
  }, [open, purchaseOrder]);

  const lines = purchaseOrder.items.map((item) => {
    const value = Number(quantities[item.id] ?? "0");
    return {
      item,
      value: Number.isFinite(value) && value >= 0 ? value : 0,
      over: Number.isFinite(value) && value > item.outstandingQuantity,
    };
  });
  const overIds = new Set(lines.filter((line) => line.over).map((line) => line.item.id));
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
      footerVariant="split"
      headerClassName={PO_HEADER_PLAIN}
      onSubmit={() =>
        onSubmit({
          lines: lines.map((line) => ({ itemId: line.item.id, receivedQuantity: line.value })),
          receivedAt,
          note: note.trim() || undefined,
        })
      }
      {...PO_SHEET}
      bodyClassName="gap-[24px] pl-[24px] pr-[40px] py-0"
    >
      <div className="flex flex-col gap-[5px]">
        <label htmlFor="po-received-at" className={DRAWER_LABEL_CLASS}>
          Received On
        </label>
        <input id="po-received-at" type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} className={DRAWER_FIELD_CLASS} />
      </div>

      <section className="flex flex-col gap-[16px]">
        <LinesHeading hint="Each line is quantity × rate." />
        <PoLinesTable
          items={purchaseOrder.items}
          currency={currency}
          trailing={{
            label: "Received now",
            render: (item) => (
              <div className="flex flex-col gap-[2px]">
                <input
                  aria-label={`Received now: ${item.description}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={quantities[item.id] ?? "0"}
                  onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))}
                  className={cn(DRAWER_FIELD_CLASS, "h-[36px] w-[110px] px-[12px]", overIds.has(item.id) && "border-warning-500")}
                />
                {overIds.has(item.id) ? <span className="text-caption-m text-[#BB4D00]">Over-receipt</span> : null}
              </div>
            ),
          }}
        />
      </section>

      {overIds.size > 0 ? (
        <p className="border border-warning-500/40 bg-warning-50 p-3 text-caption-l text-[#1E1E1E] text-pretty">
          More is being signed for than was ordered. The PO will be flagged as an over-receipt so it can be reconciled — the ordered
          quantities are not rewritten.
        </p>
      ) : null}

      <div className="flex flex-col gap-[16px]">
        <div className="flex flex-col gap-[5px]">
          <label htmlFor="po-receive-note" className={DRAWER_LABEL_CLASS}>
            Notes<span className="font-normal text-[#737373]"> (optional)</span>
          </label>
          <textarea
            id="po-receive-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Delivery note number, who signed, condition…"
            className={cn(DRAWER_FIELD_CLASS, "h-[132px] resize-none py-[16px]")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[8px]">
          <AddImageButton onFiles={(files) => setImages((current) => [...current, ...files])} />
          {images.map((file, index) => (
            <FileLink key={`${file.name}-${index}`} file={file} onRemove={() => setImages((current) => current.filter((_, i) => i !== index))} />
          ))}
        </div>
      </div>
    </FormDrawer>
  );
}

ReceivePurchaseOrderDialog.displayName = "ReceivePurchaseOrderDialog";
