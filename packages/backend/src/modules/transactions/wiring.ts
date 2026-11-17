import type { Knex } from "knex";
import type { AuthorizationRequest, AuthorizedProject } from "../../lib/authorization-request.ts";
import { stagesRepository } from "../stages/repository.ts";
import { expenseReaderId } from "./access.ts";
import { customCategoriesRepository, transactionsRepository } from "./repository.ts";
import { transactionsService } from "./service.ts";

export function buildTransactionsService(db: Knex, request: AuthorizationRequest, project: AuthorizedProject) {
  const stages = stagesRepository(db);
  return transactionsService(transactionsRepository(db, expenseReaderId(request, project)), customCategoriesRepository(db), {
    stageBelongsToProject: async (projectId, stageId) => (await stages.findById(stageId))?.project_id === projectId,
  });
}
