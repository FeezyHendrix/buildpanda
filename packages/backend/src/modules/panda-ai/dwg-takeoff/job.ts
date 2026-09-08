import type { Knex } from "knex";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import type { QueueManager } from "../../../lib/queue/index.ts";
import { openStoredFile } from "../../../lib/file-storage.ts";
import { generateId } from "../../../lib/ids.ts";
import { takeoffJobsRepository } from "./jobs-repository.ts";
import { registerDoc, runDwgTakeoff } from "./engine.ts";
import { parseDwgToJson } from "./dwg.ts";
import { fromDwg } from "../geometry/from-dwg.ts";
import { buildReport, summarise } from "../geometry/report.ts";
import { isLayerElement } from "./taxonomy.ts";
import type { LayerMap, TakeoffResult } from "./types.ts";
import { preconRepository } from "../pdf-takeoff/repository.ts";
import { preconService } from "../pdf-takeoff/service.ts";
import type { DwgTakeoffHandover } from "../pdf-takeoff/types.ts";

// Queue name is the pre-rename "automated-takeoff" string: it is a BullMQ key
// in Redis, so changing it would strand jobs enqueued before a deploy.
export const TAKEOFF_QUEUE = "automated-takeoff";

export interface TakeoffJobData {
  // the upload job to run; absent on a re-run, which reads the session's file
  jobId?: string;
  orgId?: string;
  // set when the route already created the reviewable session up front
  sessionId?: string;
  // measure the session's DWG again with its stored layer map
  rerun?: boolean;
  // a take-off measured by hand: build the drawing register (sheets, bounds,
  // units) for the session's DWG and draft no lines
  sheetsOnly?: boolean;
}

// LibreDWG reads from a file path, so the stored object is streamed to a temp
// file for the duration of the job and removed afterwards.
export async function withTempDwg<T>(storagePath: string, fn: (file: string) => Promise<T>): Promise<T> {
  const file = path.join(os.tmpdir(), `${generateId("tko")}.dwg`);
  const stream = await openStoredFile(storagePath);
  await pipeline(stream as Readable, createWriteStream(file));
  try {
    return await fn(file);
  } finally {
    await fs.rm(file, { force: true });
  }
}

async function recordExtraction(db: Knex, sessionId: string, file: string): Promise<void> {
  const precon = preconRepository(db);
  const report = buildReport(fromDwg(await parseDwgToJson(file)));
  const sheets = await precon.sheetsBySession(sessionId);
  const bySheet: Record<string, typeof report> = {};
  for (const sheet of sheets) {
    bySheet[sheet.id] = report;
    await precon.updateSheetGeoSummary(sheet.id, summarise(report));
  }
  await precon.updateSessionExtraction(sessionId, { sheets: bySheet, generatedAt: new Date().toISOString() });
}

// What the session keeps of an engine run: the register, the units, the map,
// the lines with their evidence, and the notes.
export function toHandover(result: TakeoffResult): DwgTakeoffHandover {
  const units = result.units ?? { unit: "unknown", scaleToMm: result.scaleToMm, errorPct: 1 - result.scaleConfidence, note: "" };
  return {
    units: { unit: units.unit, scaleToMm: units.scaleToMm, errorPct: units.errorPct, note: units.note },
    layerMap: result.layerMap ?? {},
    sheets: (result.sheets ?? []).map((s) => ({
      id: s.id,
      code: s.code,
      title: s.title,
      kind: s.kind,
      bounds: s.bounds,
      levelMm: s.levelMm,
      multiplier: s.multiplier,
    })),
    items: result.items.map((i) => ({
      trade: i.trade,
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      confidence: i.confidence,
      basis: i.basis,
      sheetId: i.sheetId,
      evidence: i.evidence,
      reason: i.reason,
      crossCheck: i.crossCheck,
      noteOnly: i.noteOnly,
    })),
    notes: result.notes,
  };
}

// A stored map is only trusted where its values are elements the engine knows.
function storedLayerMap(raw: Record<string, string> | null): LayerMap | undefined {
  if (!raw) return undefined;
  const map: LayerMap = {};
  for (const [layer, element] of Object.entries(raw)) if (isLayerElement(element)) map[layer] = element;
  return Object.keys(map).length ? map : undefined;
}

async function rerun(precon: ReturnType<typeof preconService>, sessionId: string): Promise<void> {
  const context = await precon.dwgRerunContext(sessionId);
  if (!context) return;
  try {
    const result = await withTempDwg(context.storagePath, (file) => runDwgTakeoff(file, { layerMap: storedLayerMap(context.layerMap) }));
    await precon.fillDwgSession(sessionId, { fileName: context.fileName }, toHandover(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Take-off failed";
    await precon.failDwgSession(sessionId, message).catch(() => undefined);
    throw error;
  }
}

// The register only: the person measuring by hand gets every drawing, framed
// and scaled, and an empty bill. The extraction report is still recorded so
// the sheet summaries read the same as on an engine run.
async function sheetsOnly(db: Knex, precon: ReturnType<typeof preconService>, sessionId: string): Promise<void> {
  const context = await precon.sheetsOnlyDwgContext(sessionId);
  if (!context) return;
  try {
    const result = await withTempDwg(context.storagePath, async (file) => {
      await recordExtraction(db, sessionId, file);
      return registerDoc(await parseDwgToJson(file));
    });
    await precon.fillDwgSession(sessionId, { fileName: context.fileName }, toHandover(result), { sheetsOnly: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reading the drawing failed";
    await precon.failDwgSession(sessionId, message).catch(() => undefined);
    throw error;
  }
}

export async function runTakeoff(db: Knex, data: TakeoffJobData): Promise<void> {
  const precon = preconService(preconRepository(db));
  if (data.sheetsOnly && data.sessionId) return sheetsOnly(db, precon, data.sessionId);
  if (data.rerun && data.sessionId) return rerun(precon, data.sessionId);
  if (!data.jobId) return;
  const repo = takeoffJobsRepository(db);
  const job = await repo.rawById(data.jobId);
  if (!job) return;

  await repo.markProcessing(job.id);
  try {
    const result = await withTempDwg(job.storage_path, async (file) => {
      // the extraction report is written before measuring so a failed or empty
      // measure still leaves the reviewer with what the parser found
      if (data.sessionId) await recordExtraction(db, data.sessionId, file);
      return runDwgTakeoff(file);
    });
    await repo.markComplete(job.id, result);
    // A proposal take-off becomes a reviewable session — the same object a PDF
    // produces — rather than lines appended straight onto the bill.
    if (data.sessionId) {
      await precon.fillDwgSession(data.sessionId, { fileName: job.file_name }, toHandover(result));
    } else if (job.proposal_id) {
      const context = await repo.proposalContext(job.proposal_id, job.file_id);
      if (context) {
        const session = await precon.createDwgSession(
          context.orgId,
          job.requested_by ?? "system",
          job.proposal_id,
          context.planId,
          { fileName: job.file_name, storagePath: job.storage_path },
          toHandover(result),
        );
        await repo.linkSession(job.id, session.id);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Take-off failed";
    await repo.markFailed(job.id, message);
    if (data.sessionId) await precon.failDwgSession(data.sessionId, message).catch(() => undefined);
    throw error;
  }
}

export function registerDwgTakeoffWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<TakeoffJobData>(TAKEOFF_QUEUE, (data) => runTakeoff(db, data));
}
