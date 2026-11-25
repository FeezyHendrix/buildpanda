import { Dialog } from "@base-ui/react/dialog";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import type { PurchaseOrder } from "@/hooks/use-purchase-orders";
import { formatCurrency, formatLongDate } from "@/lib/formatters";
import {
  PO_ACTION_LABEL,
  PO_STATUS_META,
  availableActions,
  canEditLines,
  type PurchaseOrderAction,
} from "./purchase-order-model";
import { LinesHeading } from "./po-parts";
import { PoLinesTable } from "./po-lines-table";

interface PurchaseOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder;
  currency: string;
  canManage: boolean;
  onEdit: () => void;
  onAction: (action: PurchaseOrderAction) => void;
  busyAction: PurchaseOrderAction | null;
}

const META_COLUMNS = "216px 214px 112px 166px 166px 1fr";
const SECONDARY_BUTTON = "h-[46px] w-[152px] border border-[#E0E0E0]";

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-caption-m font-medium text-[#737373]">{label}</p>
      <p className="mt-[8px] truncate text-caption-l tabular-nums text-[#1E1E1E]">{value}</p>
    </div>
  );
}

Meta.displayName = "Meta";

/**
 * A PO moves through actions, never a status dropdown: issue puts it with the
 * vendor and commits the spend, receive records what arrived line by line,
 * cancel keeps it on file with a reason, close settles it. The footer reads
 * Cancel · Edit · the one forward action, as designed.
 */
export function PurchaseOrderDrawer({
  open,
  onOpenChange,
  purchaseOrder,
  currency,
  canManage,
  onEdit,
  onAction,
  busyAction,
}: PurchaseOrderDrawerProps) {
  const meta = PO_STATUS_META[purchaseOrder.status];
  const actions = availableActions(purchaseOrder.status);
  const canCancel = actions.includes("cancel");
  const forward = actions.find((action) => action !== "cancel");
  const subtitle = [purchaseOrder.vendorName, purchaseOrder.stageName].filter(Boolean).join(" • ");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-300 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
        />
        <Dialog.Popup
          className="fixed inset-y-0 right-0 z-50 flex w-[min(1026px,100vw)] flex-col bg-white shadow-drawer outline-none transition-transform duration-300 ease-out data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full"
        >
          <header className="px-[24px] pb-[23px] pt-[39px]">
            <div className="flex flex-wrap items-center gap-[6px]">
              <Dialog.Title className="text-[20px] font-semibold leading-[28px] text-[#1E1E1E]">{purchaseOrder.poNumber}</Dialog.Title>
              <Badge tone={meta.tone} size="md" className="h-[24px] text-caption-m font-semibold">
                {meta.label}
              </Badge>
              {purchaseOrder.overReceipt ? (
                <Badge tone="warning" size="md" className="text-caption-m font-semibold">
                  Over-receipt
                </Badge>
              ) : null}
            </div>
            <Dialog.Description className="mt-[3px] px-[2px] text-caption-m text-[#737373]">{subtitle}</Dialog.Description>
          </header>
          <div aria-hidden className="mx-[24px] h-px shrink-0 bg-[#EEEEEE]" />

          <div className="flex flex-1 flex-col gap-[24px] overflow-y-auto px-[24px] pb-[24px] pt-[23px] no-scrollbar">
            {purchaseOrder.cancelReason ? (
              <div className="border border-[#FFC9C9] bg-[#FEF2F2] p-3">
                <p className="text-caption-m font-semibold text-[#C10007]">Cancelled {formatLongDate(purchaseOrder.cancelledAt)}</p>
                <p className="mt-0.5 text-caption-l text-[#1E1E1E] text-pretty">{purchaseOrder.cancelReason}</p>
              </div>
            ) : null}

            <div className="grid gap-y-[16px]" style={{ gridTemplateColumns: META_COLUMNS }}>
              <Meta label="PO value" value={formatCurrency(purchaseOrder.total, currency)} />
              <Meta label="Received value" value={formatCurrency(purchaseOrder.receivedTotal, currency)} />
              <Meta label="Lines" value={String(purchaseOrder.items.length)} />
              <Meta label="Ordered" value={formatLongDate(purchaseOrder.orderDate) || "—"} />
              <Meta label="Issued" value={formatLongDate(purchaseOrder.issuedAt) || "Not issued"} />
              <Meta label="Expected" value={formatLongDate(purchaseOrder.expectedDate) || "—"} />
            </div>

            <section className="mr-[16px] flex flex-col gap-[16px]">
              <LinesHeading hint="Each line is quantity × rate." />
              <PoLinesTable items={purchaseOrder.items} currency={currency} />
              {canEditLines(purchaseOrder.status) ? null : (
                <p className="text-caption-m text-[#737373] text-pretty">
                  The lines on this PO are fixed — a received or closed order cannot have its quantities rewritten. Raise a new PO for anything further.
                </p>
              )}
            </section>

            {purchaseOrder.notes ? (
              <div className="flex flex-col gap-[5px]">
                <p className="text-caption-m font-semibold text-[#1E1E1E]">Notes</p>
                <p className="text-caption-l text-[#1E1E1E] text-pretty">{purchaseOrder.notes}</p>
              </div>
            ) : null}
          </div>

          {canManage ? (
            <footer className="flex flex-wrap items-center justify-end gap-[4px] px-[24px] pb-[24px] pt-[16px]">
              {canCancel ? (
                <Button type="button" variant="outline" size="lg" className={SECONDARY_BUTTON} loading={busyAction === "cancel"} onClick={() => onAction("cancel")}>
                  {PO_ACTION_LABEL.cancel}
                </Button>
              ) : null}
              {canEditLines(purchaseOrder.status) ? (
                <Button type="button" variant="outline" size="lg" className={SECONDARY_BUTTON} onClick={onEdit}>
                  Edit
                </Button>
              ) : null}
              {forward ? (
                <Button type="button" size="lg" className="h-[46px] min-w-[175px] px-[24px]" loading={busyAction === forward} onClick={() => onAction(forward)}>
                  {PO_ACTION_LABEL[forward]}
                </Button>
              ) : null}
            </footer>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

PurchaseOrderDrawer.displayName = "PurchaseOrderDrawer";
