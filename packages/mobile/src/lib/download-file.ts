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
  const pending = pendingDownloads.get(destination.uri);
  if (pending) return pending;
  if (destination.exists && destination.size > 0) return Promise.resolve(destination.uri);
  const partial = new File(`${destination.uri}.download`);
  const download = File.downloadFileAsync(url, partial, { headers: authHeaders(), idempotent: true })
    .then((file) => {
      if (file.size === 0) throw new Error("The downloaded file is empty. Try downloading it again.");
      file.move(destination);
      return destination.uri;
    })
    .catch((error: unknown) => {
      // A failed download or app restart must never expose partial bytes as a plan.
      if (partial.exists) partial.delete();
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

/** Keep the picked bytes available after its queued upload gains a server revision. */
export function cachePickedVersion(uri: string, versionId: string, fileName: string): string {
  const destination = new File(cacheDir(), `${versionId}${extensionOf(fileName)}`);
  if (!destination.exists || destination.size === 0) new File(uri).copy(destination);
  return destination.uri;
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
 * The selected project's plans are prepared in the background; other documents
 * are cached on demand. Both paths share the same revision-specific download.
 */
export async function cacheDocument(
  db: Db,
  projectId: string,
  documentId: string,
  expectedVersionId?: string,
): Promise<string | null> {
  const row = await documentsRepository.findById(db, documentId);
  if (!row || row.projectId !== projectId) return null;
  if (!row.currentVersionId) throw new Error("No file is attached to this record yet.");
  if (expectedVersionId && expectedVersionId !== row.currentVersionId) {
    throw new Error("This plan revision has changed. Reopen the plan to load its current revision.");
  }

  if (row.localUri) {
    const existing = new File(row.localUri);
    const expectedName = `${row.currentVersionId}${extensionOf(row.fileName)}`;
    const retainedUpload = !row.isPendingSync && row.stagedUri === row.localUri;
    if (existing.exists && existing.size > 0 && (existing.name === expectedName || retainedUpload)) return row.localUri;
    await documentsRepository.setLocalUri(db, documentId, null, row.currentVersionId);
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
