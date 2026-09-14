import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { SupplierPicker } from "@/components/molecules/supplier-picker";
import { WorkLinkFields, type WorkLinkValue } from "@/components/molecules/work-link-fields";
import type { MaterialOrder, RequestPriority } from "@/lib/project-types";
import { useProjectBoqMaterials, type MaterialOrderInput } from "@/hooks/use-materials-equipment";
import { FIELD, nextWeek, today } from "./shared";
import { OrderPricingFields } from "./order-pricing-fields";
import { UnitInput } from "@/components/atoms/unit-input";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

const PRIORITIES: readonly RequestPriority[] = ["Low", "Normal", "High", "Critical"] as const;

export interface MaterialOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initial: MaterialOrder | null;
  onSubmit: (values: MaterialOrderInput) => void;
  isSubmitting: boolean;
  error: string | null;
  currency?: string;
}

export function MaterialOrderDialog({
  open,
  onOpenChange,
  projectId,
  initial,
  onSubmit,
  isSubmitting,
  error,
  currency = "NGN",
}: MaterialOrderDialogProps) {
  const { data: boqMaterials = [] } = useProjectBoqMaterials(open ? projectId : undefined);
  const [title, setTitle] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("bags");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [priority, setPriority] = useState<RequestPriority>("Normal");
  const [neededBy, setNeededBy] = useState(nextWeek());
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState("");
  const [unitRate, setUnitRate] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("0");
  const [link, setLink] = useState<WorkLinkValue>({ phaseId: null, activityId: null });
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setMaterialName(initial?.materialName ?? "");
    setQuantity(String(initial?.quantity ?? 1));
    setUnit(initial?.unit ?? "bags");
    setSupplierId(initial?.supplierId ?? null);
    setPriority(initial?.priority ?? "Normal");
    setNeededBy(initial?.neededBy.slice(0, 10) ?? nextWeek());
    setExpectedDeliveryAt(initial?.expectedDeliveryAt?.slice(0, 10) ?? "");
    setUnitRate(initial?.unitRate === null || initial?.unitRate === undefined ? "" : String(initial.unitRate));
    setEstimatedCost(String(initial?.estimatedCost ?? 0));
    setLink({ phaseId: initial?.phaseId ?? null, activityId: initial?.activityId ?? null });
    setDeliveryLocation(initial?.deliveryLocation ?? "");
    setNotes(initial?.notes ?? "");
  }, [initial, open]);

  function handleMaterialName(value: string): void {
    setMaterialName(value);
    const match = boqMaterials.find((m) => m.materialName.toLowerCase() === value.trim().toLowerCase());
    if (!match) return;
    if (match.unit) setUnit(match.unit);
    if (match.estimatedCost > 0) setEstimatedCost(String(match.estimatedCost));
  }

  const quantityValue = Number(quantity);
  const quantityInvalid = quantity.trim() !== "" && !(quantityValue > 0);
  const neededInPast = Boolean(neededBy) && neededBy < today();
  const valid =
    title.trim() !== "" && materialName.trim() !== "" && quantityValue > 0 && unit.trim() !== "" && neededBy !== "";

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit material order" : "New material order"}
      description="Name the stage and activity it unlocks, price it at a rate, and say who is supplying it."
      submitLabel={initial ? "Save changes" : "Create order"}
      submitDisabled={!valid}
      submitting={isSubmitting}
      error={error}
      width="lg"
      onSubmit={() => {
        const rate = unitRate.trim() === "" ? null : Number(unitRate);
        onSubmit({
          title: title.trim(),
          materialName: materialName.trim(),
          quantity: quantityValue,
          unit: unit.trim(),
          supplierId,
          priority,
          neededBy,
          expectedDeliveryAt: expectedDeliveryAt || null,
          unitRate: rate !== null && Number.isFinite(rate) ? rate : null,
          estimatedCost: Number(estimatedCost || 0),
          phaseId: link.phaseId,
          activityId: link.activityId,
          currency: "NGN",
          deliveryLocation: deliveryLocation.trim() || null,
          notes: notes.trim() || null,
        });
      }}
    >
      <Field
        label="Title"
        id="mat-title"
        value={title}
        onChange={setTitle}
        placeholder="e.g. Cement for first-floor blockwork"
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mat-name">Material</Label>
        <input
          id="mat-name"
          value={materialName}
          onChange={(e) => handleMaterialName(e.target.value)}
          placeholder={boqMaterials.length > 0 ? "Pick from BoQ or type a material" : "Dangote cement 42.5"}
          list="mat-boq-materials"
          className={FIELD}
          autoComplete="off"
        />
        <datalist id="mat-boq-materials">
          {boqMaterials.map((m) => (
            <option key={m.materialName} value={m.materialName} />
          ))}
        </datalist>
        {boqMaterials.length > 0 ? (
          <p className="text-xs text-ink-muted">
            {boqMaterials.length} materials from the project BoQ available.
          </p>
        ) : null}
      </div>

      <WorkLinkFields
        projectId={projectId}
        enabled={open}
        value={link}
        onChange={setLink}
        idPrefix="mat"
      />

      <SupplierPicker
        projectId={projectId}
        enabled={open}
        value={supplierId}
        onChange={setSupplierId}
        legacyName={initial?.supplierId ? null : initial?.supplier}
        id="mat-supplier"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Field
            label="Quantity"
            id="mat-quantity"
            value={quantity}
            onChange={setQuantity}
            type="number"
            min="0"
            error={quantityInvalid ? "Quantity must be greater than 0." : null}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mat-unit">Unit</Label>
          <UnitInput id="mat-unit" value={unit} onChange={setUnit} className={FIELD} />
        </div>
      </div>

      <OrderPricingFields
        currency={currency}
        quantity={quantityValue}
        unit={unit}
        unitRate={unitRate}
        onUnitRateChange={setUnitRate}
        estimatedCost={estimatedCost}
        onEstimatedCostChange={setEstimatedCost}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mat-priority">Priority</Label>
          <select
            id="mat-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as RequestPriority)}
            className={FIELD}
          >
            {PRIORITIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <Field
          label="Needed by"
          id="mat-needed"
          value={neededBy || today()}
          onChange={setNeededBy}
          type="date"
          hint={neededInPast ? "This date has already passed — the order will show as late." : null}
        />
      </div>

      <Field
        label="Expected delivery"
        id="mat-expected"
        value={expectedDeliveryAt}
        onChange={setExpectedDeliveryAt}
        type="date"
        hint="What the supplier has confirmed. Later than the needed-by date marks the order late."
      />

      <Field
        label="Delivery location"
        id="mat-location"
        value={deliveryLocation}
        onChange={setDeliveryLocation}
        placeholder="Site store, gate, yard…"
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mat-notes">Lifecycle notes</Label>
        <textarea
          id="mat-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3")}
        />
      </div>
    </FormDrawer>
  );
}

MaterialOrderDialog.displayName = "MaterialOrderDialog";

export function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  step = "any",
  min,
  hint,
  error,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
  min?: string;
  /** Explains the field; an `error` replaces it. */
  hint?: string | null;
  error?: string | null;
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
        step={step}
        min={min}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD, error && "ring-1 ring-negative-500")}
      />
      {error ? (
        <p className="text-xs text-negative-500">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

Field.displayName = "Field";
