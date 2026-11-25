import { Dialog } from "@base-ui/react/dialog";
import { ChevronUp, Download, SquarePen, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/atoms/dropdown-menu";
import type { Invoice, InvoiceStatus } from "@/hooks/use-invoices";
import { formatCurrency, formatLongDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/project-types";
import { InvoiceBudgetAllocations } from "../../invoices/invoice-budget-allocations";
import type { InvoiceAction } from "./invoice-action-dialogs";
import { InvoiceCertificatePanel } from "./invoice-certificate-panel";
import { InvoicePaymentsPanel } from "./invoice-drawer-panels";
import { canRecordPaymentOn, counterpartyLabel, counterpartyName, isVoided } from "./invoice-model";
import { InvoiceTimeline } from "./invoice-timeline";
import { invoiceMenuItems, StatusPill } from "./invoice-table";

/**
 * One invoice, read in place, in one scroll: who and when, the amounts, the
 * items, the approval timeline, then the payments recorded against it. Every
 * figure is a recorded amount; nothing here charges anyone.
 */

const CERTIFICATE_TYPES = new Set(["progress", "final", "variation", "advance"]);
const OUTLINE_BUTTON = "h-[46px] gap-[10px] border border-[#E0E0E0] px-[16px] text-caption-l font-semibold";
const ITEM_COLUMNS = "262px 150px 1fr";

interface InvoiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  invoice: Invoice | null;
  currency: Currency;
  canManage: boolean;
  /** finances:approve — who may record a payment against the invoice. */
  canRecordPayment: boolean;
  onAction: (invoice: Invoice, action: InvoiceAction) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  onMoveStatus: (invoice: Invoice, status: InvoiceStatus) => void;
  pdfPending: boolean;
}

function Field({ label, value, align }: { label: string; value: string; align?: "right" }) {
  return (
    <div className={align === "right" ? "min-w-0 text-right" : "min-w-0"}>
      <p className="text-caption-m text-[#737373]">{label}</p>
      <p className="mt-[7px] truncate text-caption-l tabular-nums text-[#1E1E1E]">{value}</p>
    </div>
  );
}

Field.displayName = "Field";

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="text-[16px] font-medium leading-[24px] text-[#1E1E1E]">{children}</h3>;
}

function Items({ invoice, currency }: { invoice: Invoice; currency: string }) {
  if (invoice.lineItems.length === 0) return <p className="text-caption-l text-[#737373]">No line items on this invoice.</p>;
  return (
    <div>
      <div className="grid h-[52px] items-center border border-[#EEEEEE] bg-[#F6F6F6] px-[24px] text-caption-l font-medium text-[#525252]" style={{ gridTemplateColumns: ITEM_COLUMNS }}>
        <span>Description</span>
        <span>QTY</span>
        <span className="text-right">Unit</span>
      </div>
      {invoice.lineItems.map((line) => (
        <div key={line.id} className="grid min-h-[52px] items-center border-b border-[#EEEEEE] px-[24px] py-[10px] text-caption-l text-[#1E1E1E]" style={{ gridTemplateColumns: ITEM_COLUMNS }}>
          <div className="min-w-0 pr-[12px]">
            <p className="break-words">
              {line.description}
              {line.isVariation ? <span className="ml-2 text-caption-m text-[#5D5FEF]">Variation</span> : null}
            </p>
            {line.unitRate > 0 ? (
              <p className="text-caption-m tabular-nums text-[#737373]">
                {formatCurrency(line.unitRate, currency)} each · {formatCurrency(line.amount, currency)}
              </p>
            ) : null}
          </div>
          <p className="tabular-nums">{line.quantity ?? "—"}</p>
          <p className="text-right">{line.unit ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

Items.displayName = "Items";

export function InvoiceSheet({ open, onOpenChange, projectId, invoice, currency, canManage, canRecordPayment, onAction, onDownloadPdf, onMoveStatus, pdfPending }: InvoiceSheetProps) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  if (!invoice) return null;

  const invoiceCurrency = invoice.currency || currency;
  const money = (value: number) => formatCurrency(value, invoiceCurrency);
  const voided = isVoided(invoice);
  const payable = canRecordPaymentOn(invoice);
  const menu = invoiceMenuItems(invoice, canManage, { onView: () => undefined, onAction, onDownloadPdf, onMoveStatus }, false).filter((item) => item.label !== "Download PDF");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-300 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-[min(580px,100vw)] flex-col bg-white shadow-drawer outline-none transition-transform duration-300 ease-out data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full">
          <header className="flex items-start justify-between gap-[16px] px-[24px] pb-[22px] pt-[24px]">
            <div className="min-w-0">
              <Dialog.Description className="text-caption-m leading-[16px] text-[#1E1E1E]">Invoice</Dialog.Description>
              <div className="mt-[7px] flex flex-wrap items-center gap-[8px]">
                <Dialog.Title className="text-[20px] font-semibold leading-[28px] text-[#1E1E1E]">{invoice.number ?? "Invoice"}</Dialog.Title>
                <StatusPill status={voided ? "Void" : invoice.status} />
              </div>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="mr-[23px] mt-[20px] flex size-[24px] shrink-0 items-center justify-center rounded-full border border-[#737373] text-[#737373] outline-none hover:border-[#1E1E1E] hover:text-[#1E1E1E] focus-visible:ring-2 focus-visible:ring-[#004DE7]/25"
            >
              <X className="size-[14px]" strokeWidth={2} aria-hidden />
            </Dialog.Close>
          </header>
          <div aria-hidden className="mx-[24px] h-px shrink-0 bg-[#EEEEEE]" />

          <div className="flex flex-1 flex-col gap-[24px] overflow-y-auto px-[24px] pb-[24px] pt-[24px] no-scrollbar">
            {voided ? (
              <p className="border border-[#FFC9C9] bg-[#FEF2F2] p-3 text-caption-l text-[#C10007] text-pretty">
                Voided{invoice.voidedAt ? ` on ${invoice.voidedAt.slice(0, 10)}` : ""}
                {invoice.voidReason ? `: ${invoice.voidReason}` : "."} The certificate and its receipts stay on file; its figures no longer count towards the contract position.
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-x-[16px] gap-y-[30px]">
              <Field label={`${counterpartyLabel(invoice)} / Payee`} value={counterpartyName(invoice)} />
              <Field label={`${counterpartyLabel(invoice)} contact`} value={invoice.recipientEmail ?? "—"} align="right" />
              <Field label="Issue date" value={formatLongDate(invoice.issueDate) || "—"} />
              <Field label="Due date" value={formatLongDate(invoice.dueDate) || "—"} align="right" />
              <Field label="Amount" value={money(invoice.totalInvoiced)} />
              <Field label="Balance due" value={money(invoice.balanceDue)} align="right" />
            </div>
            <div aria-hidden className="h-px shrink-0 bg-[#EEEEEE]" />

            <section className="flex flex-col gap-[16px]">
              <Heading>Items</Heading>
              <Items invoice={invoice} currency={invoiceCurrency} />
            </section>

            <section className="flex flex-col gap-[16px]">
              <Heading>Approval timeline</Heading>
              <InvoiceTimeline projectId={projectId} invoiceId={invoice.id} currency={invoiceCurrency} />
            </section>

            <InvoicePaymentsPanel
              projectId={projectId}
              invoice={invoice}
              currency={invoiceCurrency}
              canManage={canRecordPayment && !voided}
              addOpen={paymentOpen}
              onAddOpenChange={setPaymentOpen}
            />
            {CERTIFICATE_TYPES.has(invoice.invoiceType) ? <InvoiceCertificatePanel projectId={projectId} invoiceId={invoice.id} currency={invoiceCurrency} /> : null}
            {invoice.notes ? (
              <section className="flex flex-col gap-[8px]">
                <Heading>Notes</Heading>
                <p className="whitespace-pre-line text-caption-l text-[#1E1E1E] text-pretty">{invoice.notes}</p>
              </section>
            ) : null}
            {invoice.paymentInstructions ? (
              <section className="flex flex-col gap-[8px]">
                <Heading>Payment details</Heading>
                <p className="whitespace-pre-line text-caption-l text-[#1E1E1E] text-pretty">{invoice.paymentInstructions}</p>
              </section>
            ) : null}
            <InvoiceBudgetAllocations projectId={projectId} invoice={invoice} currency={invoiceCurrency} canManage={canRecordPayment && !voided} />
          </div>

          <footer className="flex items-center gap-[12px] px-[24px] pb-[20px] pt-[16px]">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={cn(OUTLINE_BUTTON, "w-[167px]")}
              disabled={!canRecordPayment || voided || !payable.allowed}
              title={payable.reason ?? undefined}
              onClick={() => setPaymentOpen(true)}
            >
              <SquarePen className="size-[18px]" aria-hidden />
              Record payment
            </Button>
            <Button type="button" variant="outline" size="lg" className={cn(OUTLINE_BUTTON, "w-[166px]")} loading={pdfPending} onClick={() => onDownloadPdf(invoice)}>
              <Download className="size-[18px]" aria-hidden />
              Download PDF
            </Button>
            {menu.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="ml-auto"
                  render={
                    <Button type="button" size="lg" className="h-[46px] min-w-[175px] gap-[10px] px-[16px] text-caption-l font-semibold">
                      More Options
                      <ChevronUp className="size-[18px]" aria-hidden />
                    </Button>
                  }
                />
                <DropdownMenuContent side="top" className="z-[70] w-[122px]">
                  {menu.map((item) => (
                    <DropdownMenuItem key={item.label} tone={item.tone} onSelect={item.onSelect}>
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

InvoiceSheet.displayName = "InvoiceSheet";
