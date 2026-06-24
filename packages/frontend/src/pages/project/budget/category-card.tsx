import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  useEditBudgetCategory,
  useDeleteBudgetCategory,
  type BudgetCategory,
} from "@/hooks/use-budget";
import {
  UpsertBudgetCategoryDialog,
  type UpsertBudgetCategoryValues,
} from "@/components/molecules/upsert-budget-category-dialog";
import { formatCurrency } from "@/lib/formatters";
import { Metric } from "./metric";
import { toCategoryInput, toCategoryValues } from "./budget-helpers";

export function CategoryCard({
  projectId,
  category,
  currency,
  canManage,
}: {
  projectId: string;
  category: BudgetCategory;
  currency: string;
  canManage: boolean;
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
        {canManage && (
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
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric
          label="Planned"
          value={formatCurrency(category.effectivePlanned, currency)}
          secondaryValue={category.effectivePlanned !== category.planned ? formatCurrency(category.planned, currency) : undefined}
          projectedValue={category.projectedPlanned !== category.effectivePlanned ? formatCurrency(category.projectedPlanned, currency) : undefined}
        />
        <Metric
          label="Committed"
          value={formatCurrency(category.effectiveCommitted, currency)}
        />
        <Metric
          label="Actual"
          value={formatCurrency(category.effectiveActual, currency)}
          secondaryValue={category.effectiveActual !== category.actual ? formatCurrency(category.actual, currency) : undefined}
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
