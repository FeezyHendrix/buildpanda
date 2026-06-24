import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { currencySymbol } from "@/lib/formatters";
import type { InvoiceStatus } from "@/hooks/use-invoices";

export interface UpsertInvoiceValues {
  vendorName: string;
  trade: string;
  number: string;
  status: InvoiceStatus;
  amount: string;
  retainagePercentage: string;
  issueDate: string;
  dueDate: string;
  notes: string;
}

interface UpsertInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: UpsertInvoiceValues;
  onSubmit: (values: UpsertInvoiceValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
  currency?: string;
}

const STATUSES: InvoiceStatus[] = ["Draft", "Submitted", "Approved", "Paid"];

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

const EMPTY: UpsertInvoiceValues = {
  vendorName: "",
  trade: "",
  number: "",
  status: "Draft",
  amount: "",
  retainagePercentage: "",
  issueDate: "",
  dueDate: "",
  notes: "",
};

function UpsertInvoiceDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
  currency = "NGN",
}: UpsertInvoiceDialogProps) {
  const [values, setValues] = useState<UpsertInvoiceValues>(EMPTY);
  const symbol = currencySymbol(currency);

  useEffect(() => {
    if (open) {
      setValues(initial ?? EMPTY);
    }
  }, [open, initial]);

  function update<K extends keyof UpsertInvoiceValues>(
    key: K,
    value: UpsertInvoiceValues[K],
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const amountNumber = Number(values.amount);
  const retainageNumber = Number(values.retainagePercentage || "0");
  const isValid =
    values.vendorName.trim().length > 0 &&
    values.trade.trim().length > 0 &&
    values.amount.trim().length > 0 &&
    Number.isFinite(amountNumber) &&
    amountNumber >= 0 &&
    Number.isFinite(retainageNumber) &&
    retainageNumber >= 0 &&
    retainageNumber <= 100;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      vendorName: values.vendorName.trim(),
      trade: values.trade.trim(),
      number: values.number.trim(),
      status: values.status,
      amount: String(amountNumber),
      retainagePercentage: String(retainageNumber),
      issueDate: values.issueDate.trim(),
      dueDate: values.dueDate.trim(),
      notes: values.notes.trim(),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "edit" ? "Edit invoice" : "New invoice"}
      description={
        mode === "edit"
          ? "Update the vendor invoice details and retainage held on this project."
          : "Record a vendor invoice with the contract amount and retainage withheld."
      }
      submitLabel={mode === "edit" ? "Save changes" : "Add invoice"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invoice-vendor">Vendor name</Label>
        <input
          id="invoice-vendor"
          value={values.vendorName}
          onChange={(e) => update("vendorName", e.target.value)}
          placeholder="e.g. Adeyemi Builders Ltd"
          maxLength={200}
          autoFocus
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invoice-trade">Trade</Label>
        <input
          id="invoice-trade"
          value={values.trade}
          onChange={(e) => update("trade", e.target.value)}
          placeholder="e.g. Electrical"
          maxLength={120}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invoice-number">Invoice number</Label>
        <input
          id="invoice-number"
          value={values.number}
          onChange={(e) => update("number", e.target.value)}
          placeholder="e.g. INV-0042"
          maxLength={100}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-amount">Amount</Label>
          <MoneyInput
            id="invoice-amount"
            value={values.amount}
            onChange={(v) => update("amount", v)}
            currencySymbol={symbol}
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-retainage">Retainage (%)</Label>
          <input
            id="invoice-retainage"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            value={values.retainagePercentage}
            onChange={(e) => update("retainagePercentage", e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invoice-status">Status</Label>
        <select
          id="invoice-status"
          value={values.status}
          onChange={(e) => update("status", e.target.value as InvoiceStatus)}
          className={inputClass}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-issue-date">Issue date</Label>
          <input
            id="invoice-issue-date"
            type="date"
            value={values.issueDate}
            onChange={(e) => update("issueDate", e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-due-date">Due date</Label>
          <input
            id="invoice-due-date"
            type="date"
            value={values.dueDate}
            onChange={(e) => update("dueDate", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invoice-notes">Notes</Label>
        <textarea
          id="invoice-notes"
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Scope covered, approvals, or any context for this invoice…"
          maxLength={2000}
          rows={4}
          className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </FormDrawer>
  );
}

export { UpsertInvoiceDialog };
