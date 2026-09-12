import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { SearchInput } from "@/components/atoms/search-input";
import { KpiCard } from "@/components/molecules/kpi-card";
import { useProjectContext } from "@/layouts/project-layout";
import { useInvoicePayments, useProjectInvoices, type Invoice } from "@/hooks/use-invoices";
import { canResourceAction } from "@/lib/project-types";
import { formatCurrency } from "@/lib/formatters";
import { PaymentRequestsSection } from "../payments/payment-requests-section";
import { StagePaymentsSection } from "../payments/stage-payments-section";
import { InvoiceActionDialogs, useDownloadInvoicePdf, type InvoiceAction } from "./invoices/invoice-action-dialogs";
import { InvoiceDrawer } from "./invoices/invoice-drawer";
import { AddPaymentDrawer } from "./payments/add-payment-drawer";
import { defaultExpanded, filterPaymentRows, normalisePayments } from "./payments/invoice-payments-model";
import { InvoicePaymentsTable } from "./payments/invoice-payments-table";

/**
 * Payments — every payment recorded against an invoice, under its invoice,
 * then BuildPanda's own contractual records: payment requests and stage
 * payments. All of it is logged money movement; none of it moves money.
 */
export function PaymentsTab() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  // Recording a payment is an approval-level act: the backend checks finances:approve.
  const canRecordPayment = canResourceAction(access, "finances", "approve");
  const currency = project.currency;
  const { data: invoices = [], isPending: invoicesPending } = useProjectInvoices(project.id);
  const { data: paymentsData, isPending: paymentsPending } = useInvoicePayments(project.id);
  const pdf = useDownloadInvoicePdf(project.id);

  const [search, setSearch] = useState("");
  const [toggled, setToggled] = useState<Map<string, boolean>>(() => new Map());
  const [addOpen, setAddOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ invoice: Invoice; action: InvoiceAction } | null>(null);

  const { invoices: rows, totals } = useMemo(
    () => normalisePayments(paymentsData, invoices),
    [paymentsData, invoices],
  );
  const isFiltered = search.trim().length > 0;
  const visible = useMemo(() => filterPaymentRows(rows, search), [rows, search]);
  // Manual toggles sit on top of the default (first open; all open while filtered).
  const expanded = useMemo(() => {
    const base = defaultExpanded(visible, isFiltered);
    for (const [id, open] of toggled) {
      if (open) base.add(id);
      else base.delete(id);
    }
    return base;
  }, [visible, isFiltered, toggled]);
  const viewed = useMemo(() => invoices.find((invoice) => invoice.id === viewId) ?? null, [invoices, viewId]);

  function toggle(invoiceId: string): void {
    const isOpen = expanded.has(invoiceId);
    setToggled((current) => new Map(current).set(invoiceId, !isOpen));
  }

  return (
    <section aria-label="Payments" className="flex flex-col gap-10">
      <section aria-label="Invoice payments">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="w-full rounded-lg bg-surface-alt sm:max-w-xs">
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by invoice #"
              aria-label="Search invoice payments"
            />
          </div>
          {canRecordPayment ? (
            <Button variant="primary" size="md" onClick={() => setAddOpen(true)} disabled={invoices.length === 0}>
              <PlusIcon className="size-4" />
              Add payment
            </Button>
          ) : null}
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <KpiCard label="Invoiced" value={formatCurrency(totals.invoiced, currency)} />
          <KpiCard label="Paid" value={formatCurrency(totals.paid, currency)} />
          <KpiCard label="Outstanding" value={formatCurrency(totals.outstanding, currency)} />
        </div>

        <InvoicePaymentsTable
          rows={visible}
          currency={currency}
          isLoading={paymentsPending && invoicesPending}
          isFiltered={isFiltered}
          expanded={expanded}
          onToggle={toggle}
          onOpenInvoice={setViewId}
        />
      </section>

      <section aria-labelledby="payment-requests-heading">
        <h2 id="payment-requests-heading" className="mb-4 text-base font-semibold text-ink">
          Payment requests
        </h2>
        <PaymentRequestsSection />
      </section>

      <section aria-labelledby="stage-payments-heading">
        <h2 id="stage-payments-heading" className="mb-4 text-base font-semibold text-ink">
          Stage payments
        </h2>
        <StagePaymentsSection />
      </section>

      <AddPaymentDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={project.id}
        currency={currency}
        invoices={invoices}
      />

      <InvoiceDrawer
        open={viewed !== null}
        onOpenChange={(next) => {
          if (!next) setViewId(null);
        }}
        projectId={project.id}
        invoice={viewed}
        currency={currency}
        canManage={canManage}
        canRecordPayment={canRecordPayment}
        onAction={(invoice, action) => setPending({ invoice, action })}
        onDownloadPdf={pdf.download}
        pdfPending={pdf.isPending}
      />

      <InvoiceActionDialogs
        projectId={project.id}
        currency={currency}
        canManage={canManage}
        invoice={pending?.invoice ?? null}
        action={pending?.action ?? null}
        onClose={() => setPending(null)}
        onDeleted={(invoiceId) => {
          if (viewId === invoiceId) setViewId(null);
        }}
      />
    </section>
  );
}

PaymentsTab.displayName = "PaymentsTab";
