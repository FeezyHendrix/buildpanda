import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { preconRepository } from "./repository.ts";

export const PRECON_GENERATE_QUEUE = "precon-generate";

export interface PreconGenerateJobData {
  sessionId: string;
}

export async function runGenerate(db: Knex, data: PreconGenerateJobData): Promise<void> {
  const repo = preconRepository(db);
  const session = await repo.sessionById(data.sessionId);
  if (!session) return;
  await repo.updateSessionStatus(session.id, "generating");
  try {
    // Engine wiring lands with the measurement engine (phase 2 of the
    // implementation plan); until then sessions park in `reviewing` with
    // their sheets pending so the workspace shell is exercisable.
    const { generateForSession } = await import("./engine/run.ts");
    await generateForSession(db, session.id);
    await repo.updateSessionStatus(session.id, "reviewing");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generate failed";
    await repo.updateSessionStatus(session.id, "failed", message);
    throw error;
  }
}

export function registerPreconWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<PreconGenerateJobData>(PRECON_GENERATE_QUEUE, (data) => runGenerate(db, data));
}
