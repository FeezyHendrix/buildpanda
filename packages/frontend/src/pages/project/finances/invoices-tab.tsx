import { useUrlState } from "@/hooks/use-url-state";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { CreateButton } from "@/components/molecules/create-button";
import { SearchInput } from "@/components/atoms/search-input";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { QueryError } from "@/components/molecules/query-error";
import { UnavailableRecord } from "@/components/molecules/unavailable-record";
import { ScanInvoiceDialog } from "@/components/molecules/scan-invoice-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectInvoices, type Invoice, type InvoiceScanResult } from "@/hooks/use-invoices";
import { canResourceAction } from "@/lib/project-types";
import { InvoiceComposer } from "../invoices/invoice-composer";
import { PERIOD_PATTERN } from "./contract/billing-sheet-model";
import {
  InvoiceActionDialogs,
  useDownloadInvoicePdf,
  type InvoiceAction,
} from "./invoices/invoice-action-dialogs";
import { InvoiceDrawer } from "./invoices/invoice-drawer";
import { filterInvoices, INVOICE_STATUS_FILTERS, type InvoiceStatusFilter } from "./invoices/invoice-model";
import { InvoiceTable } from "./invoices/invoice-table";

const EMPTY_INVOICES: Invoice[] = [];
const STATUS_VALUES = INVOICE_STATUS_FILTERS.map(filter => filter.value);

/**
 * Invoices — the register of what's been billed, held back and paid. Adding
 * or sending an invoice records it; nothing here charges anyone.
 */
export function InvoicesTab() {
  const { project, access } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = canResourceAction(access, "finances", "manage");
  const canRecordPayment = canResourceAction(access, "finances", "approve");
  const currency = project.currency;
  const { data: invoices = EMPTY_INVOICES, isPending, isSuccess, error, refetch } = useProjectInvoices(project.id);
  const pdf = useDownloadInvoicePdf(project.id);

  const [search, setSearch] = useUrlState<string>("q", "");
  const [status, setStatus] = useUrlState<InvoiceStatusFilter>("status", "all", STATUS_VALUES);
  const [scanOpen, setScanOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [scanResult, setScanResult] = useState<InvoiceScanResult | null>(null);
  const [composePeriod, setComposePeriod] = useState<string | null>(null);
  const [viewId, setViewId] = useUrlState<string | null>("invoice", null);
  const [pending, setPending] = useState<{ invoice: Invoice; action: InvoiceAction } | null>(null);

  // The retired /invoices/new route (and any deep link) opens the composer via
  // ?compose=1; the billing sheet adds &period=YYYY-MM to seed a progress
  // invoice for that month. Consume both so a refresh doesn't reopen it.
  useEffect(() => {
    if (canManage && searchParams.get("compose") === "1") {
      const period = searchParams.get("period");
      setScanResult(null);
      setComposePeriod(period && PERIOD_PATTERN.test(period) ? period : null);
      setComposerOpen(true);
      searchParams.delete("compose");
      searchParams.delete("period");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => filterInvoices(invoices, status, search), [invoices, status, search]);
  // The drawer reads the live invoice so a payment or status change shows at once.
  const viewed = useMemo(() => invoices.find((invoice) => invoice.id === viewId) ?? null, [invoices, viewId]);
  const isFiltered = status !== "all" || search.trim().length > 0;
  const unavailable = Boolean(viewId) && isSuccess && !viewed;

  function openComposer(): void {
    setScanResult(null);
    setComposePeriod(null);
    setComposerOpen(true);
  }

  function clearFilters(): void {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete("status");
      next.delete("q");
      return next;
    }, { replace: true });
  }

  return (
    <section aria-label="Invoices">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="w-full rounded-lg bg-surface-alt sm:max-w-xs">
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by invoice # or vendor"
              aria-label="Search invoices"
            />
          </div>
          <FilterTabs items={INVOICE_STATUS_FILTERS} value={status} onChange={setStatus} ariaLabel="Filter invoices by status" />
        </div>
        {canManage ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={() => setScanOpen(true)}>
              Scan invoice
            </Button>
            <CreateButton onClick={openComposer}>
              Add invoice
      </CreateButton>
          </div>
        ) : null}
      </div>

      {error ? <QueryError error={error} retry={refetch} noun="invoices" /> : null}
      {unavailable ? <UnavailableRecord name="Invoice" returnLabel="Return to invoices" onReturn={() => setViewId(null)} /> : null}
      {!error && !unavailable ? <InvoiceTable
        projectId={project.id}
        currency={currency}
        invoices={visible}
        isLoading={isPending}
        isFiltered={isFiltered}
        canManage={canManage}
        onAdd={canManage ? openComposer : undefined}
        onClearFilters={clearFilters}
        onView={(invoice) => setViewId(invoice.id)}
        onAction={(invoice, action) => setPending({ invoice, action })}
        onDownloadPdf={pdf.download}
      /> : null}

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

      <ScanInvoiceDialog
        projectId={project.id}
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScanned={(result) => {
          setScanResult(result);
          setComposerOpen(true);
        }}
      />

      {canManage ? (
        <InvoiceComposer
          projectId={project.id}
          currency={currency}
          open={composerOpen}
          onOpenChange={setComposerOpen}
          scan={scanResult}
          period={composePeriod}
        />
      ) : null}
    </section>
  );
}

InvoicesTab.displayName = "InvoicesTab";
