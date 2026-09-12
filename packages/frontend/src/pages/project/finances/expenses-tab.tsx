import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { ComboSelect } from "@/components/molecules/combo-select";
import { KpiCard } from "@/components/molecules/kpi-card";
import {
  useDeleteTransaction,
  useExportTransactionsCsv,
  useTransactionAnalytics,
  useTransactionCategories,
  useTransactions,
} from "@/hooks/use-transactions";
import { useProjectContext } from "@/layouts/project-layout";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionListFilters } from "@/lib/project-types";
import {
  UpsertTransactionDialog,
  expenseInputClass,
  toCategoryItems,
} from "./expenses/expense-dialogs";
import { ManageCategoriesDialog } from "./expenses/manage-categories-dialog";
import { ExpenseCharts } from "./expenses/expense-charts";
import { ExpenseTable } from "./expenses/expense-table";
import { TabActions } from "./finance-tabs";

/** Expenses — site spend logged with its receipt. A record of money spent off-platform. */
export function ExpensesTab() {
  const { project } = useProjectContext();
  const projectId = project.id;
  const currency = project.currency;

  const [filters, setFilters] = useState<TransactionListFilters>({});
  const [draftSearch, setDraftSearch] = useState("");

  const { data: transactions = [], isPending: isLoadingTx } = useTransactions(projectId, filters);
  const { data: analytics, isPending: isLoadingAnalytics } = useTransactionAnalytics(projectId, filters);
  const { data: categories = [] } = useTransactionCategories(projectId);

  const deleteTx = useDeleteTransaction(projectId);
  const exportCsv = useExportTransactionsCsv();

  const [upsertTarget, setUpsertTarget] = useState<Transaction | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);

  const categoryOptions = useMemo(() => toCategoryItems(categories), [categories]);
  const isFiltered = Object.keys(filters).length > 0;

  function handleClearFilters() {
    setFilters({});
    setDraftSearch("");
  }

  function handleSearch() {
    setFilters((prev) => ({ ...prev, search: draftSearch || undefined }));
  }

  return (
    <section aria-label="Expenses">
      <TabActions>
        <Button
          variant="secondary"
          onClick={() => exportCsv.mutate({ projectId, filters })}
          loading={exportCsv.isPending}
        >
          Export CSV
        </Button>
        <Button variant="secondary" onClick={() => setManageCategoriesOpen(true)}>
          Manage categories
        </Button>
        <Button onClick={() => setUpsertTarget("new")}>Record expense</Button>
      </TabActions>

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard label="Total spend" value={formatCurrency(analytics?.totalAmount || 0, currency)} />
          <KpiCard label="Expenses recorded" value={(analytics?.count || 0).toString()} />
        </div>

        <ExpenseCharts analytics={analytics} currency={currency} isLoading={isLoadingAnalytics} />

        <Card className="p-4 flex flex-wrap items-center gap-4 bg-white">
          <div className="w-48">
            <ComboSelect
              items={categoryOptions}
              value={filters.category || null}
              onChange={(val) => setFilters((p) => ({ ...p, category: val || undefined }))}
              placeholder="All categories"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className={cn(expenseInputClass, "w-40")}
              value={filters.from || ""}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value || undefined }))}
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              className={cn(expenseInputClass, "w-40")}
              value={filters.to || ""}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value || undefined }))}
            />
          </div>
          <div className="flex-1 flex gap-2 min-w-[200px]">
            <input
              className={cn(expenseInputClass, "flex-1")}
              placeholder="Search title, vendor, ref..."
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button variant="secondary" onClick={handleSearch}>
              Search
            </Button>
          </div>
          {isFiltered ? (
            <Button variant="ghost" onClick={handleClearFilters} className="text-gray-500">
              Clear
            </Button>
          ) : null}
        </Card>

        <ExpenseTable
          transactions={transactions}
          currency={currency}
          isLoading={isLoadingTx}
          isFiltered={isFiltered}
          onOpen={setUpsertTarget}
          onDelete={setDeleteTarget}
          onRecord={() => setUpsertTarget("new")}
          onClearFilters={handleClearFilters}
        />
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
        <ManageCategoriesDialog
          projectId={projectId}
          categories={categories}
          onClose={() => setManageCategoriesOpen(false)}
        />
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
