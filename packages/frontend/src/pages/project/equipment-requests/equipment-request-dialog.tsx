import { useCallback, useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Switcher } from "@/components/atoms/switcher";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { SupplierPicker } from "@/components/molecules/supplier-picker";
import { WorkLinkFields, type WorkLinkValue } from "@/components/molecules/work-link-fields";
import type { EquipmentRequestInput } from "@/hooks/use-materials-equipment";
import { cn } from "@/lib/utils";
import type { EquipmentRequest, RequestPriority } from "@/lib/project-types";
import { HireTermsFields, type HireTerms } from "./hire-terms-fields";

const PRIORITIES: readonly RequestPriority[] = ["Low", "Normal", "High", "Critical"] as const;

const EMPTY_TERMS: HireTerms = {
  onHireAt: "",
  offHireAt: "",
  plantRef: "",
  dailyRate: "",
  estimatedCost: "0",
};

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
  projectId: string;
  initial: EquipmentRequest | null;
  onSubmit: (values: EquipmentRequestInput) => void;
  isSubmitting: boolean;
  error: string | null;
  currency: string;
}

/** Create and edit a plant hire request in one drawer; `initial` picks the mode. */
export function EquipmentRequestDialog({
  open,
  onOpenChange,
  projectId,
  initial,
  onSubmit,
  isSubmitting,
  error,
  currency,
}: EquipmentRequestDialogProps) {
  const [title, setTitle] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("Plant");
  const [quantity, setQuantity] = useState("1");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [priority, setPriority] = useState<RequestPriority>("Normal");
  const [neededFrom, setNeededFrom] = useState(defaultFrom());
  const [neededUntil, setNeededUntil] = useState(defaultUntil());
  const [terms, setTerms] = useState<HireTerms>(EMPTY_TERMS);
  const [link, setLink] = useState<WorkLinkValue>({ phaseId: null, activityId: null });
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [operatorRequired, setOperatorRequired] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setEquipmentName(initial?.equipmentName ?? "");
    setEquipmentType(initial?.equipmentType ?? "Plant");
    setQuantity(String(initial?.quantity ?? 1));
    setSupplierId(initial?.supplierId ?? null);
    setPriority(initial?.priority ?? "Normal");
    setNeededFrom(initial?.neededFrom.slice(0, 10) ?? defaultFrom());
    setNeededUntil(initial?.neededUntil.slice(0, 10) ?? defaultUntil());
    setTerms({
      onHireAt: initial?.onHireAt?.slice(0, 10) ?? "",
      offHireAt: initial?.offHireAt?.slice(0, 10) ?? "",
      plantRef: initial?.plantRef ?? "",
      dailyRate:
        initial?.dailyRate === null || initial?.dailyRate === undefined
          ? ""
          : String(initial.dailyRate),
      estimatedCost: String(initial?.estimatedCost ?? 0),
    });
    setLink({ phaseId: initial?.phaseId ?? null, activityId: initial?.activityId ?? null });
    setDeliveryLocation(initial?.deliveryLocation ?? "");
    setOperatorRequired(initial?.operatorRequired ?? false);
    setNotes(initial?.notes ?? "");
  }, [initial, open]);

  const patchTerms = useCallback((patch: Partial<HireTerms>) => {
    setTerms((current) => ({ ...current, ...patch }));
  }, []);

  const valid =
    title.trim() !== "" &&
    equipmentName.trim() !== "" &&
    equipmentType.trim() !== "" &&
    Number(quantity) > 0 &&
    neededFrom !== "" &&
    neededUntil !== "";

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit equipment request" : "New equipment request"}
      description="Book plant against the stage and activity it works on, with the hire period, fleet number and daily rate it is invoiced by."
      submitLabel={initial ? "Save changes" : "Create request"}
      submitDisabled={!valid}
      submitting={isSubmitting}
      error={error}
      width="lg"
      onSubmit={() => {
        const rate = terms.dailyRate.trim() === "" ? null : Number(terms.dailyRate);
        onSubmit({
          title: title.trim(),
          equipmentName: equipmentName.trim(),
          equipmentType: equipmentType.trim(),
          quantity: Number(quantity),
          supplierId,
          priority,
          neededFrom,
          neededUntil,
          onHireAt: terms.onHireAt || null,
          offHireAt: terms.offHireAt || null,
          plantRef: terms.plantRef.trim() || null,
          dailyRate: rate !== null && Number.isFinite(rate) ? rate : null,
          estimatedCost: Number(terms.estimatedCost || 0),
          phaseId: link.phaseId,
          activityId: link.activityId,
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
        placeholder="e.g. Grader for cut to formation"
      />
      <Field
        label="Equipment"
        id="eq-name"
        value={equipmentName}
        onChange={setEquipmentName}
        placeholder="Motor grader"
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

      <WorkLinkFields
        projectId={projectId}
        enabled={open}
        value={link}
        onChange={setLink}
        idPrefix="eq"
      />

      <SupplierPicker
        projectId={projectId}
        enabled={open}
        value={supplierId}
        onChange={setSupplierId}
        legacyName={initial?.supplierId ? null : initial?.supplier}
        id="eq-supplier"
        label="Hire supplier"
      />

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

      <HireTermsFields
        currency={currency}
        value={terms}
        onChange={patchTerms}
        fallbackFrom={neededFrom}
        fallbackTo={neededUntil}
      />

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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eq-operator">Operator required</Label>
          <Switcher
            value={operatorRequired ? "yes" : "no"}
            onChange={(next) => setOperatorRequired(next === "yes")}
          />
        </div>
      </div>

      <Field
        label="Delivery location"
        id="eq-location"
        value={deliveryLocation}
        onChange={setDeliveryLocation}
        placeholder="Site gate, laydown area…"
      />

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

Field.displayName = "Field";
