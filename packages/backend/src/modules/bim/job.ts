import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { openStoredFile, saveStream, streamToBuffer } from "../../lib/file-storage.ts";
import { generateId } from "../../lib/ids.ts";
import { bimRepository } from "./repository.ts";
import { extractIfcElements } from "./ifc-extract.ts";
import { convertIfcToXkt } from "./ifc-to-xkt.ts";
import type { BimElementRecord } from "./types.ts";
import { Readable } from "node:stream";

export const BIM_PROCESS_QUEUE = "bim-ifc-extraction";
export const BIM_XKT_QUEUE = "bim-xkt-conversion";

const XKT_MAX_SOURCE_BYTES = 150 * 1024 * 1024;
const XKT_TIMEOUT_MS = 8 * 60 * 1000;

export interface BimProcessJobData {
  versionId: string;
}

export interface BimXktJobData {
  versionId: string;
}

export async function runBimProcessing(
  db: Knex,
  data: BimProcessJobData,
  enqueueXkt: (versionId: string) => Promise<void>,
): Promise<void> {
  const repo = bimRepository(db);
  const version = await repo.findVersionById(data.versionId);
  if (!version) return;

  await repo.markVersionStatus(version.id, "Processing");
  try {
    const stream = await openStoredFile(version.source_storage_path);
    const buffer = await streamToBuffer(stream);
    const { elements } = await extractIfcElements(buffer);

    const records: BimElementRecord[] = elements.map((el) => ({
      id: generateId("bime"),
      model_version_id: version.id,
      guid: el.guid,
      express_id: el.expressId,
      ifc_type: el.ifcType,
      name: el.name,
    }));
    await repo.insertElements(records);
    await repo.markVersionStatus(version.id, "Ready", { element_count: records.length });
    await enqueueXkt(version.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "IFC processing failed";
    await repo.markVersionStatus(version.id, "Failed", { failure_reason: message });
    throw error;
  }
}

export async function runBimXktConversion(db: Knex, data: BimXktJobData): Promise<void> {
  const repo = bimRepository(db);
  const version = await repo.findVersionById(data.versionId);
  if (!version) return;

  if (version.size_bytes !== null && version.size_bytes > XKT_MAX_SOURCE_BYTES) {
    await repo.setXktStatus(version.id, "Skipped");
    return;
  }

  try {
    const stream = await openStoredFile(version.source_storage_path);
    const ifc = await streamToBuffer(stream);
    const { buffer } = await withTimeout(convertIfcToXkt(ifc), XKT_TIMEOUT_MS);
    const stored = await saveStream(version.id, Readable.from(buffer));
    await repo.setXktStatus(version.id, "Ready", stored.storagePath);
  } catch {
    // Best-effort: leave the version Ready and fall back to the IFC viewer.
    await repo.setXktStatus(version.id, "Failed");
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`XKT conversion timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export function registerBimProcessingWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<BimProcessJobData>(BIM_PROCESS_QUEUE, (jobData) =>
    runBimProcessing(db, jobData, (versionId) =>
      manager.enqueue(BIM_XKT_QUEUE, "convert", { versionId }),
    ),
  );
  manager.registerProcessor<BimXktJobData>(BIM_XKT_QUEUE, (jobData) =>
    runBimXktConversion(db, jobData),
  );
}
