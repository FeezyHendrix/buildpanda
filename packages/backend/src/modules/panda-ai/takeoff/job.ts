import type { Knex } from "knex";
import type { QueueManager } from "../../../lib/queue/index.ts";
import type { RealtimePayload } from "../../../lib/realtime/index.ts";
import { preconRepository } from "./repository.ts";
import { generateForSession } from "./engine/run.ts";

export const PRECON_GENERATE_QUEUE = "precon-generate";

export interface PreconGenerateJobData {
  sessionId: string;
  orgId?: string;
}

export type RealtimePublish = (payload: RealtimePayload) => void;

export async function runGenerate(db: Knex, data: PreconGenerateJobData, publish: RealtimePublish = () => {}): Promise<void> {
  const repo = preconRepository(db);
  const session = await repo.sessionById(data.sessionId);
  if (!session) return;

  const progress = (message: string, extra?: Record<string, unknown>) => {
    publish({
      event: "precon.progress",
      channelId: `precon:${session.id}`,
      data: { sessionId: session.id, message, ...extra },
    });
  };

  await repo.updateSessionStatus(session.id, "generating");
  progress("Generation started");
  try {
    await generateForSession(db, session.id, progress);
    await repo.updateSessionStatus(session.id, "reviewing");
    progress("Generation complete — ready for review");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generate failed";
    await repo.updateSessionStatus(session.id, "failed", message);
    progress(`Generation failed: ${message}`);
    throw error;
  }
}

export const PRECON_PROGRAMME_QUEUE = "precon-programme";

export interface PreconProgrammeJobData {
  sessionId: string;
  orgId?: string;
}

/**
 * Drafting the programme is a separate job from the BOQ so a planner can re-run
 * it after editing quantities. It deliberately leaves session.status alone —
 * the BOQ owns that lifecycle, and failing to draft a programme must not knock
 * a reviewed BOQ back into `failed`.
 */
export async function runProgramme(
  db: Knex,
  data: PreconProgrammeJobData,
  publish: RealtimePublish = () => {},
): Promise<void> {
  const repo = preconRepository(db);
  const session = await repo.sessionById(data.sessionId);
  if (!session) return;

  const progress = (message: string, extra?: Record<string, unknown>) => {
    publish({
      event: "precon.progress",
      channelId: `precon:${session.id}`,
      data: { sessionId: session.id, message, ...extra },
    });
  };

  progress("Drafting programme of work");
  try {
    const { generateProgrammeForSession } = await import("./engine/programme.ts");
    const result = await generateProgrammeForSession(db, session.id, session.title, progress);
    progress("Programme ready for review", { programmeTaskCount: result.taskCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Programme generation failed";
    progress(`Programme generation failed: ${message}`);
    throw error;
  }
}

export function registerPreconWorker(db: Knex, manager: QueueManager, publish: RealtimePublish = () => {}): void {
  manager.registerProcessor<PreconGenerateJobData>(PRECON_GENERATE_QUEUE, (data) => runGenerate(db, data, publish));
  manager.registerProcessor<PreconProgrammeJobData>(PRECON_PROGRAMME_QUEUE, (data) =>
    runProgramme(db, data, publish),
  );
}
