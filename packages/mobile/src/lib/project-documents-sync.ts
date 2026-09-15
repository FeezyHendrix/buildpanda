import { documentsApi } from "@/api/documents";
import type { Db } from "@/db/client";
import { DOCUMENT_GROUP, documentsRepository } from "@/db/documents-repository";
import { cacheDocument } from "./download-file";

export interface PlanDownloadProgress {
  completed: number;
  total: number;
  failed: number;
  error: string | null;
}

/** Prepare only the selected project's current drawings, two files at a time. */
export async function syncProjectDocuments(
  db: Db,
  projectId: string,
  onProgress: (progress: PlanDownloadProgress) => void,
  cancelled: () => boolean,
): Promise<void> {
  const progress: PlanDownloadProgress = { completed: 0, total: 0, failed: 0, error: null };
  const results = await Promise.allSettled([
    documentsApi.categories(projectId).then(async (rows) => {
      if (!cancelled()) await documentsRepository.upsertCategories(db, projectId, rows);
    }),
    documentsApi.list(projectId).then(async (rows) => {
      if (!cancelled()) await documentsRepository.upsertFromServer(db, projectId, rows);
    }),
  ]);
  if (cancelled()) return;
  if (results.some((result) => result.status === "rejected")) {
    progress.error = "Couldn't refresh all plan details. Saved plans are still available.";
  }
  const plans = (await documentsRepository.listQuery(db, projectId))
    .filter((row) => row.group === DOCUMENT_GROUP.PLAN && row.currentVersionId && !row.isPendingSync);
  progress.total = plans.length;
  onProgress({ ...progress });
  let next = 0;
  const download = async () => {
    while (!cancelled() && next < plans.length) {
      const plan = plans[next++]!;
      try {
        const uri = await cacheDocument(db, projectId, plan.id, plan.currentVersionId!);
        if (!uri) throw new Error("The plan is no longer available.");
        progress.completed++;
      } catch (error) {
        progress.failed++;
        progress.error = `${plan.fileName}: ${error instanceof Error ? error.message : "Download failed. Try again."}`;
      }
      if (!cancelled()) onProgress({ ...progress });
    }
  };
  await Promise.all([download(), download()]);
}
