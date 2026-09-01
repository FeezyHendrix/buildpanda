import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { documentsApi } from "@/api/documents";
import type { Db } from "@/db/client";
import { API_BASE_URL, authClient } from "./auth-client";
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

/** Downloads one document version to the offline cache and returns its local URI. */
export async function cacheVersionFile(
  projectId: string,
  documentId: string,
  versionId: string,
  fileName: string,
): Promise<string> {
  const destination = new File(cacheDir(), `${versionId}${extensionOf(fileName)}`);
  if (destination.exists) return destination.uri;
  const url = documentsApi.versionDownloadUrl(projectId, documentId, versionId);
  const downloaded = await File.downloadFileAsync(url, destination, {
    headers: authHeaders(),
    idempotent: true,
  });
  return downloaded.uri;
}

/** Downloads an uploaded file (comment media, attachments) and returns its local URI. */
export async function cacheFileById(fileId: string, fileName: string): Promise<string> {
  const destination = new File(cacheDir(), `${fileId}${extensionOf(fileName)}`);
  if (destination.exists) return destination.uri;
  const downloaded = await File.downloadFileAsync(`${API_BASE_URL}/files/${fileId}/download`, destination, {
    headers: authHeaders(),
    idempotent: true,
  });
  return downloaded.uri;
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

  const uri = await cacheVersionFile(projectId, documentId, row.currentVersionId, row.fileName);
  await documentsRepository.setLocalUri(db, documentId, uri);
  return uri;
}

/** Frees every cached blob; the metadata rows stay so the list still renders. */
export async function clearDocumentCache(): Promise<void> {
  const dir = new Directory(Paths.document, CACHE_DIR_NAME);
  if (dir.exists) dir.delete();
}
