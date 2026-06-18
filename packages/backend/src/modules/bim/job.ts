import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { openStoredFile, streamToBuffer } from "../../lib/file-storage.ts";
import { generateId } from "../../lib/ids.ts";
import { bimRepository } from "./repository.ts";
import { extractIfcElements } from "./ifc-extract.ts";
import type { BimElementRecord } from "./types.ts";

export const BIM_PROCESS_QUEUE = "bim-ifc-extraction";

export interface BimProcessJobData {
  versionId: string;
}

export async function runBimProcessing(db: Knex, data: BimProcessJobData): Promise<void> {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "IFC processing failed";
    await repo.markVersionStatus(version.id, "Failed", { failure_reason: message });
    throw error;
  }
}

export function registerBimProcessingWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<BimProcessJobData>(BIM_PROCESS_QUEUE, (jobData) =>
    runBimProcessing(db, jobData),
  );
}
