import { PlusIcon } from "@/components/atoms/project-nav-icons";
import {
  type InvoiceStatus,
  type InvoiceType,
} from "@/hooks/use-invoices";
import {
  STATUSES,
  TYPES,
} from "./invoice-form-model";
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
}

function InvoiceForm({ form, money }: InvoiceFormProps) {
  const { values, update, updateLine, addLine, removeLine } = form;

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Invoice details"
        description="Who, what and which book it lands in."
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
          <TextField
            id="vendor"
            label="Vendor / payee"
            span="md:col-span-2"
            value={values.vendorName}
            onChange={(v) => update("vendorName", v)}
            placeholder="e.g. Adeyemi Builders Ltd"
            maxLength={200}
            autoFocus
          />
          <SelectField<InvoiceType>
            id="type"
            label="Type"
            value={values.invoiceType}
            onChange={(v) => update("invoiceType", v)}
            options={TYPES}
          />
          <TextField
            id="trade"
            label="Trade"
            value={values.trade}
            onChange={(v) => update("trade", v)}
            placeholder="e.g. Electrical"
            maxLength={120}
          />
          <TextField
            id="number"
            label="Invoice number"
            value={values.number}
            onChange={(v) => update("number", v)}
            placeholder="INV-0042"
            maxLength={100}
          />
          <SelectField<InvoiceStatus>
            id="status"
            label="Status"
            value={values.status}
            onChange={(v) => update("status", v)}
            options={STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </Section>

      <Section
        title="Line items"
        description="Each line is quantity × rate. Add as many as you need."
        action={
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100"
          >
            <PlusIcon className="size-3.5" />
            Add line
          </button>
        }
      >
        <LineItemsList
          items={values.lineItems}
          money={money}
          onChange={updateLine}
          onRemove={removeLine}
        />
      </Section>

      <Section
        title="Schedule & contact"
        description="Dates the back-office needs to chase the money."
      >
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
          <TextField
            id="terms"
            label="Payment terms"
            value={values.paymentTerms}
            onChange={(v) => update("paymentTerms", v)}
            placeholder="e.g. Net 30"
          />
          <TextField
            id="recipient"
            type="email"
            label="Client email"
            value={values.recipientEmail}
            onChange={(v) => update("recipientEmail", v)}
            placeholder="client@example.com"
          />
        </div>
      </Section>

      <Section
        title="Taxes & retention"
        description="Percentages applied to the subtotal."
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
          <TextField
            id="vat"
            label="VAT (%)"
            value={values.vatRate}
            onChange={(v) => update("vatRate", v)}
            inputMode="decimal"
          />
          <TextField
            id="wht"
            label="WHT (%)"
            value={values.whtRate}
            onChange={(v) => update("whtRate", v)}
            inputMode="decimal"
          />
          <TextField
            id="retention"
            label="Retention (%)"
            value={values.retentionRate}
            onChange={(v) => update("retentionRate", v)}
            inputMode="decimal"
          />
        </div>
      </Section>

      <Section
        title="Notes"
        description="Visible to the recipient on the issued invoice."
      >
        <TextareaField
          id="notes"
          label="Notes"
          hideLabel
          value={values.notes}
          onChange={(v) => update("notes", v)}
          placeholder="Optional — scope clarifications, retention schedule, payment instructions…"
          maxLength={2000}
          rows={4}
        />
      </Section>
    </div>
  );
}

InvoiceForm.displayName = "InvoiceForm";

export { InvoiceForm };
