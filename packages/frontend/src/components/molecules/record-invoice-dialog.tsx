import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDialog } from "@/components/molecules/form-dialog";
import type { PaymentClaim } from "@/api/payment-claims";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { INPUT_CLASS } from "@/components/atoms/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: PaymentClaim | null;
  currency: string;
  milestoneName?: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (invoiceNumber: string) => void;
}

interface Line {
  label: string;
  value: number;
  sign?: "+" | "−";
  strong?: boolean;
  muted?: boolean;
}

// Every deduction is a visible row: the caveat "VAT applies" is ignored, a
// line is not. Figures come from the claim as approved, never recomputed here.
function linesFor(claim: PaymentClaim): Line[] {
  const retention = claim.retentionAmount ?? 0;
  const advance = claim.advanceRecoveryAmount ?? 0;
  const vat = claim.vatAmount ?? 0;
  const invoice = claim.invoiceAmount ?? claim.amount;
  return [
    { label: "Certified", value: claim.amount },
    { label: "Less retention", value: retention, sign: "−" },
    { label: "Less advance recovery", value: advance, sign: "−" },
    { label: "Plus VAT", value: vat, sign: "+" },
    { label: "Invoice amount", value: invoice, strong: true },
    { label: "Client deducts withholding tax and issues a credit note", value: claim.whtAmount ?? 0, sign: "−", muted: true },
  ];
}

const inputClass = INPUT_CLASS;

export function RecordInvoiceDialog({ open, onOpenChange, claim, currency, milestoneName, submitting, error, onSubmit }: Props) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  useEffect(() => {
    if (open) setInvoiceNumber("");
  }, [open]);

  const lines = claim ? linesFor(claim) : [];
  const valid = invoiceNumber.trim().length > 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Record invoice · ${milestoneName ?? claim?.claimNumber ?? ""}`}
      description="Logs the invoice you raised for this certified claim. BuildPanda records it; no money moves here."
      submitLabel="Record invoice"
      submitDisabled={!valid}
      submitting={submitting}
      error={error}
      onSubmit={() => onSubmit(invoiceNumber.trim())}
    >
      <dl className="divide-y divide-line-hair rounded-lg border border-line px-4">
        {lines.map((line) => (
          <div
            key={line.label}
            className={cn("flex items-center justify-between gap-4 py-2.5 text-sm", line.muted && "text-gray-400")}
          >
            <dt className={cn(line.strong ? "font-semibold text-gray-900" : "text-gray-600", line.muted && "text-gray-400")}>
              {line.label}
            </dt>
            <dd className={cn("tabular-nums", line.strong ? "text-base font-medium text-gray-900" : "text-gray-800", line.muted && "text-gray-400")}>
              {line.sign ? `${line.sign} ` : ""}
              {formatCurrency(line.value, currency)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invoice-number">Invoice number</Label>
        <input
          id="invoice-number"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          placeholder="e.g. INV-0042"
          maxLength={100}
          autoFocus
          className={inputClass}
        />
      </div>
    </FormDialog>
  );
}
RecordInvoiceDialog.displayName = "RecordInvoiceDialog";
