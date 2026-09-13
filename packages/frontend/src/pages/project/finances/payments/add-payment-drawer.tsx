import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { Switcher } from "@/components/atoms/switcher";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useAddInvoicePayment, type Invoice, type PaymentMethod } from "@/hooks/use-invoices";
import { getApiErrorMessage } from "@/lib/api-error";
import { currencySymbol, formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { canRecordPaymentOn, invoiceLabel } from "../invoices/invoice-model";

/**
 * Records a payment against an invoice — the money moved off-platform; this
 * logs it. The guards are the ones a QS applies to a receipt book, not to a
 * payment gateway:
 *
 *   • nothing is received against a certificate that was never certified;
 *   • a receipt cannot be dated in the future, because it has not happened;
 *   • more than the balance is accepted only when the user says so, and is
 *     then recorded as a credit with a note explaining it.
 *
 * The API enforces all three; the form states them before the request so the
 * user is never guessing at a 409.
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
  const [allowOverpayment, setAllowOverpayment] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(invoiceId ?? invoices[0]?.id ?? "");
    setAmount("");
    setPaidAt(today());
    setMethod("Bank Transfer");
    setNote("");
    setAllowOverpayment(false);
    add.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId]);

  const invoice = invoices.find((candidate) => candidate.id === selectedId) ?? null;
  const invoiceCurrency = invoice?.currency || currency;
  const payable = invoice ? canRecordPaymentOn(invoice) : { allowed: false, reason: null };
  const parsed = Number(amount);
  const hasAmount = amount.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;
  const isFutureDate = paidAt.length > 0 && paidAt > today();
  const exceedsBalance = invoice !== null && hasAmount && parsed > Number(invoice.balanceDue.toFixed(2));
  const needsNote = exceedsBalance && allowOverpayment && note.trim().length === 0;

  const blocker = !payable.allowed
    ? payable.reason
    : isFutureDate
      ? "A recorded receipt cannot be dated in the future — this payment has not happened yet."
      : exceedsBalance && !allowOverpayment
        ? `This is more than the ${formatCurrency(invoice?.balanceDue ?? 0, invoiceCurrency)} outstanding. Tick "record as an overpayment" if that is intended.`
        : needsNote
          ? "An overpayment needs a note explaining it."
          : null;

  const isValid = invoice !== null && hasAmount && blocker === null;

  function handleSubmit(): void {
    if (!invoice || !isValid) return;
    add.mutate(
      {
        projectId,
        invoiceId: invoice.id,
        amount: parsed,
        method,
        paidAt: paidAt || undefined,
        note: note.trim() || undefined,
        ...(allowOverpayment ? { allowOverpayment: true } : {}),
      },
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
      description={
        invoice
          ? `Against ${invoiceLabel(invoice)} · balance ${formatCurrency(invoice.balanceDue, invoiceCurrency)}`
          : "Pick the invoice this payment settles."
      }
      submitLabel="Record payment"
      submitDisabled={!isValid}
      submitting={add.isPending}
      error={add.error ? getApiErrorMessage(add.error) : blocker}
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
          currencySymbol={currencySymbol(invoiceCurrency)}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-date">Paid on</Label>
          <input
            id="payment-date"
            type="date"
            value={paidAt}
            max={today()}
            onChange={(event) => setPaidAt(event.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-method">Method</Label>
          <select
            id="payment-method"
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            className={INPUT_CLASS}
          >
            {METHODS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {exceedsBalance ? (
        <div className="flex flex-col gap-1.5">
          <Label>Record as an overpayment</Label>
          <Switcher
            value={allowOverpayment ? "yes" : "no"}
            onChange={(next) => setAllowOverpayment(next === "yes")}
          />
          <p className="text-xs text-ink-muted">
            The excess is kept as a credit against the certificate rather than driving the balance
            negative. Say in the note why more was received than was certified.
          </p>
        </div>
      ) : null}

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
