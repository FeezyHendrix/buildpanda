import { Directory, File, Paths } from "expo-file-system";
import { documentsApi } from "@/api/documents";
import type { Db } from "@/db/client";
import { documentsRepository } from "@/db/documents-repository";

const CACHE_DIR_NAME = "offline-docs";

function cacheDir(): Directory {
  const dir = new Directory(Paths.document, CACHE_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Downloads a document's current version for offline use and records the local
 * URI, so opening it later needs no network.
 *
 * On demand rather than downloading everything when the list loads: a drawing
 * set runs to hundreds of megabytes and device storage is the binding
 * constraint on site.
 */
export async function cacheDocument(
  db: Db,
  projectId: string,
  documentId: string,
): Promise<string | null> {
  const row = await documentsRepository.findById(db, documentId);
  if (!row?.currentVersionId) return null;

  if (row.localUri) {
    const existing = new File(row.localUri);
    if (existing.exists) return row.localUri;
  }

  const { url } = await documentsApi.versionViewUrl(projectId, documentId, row.currentVersionId);
  const downloaded = await File.downloadFileAsync(url, cacheDir());

  await documentsRepository.setLocalUri(db, documentId, downloaded.uri);
  return downloaded.uri;
}

/** Frees every cached blob; the metadata rows stay so the list still renders. */
export async function clearDocumentCache(): Promise<void> {
  const dir = new Directory(Paths.document, CACHE_DIR_NAME);
  if (dir.exists) dir.delete();
}
