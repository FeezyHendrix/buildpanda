import { NotFoundError } from "../../lib/errors.ts";
import type { PurchaseOrdersRepository } from "../purchase-orders/repository.ts";
import type { TransactionsRepository } from "../transactions/repository.ts";
import type { FinancesRepository } from "./repository.ts";
import type { StageCost, StageCostsResponse } from "./types.ts";

export interface StageCostsDeps {
  finances: Pick<FinancesRepository, "findSummary">;
  transactions: Pick<TransactionsRepository, "sumByStage">;
  purchaseOrders: Pick<PurchaseOrdersRepository, "committedByStage">;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Read-only view over the transactions and purchase-orders modules: each sum
// is that module's own repository query; this service only stitches them.
export function stageCostsService(deps: StageCostsDeps) {
  return {
    async byProject(projectId: string): Promise<StageCostsResponse> {
      const [summary, committedRows, actualRows] = await Promise.all([
        deps.finances.findSummary(projectId),
        deps.purchaseOrders.committedByStage(projectId),
        deps.transactions.sumByStage(projectId),
      ]);
      if (!summary) throw new NotFoundError("Project finances");

      // Actual cost is logged expenses only. invoice_budget_allocations attributes
      // a paid invoice to a budget category, not a stage, so paid invoices
      // cannot be folded in until an allocation carries a stage_id.
      const byStage = new Map<string, StageCost>();
      const ensure = (stageId: string): StageCost => {
        let cost = byStage.get(stageId);
        if (!cost) {
          cost = { stageId, committed: 0, actual: 0, currency: summary.currency };
          byStage.set(stageId, cost);
        }
        return cost;
      };
      for (const row of committedRows) ensure(row.stage_id).committed = round2(Number(row.total));
      for (const row of actualRows) ensure(row.stage_id).actual = round2(Number(row.total));

      return { stages: [...byStage.values()] };
    },
  };
}

export type StageCostsService = ReturnType<typeof stageCostsService>;
