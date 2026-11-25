import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Select } from "@/components/atoms/select";
import { UnitInput } from "@/components/atoms/unit-input";
import { DRAWER_FIELD_CLASS, DRAWER_LABEL_CLASS } from "@/components/molecules/drawer-fields";
import { useContracts } from "@/hooks/use-contracts";
import type { InvoiceType } from "@/hooks/use-invoices";
import { cn } from "@/lib/utils";
import { LinesBand } from "../finances/purchase-orders/po-parts";
import { TYPES, directionForType, lineAmount, type UpsertLineItem } from "./invoice-form-model";
import { type InvoiceFormApi } from "./use-invoice-form";

/**
 * The New invoice sheet's form (1026px): who it is for, the lines, the dates,
 * and — folded away — the type, taxes, retention and notes. It is its own form
 * because the edit dialog still shares the older single-column `InvoiceForm`.
 */

const BAND_COLUMNS = "357px 85px 163px 162px 1fr";
const ROW_COLUMNS = "362px 85px 163px 161px 1fr";
const BAND_LABELS = ["Description", "QTY", "Unit", "Rate", "Amount"] as const;
const SELECT_DARK = "h-[45px] border-[#525252] px-[16px] text-caption-l";

function Field({ label, htmlFor, optional, children, className }: { label: string; htmlFor?: string; optional?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-[4px]", className)}>
      <label htmlFor={htmlFor} className={DRAWER_LABEL_CLASS}>
        {label}
        {optional ? <span className="font-normal text-[#737373]"> (optional)</span> : null}
      </label>
      {children}
    </div>
  );
}

Field.displayName = "Field";

function Heading({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-[16px]">
      <div>
        <h3 className="text-[16px] font-medium leading-[24px] text-[#1E1E1E]">{title}</h3>
        {hint ? <p className="mt-[4px] text-caption-l text-[#737373]">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

Heading.displayName = "Heading";

function Text({ id, value, onChange, placeholder, type = "text", inputMode, maxLength, autoFocus }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "date";
  inputMode?: "decimal" | "text";
  maxLength?: number;
  autoFocus?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength}
      autoFocus={autoFocus}
      className={DRAWER_FIELD_CLASS}
    />
  );
}

function Lines({ form, money }: { form: InvoiceFormApi; money: (n: number) => string }) {
  const { values, updateLine, removeLine } = form;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[940px]">
        <LinesBand columns={BAND_COLUMNS} labels={BAND_LABELS} />
        {values.lineItems.map((line: UpsertLineItem, index: number) => (
          <div key={index} className="pl-[20px] pt-[24px]">
            <div className="grid items-center" style={{ gridTemplateColumns: ROW_COLUMNS }}>
              <input
                aria-label={`Line ${index + 1} description`}
                value={line.description}
                onChange={(event) => updateLine(index, { description: event.target.value })}
                placeholder="e.g. Cement bags"
                className={cn(DRAWER_FIELD_CLASS, "w-[335px]")}
              />
              <input
                aria-label={`Line ${index + 1} quantity`}
                value={line.quantity}
                onChange={(event) => updateLine(index, { quantity: event.target.value })}
                inputMode="decimal"
                placeholder="100"
                className={cn(DRAWER_FIELD_CLASS, "w-[60px] px-[8px] text-center")}
              />
              <div className="w-[137px]">
                <UnitInput
                  value={line.unit}
                  onChange={(unit) => updateLine(index, { unit })}
                  aria-label={`Line ${index + 1} unit`}
                  placeholder="Select type"
                  className="h-[45px] rounded-none border border-[#EEEEEE] bg-white px-[16px] text-caption-l placeholder:text-[#B0B0B0]"
                />
              </div>
              <input
                aria-label={`Line ${index + 1} rate`}
                value={line.unitRate}
                onChange={(event) => updateLine(index, { unitRate: event.target.value })}
                inputMode="decimal"
                placeholder="0.00"
                className={cn(DRAWER_FIELD_CLASS, "w-[137px]")}
              />
              <p className="truncate pr-[8px] text-caption-l tabular-nums text-[#1E1E1E]">{money(lineAmount(line))}</p>
            </div>
            {values.lineItems.length > 1 ? (
              <button
                type="button"
                onClick={() => removeLine(index)}
                className="mt-[8px] text-caption-m font-medium text-error-600 outline-none hover:underline focus-visible:underline"
              >
                Remove line
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

Lines.displayName = "Lines";

/** Everything below the Dates section. */
function MoreOptions({ form, projectId }: { form: InvoiceFormApi; projectId: string }) {
  const { values, update } = form;
  const { data: contracts = [] } = useContracts(projectId);
  const receivable = values.direction === "receivable";

  // Picking the type picks the direction: a certificate raised to the employer is
  // receivable, a supplier's bill is payable.
  function setType(next: InvoiceType): void {
    update("invoiceType", next);
    update("direction", directionForType(next));
  }

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="grid gap-x-[16px] gap-y-[24px] sm:grid-cols-2">
        <Field label="Type" htmlFor="inv-type">
          <Select id="inv-type" options={TYPES.map((t) => ({ value: t.value, label: t.label }))} value={values.invoiceType} onChange={(next) => setType((next ?? "vendor") as InvoiceType)} className={SELECT_DARK} iconClassName="text-[#A3A3A3]" />
        </Field>
        <Field label="Trade" htmlFor="inv-trade">
          <Text id="inv-trade" value={values.trade} onChange={(v) => update("trade", v)} placeholder={receivable ? "e.g. Progress claim" : "e.g. Electrical"} maxLength={120} />
        </Field>
        <Field label="Invoice Number" htmlFor="inv-number">
          <Text id="inv-number" value={values.number} onChange={(v) => update("number", v)} placeholder={receivable ? "IPC-001" : "INV-00042"} maxLength={100} />
        </Field>
        {receivable ? (
          <Field label="Contract" htmlFor="inv-contract">
            <Select
              id="inv-contract"
              options={[{ value: "", label: "Main contract (default)" }, ...contracts.map((contract) => ({ value: contract.id, label: contract.title }))]}
              value={values.contractId}
              onChange={(next) => update("contractId", next ?? "")}
              className={SELECT_DARK}
              iconClassName="text-[#A3A3A3]"
            />
          </Field>
        ) : null}
      </div>

      <Field label="Payment Terms" htmlFor="inv-terms">
        <Text id="inv-terms" value={values.paymentTerms} onChange={(v) => update("paymentTerms", v)} placeholder="e.g. Net 30" />
      </Field>

      {values.invoiceType === "material" ? (
        <div className="border border-[#C6D6FA] bg-[#F4F8FF] px-4 py-3 text-caption-m text-[#1E1E1E]">
          <p className="font-semibold">Materials will sync to stock</p>
          <p className="mt-0.5 text-[#525252]">
            Each line item will be recorded as a delivered material order and posted as an IN entry in your materials ledger when you save. Line items need a description,
            quantity and unit for the sync to run.
          </p>
        </div>
      ) : null}

      <h3 className="text-[16px] font-medium leading-[24px] text-[#1E1E1E]">Taxes &amp; retention</h3>
      <div className="grid gap-x-[15px] gap-y-[24px] sm:grid-cols-3">
        <Field label="VAT %" htmlFor="inv-vat">
          <Text id="inv-vat" value={values.vatRate} onChange={(v) => update("vatRate", v)} inputMode="decimal" />
        </Field>
        <Field label="WHT %" htmlFor="inv-wht">
          <Text id="inv-wht" value={values.whtRate} onChange={(v) => update("whtRate", v)} inputMode="decimal" />
        </Field>
        <Field label="Retention (%)" htmlFor="inv-retention">
          <Text id="inv-retention" value={values.retentionRate} onChange={(v) => update("retentionRate", v)} inputMode="decimal" />
        </Field>
      </div>

      <Field label="Payment Instructions" htmlFor="inv-instructions" optional>
        <textarea
          id="inv-instructions"
          value={values.paymentInstructions}
          onChange={(event) => update("paymentInstructions", event.target.value)}
          placeholder={"Bank: GTBank\nAccount name: Acme Builders Ltd\nAccount number: 0123456789"}
          maxLength={2000}
          className={cn(DRAWER_FIELD_CLASS, "h-[132px] resize-none py-[16px]")}
        />
      </Field>
      <Field label="Notes" htmlFor="inv-notes" optional>
        <textarea
          id="inv-notes"
          value={values.notes}
          onChange={(event) => update("notes", event.target.value)}
          placeholder="Scope clarifications, retention schedule…"
          maxLength={2000}
          className={cn(DRAWER_FIELD_CLASS, "h-[132px] resize-none py-[16px]")}
        />
      </Field>
    </div>
  );
}

MoreOptions.displayName = "MoreOptions";

interface ComposerFormProps {
  form: InvoiceFormApi;
  money: (n: number) => string;
  projectId: string;
}

export function ComposerForm({ form, money, projectId }: ComposerFormProps) {
  const { values, update, addLine } = form;
  const [moreOpen, setMoreOpen] = useState(false);
  const receivable = values.direction === "receivable";

  return (
    <div className="flex flex-col gap-[24px]">
      <section className="flex flex-col gap-[16px]">
        <Heading title="Bill to" hint="Who this invoice goes to." />
        <div className="grid gap-x-[16px] gap-y-[24px] sm:grid-cols-2">
          <Field label={receivable ? "Client/Employer" : "Vendor/Payee"} htmlFor="inv-vendor">
            <Text id="inv-vendor" value={values.vendorName} onChange={(v) => update("vendorName", v)} placeholder={receivable ? "e.g. Lagos State Ministry of Works" : "e.g. BRIMATEL Ventures"} maxLength={200} autoFocus />
          </Field>
          <Field label="Client Email" htmlFor="inv-email">
            <Text id="inv-email" type="email" value={values.recipientEmail} onChange={(v) => update("recipientEmail", v)} placeholder="client@example.com" />
          </Field>
        </div>
      </section>

      <section className="mr-[16px] flex flex-col gap-[16px]">
        <Heading
          title="Line Items"
          hint="Each line is quantity × rate. Add as many as you need."
          action={
            <button type="button" onClick={addLine} className="mt-[2px] text-caption-l font-semibold text-[#004DE7] outline-none hover:underline focus-visible:underline">
              + Add line
            </button>
          }
        />
        <Lines form={form} money={money} />
      </section>

      <section className="flex flex-col gap-[16px]">
        <Heading title="Dates" hint="When it's issued and due." />
        <div className="grid gap-x-[16px] gap-y-[24px] sm:grid-cols-2">
          <Field label="Issue Date" htmlFor="inv-issue">
            <Text id="inv-issue" type="date" value={values.issueDate} onChange={(v) => update("issueDate", v)} />
          </Field>
          <Field label="Due Date" htmlFor="inv-due">
            <Text id="inv-due" type="date" value={values.dueDate} onChange={(v) => update("dueDate", v)} />
          </Field>
        </div>
      </section>

      <div className="-mb-[1px] h-px shrink-0 bg-[#EEEEEE]" aria-hidden />

      <section className={cn("flex flex-col gap-[24px]", moreOpen ? "" : "border-b border-[#EEEEEE] pb-[23px]")}>
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          className="flex w-full items-start justify-between gap-[16px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/25"
        >
          <span>
            <span className="block text-[16px] font-medium leading-[24px] text-[#1E1E1E]">More Options</span>
            <span className="mt-[3px] block text-caption-l text-[#737373]">Type, trade, taxes, retention, payment details and notes.</span>
          </span>
          <ChevronDown className={cn("mr-[8px] mt-[10px] size-[20px] shrink-0 text-[#1E1E1E] transition-transform", moreOpen && "rotate-180")} strokeWidth={1.5} aria-hidden />
        </button>
        {moreOpen ? <MoreOptions form={form} projectId={projectId} /> : null}
      </section>
    </div>
  );
}

ComposerForm.displayName = "ComposerForm";
