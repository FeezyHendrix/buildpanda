import { useEffect, useMemo, useState } from "react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { MoneyInput } from "@/components/atoms/money-input";
import { Select } from "@/components/atoms/select";
import { TextArea } from "@/components/atoms/text-area";
import { TextInput } from "@/components/atoms/text-input";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { CONSTRUCTION_UNITS } from "@/lib/construction-units";
import { currencySymbol } from "@/lib/formatters";
import type { MaterialOrder, RequestPriority } from "@/lib/project-types";
import { useProjectBoqMaterials, type MaterialOrderInput } from "@/hooks/use-materials-equipment";
import { nextWeek } from "./shared";

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

const PRIORITY_OPTIONS = (["Low", "Normal", "High", "Critical"] as RequestPriority[]).map(
  (priority) => ({ value: priority, label: priority }),
);

const CURRENCIES = ["NGN", "USD"] as const;

export function MaterialOrderDialog({ open, onOpenChange, projectId, initial, onSubmit, isSubmitting, error, currency = "NGN" }: MaterialOrderDialogProps) {
  const { data: boqMaterials = [] } = useProjectBoqMaterials(open ? projectId : undefined);
  const [title, setTitle] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("bags");
  const [supplier, setSupplier] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("Normal");
  const [neededBy, setNeededBy] = useState(nextWeek());
  const [orderCurrency, setOrderCurrency] = useState(currency);
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
    setOrderCurrency(initial?.currency ?? currency);
    setEstimatedCost(String(initial?.estimatedCost ?? 0));
    setDeliveryLocation(initial?.deliveryLocation ?? "");
    setNotes(initial?.notes ?? "");
  }, [initial, open, currency]);

  // Units come from the shared construction list. A legacy custom unit on an
  // existing order is appended so it still displays instead of blanking out.
  const unitOptions = useMemo(() => {
    const base = CONSTRUCTION_UNITS.map((u) => ({ value: u, label: u }));
    const known = new Set<string>(CONSTRUCTION_UNITS);
    return unit && !known.has(unit) ? [...base, { value: unit, label: unit }] : base;
  }, [unit]);

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
      submitLabel={initial ? "Save changes" : "Create Order"}
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
          currency: orderCurrency as "NGN" | "USD",
          deliveryLocation: deliveryLocation.trim() || null,
          notes: notes.trim() || null,
        });
      }}
      footerVariant="stacked"
    >
      <TextInput
        label="Title"
        value={title}
        onChange={setTitle}
        placeholder="e.g Cement for first floor"
        autoFocus
      />

      <div className="flex flex-col gap-1.5">
        <TextInput
          label="Material"
          value={materialName}
          onChange={handleMaterialName}
          placeholder="Lafarge cement"
          list="mat-boq-materials"
          autoComplete="off"
        />
        <datalist id="mat-boq-materials">
          {boqMaterials.map((m) => (
            <option key={m.materialName} value={m.materialName} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label="Quantity"
          value={quantity}
          onChange={setQuantity}
          type="number"
          min="0"
          step="any"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[#1E1E1E]">Unit</label>
          <Select
            options={unitOptions}
            value={unit || null}
            onChange={(v) => setUnit(v ?? "")}
            placeholder="Select unit"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[#1E1E1E]">Priority</label>
          <Select
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(v) => v && setPriority(v as RequestPriority)}
            placeholder="Select priority"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label
            htmlFor="mat-needed-by"
            className="text-[13px] font-medium text-[#1E1E1E]"
          >
            Needed by
          </label>
          <div
            className="relative"
            onClick={(e) =>
              (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.showPicker?.()
            }
          >
            <input
              id="mat-needed-by"
              type="date"
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              placeholder="DD/MM/YY"
              className="h-11 w-full cursor-pointer border border-[#EBEBEB] bg-white px-3.5 pr-9 text-caption-l text-black-500 outline-none transition-colors placeholder:text-[#B0B0B0] focus:border-black-500 focus:ring-1 focus:ring-black-500/10 [&::-webkit-calendar-picker-indicator]:hidden"
            />
            <ReactSVG
              src={icons2.calendar}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 [&_svg]:size-[16px]"
            />
          </div>
        </div>
      </div>

      <TextInput
        label="Supplier"
        optional
        value={supplier}
        onChange={setSupplier}
        placeholder="Name of Supplier"
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[#1E1E1E]">Estimated Cost</label>
        <div className="flex">
          <div className="w-28 shrink-0">
            <Select
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              value={orderCurrency}
              onChange={(v) => v && setOrderCurrency(v)}
            />
          </div>
          <div className="flex-1">
            <MoneyInput
              placeholder="0"
              value={estimatedCost}
              onChange={setEstimatedCost}
              currencySymbol={currencySymbol(orderCurrency)}
              aria-label="Estimated cost"
              className="rounded-none indent-4 border border-border bg-white px-3.5 text-[14px] text-left text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none transition-colors focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
            />
          </div>
        </div>
      </div>

      <TextInput
        label="Delivery Location"
        value={deliveryLocation}
        onChange={setDeliveryLocation}
        placeholder="Site store, gate,..."
      />

      <TextArea
        label="Lifecycle Notes"
        value={notes}
        onChange={setNotes}
        rows={5}
      />
    </FormDrawer>
  );
}
