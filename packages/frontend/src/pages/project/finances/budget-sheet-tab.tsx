import { useCallback, useMemo, useState } from "react";
import { useProjectContext } from "@/layouts/project-layout";
import { useStages } from "@/hooks/use-stages";
import { formatCurrency } from "@/lib/formatters";
import { Money } from "@/lib/money";
import { canResourceAction, type Stage } from "@/lib/project-types";
import { BillingSheet } from "./contract/billing-sheet";
import { ExpensePanel } from "./expenses/expense-panel";
import { ScheduleOfValuesDrawer } from "./schedule-of-values-drawer";
import { StageValueDrawer } from "./stage-value-drawer";

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <ExpensePanel title={label}>
      <div className="px-[24px] pb-[22px] pt-[16px]">
        <p className="truncate text-[24px] font-medium leading-[32px] tracking-[-0.02em] tabular-nums text-[#1E1E1E]">{value}</p>
        <p className="mt-[4px] truncate text-caption-l text-[#737373]">{helper}</p>
      </div>
    </ExpensePanel>
  );
}

SummaryCard.displayName = "SummaryCard";

/**
 * Budget — the contract side of a build read phase by phase.
 *
 * Each phase carries a scheduled value (its slice of the contract). The
 * billing sheet records, month by month, the cumulative share of each phase
 * that was reached, and prices what that month bills. Everything on this tab
 * is a recorded figure: BuildPanda logs money that moved off-platform, it
 * never bills, charges or transfers anything.
 */
export function BudgetSheetTab() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "stages", "manage");
  const canBill = canResourceAction(access, "finances", "manage");
  // Cost columns are the contractor's internal position, never the client's.
  const showCosts = access?.capabilities?.canViewCosts ?? false;
  const { data: stages = [] } = useStages(project.id);

  const [valueTarget, setValueTarget] = useState<Stage | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<Stage | null>(null);

  const totals = useMemo(() => {
    const priced = stages.filter((stage) => stage.value > 0).length;
    return {
      value: Money.sum(stages.map((stage) => stage.value)),
      priced,
      unpriced: stages.length - priced,
    };
  }, [stages]);

  const closeValueDrawer = useCallback((next: boolean) => {
    if (!next) setValueTarget(null);
  }, []);
  const closeScheduleDrawer = useCallback((next: boolean) => {
    if (!next) setScheduleTarget(null);
  }, []);

  return (
    <section aria-label="Budget">
      <section aria-label="Contract summary" className="grid gap-[24px] sm:grid-cols-2">
        <SummaryCard
          label="Scheduled contract value"
          value={formatCurrency(totals.value.round().toNumber(), project.currency)}
          helper="For the selected build stage"
        />
        <SummaryCard
          label="Phases priced"
          value={`${totals.priced} of ${stages.length}`}
          helper={totals.unpriced > 0 ? `${totals.unpriced} still carry no value` : "Every phase carries a value"}
        />
      </section>

      <BillingSheet
        projectId={project.id}
        currency={project.currency}
        canManage={canManage}
        canBill={canBill}
        showCosts={showCosts}
        onEditValue={setValueTarget}
        onOpenSchedule={setScheduleTarget}
      />

      <p className="mt-[16px] text-[11px] leading-[16px] text-[#737373]">
        Each cell is the cumulative % of the phase reached by the end of that month; the amount
        beneath is what the month bills. Recorded, not transacted — BuildPanda logs money that
        moved off-platform.
      </p>

      <StageValueDrawer
        open={valueTarget !== null}
        onOpenChange={closeValueDrawer}
        projectId={project.id}
        stage={valueTarget}
        currency={project.currency}
      />

      <ScheduleOfValuesDrawer
        open={scheduleTarget !== null}
        onOpenChange={closeScheduleDrawer}
        projectId={project.id}
        stage={scheduleTarget}
        currency={project.currency}
        canManage={canManage}
      />
    </section>
  );
}

BudgetSheetTab.displayName = "BudgetSheetTab";
