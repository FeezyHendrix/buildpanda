import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { CreateButton } from "@/components/molecules/create-button";
import { NumberedPagination } from "@/components/molecules/numbered-pagination";
import {
  useDeleteTransaction,
  useExportTransactionsCsv,
  useTransactionAnalytics,
  useTransactionCategories,
  useTransactions,
} from "@/hooks/use-transactions";
import { useProjectContext } from "@/layouts/project-layout";
import { formatCompactPrecise } from "@/lib/formatters";
import type { Transaction, TransactionListFilters } from "@/lib/project-types";
import { ExpenseCharts } from "./expenses/expense-charts";
import { UpsertTransactionDialog } from "./expenses/expense-dialogs";
import { ExpenseStatCard } from "./expenses/expense-panel";
import { ExpenseTable } from "./expenses/expense-table";
import { ExpenseToolbar } from "./expenses/expense-toolbar";
import { ManageCategoriesDialog } from "./expenses/manage-categories-dialog";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const HEADER_BUTTON = "h-[36px] border border-[#DCDCDC] px-[15px] text-[14px] font-medium";

/**
 * Expenses — site spend logged with its receipt. A record of money spent
 * off-platform. The page's tab switch arrives as `tabs` because it shares a row
 * with this tab's actions.
 */
export function ExpensesTab({ tabs }: { tabs: ReactNode }) {
  const { project } = useProjectContext();
  const projectId = project.id;
  const currency = project.currency;

  const [filters, setFilters] = useState<TransactionListFilters>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // The search box types freely; the list is asked for once typing settles.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => (prev.search === (search.trim() || undefined) ? prev : { ...prev, search: search.trim() || undefined }));
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data: transactions = [], isPending: isLoadingTx } = useTransactions(projectId, filters);
  const { data: analytics, isPending: isLoadingAnalytics } = useTransactionAnalytics(projectId, filters);
  const { data: categories = [] } = useTransactionCategories(projectId);

  const deleteTx = useDeleteTransaction(projectId);
  const exportCsv = useExportTransactionsCsv();

  const [upsertTarget, setUpsertTarget] = useState<Transaction | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);

  const isFiltered = Object.values(filters).some(Boolean);
  const pageCount = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedTransactions = useMemo(
    () => transactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [transactions, currentPage],
  );

  function handleFiltersChange(next: TransactionListFilters): void {
    setFilters(next);
    setPage(1);
  }

  function handleClearFilters(): void {
    setFilters({});
    setSearch("");
    setPage(1);
  }

  function handleExport(): void {
    exportCsv.mutate({ projectId, filters });
  }

  return (
    <section aria-label="Expenses">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {tabs}
        <div className="flex flex-wrap items-center gap-[12px]">
          <Button variant="outline" className={HEADER_BUTTON} onClick={handleExport} loading={exportCsv.isPending}>
            Export CSV
          </Button>
          <Button variant="outline" className={HEADER_BUTTON} onClick={() => setManageCategoriesOpen(true)}>
            Manage Categories
          </Button>
          <CreateButton onClick={() => setUpsertTarget("new")} className="h-[36px] gap-[8px] px-[16px] text-[14px] font-semibold">
            Record Expense
          </CreateButton>
        </div>
      </div>

      <div className="mt-[24px] grid gap-[24px] sm:grid-cols-2">
        <ExpenseStatCard label="Total spend" value={formatCompactPrecise(analytics?.totalAmount ?? 0, currency)} pending={isLoadingAnalytics} />
        <ExpenseStatCard label="Expenses recorded" value={String(analytics?.count ?? 0)} pending={isLoadingAnalytics} />
      </div>

      <div className="mt-[41px]">
        <ExpenseCharts analytics={analytics} currency={currency} isLoading={isLoadingAnalytics} />
      </div>

      <div className="mt-[40px]">
        <ExpenseToolbar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          categories={categories}
          exporting={exportCsv.isPending}
          onExport={handleExport}
        />
      </div>

      <div className="mt-[16px]">
        <ExpenseTable
          transactions={pagedTransactions}
          currency={currency}
          isLoading={isLoadingTx}
          isFiltered={isFiltered}
          onOpen={setUpsertTarget}
          onDelete={setDeleteTarget}
          onRecord={() => setUpsertTarget("new")}
          onClearFilters={handleClearFilters}
        />
        {transactions.length > 0 ? (
          <NumberedPagination page={currentPage} pageSize={PAGE_SIZE} total={transactions.length} noun="Expenses" onPageChange={setPage} />
        ) : null}
      </div>

      {upsertTarget ? (
        <UpsertTransactionDialog
          projectId={projectId}
          currency={currency}
          initial={upsertTarget === "new" ? null : upsertTarget}
          categories={categories}
          onClose={() => setUpsertTarget(null)}
          onManageCategories={() => {
            setUpsertTarget(null);
            setManageCategoriesOpen(true);
          }}
        />
      ) : null}

      {manageCategoriesOpen ? (
        <ManageCategoriesDialog projectId={projectId} categories={categories} onClose={() => setManageCategoriesOpen(false)} />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete transaction"
        description="Are you sure? This cannot be undone and will update the ledger balances."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteTx.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteTx.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
      />
    </section>
  );
}

ExpensesTab.displayName = "ExpensesTab";
