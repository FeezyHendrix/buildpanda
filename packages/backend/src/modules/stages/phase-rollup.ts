import { Money } from "../../lib/money.ts";
import type { DailyLogsRepository } from "../daily-logs/repository.ts";
import type { PurchaseOrdersRepository } from "../purchase-orders/repository.ts";
import type { TransactionsRepository } from "../transactions/repository.ts";
import type { StageUsage } from "./types.ts";

/**
 * What the Phases tab shows next to each estimate: labour hours logged on the
 * stage's activities, material cost committed on purchase orders raised for
 * the stage, and total cost (materials + expenses logged against the stage).
 * Each figure is that module's own repository sum; this only stitches them.
 */
export interface PhaseRollupDeps {
  dailyLogs: Pick<DailyLogsRepository, "hoursByPhase">;
  purchaseOrders: Pick<PurchaseOrdersRepository, "committedByStage">;
  transactions: Pick<TransactionsRepository, "sumByStage">;
  /** Stages with no contract column resolve to the project's main contract. */
  mainContractId: (projectId: string) => Promise<string | null>;
}

export interface PhaseRollup {
  usageByStage: Map<string, StageUsage>;
  mainContractId: string | null;
}

export const EMPTY_USAGE: StageUsage = { usedLaborHours: 0, usedMaterialCost: 0, totalCost: 0 };

export function phaseRollup(deps: PhaseRollupDeps) {
  return {
    /** Three grouped queries for the whole project, never one per stage. */
    async forProject(projectId: string): Promise<PhaseRollup> {
      const [hours, committed, expenses, mainContractId] = await Promise.all([
        deps.dailyLogs.hoursByPhase(projectId),
        deps.purchaseOrders.committedByStage(projectId),
        deps.transactions.sumByStage(projectId),
        deps.mainContractId(projectId),
      ]);
      const usageByStage = new Map<string, StageUsage>();
      const ensure = (stageId: string): StageUsage => {
        let usage = usageByStage.get(stageId);
        if (!usage) {
          usage = { ...EMPTY_USAGE };
          usageByStage.set(stageId, usage);
        }
        return usage;
      };
      for (const row of hours) ensure(row.phase_id).usedLaborHours = Money.of(row.total).round(2).toNumber();
      for (const row of committed) ensure(row.stage_id).usedMaterialCost = Money.of(row.total).round(2).toNumber();
      const expenseByStage = new Map(expenses.map((row) => [row.stage_id, Money.of(row.total)]));
      for (const stageId of new Set([...usageByStage.keys(), ...expenseByStage.keys()])) {
        const usage = ensure(stageId);
        usage.totalCost = Money.of(usage.usedMaterialCost)
          .add(expenseByStage.get(stageId) ?? Money.zero())
          .round(2)
          .toNumber();
      }
      return { usageByStage, mainContractId };
    },
  };
}

export type PhaseRollupService = ReturnType<typeof phaseRollup>;
