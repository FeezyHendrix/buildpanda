import { useCallback, useMemo, useState } from "react";
import { KpiCard } from "@/components/molecules/kpi-card";
import { useProjectContext } from "@/layouts/project-layout";
import { useStages } from "@/hooks/use-stages";
import { formatCurrency } from "@/lib/formatters";
import { Money } from "@/lib/money";
import { canResourceAction, type Stage } from "@/lib/project-types";
import { BillingSheet } from "./contract/billing-sheet";
import { ScheduleOfValuesDrawer } from "./schedule-of-values-drawer";
import { StageValueDrawer } from "./stage-value-drawer";

/**
 * Stages & billing — the contract side of a build read stage by stage.
 *
 * Each stage carries a scheduled value (its slice of the contract). The
 * billing sheet records, month by month, the cumulative share of each stage
 * that was reached, and prices what that month bills. Everything on this tab
 * is a recorded figure: BuildPanda logs money that moved off-platform, it
 * never bills, charges or transfers anything.
 */
export function ContractStagesTab() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "stages", "manage");
  const canBill = canResourceAction(access, "finances", "manage");
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
    <section aria-label="Stages and billing">
      <section aria-label="Contract summary" className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label="Scheduled contract value"
          value={formatCurrency(totals.value.round().toNumber(), project.currency)}
          helper="Across every stage on this build"
        />
        <KpiCard
          label="Stages priced"
          value={`${totals.priced} of ${stages.length}`}
          helper={
            totals.unpriced > 0
              ? `${totals.unpriced} still carry no value`
              : "Every stage carries a value"
          }
        />
      </section>

      <BillingSheet
        projectId={project.id}
        currency={project.currency}
        canManage={canManage}
        canBill={canBill}
        onEditValue={setValueTarget}
        onOpenSchedule={setScheduleTarget}
      />

      <p className="mt-3 text-[12px] text-black-200">
        Each cell is the cumulative % of the stage reached by the end of that month; the amount
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

ContractStagesTab.displayName = "ContractStagesTab";
