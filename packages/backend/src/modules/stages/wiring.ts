import type { Knex } from "knex";
import { activitiesRepository } from "../activities/repository.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { contractsRepository } from "../contracts/repository.ts";
import { contractsService } from "../contracts/service.ts";
import { dailyLogsRepository } from "../daily-logs/repository.ts";
import { documentsRepository } from "../documents/repository.ts";
import { claimChain } from "../finances/claim-chain.ts";
import { financesRepository } from "../finances/repository.ts";
import { purchaseOrdersRepository } from "../purchase-orders/repository.ts";
import { transactionsRepository } from "../transactions/repository.ts";
import { phaseRollup } from "./phase-rollup.ts";
import { stagesRepository } from "./repository.ts";
import { stagesService } from "./service.ts";

function composeStagesService(db: Knex, readerId?: string, readOnly = false) {
  const buildings = buildingsRepository(db);
  const finances = financesRepository(db);
  const stages = stagesRepository(db);
  const contracts = contractsService(contractsRepository(db), {
    finances,
    stages,
    documents: documentsRepository(db),
  });
  return stagesService(
    stages,
    (projectId) => buildings.soleRealBuildingId(projectId),
    async (projectId) => {
      const summary = await finances.findSummary(projectId);
      return summary ? Number(summary.contract_sum) : 0;
    },
    async (projectId, stage) => {
      await claimChain(finances).markStageMilestonesClaimable(projectId, stage, null);
    },
    {
      rollup: phaseRollup({
        dailyLogs: dailyLogsRepository(db),
        purchaseOrders: purchaseOrdersRepository(db),
        transactions: transactionsRepository(db, readerId),
        mainContractId: async (projectId) => readOnly ? await contracts.recordedMainContractId(projectId) : contracts.mainContractId(projectId),
      }),
      contractBelongsToProject: (projectId, contractId) => contracts.belongsToProject(projectId, contractId),
    },
    (stageId) => activitiesRepository(db).countByPhase(stageId),
  );

}

export const buildStagesService = (db: Knex, readerId?: string) => composeStagesService(db, readerId);
export const buildStagesReadService = (db: Knex, readerId?: string) => composeStagesService(db, readerId, true);
