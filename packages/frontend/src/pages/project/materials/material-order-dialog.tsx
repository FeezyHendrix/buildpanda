import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { currencySymbol } from "@/lib/formatters";
import type { MaterialOrder, RequestPriority } from "@/lib/project-types";
import { useProjectBoqMaterials, type MaterialOrderInput } from "@/hooks/use-materials-equipment";
import { FIELD, nextWeek, today } from "./shared";
import { UnitInput } from "@/components/atoms/unit-input";

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

export function MaterialOrderDialog({ open, onOpenChange, projectId, initial, onSubmit, isSubmitting, error, currency = "NGN" }: MaterialOrderDialogProps) {
  const { data: boqMaterials = [] } = useProjectBoqMaterials(open ? projectId : undefined);
  const [title, setTitle] = useState("");
  const symbol = currencySymbol(currency);
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("bags");
  const [supplier, setSupplier] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("Normal");
  const [neededBy, setNeededBy] = useState(nextWeek());
  const [estimatedCost, setEstimatedCost] = useState("0");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setMaterialName(initial?.materialName ?? "");
    setQuantity(String(initial?.quantity ?? 1));
    setUnit(initial?.unit ?? "bags");
    setSupplier(initial?.supplier ?? "");
    setPriority(initial?.priority ?? "Normal");
    setNeededBy(initial?.neededBy.slice(0, 10) ?? nextWeek());
    setEstimatedCost(String(initial?.estimatedCost ?? 0));
    setDeliveryLocation(initial?.deliveryLocation ?? "");
    setNotes(initial?.notes ?? "");
  }, [initial, open]);

  function handleMaterialName(value: string) {
    setMaterialName(value);
    const match = boqMaterials.find((m) => m.materialName.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      if (match.unit) setUnit(match.unit);
      if (match.estimatedCost > 0) setEstimatedCost(String(match.estimatedCost));
      if (match.supplier) setSupplier(match.supplier);
    }
  }

  const valid = title.trim() && materialName.trim() && Number(quantity) > 0 && unit.trim() && neededBy;
  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit material order" : "New material order"}
      description="Connect the request to the work it unlocks, then move it through approval, order, and delivery."
      submitLabel={initial ? "Save changes" : "Create order"}
      submitDisabled={!valid}
      submitting={isSubmitting}
      error={error}
      onSubmit={() => {
        onSubmit({
          title: title.trim(),
          materialName: materialName.trim(),
          quantity: parseFloat(quantity),
          unit: unit.trim(),
          supplier: supplier.trim() || null,
          priority,
          neededBy,
          estimatedCost: Number(estimatedCost || 0),
          currency: "NGN",
          deliveryLocation: deliveryLocation.trim() || null,
          notes: notes.trim() || null,
        });
      }}
    >
      <Field label="Title" id="mat-title" value={title} onChange={setTitle} placeholder="e.g. Cement for first-floor blockwork" />
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
        {boqMaterials.length > 0 && (
          <p className="text-xs text-gray-400">{boqMaterials.length} materials from the project BoQ available.</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity" id="mat-quantity" value={quantity} onChange={setQuantity} type="number" step="any" />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mat-unit">Unit</Label>
          <UnitInput id="mat-unit" value={unit} onChange={setUnit} className={FIELD} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mat-priority">Priority</Label>
          <select id="mat-priority" value={priority} onChange={(e) => setPriority(e.target.value as RequestPriority)} className={FIELD}>
            {(["Low", "Normal", "High", "Critical"] as RequestPriority[]).map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <Field label="Needed by" id="mat-needed" value={neededBy || today()} onChange={setNeededBy} type="date" />
      </div>
      <Field label="Supplier" id="mat-supplier" value={supplier} onChange={setSupplier} placeholder="Optional" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mat-cost">Estimated cost</Label>
        <MoneyInput id="mat-cost" value={estimatedCost} onChange={setEstimatedCost} currencySymbol={symbol} placeholder="0.00" />
      </div>
      <Field label="Delivery location" id="mat-location" value={deliveryLocation} onChange={setDeliveryLocation} placeholder="Site store, gate, yard…" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mat-notes">Lifecycle notes</Label>
        <textarea id="mat-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-24 rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10" />
      </div>
    </FormDrawer>
  );
}



export function Field({ label, id, value, onChange, placeholder, type = "text", step="any" }: { label: string; id: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string, step?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} step={step} className={FIELD} />
    </div>
  );
}
