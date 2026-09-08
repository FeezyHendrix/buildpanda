import type { Knex } from "knex";
import { risksRepository } from "../risks/repository.ts";
import { risksService } from "../risks/service.ts";
import { methodStatementsRepository } from "./repository.ts";
import { methodStatementsService } from "./service.ts";

export interface SafetyHandoffResult {
  risks: number;
  methodStatements: number;
  phasePlan: boolean;
}

/**
 * Carry the proposal's safety pack (risk register, method statements, phase
 * plan) onto a freshly converted project. Intended to be called from the
 * proposal → project converter inside its transaction: pass the trx as `db`.
 * Confirmed rows travel first; if nothing was confirmed, everything does.
 */
export async function carryRisksAndStatementsToProject(
  db: Knex,
  proposalId: string,
  projectId: string,
): Promise<SafetyHandoffResult> {
  const risks = risksService(risksRepository(db));
  const statements = methodStatementsService(methodStatementsRepository(db));
  const riskCount = await risks.carryToProject(proposalId, projectId);
  const carried = await statements.carryToProject(proposalId, projectId);
  return { risks: riskCount, methodStatements: carried.statements, phasePlan: carried.phasePlan };
}
