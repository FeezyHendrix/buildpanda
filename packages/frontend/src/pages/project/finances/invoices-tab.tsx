import { useUrlState } from "@/hooks/use-url-state";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { CreateButton } from "@/components/molecules/create-button";
import { NumberedPagination } from "@/components/molecules/numbered-pagination";
import { QueryError } from "@/components/molecules/query-error";
import { UnavailableRecord } from "@/components/molecules/unavailable-record";
import { ScanInvoiceDialog } from "@/components/molecules/scan-invoice-dialog";
import { Download } from "lucide-react";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectInvoices, type Invoice, type InvoiceScanResult } from "@/hooks/use-invoices";
import { downloadCsv } from "@/lib/download-csv";
import { formatLongDate } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
import { InvoiceComposer } from "../invoices/invoice-composer";
import { PERIOD_PATTERN } from "./contract/billing-sheet-model";
import {
  InvoiceActionDialogs,
  useDownloadInvoicePdf,
  type InvoiceAction,
} from "./invoices/invoice-action-dialogs";
import { InvoiceKpis } from "./invoices/invoice-kpis";
import { counterpartyName, filterInvoices, INVOICE_STATUS_FILTERS, invoiceStatusLabel, type InvoiceStatusFilter } from "./invoices/invoice-model";
import { InvoiceSheet } from "./invoices/invoice-sheet";
import { InvoiceTable } from "./invoices/invoice-table";
import { InvoiceToolbar } from "./invoices/invoice-toolbar";
import { useInvoiceStatusMove } from "./invoices/use-invoice-status-move";

const EMPTY_INVOICES: Invoice[] = [];
const STATUS_VALUES = INVOICE_STATUS_FILTERS.map(filter => filter.value);
const PAGE_SIZE = 10;

/**
 * Invoices — the register of what's been billed, held back and paid. Adding
 * or sending an invoice records it; nothing here charges anyone. The page's tab
 * switch arrives as `tabs` because it shares a row with this tab's actions.
 */
export function InvoicesTab({ tabs }: { tabs: ReactNode }) {
  const { project, access } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = canResourceAction(access, "finances", "manage");
  const canRecordPayment = canResourceAction(access, "finances", "approve");
  const currency = project.currency;
  const { data: invoices = EMPTY_INVOICES, isPending, isSuccess, error, refetch } = useProjectInvoices(project.id);
  const pdf = useDownloadInvoicePdf(project.id);
  const statusMove = useInvoiceStatusMove(project.id);

  const [search, setSearch] = useUrlState<string>("q", "");
  const [status, setStatus] = useUrlState<InvoiceStatusFilter>("status", "all", STATUS_VALUES);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
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

  const visible = useMemo(() => {
    const matched = filterInvoices(invoices, status, search);
    if (!dateFrom && !dateTo) return matched;
    // The date range is on the issue date; an invoice with none drops out while a range is set.
    return matched.filter((invoice) => {
      const issued = invoice.issueDate?.slice(0, 10);
      return Boolean(issued) && (!dateFrom || issued! >= dateFrom) && (!dateTo || issued! <= dateTo);
    });
  }, [invoices, status, search, dateFrom, dateTo]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / PAGE_SIZE)));
  const paged = useMemo(() => visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [visible, currentPage]);
  // The drawer reads the live invoice so a payment or status change shows at once.
  const viewed = useMemo(() => invoices.find((invoice) => invoice.id === viewId) ?? null, [invoices, viewId]);
  const isFiltered = status !== "all" || search.trim().length > 0 || dateFrom !== "" || dateTo !== "";
  const unavailable = Boolean(viewId) && isSuccess && !viewed;

  function openComposer(): void {
    setScanResult(null);
    setComposePeriod(null);
    setComposerOpen(true);
  }

  function exportCsv(): void {
    downloadCsv("invoices.csv", [
      ["Invoice", "Status", "Date", "Vendor", "Amount", "Paid", "Balance"],
      ...visible.map((invoice) => [
        invoice.number ?? "",
        invoiceStatusLabel(invoice.status),
        formatLongDate(invoice.issueDate),
        counterpartyName(invoice),
        invoice.totalInvoiced,
        invoice.amountPaid,
        invoice.balanceDue,
      ]),
    ]);
  }

  function clearFilters(): void {
    setDateFrom("");
    setDateTo("");
    setPage(1);
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete("status");
      next.delete("q");
      return next;
    }, { replace: true });
  }

  return (
    <section aria-label="Invoices">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {tabs}
        {canManage ? (
          <div className="flex items-center gap-[12px]">
            <Button variant="outline" className="h-[36px] gap-[8px] border border-[#DCDCDC] px-[15px] text-[14px] font-medium" onClick={() => setScanOpen(true)}>
              <Download className="size-[16px]" aria-hidden />
              Scan invoice
            </Button>
            <CreateButton onClick={openComposer} className="h-[36px] gap-[8px] px-[16px] text-[14px] font-semibold">
              Create invoice
            </CreateButton>
          </div>
        ) : null}
      </div>

      {isSuccess ? (
        <div className="mt-[24px]">
          <InvoiceKpis invoices={invoices} currency={currency} />
        </div>
      ) : null}

      <div className="mt-[40px]">
        <InvoiceToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          status={status}
          onStatusChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
            setPage(1);
          }}
          onExport={exportCsv}
          canExport={visible.length > 0}
        />
      </div>

      {error ? <QueryError error={error} retry={refetch} noun="invoices" /> : null}
      {unavailable ? <UnavailableRecord name="Invoice" returnLabel="Return to invoices" onReturn={() => setViewId(null)} /> : null}
      {!error && !unavailable ? <div className="mt-[16px]"><InvoiceTable
        currency={currency}
        invoices={paged}
        isLoading={isPending}
        isFiltered={isFiltered}
        canManage={canManage}
        onAdd={canManage ? openComposer : undefined}
        onClearFilters={clearFilters}
        onView={(invoice) => setViewId(invoice.id)}
        onAction={(invoice, action) => setPending({ invoice, action })}
        onDownloadPdf={pdf.download}
        onMoveStatus={statusMove.move}
      />
        {visible.length > 0 ? <NumberedPagination page={currentPage} pageSize={PAGE_SIZE} total={visible.length} noun="Invoices" onPageChange={setPage} /> : null}
      </div> : null}

      <InvoiceSheet
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
        onMoveStatus={statusMove.move}
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
