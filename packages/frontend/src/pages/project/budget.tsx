import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { FinancesIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectBudget,
  useCreateBudgetCategory,
  useEditBudgetCategory,
  useDeleteBudgetCategory,
  useCreateBudgetPeriod,
  useEditBudgetPeriod,
  useDeleteBudgetPeriod,
  type BudgetCategory,
  type BudgetPeriod,
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
import { cn } from "@/lib/utils";

function toCategoryInput(values: UpsertBudgetCategoryValues) {
  return {
    name: values.name,
    costCode: values.costCode || undefined,
    planned: values.planned ? Number(values.planned) : undefined,
    committed: values.committed ? Number(values.committed) : undefined,
    actual: values.actual ? Number(values.actual) : undefined,
    notes: values.notes || undefined,
  };
}

function toCategoryValues(cat: BudgetCategory): UpsertBudgetCategoryValues {
  return {
    name: cat.name,
    costCode: cat.costCode ?? "",
    planned: String(cat.planned),
    committed: String(cat.committed),
    actual: String(cat.actual),
    notes: cat.notes ?? "",
  };
}

function toPeriodInput(values: UpsertBudgetPeriodValues) {
  return {
    period: values.period,
    planned: values.planned ? Number(values.planned) : undefined,
    actual: values.actual ? Number(values.actual) : undefined,
    notes: values.notes || undefined,
  };
}

function toPeriodValues(period: BudgetPeriod): UpsertBudgetPeriodValues {
  return {
    period: period.period,
    planned: String(period.planned),
    actual: String(period.actual),
    notes: period.notes ?? "",
  };
}

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

export default function ProjectBudget() {
  const { project } = useProjectContext();
  const currency = project.currency;
  const { data: budget, isPending } = useProjectBudget(project.id);

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

  const sortedPeriods = [...periods].sort((a, b) =>
    a.period.localeCompare(b.period),
  );

  return (
    <div className="mx-auto max-w-6xl pb-24">
      <PageHeader
        title="Budget"
        description="Track and manage the project's financial budget, cost categories, and cash flow."
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => setCreateCategoryOpen(true)}
          >
            <PlusIcon className="h-4 w-4" /> Add Category
          </Button>
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
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
          <KpiCard label="Total Planned">
            <p className="text-base font-bold tabular-nums text-gray-900">
              {formatCurrency(summary.totalPlanned, currency)}
            </p>
          </KpiCard>
          <KpiCard label="Committed">
            <p className="text-base font-bold tabular-nums text-gray-900">
              {formatCurrency(summary.totalCommitted, currency)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {summary.percentCommitted}% of planned
            </p>
          </KpiCard>
          <KpiCard label="Actual Spent">
            <p className="text-base font-bold tabular-nums text-gray-900">
              {formatCurrency(summary.totalActual, currency)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {summary.percentSpent}% of planned
            </p>
          </KpiCard>
          <KpiCard label="Variance">
            <p
              className={cn(
                "text-base font-bold tabular-nums",
                summary.totalVariance >= 0 ? "text-[#1B8E45]" : "text-[#E5484D]",
              )}
            >
              {summary.totalVariance >= 0 ? "+" : ""}
              {formatCurrency(summary.totalVariance, currency)}
            </p>
          </KpiCard>
        </div>
      )}

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
              <Button variant="secondary" size="sm" onClick={() => setCreateCategoryOpen(true)}>
                Add category
              </Button>
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCreatePeriodOpen(true)}
          >
            Add Month
          </Button>
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
              <Button variant="secondary" size="sm" onClick={() => setCreatePeriodOpen(true)}>
                Add month
              </Button>
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
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CategoryCard({
  projectId,
  category,
  currency,
}: {
  projectId: string;
  category: BudgetCategory;
  currency: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const editCategory = useEditBudgetCategory();
  const deleteCategory = useDeleteBudgetCategory();

  function handleEdit(values: UpsertBudgetCategoryValues): void {
    editCategory.mutate(
      { projectId, categoryId: category.id, ...toCategoryInput(values) },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-gray-900">
              {category.name}
            </p>
          </div>
          {category.costCode && (
            <p className="mt-0.5 text-xs text-gray-500">{category.costCode}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric
          label="Planned"
          value={formatCurrency(category.planned, currency)}
        />
        <Metric
          label="Committed"
          value={formatCurrency(category.committed, currency)}
        />
        <Metric
          label="Actual"
          value={formatCurrency(category.actual, currency)}
        />
        <Metric
          label="Variance"
          value={`${category.variance >= 0 ? "+" : ""}${formatCurrency(
            category.variance,
            currency,
          )}`}
          valueClassName={
            category.variance >= 0 ? "text-[#1B8E45]" : "text-[#E5484D]"
          }
        />
        <Metric label="Spent" value={`${category.percentSpent}%`} />
      </div>

      {category.notes && (
        <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          {category.notes}
        </div>
      )}

      <UpsertBudgetCategoryDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={toCategoryValues(category)}
        onSubmit={handleEdit}
        isSubmitting={editCategory.isPending}
        currency={currency}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete category"
        description={`Are you sure you want to delete "${category.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          deleteCategory.mutate(
            { projectId, categoryId: category.id },
            { onSuccess: () => setDeleteOpen(false) },
          );
        }}
      />
    </Card>
  );
}

function PeriodCard({
  projectId,
  period,
  currency,
}: {
  projectId: string;
  period: BudgetPeriod;
  currency: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const editPeriod = useEditBudgetPeriod();
  const deletePeriod = useDeleteBudgetPeriod();

  function handleEdit(values: UpsertBudgetPeriodValues): void {
    editPeriod.mutate(
      { projectId, periodId: period.id, ...toPeriodInput(values) },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-gray-900">
            {formatMonth(period.period)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric
          label="Planned"
          value={formatCurrency(period.planned, currency)}
        />
        <Metric
          label="Actual"
          value={formatCurrency(period.actual, currency)}
        />
        <Metric
          label="Variance"
          value={`${period.variance >= 0 ? "+" : ""}${formatCurrency(
            period.variance,
            currency,
          )}`}
          valueClassName={
            period.variance >= 0 ? "text-[#1B8E45]" : "text-[#E5484D]"
          }
        />
      </div>

      {period.notes && (
        <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          {period.notes}
        </div>
      )}

      <UpsertBudgetPeriodDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={toPeriodValues(period)}
        onSubmit={handleEdit}
        isSubmitting={editPeriod.isPending}
        currency={currency}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete month"
        description={`Are you sure you want to delete the forecast for ${formatMonth(
          period.period,
        )}?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          deletePeriod.mutate(
            { projectId, periodId: period.id },
            { onSuccess: () => setDeleteOpen(false) },
          );
        }}
      />
    </Card>
  );
}

function Metric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className={cn("text-sm font-semibold text-gray-900", valueClassName)}>
        {value}
      </span>
    </div>
  );
}
