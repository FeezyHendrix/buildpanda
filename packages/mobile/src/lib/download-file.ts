import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { documentsApi } from "@/api/documents";
import type { Db } from "@/db/client";
import { API_BASE_URL, authClient } from "./auth-client";
import { downloadError } from "./download-error";
import { documentsRepository } from "@/db/documents-repository";

const CACHE_DIR_NAME = "offline-docs";

function cacheDir(): Directory {
  const dir = new Directory(Paths.document, CACHE_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** iOS WKWebView may only read local files under a whitelisted directory. */
export function documentCacheDirUri(): string {
  return cacheDir().uri;
}

function authHeaders(): Record<string, string> {
  return Platform.OS === "web" ? {} : { cookie: authClient.getCookie() };
}

function extensionOf(fileName: string): string {
  return fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
}

// A list download and the viewer can ask for the same bytes at the same time.
const pendingDownloads = new Map<string, Promise<string>>();
function downloadToCache(url: string, destination: File): Promise<string> {
  if (destination.exists && destination.size > 0) return Promise.resolve(destination.uri);
  const pending = pendingDownloads.get(destination.uri);
  if (pending) return pending;
  const download = File.downloadFileAsync(url, destination, { headers: authHeaders(), idempotent: true })
    .then((file) => file.uri)
    .catch((error: unknown) => {
      // Android can leave partial bytes after a failed download; never treat those as a cached plan.
      if (destination.exists) destination.delete();
      throw downloadError(error);
    })
    .finally(() => pendingDownloads.delete(destination.uri));
  pendingDownloads.set(destination.uri, download);
  return download;
}

/** Downloads one document version to the offline cache and returns its local URI. */
export async function cacheVersionFile(
  projectId: string,
  documentId: string,
  versionId: string,
  fileName: string,
): Promise<string> {
  const destination = new File(cacheDir(), `${versionId}${extensionOf(fileName)}`);
  return downloadToCache(documentsApi.versionDownloadUrl(projectId, documentId, versionId), destination);
}

/** Downloads an uploaded file (comment media, attachments) and returns its local URI. */
export async function cacheFileById(fileId: string, fileName: string): Promise<string> {
  const destination = new File(cacheDir(), `${fileId}${extensionOf(fileName)}`);
  return downloadToCache(`${API_BASE_URL}/files/${fileId}/download`, destination);
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
  expectedVersionId?: string,
): Promise<string | null> {
  const row = await documentsRepository.findById(db, documentId);
  if (!row?.currentVersionId) return null;
  if (expectedVersionId && expectedVersionId !== row.currentVersionId) {
    throw new Error("This plan revision has changed. Reopen the plan to load its current revision.");
  }

  if (row.localUri) {
    const existing = new File(row.localUri);
    const expectedName = `${row.currentVersionId}${extensionOf(row.fileName)}`;
    if (existing.exists && existing.size > 0 && existing.name === expectedName) return row.localUri;
  }

  const uri = await cacheVersionFile(projectId, documentId, row.currentVersionId, row.fileName);
  await documentsRepository.setLocalUri(db, documentId, uri, row.currentVersionId);
  return uri;
}

/** Frees every cached blob; the metadata rows stay so the list still renders. */
export async function clearDocumentCache(): Promise<void> {
  const dir = new Directory(Paths.document, CACHE_DIR_NAME);
  if (dir.exists) dir.delete();
}
