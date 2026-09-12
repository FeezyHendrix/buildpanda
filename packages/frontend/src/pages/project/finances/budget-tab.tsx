import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { FeatureGate } from "@/components/atoms/feature-gate";
import { Spinner } from "@/components/atoms/spinner";
import { FinancesIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import {
  UpsertBudgetCategoryDialog,
  type UpsertBudgetCategoryValues,
} from "@/components/molecules/upsert-budget-category-dialog";
import {
  UpsertBudgetPeriodDialog,
  type UpsertBudgetPeriodValues,
} from "@/components/molecules/upsert-budget-period-dialog";
import { BudgetVsActualBar } from "@/components/organisms/charts/budget-vs-actual-bar";
import { CashFlowSCurve } from "@/components/organisms/charts/cash-flow-s-curve";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectBudget,
  useCreateBudgetCategory,
  useCreateBudgetPeriod,
} from "@/hooks/use-budget";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { formatCurrency } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
import { BudgetAllocationSection } from "../budget/budget-allocation-section";
import { CategoryCard } from "../budget/category-card";
import { PeriodCard } from "../budget/period-card";
import { toCategoryInput, toPeriodInput } from "../budget/budget-helpers";
import { TabHeader } from "./finance-tabs";

function percentOfPlanned(amount: number, planned: number): number {
  return planned > 0 ? Math.round((amount / planned) * 100) : 0;
}

/** Budget — cost categories with planned, committed and actual figures, plus the monthly forecast. */
export function BudgetTab() {
  const { project, access } = useProjectContext();
  const canManage = Boolean(access && canResourceAction(access, "finances", "manage"));
  const currency = project.currency;
  const { data: budget, isPending } = useProjectBudget(project.id);
  const { data: snapshot, isLoading: isSnapshotLoading } = useReportingSnapshot(project.id);

  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [createPeriodOpen, setCreatePeriodOpen] = useState(false);

  const createCategory = useCreateBudgetCategory();
  const createPeriod = useCreateBudgetPeriod();

  function handleCreateCategory(values: UpsertBudgetCategoryValues): void {
    createCategory.mutate(
      { projectId: project.id, ...toCategoryInput(values) },
      { onSuccess: () => setCreateCategoryOpen(false) },
    );
  }

  function handleCreatePeriod(values: UpsertBudgetPeriodValues): void {
    createPeriod.mutate(
      { projectId: project.id, ...toPeriodInput(values) },
      { onSuccess: () => setCreatePeriodOpen(false) },
    );
  }

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  const { categories = [], periods = [], summary } = budget ?? {};

  const effectiveTotalPlanned = categories.reduce((sum, cat) => sum + cat.effectivePlanned, 0);
  const effectiveTotalCommitted = categories.reduce((sum, cat) => sum + cat.effectiveCommitted, 0);
  const effectiveTotalActual = categories.reduce((sum, cat) => sum + cat.effectiveActual, 0);

  const sortedPeriods = [...periods].sort((a, b) => a.period.localeCompare(b.period));

  return (
    <section aria-label="Budget">
      <TabHeader
        heading="Budget"
        description="Planned, committed and actual cost by category."
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={() => setCreateCategoryOpen(true)}>
              <PlusIcon className="h-4 w-4" /> Add category
            </Button>
          ) : undefined
        }
      />

      <UpsertBudgetCategoryDialog
        open={createCategoryOpen}
        onOpenChange={setCreateCategoryOpen}
        mode="create"
        onSubmit={handleCreateCategory}
        isSubmitting={createCategory.isPending}
        error={(createCategory.error as Error | undefined)?.message ?? null}
        currency={currency}
      />

      {summary ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <KpiCard label="Total planned" value={formatCurrency(effectiveTotalPlanned, currency)} />
          <KpiCard
            label="Committed"
            value={formatCurrency(effectiveTotalCommitted, currency)}
            helper={`${percentOfPlanned(effectiveTotalCommitted, effectiveTotalPlanned)}% of planned`}
          />
          <KpiCard
            label="Actual spent"
            value={formatCurrency(effectiveTotalActual, currency)}
            helper={`${percentOfPlanned(effectiveTotalActual, effectiveTotalPlanned)}% of planned`}
          />
          <KpiCard
            label="Variance"
            value={`${summary.totalVariance >= 0 ? "+" : ""}${formatCurrency(summary.totalVariance, currency)}`}
            tone={summary.totalVariance >= 0 ? undefined : "danger"}
          />
          {snapshot?.finance?.budget ? (
            <KpiCard
              label="Variance status"
              value={`${snapshot.finance.budget.overBudgetCount} of ${snapshot.finance.budget.categoryCount}`}
              helper="categories over budget"
              tone={snapshot.finance.budget.overBudgetCount > 0 ? "danger" : undefined}
            />
          ) : null}
        </div>
      ) : null}

      <BudgetAllocationSection categories={categories} currency={currency} />

      <FeatureGate flag="projects.reporting">
        {snapshot ? (
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CashFlowSCurve
              points={snapshot.finance.cashFlow.points}
              programmeCurve={snapshot.schedule.programmeCostCurve}
              currency={snapshot.currency}
              isLoading={isSnapshotLoading}
            />
            <BudgetVsActualBar
              categories={snapshot.finance.budget.categories}
              currency={snapshot.currency}
              isLoading={isSnapshotLoading}
            />
          </div>
        ) : null}
      </FeatureGate>

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-gray-900">Cost categories</h2>
        {categories.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<FinancesIcon />}
            title="No cost categories yet"
            description="Add budget categories to track your planned vs actual costs."
            action={canManage ? { label: "Add category", onClick: () => setCreateCategoryOpen(true) } : undefined}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                projectId={project.id}
                category={category}
                currency={currency}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-16">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">Monthly cash flow</h2>
          {canManage ? (
            <Button variant="secondary" size="sm" onClick={() => setCreatePeriodOpen(true)}>
              Add month
            </Button>
          ) : null}
        </div>

        <UpsertBudgetPeriodDialog
          open={createPeriodOpen}
          onOpenChange={setCreatePeriodOpen}
          mode="create"
          onSubmit={handleCreatePeriod}
          isSubmitting={createPeriod.isPending}
          currency={currency}
        />

        {sortedPeriods.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<FinancesIcon />}
            title="No cash flow data yet"
            description="Add monthly forecasts to track your project's spend over time."
            action={canManage ? { label: "Add month", onClick: () => setCreatePeriodOpen(true) } : undefined}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {sortedPeriods.map((period) => (
              <PeriodCard
                key={period.id}
                projectId={project.id}
                period={period}
                currency={currency}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

BudgetTab.displayName = "BudgetTab";
