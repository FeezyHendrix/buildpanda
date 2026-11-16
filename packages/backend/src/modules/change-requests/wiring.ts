import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { contractsRepository } from "../contracts/repository.ts";
import { contractsService } from "../contracts/service.ts";
import { documentsRepository } from "../documents/repository.ts";
import { financesRepository } from "../finances/repository.ts";
import { financesService } from "../finances/service.ts";
import { transactionalNotifications } from "../notifications/transactional.ts";
import { stagesRepository } from "../stages/repository.ts";
import { stagesService } from "../stages/service.ts";
import { applyTimeAward } from "../projects/time-award.ts";
import { changeActions } from "./change-actions.ts";
import { changeRequestsRepository } from "./repository.ts";
import { changeRequestsService } from "./service.ts";

export function buildChangeServices(db: Knex, queue?: Pick<QueueManager, "enqueue">) {
  const notifications = transactionalNotifications(db, queue);
  const financesRepo = financesRepository(db);
  const finances = financesService(financesRepo);
  const contracts = contractsService(contractsRepository(db), {
    finances: financesRepo,
    stages: stagesRepository(db),
    documents: documentsRepository(db),
  });
  const repository = changeRequestsRepository(db);
  const stages = stagesService(stagesRepository(db), async () => undefined);
  const service = changeRequestsService(repository, {
    notifications: notifications.service,
    contracts,
    recordVariation: async (projectId, input, actor) => {
      await finances.recordVariation(projectId, { amount: input.amount, description: input.description }, actor);
    },
  });

  /**
   * A decision on a time claim moves the contract: approving an `eot_only`
   * change awards the days through the projects module, which owns the revised
   * completion date and the contractual key dates that follow it. Executing any
   * change shifts the stage it was claimed against, which is a programme move.
   */
  const actions = changeActions(repository, {
    assertExecutable: (row) => service.assertExecutable(row),
    shiftStageEnd: async (projectId, stageId, days) => {
      const stage = (await stages.list(projectId)).find((s) => s.id === stageId);
      if (!stage?.endDate) return;
      const moved = new Date(`${stage.endDate}T00:00:00Z`);
      moved.setUTCDate(moved.getUTCDate() + days);
      await stages.update(projectId, stageId, { endDate: moved.toISOString().slice(0, 10) });
    },
    applyTimeAward: async (projectId, days) => {
      await db.transaction((trx) => applyTimeAward(projectId, days, trx));
    },
    onApproved: (row, actor) => service.onApproved(row, { id: actor.id, name: actor.name }),
    onDecided: (row, action, reason, actor) => {
      if (action === "reject") service.notifyDecided(row, "Rejected", actor.id, reason);
      else if (action === "approve") service.notifyDecided(row, "Approved", actor.id);
      else if (action === "submit" || action === "resubmit") {
        service.notifyDecided(row, "Submitted", actor.id);
      }
    },
  });

  return { service, actions, repository, flush: notifications.flush };
}
