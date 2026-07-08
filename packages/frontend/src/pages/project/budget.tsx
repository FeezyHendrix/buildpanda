import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { CashFlowSCurve } from "@/components/organisms/charts/cash-flow-s-curve";
import { BudgetVsActualBar } from "@/components/organisms/charts/budget-vs-actual-bar";

import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { FinancesIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectBudget,
  useCreateBudgetCategory,
  useCreateBudgetPeriod,
} from "@/hooks/use-budget";
import {
  UpsertBudgetCategoryDialog,
  type UpsertBudgetCategoryValues,
} from "@/components/molecules/upsert-budget-category-dialog";
import {
  UpsertBudgetPeriodDialog,
  type UpsertBudgetPeriodValues,
} from "@/components/molecules/upsert-budget-period-dialog";
import { formatCurrency } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
import { cn } from "@/lib/utils";

import { CategoryCard } from "./budget/category-card";
import { PeriodCard } from "./budget/period-card";
import { toCategoryInput, toPeriodInput } from "./budget/budget-helpers";
export default function ProjectBudget() {
  const { project, access } = useProjectContext();
  const canManage = Boolean(access && canResourceAction(access, "finances", "manage"));
  const currency = project.currency;
  const { data: budget, isPending } = useProjectBudget(project.id);
  const { data: snapshot, isLoading: isSnapshotLoading } = useReportingSnapshot(
    project.id,
  );

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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#004DE7] border-t-transparent" />
      </div>
    );
  }

  const { categories = [], periods = [], summary } = budget ?? {};

  const effectiveTotalPlanned = categories.reduce(
    (sum, cat) => sum + cat.effectivePlanned,
    0,
  );
  const effectiveTotalCommitted = categories.reduce(
    (sum, cat) => sum + cat.effectiveCommitted,
    0,
  );
  const effectiveTotalActual = categories.reduce(
    (sum, cat) => sum + cat.effectiveActual,
    0,
  );

  const sortedPeriods = [...periods].sort((a, b) =>
    a.period.localeCompare(b.period),
  );

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Finances", to: `/project/${project.id}/finances` },
          { label: "Budget" },
        ]}
        className="mb-4"
      />

      <PageHeader
        title="Budget"
        description="Track and manage the project's financial budget, cost categories, and cash flow."
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateCategoryOpen(true)}
            >
              <PlusIcon className="h-4 w-4" /> Add Category
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
        currency={currency}
      />

      {summary && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
          <KpiCard label="Total Planned">
            <p className="text-base font-bold tabular-nums text-gray-900">
              {formatCurrency(effectiveTotalPlanned, currency)}
            </p>
          </KpiCard>
          <KpiCard label="Committed">
            <p className="text-base font-bold tabular-nums text-gray-900">
              {formatCurrency(effectiveTotalCommitted, currency)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {effectiveTotalPlanned > 0
                ? Math.round(
                    (effectiveTotalCommitted / effectiveTotalPlanned) * 100,
                  )
                : 0}
              % of planned
            </p>
          </KpiCard>
          <KpiCard label="Actual Spent">
            <p className="text-base font-bold tabular-nums text-gray-900">
              {formatCurrency(effectiveTotalActual, currency)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {effectiveTotalPlanned > 0
                ? Math.round(
                    (effectiveTotalActual / effectiveTotalPlanned) * 100,
                  )
                : 0}
              % of planned
            </p>
          </KpiCard>
          <KpiCard label="Variance">
            <p
              className={cn(
                "text-base font-bold tabular-nums",
                summary.totalVariance >= 0
                  ? "text-[#1B8E45]"
                  : "text-[#E5484D]",
              )}
            >
              {summary.totalVariance >= 0 ? "+" : ""}
              {formatCurrency(summary.totalVariance, currency)}
            </p>
          </KpiCard>
          {snapshot?.finance?.budget && (
            <KpiCard label="Variance Status">
              <p className="text-base font-bold text-[#E5484D]">
                {snapshot.finance.budget.overBudgetCount} of{" "}
                {snapshot.finance.budget.categoryCount} over budget
              </p>
            </KpiCard>
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {snapshot && (
          <>
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
          </>
        )}
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-gray-900">
          Cost Categories
        </h2>
        {categories.length === 0 ? (
          <EmptyState
            icon={<FinancesIcon className="h-6 w-6" />}
            title="No cost categories"
            description="Add budget categories to track your planned vs actual costs."
            action={
              canManage ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCreateCategoryOpen(true)}
                >
                  Add category
                </Button>
              ) : undefined
            }
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
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">
            Monthly Cash Flow
          </h2>
          {canManage && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCreatePeriodOpen(true)}
            >
              Add Month
            </Button>
          )}
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
            icon={<FinancesIcon className="h-6 w-6" />}
            title="No cash flow data"
            description="Add monthly forecasts to track your project's spend over time."
            action={
              canManage ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCreatePeriodOpen(true)}
                >
                  Add month
                </Button>
              ) : undefined
            }
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
    </div>
  );
}
