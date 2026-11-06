import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { MoneyInput } from "@/components/atoms/money-input";
import { useChangeRequestBudgetLinks, useSetChangeRequestBudgetLinks } from "@/hooks/use-change-requests";
import { useProjectBudget } from "@/hooks/use-budget";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { currencySymbol, formatCurrency } from "@/lib/formatters";
import type { ChangeRequestDetail } from "@/lib/project-types";

export function ChangeRequestBudgetAllocations({ projectId, cr }: { projectId: string; cr: ChangeRequestDetail }) {
  const { data: budget } = useProjectBudget(projectId);
  const { data: links = [], isPending } = useChangeRequestBudgetLinks(projectId, cr.id);
  const setLinks = useSetChangeRequestBudgetLinks();
  
  const [allocations, setAllocations] = useState<Array<{categoryId: string; amount: string}>>([]);

  useEffect(() => {
    if (!isPending) {
      if (links.length > 0) {
        setAllocations(links.map(l => ({ categoryId: l.budgetCategoryId, amount: String(l.amount) })));
      } else {
        const first = budget?.categories?.[0];
        if (first) {
          setAllocations([{ categoryId: first.id, amount: "" }]);
        }
      }
    }
  }, [links, isPending, budget?.categories]);

  if (isPending || !budget) return null;

  const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const isOver = totalAllocated > cr.costImpact;

  function handleSave() {
    setLinks.mutate(
      {
        projectId,
        changeId: cr.id,
        links: allocations
          .filter((a) => a.categoryId && Number(a.amount) > 0)
          .map((a) => ({ budgetCategoryId: a.categoryId, amount: Number(a.amount) })),
      },
      { onError: (error) => toast(getApiErrorMessage(error), "error") },
    );
  }

  function addRow() {
    const first = budget?.categories?.[0];
    if (first) {
      setAllocations([...allocations, { categoryId: first.id, amount: "" }]);
    }
  }

  function updateRow(idx: number, field: "categoryId" | "amount", val: string) {
    const copy = [...allocations];
    const item = copy[idx];
    if (item) {
      if (field === "categoryId") item.categoryId = val;
      if (field === "amount") item.amount = val;
      setAllocations(copy);
    }
  }

  function removeRow(idx: number) {
    setAllocations(allocations.filter((_, i) => i !== idx));
  }

  return (
    <div className="mt-6 border-t border-line-hair pt-5">
      <p className="text-xs font-medium uppercase text-ink-muted mb-3">
        Allocate to budget categories
      </p>
      
      <div className="flex flex-col gap-2">
        {allocations.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={a.categoryId}
              onChange={e => updateRow(i, "categoryId", e.target.value)}
              className={cn(INPUT_SM_CLASS, "flex-1")}
            >
              {budget.categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <MoneyInput
              currencySymbol={currencySymbol(cr.currency)}
              value={a.amount}
              onChange={val => updateRow(i, "amount", val)}
              className="w-32"
            />
            <Button variant="ghost" size="sm" className="text-negative-500" onClick={() => removeRow(i)}>
              ✕
            </Button>
          </div>
        ))}
      </div>
      
      <div className="mt-3 flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={addRow}>+ Add category</Button>
        <div className="flex items-center gap-4">
          <span className={cn("text-sm font-medium", isOver ? "text-negative-500" : "text-ink")}>
            Total: {formatCurrency(totalAllocated, cr.currency)} / {formatCurrency(cr.costImpact, cr.currency)}
          </span>
          <Button 
            variant="primary" 
            size="sm" 
            loading={setLinks.isPending}
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

ChangeRequestBudgetAllocations.displayName = "ChangeRequestBudgetAllocations";
