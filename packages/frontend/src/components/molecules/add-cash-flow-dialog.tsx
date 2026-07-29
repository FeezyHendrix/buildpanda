import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { currencySymbol as symbolFor } from "@/lib/formatters";
import type { CashFlowCategory, Currency } from "@/lib/project-types";

const CATEGORY_OPTIONS: { value: CashFlowCategory; label: string }[] = [
  { value: "valuation", label: "Valuation" },
  { value: "milestone_payment", label: "Milestone payment" },
  { value: "claims_payment", label: "Claims payment" },
];

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

export interface AddCashFlowDialogInput {
  category: CashFlowCategory;
  amount: number;
  isCredit: boolean;
  description?: string;
  entryDate?: string;
}

export interface AddCashFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: Currency;
  onSubmit: (input: AddCashFlowDialogInput) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function AddCashFlowDialog({
  open,
  onOpenChange,
  currency,
  onSubmit,
  isSubmitting = false,
  error,
}: AddCashFlowDialogProps) {
  const [category, setCategory] = useState<CashFlowCategory>("valuation");
  const [amount, setAmount] = useState("");
  const [isCredit, setIsCredit] = useState(false);
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    if (!open) {
      setCategory("valuation");
      setAmount("");
      setIsCredit(false);
      setDescription("");
      setEntryDate(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const amountNumber = Number(amount);
  const isValid =
    amount.trim().length > 0 &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    const input: AddCashFlowDialogInput = {
      category,
      amount: amountNumber,
      isCredit,
    };
    const trimmedDesc = description.trim();
    if (trimmedDesc.length > 0) input.description = trimmedDesc;
    const trimmedDate = entryDate.trim();
    if (trimmedDate.length > 0) input.entryDate = trimmedDate;
    onSubmit(input);
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Record cash flow entry"
      description="Log a real-world money movement (valuation, milestone payment, or claims payment) that happened off-platform."
      submitLabel="Save entry"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cash-flow-category">Category</Label>
          <select
            id="cash-flow-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CashFlowCategory)}
            className={inputClass}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cash-flow-amount">Amount</Label>
            <MoneyInput
              id="cash-flow-amount"
              value={amount}
              onChange={setAmount}
              currencySymbol={symbolFor(currency)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cash-flow-date">Date</Label>
            <input
              id="cash-flow-date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isCredit}
            onChange={(e) => setIsCredit(e.target.checked)}
            className="size-4 rounded border-gray-300 accent-[#004DE7]"
          />
          This is a credit / refund (reduces the running total)
        </label>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cash-flow-description">Description (optional)</Label>
          <textarea
            id="cash-flow-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Interim valuation certificate #4 for foundation works"
            className="resize-none rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
          />
          <p className="text-[11px] text-gray-400">
            {description.trim().length}/500
          </p>
        </div>
      </div>
    </FormDrawer>
  );
}

AddCashFlowDialog.displayName = "AddCashFlowDialog";

export { AddCashFlowDialog };
