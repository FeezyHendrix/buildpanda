import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
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
}: {
  projectId: string;
  invoice: Invoice;
  currency: string;
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
            { categoryId: first.id, amount: String(invoice.amount) },
          ]);
        }
      }
    }
  }, [allocationsData, isPending, budget?.categories, invoice.amount]);

  if (isPending || !budget) return null;

  const totalAllocated = allocations.reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
    0,
  );
  const isOver = totalAllocated > invoice.amount;

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
    <div className="flex flex-col gap-2 border-t border-[#F0F0F0] pt-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Charge to budget category
      </p>
      <div className="flex flex-col gap-2">
        {allocations.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={a.categoryId}
              onChange={(e) => updateRow(i, "categoryId", e.target.value)}
              className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm"
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
              className="h-9 w-32 rounded-lg border border-gray-200 px-3 text-sm"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-red-500"
              onClick={() => removeRow(i)}
            >
              ✕
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={addRow}>
          + Add category
        </Button>
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "text-sm font-medium",
              isOver ? "text-red-600" : "text-gray-700",
            )}
          >
            Total: {formatCurrency(totalAllocated, currency)} /{" "}
            {formatCurrency(invoice.amount, currency)}
          </span>
          <Button
            variant="primary"
            size="sm"
            loading={setAllocations.isPending}
            disabled={isOver}
            onClick={handleSave}
          >
            Save allocations
          </Button>
        </div>
      </div>
    </div>
  );
}
