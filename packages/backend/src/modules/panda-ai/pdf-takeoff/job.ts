import type { Knex } from "knex";
import type { QueueManager } from "../../../lib/queue/index.ts";
import type { RealtimePayload } from "../../../lib/realtime/index.ts";
import { preconRepository } from "./repository.ts";
import { generateForSession, type ProgressFn } from "./engine/run.ts";
import { remeasureSheet } from "./engine/remeasure.ts";
import { redraftBill } from "./engine/redraft.ts";
import type { PreconPhase } from "./types.ts";

export const PRECON_GENERATE_QUEUE = "precon-generate";

export const PRECON_JOB_MODES = ["generate", "remeasure", "redraft"] as const;
export type PreconJobMode = (typeof PRECON_JOB_MODES)[number];

export interface PreconGenerateJobData {
  sessionId: string;
  orgId?: string;
  // remeasure re-reads one sheet; redraft re-runs the build-up. Both leave
  // session.status alone — the session is already in review.
  mode?: PreconJobMode;
  sheetId?: string;
}

export type RealtimePublish = (payload: RealtimePayload) => void;

export async function runGenerate(db: Knex, data: PreconGenerateJobData, publish: RealtimePublish = () => {}): Promise<void> {
  const repo = preconRepository(db);
  const session = await repo.sessionById(data.sessionId);
  if (!session) return;

  // Every progress tick is written to the session before it is broadcast, so a
  // client that connects late (or reloads) reads the same checklist from the
  // snapshot that a live client built from the socket.
  const progress: ProgressFn = async (phase: PreconPhase, message: string, extra?: Record<string, unknown>) => {
    const at = new Date().toISOString();
    await repo.appendSessionProgress(session.id, { at, phase, message });
    publish({
      event: "precon.progress",
      channelId: `precon:${session.id}`,
      data: { sessionId: session.id, phase, message, at, ...extra },
    });
  };

  const mode: PreconJobMode = data.mode ?? "generate";
  if (mode !== "generate") {
    try {
      if (mode === "remeasure" && data.sheetId) await remeasureSheet(db, data.sheetId, progress);
      else if (mode === "redraft") await redraftBill(db, session.id, progress);
    } catch (error) {
      const message = error instanceof Error ? error.message : `${mode} failed`;
      await progress("draft", `${mode === "remeasure" ? "Re-measure" : "Redraft"} failed: ${message}`);
      throw error;
    }
    return;
  }

  await repo.updateSessionStatus(session.id, "generating");
  await progress("reading", "Generation started");
  try {
    await generateForSession(db, session.id, progress);
    await repo.updateSessionStatus(session.id, "reviewing");
    await progress("draft", "Generation complete — ready for review");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generate failed";
    await repo.updateSessionStatus(session.id, "failed", message);
    publish({
      event: "precon.progress",
      channelId: `precon:${session.id}`,
      data: { sessionId: session.id, message: `Generation failed: ${message}`, at: new Date().toISOString() },
    });
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

export function registerPdfTakeoffWorker(db: Knex, manager: QueueManager, publish: RealtimePublish = () => {}): void {
  manager.registerProcessor<PreconGenerateJobData>(PRECON_GENERATE_QUEUE, (data) => runGenerate(db, data, publish));
  manager.registerProcessor<PreconProgrammeJobData>(PRECON_PROGRAMME_QUEUE, (data) =>
    runProgramme(db, data, publish),
  );
}
