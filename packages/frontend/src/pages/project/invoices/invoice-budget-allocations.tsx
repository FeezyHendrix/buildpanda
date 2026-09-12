import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { MoneyInput } from "@/components/atoms/money-input";
import { useProjectBudget } from "@/hooks/use-budget";
import {
  useInvoiceAllocations,
  useSetInvoiceAllocations,
  type Invoice,
} from "@/hooks/use-invoices";
import { formatCurrency, currencySymbol } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export function InvoiceBudgetAllocations({
  projectId,
  invoice,
  currency,
  canManage,
}: {
  projectId: string;
  invoice: Invoice;
  currency: string;
  canManage: boolean;
}) {
  const { data: budget } = useProjectBudget(projectId);
  const { data: allocationsData = [], isPending } = useInvoiceAllocations(
    projectId,
    invoice.id,
  );
  const setAllocations = useSetInvoiceAllocations();

  const [allocations, setAllocationsState] = useState<
    Array<{ categoryId: string; amount: string }>
  >([]);

  useEffect(() => {
    if (!isPending) {
      if (allocationsData.length > 0) {
        setAllocationsState(
          allocationsData.map((a) => ({
            categoryId: a.budgetCategoryId,
            amount: String(a.amount),
          })),
        );
      } else {
        const first = budget?.categories?.[0];
        if (first) {
          setAllocationsState([
            { categoryId: first.id, amount: String(invoice.totalInvoiced) },
          ]);
        }
      }
    }
  }, [allocationsData, isPending, budget?.categories, invoice.totalInvoiced]);

  if (isPending || !budget) return null;

  const totalAllocated = allocations.reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
    0,
  );
  const isOver = totalAllocated > invoice.totalInvoiced;

  function handleSave() {
    setAllocations.mutate({
      projectId,
      invoiceId: invoice.id,
      allocations: allocations
        .filter((a) => a.categoryId && Number(a.amount) > 0)
        .map((a) => ({
          budgetCategoryId: a.categoryId,
          amount: Number(a.amount),
        })),
    });
  }

  function addRow() {
    const first = budget?.categories?.[0];
    if (first) {
      setAllocationsState([
        ...allocations,
        { categoryId: first.id, amount: "" },
      ]);
    }
  }

  function updateRow(idx: number, field: "categoryId" | "amount", val: string) {
    setAllocationsState(
      allocations.map((row, i) => (i === idx ? { ...row, [field]: val } : row)),
    );
  }

  function removeRow(idx: number) {
    setAllocationsState(allocations.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line-hair pt-3">
      <p className="mb-1 text-xs font-medium uppercase text-ink-muted">
        Charge to budget category
      </p>
      <div className="flex flex-col gap-2">
        {allocations.map((a, i) => {
          const categoryName = budget.categories.find((c) => c.id === a.categoryId)?.name;
          if (!canManage) {
            return (
              <div key={i} className="flex items-center justify-between gap-2 text-sm text-gray-700">
                <span className="flex-1 truncate">{categoryName ?? "—"}</span>
                <span className="tabular-nums">{formatCurrency(Number(a.amount) || 0, currency)}</span>
              </div>
            );
          }
          return (
            <div key={i} className="flex items-center gap-2">
              <select
                value={a.categoryId}
                onChange={(e) => updateRow(i, "categoryId", e.target.value)}
                className={cn(INPUT_SM_CLASS, "flex-1")}
              >
                {budget.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <MoneyInput
                currencySymbol={currencySymbol(currency)}
                value={a.amount}
                onChange={(val) => updateRow(i, "amount", val)}
                className={cn(INPUT_SM_CLASS, "w-32")}
              />
              <Button variant="danger" size="sm" onClick={() => removeRow(i)}>
                ✕
              </Button>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        {canManage ? (
          <Button variant="secondary" size="sm" onClick={addRow}>
            + Add category
          </Button>
        ) : <span />}
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "text-sm font-medium",
              isOver ? "text-negative-600" : "text-gray-700",
            )}
          >
            Total: {formatCurrency(totalAllocated, currency)} /{" "}
            {formatCurrency(invoice.totalInvoiced, currency)}
          </span>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              loading={setAllocations.isPending}
              disabled={isOver}
              onClick={handleSave}
            >
              Save allocations
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
