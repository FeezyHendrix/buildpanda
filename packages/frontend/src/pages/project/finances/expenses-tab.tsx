import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { CreateButton } from "@/components/molecules/create-button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { ComboSelect } from "@/components/molecules/combo-select";
import { KpiCard } from "@/components/molecules/kpi-card";
import { useStageScope } from "@/contexts/stage-scope-context";
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
import { canResourceAction } from "@/lib/project-types";
import type { Transaction, TransactionListFilters } from "@/lib/project-types";
import {
  UpsertTransactionDialog,
  toCategoryItems,
} from "./expenses/expense-dialogs";
import { ManageCategoriesDialog } from "./expenses/manage-categories-dialog";
import { ExpenseCharts } from "./expenses/expense-charts";
import { ExpenseTable } from "./expenses/expense-table";
import { TabActions } from "./finance-tabs";

/** Expenses — site spend logged with its receipt. A record of money spent off-platform. */
export function ExpensesTab() {
  const { project, access } = useProjectContext();
  const canRead = canResourceAction(access, "finances", "viewCosts");
  const canManage = canRead && canResourceAction(access, "finances", "manage");
  const viewAll = canRead && canResourceAction(access, "finances", "viewAllExpenses");
  const { selectedStageId, setSelectedStageId } = useStageScope();
  const projectId = project.id;
  const currency = project.currency;
  const [localFilters, setFilters] = useState<TransactionListFilters>({});
  const filters = { ...localFilters, stageId: selectedStageId };
  const [draftSearch, setDraftSearch] = useState("");

  const { data: transactions = [], isPending: isLoadingTx } = useTransactions(canRead ? projectId : "", filters);
  const { data: analytics, isPending: isLoadingAnalytics } = useTransactionAnalytics(canRead ? projectId : "", filters);
  const { data: categories = [] } = useTransactionCategories(canRead ? projectId : "");

  const deleteTx = useDeleteTransaction(projectId);
  const exportCsv = useExportTransactionsCsv();

  const [upsertTarget, setUpsertTarget] = useState<Transaction | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);

  const categoryOptions = useMemo(() => toCategoryItems(categories), [categories]);
  const isFiltered = Object.values(filters).some(Boolean);

  function handleClearFilters() {
    setSelectedStageId(undefined);
    setFilters({});
    setDraftSearch("");
  }

  function handleSearch() {
    setFilters((prev) => ({ ...prev, search: draftSearch || undefined }));
  }

  if (!canRead) return null;

  return (
    <section aria-label="Expenses">
      {canManage ? <TabActions>
        <Button
          variant="secondary"
          onClick={() => { if (canManage) exportCsv.mutate({ projectId, filters }); }}
          loading={exportCsv.isPending}
        >
          Export CSV
        </Button>
        <Button variant="secondary" onClick={() => setManageCategoriesOpen(true)}>
          Manage categories
        </Button>
        <CreateButton onClick={() => setUpsertTarget("new")}>Record expense</CreateButton>
      </TabActions> : null}

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard label={viewAll ? "Total spend" : "Spend you logged"} value={formatCurrency(analytics?.totalAmount || 0, currency)} />
          <KpiCard label={viewAll ? "Expenses recorded" : "Your expenses"} value={(analytics?.count || 0).toString()} />
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
              className={cn(INPUT_SM_CLASS, "w-40")}
              value={filters.from || ""}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value || undefined }))}
            />
            <span className="text-ink-muted">to</span>
            <input
              type="date"
              className={cn(INPUT_SM_CLASS, "w-40")}
              value={filters.to || ""}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value || undefined }))}
            />
          </div>
          <div className="flex-1 flex gap-2 min-w-[200px]">
            <input
              className={cn(INPUT_SM_CLASS, "flex-1")}
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
            <Button variant="ghost" onClick={handleClearFilters} className="text-ink-muted">
              Clear
            </Button>
          ) : null}
        </Card>

        <ExpenseTable
          transactions={transactions}
          currency={currency}
          isLoading={isLoadingTx}
          isFiltered={isFiltered}
          onOpen={canManage ? setUpsertTarget : undefined}
          onDelete={canManage ? setDeleteTarget : undefined}
          onRecord={canManage ? () => setUpsertTarget("new") : undefined}
          onClearFilters={handleClearFilters}
        />
      </div>

      {canManage && upsertTarget ? (
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

      {canManage && manageCategoriesOpen ? (
        <ManageCategoriesDialog
          projectId={projectId}
          categories={categories}
          onClose={() => setManageCategoriesOpen(false)}
        />
      ) : null}

      <ConfirmDialog
        open={canManage && Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete transaction"
        description="Are you sure? This cannot be undone and will update the ledger balances."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteTx.isPending}
        onConfirm={() => {
          if (canManage && deleteTarget) {
            deleteTx.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
      />
    </section>
  );
}

ExpensesTab.displayName = "ExpensesTab";
