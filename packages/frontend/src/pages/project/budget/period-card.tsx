import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  useEditBudgetPeriod,
  useDeleteBudgetPeriod,
  type BudgetPeriod,
} from "@/hooks/use-budget";
import {
  UpsertBudgetPeriodDialog,
  type UpsertBudgetPeriodValues,
} from "@/components/molecules/upsert-budget-period-dialog";
import { formatCurrency } from "@/lib/formatters";
import { Metric } from "./metric";
import { toPeriodInput, toPeriodValues, formatMonth } from "./budget-helpers";

export function PeriodCard({
  projectId,
  period,
  currency,
  canManage,
}: {
  projectId: string;
  period: BudgetPeriod;
  currency: string;
  canManage: boolean;
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
        title="Delete period"
        description={`Are you sure you want to delete the budget for ${formatMonth(
          period.period,
        )}? This action cannot be undone.`}
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
