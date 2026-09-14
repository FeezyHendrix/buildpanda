import type { Knex } from "knex";
import { NotFoundError } from "../../lib/errors.ts";
import { proposalsRepository } from "../proposals/repository.ts";
import { preconRepository } from "../panda-ai/pdf-takeoff/repository.ts";
import { preconService } from "../panda-ai/pdf-takeoff/service.ts";
import type { PreconSession, StructureContext } from "../panda-ai/pdf-takeoff/types.ts";
import type { RiskDraftContext } from "./types.ts";

function describeStructure(ctx: StructureContext | null): string | null {
  if (!ctx || ctx.structureClass === "unknown") return null;
  const parts: string[] = [ctx.structureClass];
  if (ctx.buildingType) parts.push(ctx.buildingType);
  if (ctx.storeys) parts.push(`${ctx.storeys} storeys`);
  if (ctx.structuralSystem !== "unknown") parts.push(ctx.structuralSystem);
  if (ctx.foundationType !== "unknown") parts.push(`${ctx.foundationType} foundation`);
  return parts.join(", ");
}

// What Panda AI is told about the job when drafting risks or method statements:
// the proposal's own words plus whatever the take-off already worked out. Reads
// go through the other modules' services; the programme is optional because a
// proposal may have no take-off yet.
export async function buildProposalDraftContext(
  db: Knex,
  proposalId: string,
  orgId: string,
): Promise<RiskDraftContext & { programmeTaskIds: Record<string, string> }> {
  const proposal = await proposalsRepository(db).getById(proposalId, orgId);
  if (!proposal) throw new NotFoundError("Proposal");

  const precon = preconService(preconRepository(db));
  const sessions: PreconSession[] = await precon.listSessions(orgId, proposalId);
  const latest = sessions.find((s) => s.status === "reviewing" || s.status === "output") ?? sessions[0] ?? null;

  const programmeTasks: string[] = [];
  const programmeTaskIds: Record<string, string> = {};
  if (latest) {
    try {
      const programme = await precon.getProgramme(latest.id);
      for (const task of programme.tasks) {
        if (task.status === "rejected") continue;
        programmeTasks.push(task.name);
        programmeTaskIds[task.name] = task.id;
      }
    } catch {
      // a session without a programme is normal; the drafter copes without it
    }
  }

  return {
    title: proposal.title,
    brief: proposal.brief,
    location: proposal.location,
    structure: describeStructure(latest?.structureContext ?? null),
    programmeTasks,
    programmeTaskIds,
  };
}
