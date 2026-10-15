import type { Knex } from "knex";
import { NO_RECORD_ACCESS, type AgentRecordScope } from "./record-scope.ts";
import { takeoffAgentRepository } from "./takeoff-repository.ts";
import { programmeAgentRepository } from "./programme-repository.ts";
import { expensesAgentRepository } from "./expenses-repository.ts";
import { contractAgentRepository } from "./contract-repository.ts";
import { siteAgentRepository } from "./site-repository.ts";
import { materialsAgentRepository } from "./materials-repository.ts";
import { preconstructionAgentRepository } from "./preconstruction-repository.ts";
import { tasksAgentRepository } from "./tasks-repository.ts";
import { documentsAgentRepository } from "./documents-repository.ts";

export function agentRepository(db: Knex, scope: AgentRecordScope = NO_RECORD_ACCESS) {
  return {
    ...takeoffAgentRepository(db),
    ...programmeAgentRepository(db),
    ...expensesAgentRepository(db, scope.expenseReaderId),
    ...contractAgentRepository(db),
    ...siteAgentRepository(db),
    ...materialsAgentRepository(db),
    ...preconstructionAgentRepository(db),
    ...tasksAgentRepository(db, scope.taskReaderId),
    ...documentsAgentRepository(db),
  };
}

export type AgentRepository = ReturnType<typeof agentRepository>;
