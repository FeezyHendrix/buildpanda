import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "@/components/molecules/form-drawer";
import type { EquipmentRequestInput } from "@/hooks/use-materials-equipment";
import { cn } from "@/lib/utils";
import type { EquipmentRequest, RequestPriority } from "@/lib/project-types";

const PRIORITIES: RequestPriority[] = ["Low", "Normal", "High", "Critical"];

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function defaultFrom(): string {
  return isoDaysFromNow(3);
}

function defaultUntil(): string {
  return isoDaysFromNow(10);
}

interface EquipmentRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: EquipmentRequest | null;
  onSubmit: (values: EquipmentRequestInput) => void;
  isSubmitting: boolean;
  error: string | null;
}

/** Create and edit a plant hire request in one drawer; `initial` picks the mode. */
export function EquipmentRequestDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isSubmitting,
  error,
}: EquipmentRequestDialogProps) {
  const [title, setTitle] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("Plant");
  const [quantity, setQuantity] = useState("1");
  const [supplier, setSupplier] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("Normal");
  const [neededFrom, setNeededFrom] = useState(defaultFrom());
  const [neededUntil, setNeededUntil] = useState(defaultUntil());
  const [estimatedCost, setEstimatedCost] = useState("0");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [operatorRequired, setOperatorRequired] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setEquipmentName(initial?.equipmentName ?? "");
    setEquipmentType(initial?.equipmentType ?? "Plant");
    setQuantity(String(initial?.quantity ?? 1));
    setSupplier(initial?.supplier ?? "");
    setPriority(initial?.priority ?? "Normal");
    setNeededFrom(initial?.neededFrom.slice(0, 10) ?? defaultFrom());
    setNeededUntil(initial?.neededUntil.slice(0, 10) ?? defaultUntil());
    setEstimatedCost(String(initial?.estimatedCost ?? 0));
    setDeliveryLocation(initial?.deliveryLocation ?? "");
    setOperatorRequired(initial?.operatorRequired ?? false);
    setNotes(initial?.notes ?? "");
  }, [initial, open]);

  const valid =
    title.trim() &&
    equipmentName.trim() &&
    equipmentType.trim() &&
    Number(quantity) > 0 &&
    neededFrom &&
    neededUntil;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit equipment request" : "New equipment request"}
      description="Tie equipment rentals to schedule dates, site activities, supplier paperwork, and return control."
      submitLabel={initial ? "Save changes" : "Create request"}
      submitDisabled={!valid}
      submitting={isSubmitting}
      error={error}
      onSubmit={() => {
        onSubmit({
          title: title.trim(),
          equipmentName: equipmentName.trim(),
          equipmentType: equipmentType.trim(),
          quantity: Number(quantity),
          supplier: supplier.trim() || null,
          priority,
          neededFrom,
          neededUntil,
          estimatedCost: Number(estimatedCost || 0),
          currency: "NGN",
          deliveryLocation: deliveryLocation.trim() || null,
          operatorRequired,
          notes: notes.trim() || null,
        });
      }}
    >
      <Field
        label="Title"
        id="eq-title"
        value={title}
        onChange={setTitle}
        placeholder="e.g. Crane for roof truss lift"
      />
      <Field
        label="Equipment"
        id="eq-name"
        value={equipmentName}
        onChange={setEquipmentName}
        placeholder="Mobile crane"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" id="eq-type" value={equipmentType} onChange={setEquipmentType} />
        <Field
          label="Quantity"
          id="eq-quantity"
          value={quantity}
          onChange={setQuantity}
          type="number"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eq-priority">Priority</Label>
          <select
            id="eq-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as RequestPriority)}
            className={INPUT_CLASS}
          >
            {PRIORITIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <Field
          label="Estimated cost"
          id="eq-cost"
          value={estimatedCost}
          onChange={setEstimatedCost}
          type="number"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Needed from"
          id="eq-from"
          value={neededFrom}
          onChange={setNeededFrom}
          type="date"
        />
        <Field
          label="Needed until"
          id="eq-until"
          value={neededUntil}
          onChange={setNeededUntil}
          type="date"
        />
      </div>
      <Field
        label="Supplier"
        id="eq-supplier"
        value={supplier}
        onChange={setSupplier}
        placeholder="Optional"
      />
      <Field
        label="Delivery location"
        id="eq-location"
        value={deliveryLocation}
        onChange={setDeliveryLocation}
        placeholder="Site gate, crane pad…"
      />
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={operatorRequired}
          onChange={(e) => setOperatorRequired(e.target.checked)}
        />
        Operator required
      </label>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eq-notes">Lifecycle notes</Label>
        <textarea
          id="eq-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={cn(INPUT_CLASS, "min-h-24 py-3")}
        />
      </div>
    </FormDrawer>
  );
}

EquipmentRequestDialog.displayName = "EquipmentRequestDialog";

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        className={INPUT_CLASS}
      />
    </div>
  );
}
