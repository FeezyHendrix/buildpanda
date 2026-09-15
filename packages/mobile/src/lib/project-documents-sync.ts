import { documentsApi } from "@/api/documents";
import type { Db } from "@/db/client";
import { documentsRepository } from "@/db/documents-repository";
import { cacheDocument } from "./download-file";
import { isReviewableFile } from "./reviewable-file";

export interface PlanDownloadProgress {
  completed: number;
  total: number;
  failed: number;
  error: string | null;
}

/** Prepare the selected project's PDFs and images, two files at a time. */
export async function syncProjectDocuments(
  db: Db,
  projectId: string,
  onProgress: (progress: PlanDownloadProgress) => void,
  cancelled: () => boolean,
): Promise<void> {
  const progress: PlanDownloadProgress = { completed: 0, total: 0, failed: 0, error: null };
  try {
    const rows = await documentsApi.list(projectId);
    if (!cancelled()) await documentsRepository.upsertFromServer(db, projectId, rows);
  } catch {
    progress.error = "Couldn't refresh the file list. Saved files are still available.";
  }
  if (cancelled()) return;
  const plans = (await documentsRepository.listQuery(db, projectId))
    .filter((row) => isReviewableFile(row.fileName) && row.currentVersionId && !row.isPendingSync);
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
