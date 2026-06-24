import { useEffect, useState } from "react";
import { MoneyInput } from "@/components/atoms/money-input";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { currencySymbol } from "@/lib/formatters";

export interface UpsertBudgetPeriodValues {
  period: string;
  planned: string;
  actual: string;
  notes: string;
}

interface UpsertBudgetPeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: UpsertBudgetPeriodValues;
  onSubmit: (values: UpsertBudgetPeriodValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
  currency?: string;
}

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

const EMPTY: UpsertBudgetPeriodValues = {
  period: "",
  planned: "",
  actual: "",
  notes: "",
};

function UpsertBudgetPeriodDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
  currency = "NGN",
}: UpsertBudgetPeriodDialogProps) {
  const [values, setValues] = useState<UpsertBudgetPeriodValues>(EMPTY);
  const symbol = currencySymbol(currency);

  useEffect(() => {
    if (open) {
      setValues(initial ?? EMPTY);
    }
  }, [open, initial]);

  function update<K extends keyof UpsertBudgetPeriodValues>(
    key: K,
    value: UpsertBudgetPeriodValues[K],
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const plannedNumber = Number(values.planned || "0");
  const actualNumber = Number(values.actual || "0");

  const isPeriodValid = /^\d{4}-(0[1-9]|1[0-2])$/.test(values.period);

  const isValid =
    isPeriodValid &&
    Number.isFinite(plannedNumber) &&
    plannedNumber >= 0 &&
    Number.isFinite(actualNumber) &&
    actualNumber >= 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      period: values.period,
      planned: values.planned.trim() ? String(plannedNumber) : "",
      actual: values.actual.trim() ? String(actualNumber) : "",
      notes: values.notes.trim(),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "edit" ? "Edit month" : "New month"}
      description={
        mode === "edit"
          ? "Update the cash flow forecast or actuals for this month."
          : "Add a new month to track your cash flow forecast."
      }
      submitLabel={mode === "edit" ? "Save changes" : "Create month"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="period-month">Month</Label>
        <input
          id="period-month"
          type="month"
          value={values.period}
          onChange={(e) => update("period", e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="period-planned">Planned ({symbol})</Label>
          <MoneyInput
            id="period-planned"
            value={values.planned}
            onChange={(v) => update("planned", v)}
            currencySymbol={symbol}
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="period-actual">Actual ({symbol})</Label>
          <MoneyInput
            id="period-actual"
            value={values.actual}
            onChange={(v) => update("actual", v)}
            currencySymbol={symbol}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="period-notes">Notes</Label>
        <textarea
          id="period-notes"
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Any additional context for this month..."
          maxLength={2000}
          rows={4}
          className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </FormDrawer>
  );
}

export { UpsertBudgetPeriodDialog };
