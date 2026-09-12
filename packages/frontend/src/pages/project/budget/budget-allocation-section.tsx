import { useMemo } from "react";
import type { BudgetCategory } from "@/api/budget";
import type { BudgetPhase, Currency } from "@/lib/project-types";
import { AllocationBreakdown } from "./allocation-breakdown";
import { PlannedVsActualChart } from "./planned-vs-actual-chart";

const CARD_CLASS = "rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0";

/**
 * Allocation and variance read straight off the cost categories, so the charts
 * and the category cards below them always describe the same records.
 */
export function BudgetAllocationSection({
  categories,
  currency,
}: {
  categories: BudgetCategory[];
  currency: Currency;
}) {
  const allocation = useMemo<BudgetPhase[]>(
    () =>
      categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        planned: cat.effectivePlanned,
        actual: cat.effectiveActual,
      })),
    [categories],
  );

  if (allocation.length === 0) return null;

  return (
    <section aria-label="Budget allocation" className="mt-8 flex flex-col gap-5">
      <AllocationBreakdown allocation={allocation} currency={currency} className={CARD_CLASS} />
      <PlannedVsActualChart allocation={allocation} currency={currency} className={CARD_CLASS} />
    </section>
  );
}

BudgetAllocationSection.displayName = "BudgetAllocationSection";
