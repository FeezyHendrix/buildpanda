import { useEffect, useState } from "react";
import { MoneyInput } from "@/components/atoms/money-input";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { currencySymbol } from "@/lib/formatters";

export interface UpsertBudgetCategoryValues {
  name: string;
  costCode: string;
  planned: string;
  committed: string;
  actual: string;
  notes: string;
}

interface UpsertBudgetCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: UpsertBudgetCategoryValues;
  onSubmit: (values: UpsertBudgetCategoryValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
  currency?: string;
}

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

const EMPTY: UpsertBudgetCategoryValues = {
  name: "",
  costCode: "",
  planned: "",
  committed: "",
  actual: "",
  notes: "",
};

function UpsertBudgetCategoryDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
  currency = "NGN",
}: UpsertBudgetCategoryDialogProps) {
  const [values, setValues] = useState<UpsertBudgetCategoryValues>(EMPTY);
  const symbol = currencySymbol(currency);

  useEffect(() => {
    if (open) {
      setValues(initial ?? EMPTY);
    }
  }, [open, initial]);

  function update<K extends keyof UpsertBudgetCategoryValues>(
    key: K,
    value: UpsertBudgetCategoryValues[K],
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const plannedNumber = Number(values.planned || "0");
  const committedNumber = Number(values.committed || "0");
  const actualNumber = Number(values.actual || "0");

  const isValid =
    values.name.trim().length > 0 &&
    Number.isFinite(plannedNumber) &&
    plannedNumber >= 0 &&
    Number.isFinite(committedNumber) &&
    committedNumber >= 0 &&
    Number.isFinite(actualNumber) &&
    actualNumber >= 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      name: values.name.trim(),
      costCode: values.costCode.trim(),
      planned: values.planned.trim() ? String(plannedNumber) : "",
      committed: values.committed.trim() ? String(committedNumber) : "",
      actual: values.actual.trim() ? String(actualNumber) : "",
      notes: values.notes.trim(),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "edit" ? "Edit category" : "New category"}
      description={
        mode === "edit"
          ? "Update the details and costs for this budget category."
          : "Add a new cost category to your project budget."
      }
      submitLabel={mode === "edit" ? "Save changes" : "Create category"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-name">Name</Label>
        <input
          id="category-name"
          type="text"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="e.g. Concrete, framing, electrical..."
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-cost-code">Cost Code</Label>
        <input
          id="category-cost-code"
          type="text"
          value={values.costCode}
          onChange={(e) => update("costCode", e.target.value)}
          placeholder="e.g. 03-3000"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-planned">Planned ({symbol})</Label>
          <MoneyInput
            id="category-planned"
            value={values.planned}
            onChange={(v) => update("planned", v)}
            currencySymbol={symbol}
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-committed">Committed ({symbol})</Label>
          <MoneyInput
            id="category-committed"
            value={values.committed}
            onChange={(v) => update("committed", v)}
            currencySymbol={symbol}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-actual">Actual ({symbol})</Label>
        <MoneyInput
          id="category-actual"
          value={values.actual}
          onChange={(v) => update("actual", v)}
          currencySymbol={symbol}
          placeholder="0.00"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-notes">Notes</Label>
        <textarea
          id="category-notes"
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Any additional context for this category..."
          maxLength={2000}
          rows={4}
          className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </FormDrawer>
  );
}

export { UpsertBudgetCategoryDialog };
