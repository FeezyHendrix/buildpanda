import { useEffect, useMemo, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { InvoiceStatus, InvoiceType } from "@/hooks/use-invoices";

export interface UpsertLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitRate: string;
}

export interface UpsertInvoiceValues {
  vendorName: string;
  trade: string;
  number: string;
  status: InvoiceStatus;
  invoiceType: InvoiceType;
  currency: string;
  vatRate: string;
  whtRate: string;
  retentionRate: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  recipientEmail: string;
  notes: string;
  lineItems: UpsertLineItem[];
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

const STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Approved", "PartiallyPaid", "Paid", "Overdue"];
const TYPES: { value: InvoiceType; label: string }[] = [
  { value: "vendor", label: "Vendor invoice" },
  { value: "progress", label: "Progress / IPC" },
  { value: "variation", label: "Variation" },
  { value: "final", label: "Final account" },
  { value: "material", label: "Material" },
];

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

function emptyLine(): UpsertLineItem {
  return { description: "", quantity: "1", unit: "", unitRate: "" };
}

const EMPTY: UpsertInvoiceValues = {
  vendorName: "",
  trade: "",
  number: "",
  status: "Draft",
  invoiceType: "vendor",
  currency: "NGN",
  vatRate: "7.5",
  whtRate: "0",
  retentionRate: "0",
  issueDate: "",
  dueDate: "",
  paymentTerms: "",
  recipientEmail: "",
  notes: "",
  lineItems: [emptyLine()],
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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

  useEffect(() => {
    if (open) setValues(initial ?? { ...EMPTY, currency });
  }, [open, initial, currency]);

  function update<K extends keyof UpsertInvoiceValues>(key: K, value: UpsertInvoiceValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateLine(index: number, patch: Partial<UpsertLineItem>): void {
    setValues((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, i) => (i === index ? { ...li, ...patch } : li)),
    }));
  }

  function addLine(): void {
    setValues((prev) => ({ ...prev, lineItems: [...prev.lineItems, emptyLine()] }));
  }

  function removeLine(index: number): void {
    setValues((prev) => ({
      ...prev,
      lineItems: prev.lineItems.length > 1 ? prev.lineItems.filter((_, i) => i !== index) : prev.lineItems,
    }));
  }

  const totals = useMemo(() => {
    const subtotal = round2(
      values.lineItems.reduce((sum, li) => sum + Number(li.quantity || "0") * Number(li.unitRate || "0"), 0),
    );
    const vat = round2((subtotal * Number(values.vatRate || "0")) / 100);
    const wht = round2((subtotal * Number(values.whtRate || "0")) / 100);
    const retention = round2((subtotal * Number(values.retentionRate || "0")) / 100);
    const totalInvoiced = round2(subtotal + vat);
    const netPayable = round2(totalInvoiced - wht - retention);
    return { subtotal, vat, wht, retention, totalInvoiced, netPayable };
  }, [values.lineItems, values.vatRate, values.whtRate, values.retentionRate]);

  const isValid =
    values.vendorName.trim().length > 0 &&
    values.lineItems.some((li) => li.description.trim().length > 0 && Number(li.unitRate || "0") > 0);

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      ...values,
      vendorName: values.vendorName.trim(),
      trade: values.trade.trim(),
      number: values.number.trim(),
      lineItems: values.lineItems.filter((li) => li.description.trim().length > 0),
    });
  }

  const money = (n: number): string => formatCurrency(n, values.currency || currency);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "edit" ? "Edit invoice" : "New invoice"}
      description={
        mode === "edit"
          ? "Update line items, taxes and details for this invoice."
          : "Build a construction invoice with line items, VAT, WHT and retention."
      }
      submitLabel={mode === "edit" ? "Save changes" : "Create invoice"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-vendor">Vendor / payee</Label>
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
          <Label htmlFor="invoice-type">Type</Label>
          <select
            id="invoice-type"
            value={values.invoiceType}
            onChange={(e) => update("invoiceType", e.target.value as InvoiceType)}
            className={inputClass}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
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
          <Label htmlFor="invoice-number">Number</Label>
          <input
            id="invoice-number"
            value={values.number}
            onChange={(e) => update("number", e.target.value)}
            placeholder="INV-0042"
            maxLength={100}
            className={inputClass}
          />
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
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Line items</Label>
          <button type="button" onClick={addLine} className="text-xs font-medium text-primary-500 hover:text-primary-600">
            + Add line
          </button>
        </div>
        {values.lineItems.map((li, i) => {
          const amount = round2(Number(li.quantity || "0") * Number(li.unitRate || "0"));
          return (
            <div key={i} className="flex items-start gap-2">
              <input
                value={li.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
                placeholder="Description"
                className={cn(inputClass, "flex-1")}
              />
              <input
                value={li.quantity}
                onChange={(e) => updateLine(i, { quantity: e.target.value })}
                placeholder="Qty"
                inputMode="decimal"
                className={cn(inputClass, "w-16 text-right")}
              />
              <input
                value={li.unit}
                onChange={(e) => updateLine(i, { unit: e.target.value })}
                placeholder="Unit"
                className={cn(inputClass, "w-16")}
              />
              <input
                value={li.unitRate}
                onChange={(e) => updateLine(i, { unitRate: e.target.value })}
                placeholder="Rate"
                inputMode="decimal"
                className={cn(inputClass, "w-24 text-right")}
              />
              <div className="flex h-11 w-28 items-center justify-end text-sm font-medium text-gray-700">
                {money(amount)}
              </div>
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="flex h-11 w-8 items-center justify-center text-gray-400 hover:text-red-500"
                aria-label="Remove line"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-vat">VAT (%)</Label>
          <input
            id="invoice-vat"
            value={values.vatRate}
            onChange={(e) => update("vatRate", e.target.value)}
            inputMode="decimal"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-wht">WHT (%)</Label>
          <input
            id="invoice-wht"
            value={values.whtRate}
            onChange={(e) => update("whtRate", e.target.value)}
            inputMode="decimal"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-retention">Retention (%)</Label>
          <input
            id="invoice-retention"
            value={values.retentionRate}
            onChange={(e) => update("retentionRate", e.target.value)}
            inputMode="decimal"
            className={inputClass}
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <Row label="Subtotal" value={money(totals.subtotal)} />
        <Row label={`VAT (${values.vatRate || "0"}%)`} value={money(totals.vat)} />
        <Row label="Total invoiced" value={money(totals.totalInvoiced)} strong />
        <Row label={`WHT (${values.whtRate || "0"}%)`} value={`− ${money(totals.wht)}`} muted />
        <Row label={`Retention (${values.retentionRate || "0"}%)`} value={`− ${money(totals.retention)}`} muted />
        <div className="my-1 border-t border-gray-200" />
        <Row label="Net payable" value={money(totals.netPayable)} strong />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-issue">Issue date</Label>
          <input
            id="invoice-issue"
            type="date"
            value={values.issueDate}
            onChange={(e) => update("issueDate", e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-due">Due date</Label>
          <input
            id="invoice-due"
            type="date"
            value={values.dueDate}
            onChange={(e) => update("dueDate", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-terms">Payment terms</Label>
          <input
            id="invoice-terms"
            value={values.paymentTerms}
            onChange={(e) => update("paymentTerms", e.target.value)}
            placeholder="e.g. Net 30"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-recipient">Client email</Label>
          <input
            id="invoice-recipient"
            type="email"
            value={values.recipientEmail}
            onChange={(e) => update("recipientEmail", e.target.value)}
            placeholder="client@example.com"
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
          rows={2}
          maxLength={2000}
          className={cn(inputClass, "h-auto py-2")}
        />
      </div>
    </FormDrawer>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-0.5", strong && "font-semibold text-gray-900", muted && "text-gray-500")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

UpsertInvoiceDialog.displayName = "UpsertInvoiceDialog";

export { UpsertInvoiceDialog };
