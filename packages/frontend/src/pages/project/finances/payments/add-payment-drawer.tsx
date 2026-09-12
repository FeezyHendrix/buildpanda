import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useAddInvoicePayment, type Invoice, type PaymentMethod } from "@/hooks/use-invoices";
import { getApiErrorMessage } from "@/lib/api-error";
import { currencySymbol, formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { invoiceLabel } from "../invoices/invoice-model";

/**
 * Records a payment against an invoice — the money moved off-platform; this
 * logs it. Opened from the Payments tab (pick the invoice) or from inside an
 * invoice drawer (the invoice is fixed).
 */

const METHODS: readonly PaymentMethod[] = ["Bank Transfer", "Cash", "Card", "Cheque", "Other"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface AddPaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currency: string;
  /** Invoices the payment may be recorded against; one entry fixes the invoice. */
  invoices: Invoice[];
  /** Pre-selects (and locks) the invoice when opened from its drawer. */
  invoiceId?: string | null;
}

export function AddPaymentDrawer({ open, onOpenChange, projectId, currency, invoices, invoiceId }: AddPaymentDrawerProps) {
  const add = useAddInvoicePayment();
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>("Bank Transfer");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedId(invoiceId ?? invoices[0]?.id ?? "");
    setAmount("");
    setPaidAt(today());
    setMethod("Bank Transfer");
    setNote("");
    add.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId]);

  const invoice = invoices.find((candidate) => candidate.id === selectedId) ?? null;
  const parsed = Number(amount);
  const isValid = invoice !== null && amount.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;

  function handleSubmit(): void {
    if (!invoice || !isValid) return;
    add.mutate(
      { projectId, invoiceId: invoice.id, amount: parsed, method, paidAt: paidAt || undefined, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast("Payment recorded", "success");
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Add payment"
      description={invoice ? `Against ${invoiceLabel(invoice)} · balance ${formatCurrency(invoice.balanceDue, invoice.currency || currency)}` : "Pick the invoice this payment settles."}
      submitLabel="Record payment"
      submitDisabled={!isValid}
      submitting={add.isPending}
      error={add.error ? getApiErrorMessage(add.error) : null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payment-invoice">Invoice</Label>
        <select
          id="payment-invoice"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={Boolean(invoiceId) || invoices.length === 0}
          className={INPUT_CLASS}
        >
          {invoices.length === 0 ? <option value="">No invoices yet</option> : null}
          {invoices.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {invoiceLabel(candidate)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payment-amount">Amount</Label>
        <MoneyInput
          id="payment-amount"
          value={amount}
          onChange={setAmount}
          currencySymbol={currencySymbol(invoice?.currency || currency)}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-date">Paid on</Label>
          <input id="payment-date" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className={INPUT_CLASS} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-method">Method</Label>
          <select id="payment-method" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className={INPUT_CLASS}>
            {METHODS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payment-note">Note</Label>
        <input
          id="payment-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Reference, cheque number…"
          className={INPUT_CLASS}
        />
      </div>
    </FormDrawer>
  );
}

AddPaymentDrawer.displayName = "AddPaymentDrawer";
