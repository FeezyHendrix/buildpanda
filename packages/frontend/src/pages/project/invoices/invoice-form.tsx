import { Button } from "@/components/atoms/button";
import { ChevronRightIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { useContracts } from "@/hooks/use-contracts";
import { type InvoiceType } from "@/hooks/use-invoices";
import { TYPES, directionForType, partyLabel } from "./invoice-form-model";
import {
  Section,
  SelectField,
  TextField,
  TextareaField,
} from "./invoice-form-fields";
import { LineItemsList } from "./invoice-form-line-items";
import { type InvoiceFormApi } from "./use-invoice-form";

interface InvoiceFormProps {
  form: InvoiceFormApi;
  money: (n: number) => string;
  /** Offers the contract this certificate bills against. */
  projectId: string;
}

/**
 * Invoice form with progressive disclosure: the three things you always need to
 * send an invoice (who, what, when) stay open; the QS/accounting detail (type,
 * taxes, retention, payment details, notes) sits behind "More options" so the
 * common path is short. Shared by the composer and the edit dialog.
 */
function InvoiceForm({ form, money, projectId }: InvoiceFormProps) {
  const { values, update, updateLine, addLine, removeLine } = form;
  const { data: contracts = [] } = useContracts(projectId);
  const receivable = values.direction === "receivable";

  // Picking the type picks the direction: a certificate we raise to the
  // employer is receivable, a supplier's bill is payable. That is what stops
  // the employer being labelled "Vendor".
  function setType(next: InvoiceType): void {
    update("invoiceType", next);
    update("direction", directionForType(next));
  }

  return (
    <div className="flex flex-col gap-6">
      <Section
        title={receivable ? "Certificate" : "Bill"}
        description={
          receivable
            ? "What is being certified, to whom, and against which contract."
            : "Who this bill is from and what it covers."
        }
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
          <SelectField<InvoiceType>
            id="type"
            label="Type"
            value={values.invoiceType}
            onChange={setType}
            options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
          <TextField
            id="trade"
            label="Trade / description"
            value={values.trade}
            onChange={(v) => update("trade", v)}
            placeholder={receivable ? "e.g. Progress claim" : "e.g. Electrical"}
            maxLength={120}
          />
          <TextField
            id="vendor"
            label={partyLabel(values.direction)}
            span="md:col-span-2"
            value={values.vendorName}
            onChange={(v) => update("vendorName", v)}
            placeholder={receivable ? "e.g. Lagos State Ministry of Works" : "e.g. Adeyemi Builders Ltd"}
            maxLength={200}
            autoFocus
          />
          {receivable ? (
            <SelectField<string>
              id="contract"
              label="Contract"
              span="md:col-span-2"
              value={values.contractId}
              onChange={(v) => update("contractId", v)}
              options={[
                { value: "", label: "Main contract (default)" },
                ...contracts.map((contract) => ({ value: contract.id, label: contract.title })),
              ]}
            />
          ) : null}
          <TextField
            id="recipient"
            type="email"
            label="Client email"
            span="md:col-span-2"
            value={values.recipientEmail}
            onChange={(v) => update("recipientEmail", v)}
            placeholder="client@example.com"
          />
        </div>
      </Section>

      <Section
        title="Line items"
        description="Each line is quantity × rate. Add as many as you need."
        action={
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            <PlusIcon />
            Add line
          </Button>
        }
      >
        <LineItemsList
          items={values.lineItems}
          money={money}
          onChange={updateLine}
          onRemove={removeLine}
        />
      </Section>

      <Section title="Dates" description="When it's issued and due.">
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
          <TextField
            id="issue"
            type="date"
            label="Issue date"
            value={values.issueDate}
            onChange={(v) => update("issueDate", v)}
          />
          <TextField
            id="due"
            type="date"
            label="Due date"
            value={values.dueDate}
            onChange={(v) => update("dueDate", v)}
          />
        </div>
      </Section>

      <details className="group rounded-lg border border-line-hair bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">More options</h2>
            <p className="mt-0.5 text-xs text-gray-500 text-pretty">
              Invoice number, taxes, retention, payment details and notes.
            </p>
          </div>
          <ChevronRightIcon className="size-4 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-90" />
        </summary>

        <div className="flex flex-col gap-6 border-t border-line-hair p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
            <TextField
              id="number"
              label="Invoice number"
              value={values.number}
              onChange={(v) => update("number", v)}
              placeholder={receivable ? "IPC-001" : "INV-0042"}
              maxLength={100}
            />
            <TextField
              id="terms"
              label="Payment terms"
              value={values.paymentTerms}
              onChange={(v) => update("paymentTerms", v)}
              placeholder="e.g. Net 30"
            />
          </div>

          {values.invoiceType === "material" && (
            <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-900">
              <span aria-hidden="true" className="text-base leading-none">📦</span>
              <div>
                <p className="font-semibold">Materials will sync to stock</p>
                <p className="mt-0.5 text-blue-800/80">
                  Each line item will be recorded as a delivered material order
                  and posted as an <span className="font-medium">IN</span> entry
                  in your materials ledger when you save. Line items need a
                  description, quantity and unit for the sync to run.
                </p>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Taxes &amp; retention</h3>
            <p className="mb-3 text-xs text-gray-500">
              Seeded from the contract terms for a certificate against the contract. Change the
              terms on the main contract so every later certificate inherits the new figures.
            </p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
              <TextField id="vat" label="VAT (%)" value={values.vatRate} onChange={(v) => update("vatRate", v)} inputMode="decimal" />
              <TextField id="wht" label="WHT (%)" value={values.whtRate} onChange={(v) => update("whtRate", v)} inputMode="decimal" />
              <TextField id="retention" label="Retention (%)" value={values.retentionRate} onChange={(v) => update("retentionRate", v)} inputMode="decimal" />
            </div>
          </div>

          <TextareaField
            id="payment-instructions"
            label="Payment instructions"
            value={values.paymentInstructions}
            onChange={(v) => update("paymentInstructions", v)}
            placeholder={"Bank: GTBank\nAccount name: Acme Builders Ltd\nAccount number: 0123456789\nReference: invoice number"}
            maxLength={2000}
            rows={4}
          />

          <TextareaField
            id="notes"
            label="Notes"
            value={values.notes}
            onChange={(v) => update("notes", v)}
            placeholder="Optional — scope clarifications, retention schedule…"
            maxLength={2000}
            rows={4}
          />
        </div>
      </details>
    </div>
  );
}

InvoiceForm.displayName = "InvoiceForm";

export { InvoiceForm };
