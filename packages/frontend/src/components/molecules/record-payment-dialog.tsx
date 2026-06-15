import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { formatCurrency, currencySymbol } from "@/lib/formatters";
import { MoneyInput } from "@/components/atoms/money-input";
import type { PaymentMethod } from "@/hooks/use-invoices";

export interface RecordPaymentValues {
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  note: string;
}

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  balanceDue: number;
  currency: string;
  onSubmit: (values: RecordPaymentValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const METHODS: PaymentMethod[] = [
  "Bank Transfer",
  "Cash",
  "Card",
  "Cheque",
  "Other",
];

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

const EMPTY: RecordPaymentValues = {
  amount: "",
  method: "Bank Transfer",
  paidAt: "",
  note: "",
};

function RecordPaymentDialog({
  open,
  onOpenChange,
  vendorName,
  balanceDue,
  currency,
  onSubmit,
  isSubmitting = false,
  error,
}: RecordPaymentDialogProps) {
  const [values, setValues] = useState<RecordPaymentValues>(EMPTY);
  const symbol = currencySymbol(currency);

  useEffect(() => {
    if (open) {
      setValues(EMPTY);
    }
  }, [open]);

  function update<K extends keyof RecordPaymentValues>(
    key: K,
    value: RecordPaymentValues[K],
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const amountNumber = Number(values.amount);
  const isValid =
    values.amount.trim().length > 0 &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      amount: String(amountNumber),
      method: values.method,
      paidAt: values.paidAt.trim(),
      note: values.note.trim(),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Record payment"
      description={`Log a payment made to ${vendorName} against this invoice.`}
      submitLabel="Record payment"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-600">
        Balance due
        <span className="ml-2 font-semibold text-gray-900 tabular-nums">
          {formatCurrency(balanceDue, currency)}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payment-amount">Amount</Label>
        <MoneyInput
          id="payment-amount"
          value={values.amount}
          onChange={(v) => update("amount", v)}
          currencySymbol={symbol}
          placeholder="0.00"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payment-method">Method</Label>
        <select
          id="payment-method"
          value={values.method}
          onChange={(e) => update("method", e.target.value as PaymentMethod)}
          className={inputClass}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payment-paid-at">Payment date</Label>
        <input
          id="payment-paid-at"
          type="date"
          value={values.paidAt}
          onChange={(e) => update("paidAt", e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payment-note">Note</Label>
        <textarea
          id="payment-note"
          value={values.note}
          onChange={(e) => update("note", e.target.value)}
          placeholder="Reference number, bank, or any context for this payment…"
          maxLength={500}
          rows={3}
          className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </FormDrawer>
  );
}

export { RecordPaymentDialog };
