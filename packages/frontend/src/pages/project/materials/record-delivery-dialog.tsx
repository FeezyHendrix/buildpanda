import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/atoms/label";
import { Switcher } from "@/components/atoms/switcher";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useAssignableUsers } from "@/hooks/use-tasks";
import type { RecordDeliveryInput } from "@/hooks/use-materials-equipment";
import { INPUT_CLASS } from "@/components/atoms/input";
import { formatCurrency } from "@/lib/formatters";
import type { MaterialOrder } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { Field } from "./material-order-dialog";
import { formatQty, today } from "./shared";

const NOBODY = "__none__";

interface RecordDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  order: MaterialOrder;
  onSubmit: (values: RecordDeliveryInput) => void;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * A delivery is a contractual event — a GRN — not a status click. What arrived,
 * when, on which delivery note and who signed for it is the record that closes
 * the order by quantity, books the stock and books the cost on the stage.
 */
export function RecordDeliveryDialog({
  open,
  onOpenChange,
  projectId,
  order,
  onSubmit,
  isSubmitting,
  error,
}: RecordDeliveryDialogProps) {
  const { data: people = [] } = useAssignableUsers(open ? projectId : "");
  const outstanding = order.outstandingQuantity ?? Math.max(0, order.quantity - (order.deliveredQuantity ?? 0));

  const [deliveredQty, setDeliveredQty] = useState("");
  const [deliveredAt, setDeliveredAt] = useState(today());
  const [deliveryNote, setDeliveryNote] = useState("");
  const [receivedById, setReceivedById] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [rejected, setRejected] = useState(false);
  const [rejectedReason, setRejectedReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setDeliveredQty(outstanding > 0 ? String(outstanding) : "");
    setDeliveredAt(today());
    setDeliveryNote("");
    setReceivedById(null);
    setNotes("");
    setRejected(false);
    setRejectedReason("");
  }, [open, outstanding]);

  const peopleItems = useMemo<ComboItem[]>(
    () => [
      { id: NOBODY, label: "Not recorded" },
      ...people.map((person) => ({ id: person.id, label: person.name })),
    ],
    [people],
  );

  const qty = Number(deliveredQty);
  const qtyValid = deliveredQty.trim() !== "" && Number.isFinite(qty) && qty > 0;
  const over = qtyValid && qty > outstanding;
  const rate = order.unitRate;
  const bookedCost = qtyValid && rate !== null && rate !== undefined ? rate * qty : null;
  const valid = qtyValid && deliveredAt !== "" && (!rejected || rejectedReason.trim() !== "");

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Record delivery"
      description={`${order.materialName} — ${formatQty(order.quantity)} ${order.unit} ordered, ${formatQty(outstanding)} still outstanding.`}
      submitLabel={rejected ? "Record rejected load" : "Record delivery"}
      submitDisabled={!valid}
      submitting={isSubmitting}
      error={error}
      onSubmit={() =>
        onSubmit({
          deliveredQty: qty,
          deliveredAt,
          deliveryNote: deliveryNote.trim() || null,
          receivedById,
          notes: notes.trim() || null,
          rejected,
          rejectedReason: rejected ? rejectedReason.trim() : null,
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={`Quantity received (${order.unit})`}
          id="delivery-qty"
          value={deliveredQty}
          onChange={setDeliveredQty}
          type="number"
          min="0"
          error={deliveredQty.trim() !== "" && !qtyValid ? "Enter how much actually arrived." : null}
          hint={over ? `More than the ${formatQty(outstanding)} outstanding — check the order quantity.` : null}
        />
        <Field
          label="Delivery date"
          id="delivery-date"
          value={deliveredAt}
          onChange={setDeliveredAt}
          type="date"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Delivery note number"
          id="delivery-note"
          value={deliveryNote}
          onChange={setDeliveryNote}
          placeholder="e.g. DN-04821"
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delivery-received-by">Received by</Label>
          <ComboSelect
            items={peopleItems}
            value={receivedById ?? NOBODY}
            onChange={(next) => setReceivedById(next && next !== NOBODY ? next : null)}
            placeholder="Who signed for it?"
            searchPlaceholder="Search people…"
            emptyText="No one on this project"
            id="delivery-received-by"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="delivery-rejected">Load rejected</Label>
        <Switcher value={rejected ? "yes" : "no"} onChange={(next) => setRejected(next === "yes")} />
        <p className="text-xs text-ink-muted">
          A failed load still arrived on site — record it so it stands against the supplier.
        </p>
      </div>

      {rejected ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delivery-rejected-reason">Why was it rejected?</Label>
          <textarea
            id="delivery-rejected-reason"
            value={rejectedReason}
            onChange={(e) => setRejectedReason(e.target.value)}
            placeholder="CBR fail, wet load, short measure…"
            className={cn(INPUT_CLASS, "h-auto min-h-20 py-3")}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="delivery-notes">Notes</Label>
        <textarea
          id="delivery-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={cn(INPUT_CLASS, "h-auto min-h-20 py-3")}
        />
      </div>

      <div className="rounded-lg bg-surface-alt p-3 text-xs text-ink-muted">
        <p className="font-semibold text-ink">What recording this does</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>Moves the order to partially delivered or delivered from the quantities.</li>
          <li>Books the goods into the material log as a receipt against this note.</li>
          <li>
            {bookedCost === null
              ? "Books no cost — this order has no unit rate."
              : `Books ${formatCurrency(bookedCost, order.currency)} of material cost on ${order.phaseName ?? "the linked stage"}.`}
          </li>
        </ul>
      </div>
    </FormDrawer>
  );
}

RecordDeliveryDialog.displayName = "RecordDeliveryDialog";
