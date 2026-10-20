import { clearContentImages } from "./content-image-storage";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { verifyMessageAttachment } from "@/api/files";
import { documentsApi } from "@/api/documents";
import { documentsRepository } from "@/db/documents-repository";
import type { Db } from "@/db/client";
import type { AccessScope } from "./access-policy";
import { API_BASE_URL, authClient } from "./auth-client";
import { downloadError } from "./download-error";
import { features, messagingAccess } from "./feature-access";
import { AccessDeniedError, projectAccess, requireAccess, requireCurrentAccess, revokeProjectAccess, type AccessState } from "./project-access-store";

const CACHE_DIR_NAME = "protected-files-v1";
const filePolicies = { documents: features.documents.read, messages: messagingAccess, updates: features.updates.read } as const;
type FileArea = keyof typeof filePolicies;
const segment = (value: string) => `s-${encodeURIComponent(value)}`;

function scopeDirectory(scope: AccessScope): Directory {
  return new Directory(Paths.document, CACHE_DIR_NAME, segment(scope.userId), segment(scope.organizationId), segment(scope.projectId));
}
function cacheDir(scope: AccessScope, area: FileArea): Directory {
  const dir = new Directory(scopeDirectory(scope), area);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}
function ticketFor(projectId: string, area: FileArea = "documents") {
  return requireAccess(projectId, filePolicies[area]);
}

/** The viewer may read only a file in this identity/project's authorized area. */
export function requireCachedFile(uri: string): AccessState {
  const { scope } = projectAccess.getState();
  if (!scope || uri.includes("..") || /%2e|%2f|%5c/i.test(uri)) throw new AccessDeniedError();
  for (const area of Object.keys(filePolicies) as FileArea[]) {
    const prefix = new Directory(scopeDirectory(scope), area).uri.replace(/\/$/, "") + "/";
    if (uri.startsWith(prefix)) return ticketFor(scope.projectId, area);
  }
  throw new AccessDeniedError("This file is not available in the selected project.");
}

/** iOS WKWebView's read access stays inside the selected scope. */
export function documentCacheDirUri(uri?: string): string {
  if (uri) { requireCachedFile(uri); return new File(uri).parentDirectory.uri; }
  const ticket = requireAccess(projectAccess.getState().scope?.projectId ?? "", features.documents.read);
  return cacheDir(ticket.scope!, "documents").uri;
}

function extensionOf(fileName: string): string {
  const extension = /\.([a-z0-9]{1,12})$/i.exec(fileName)?.[1];
  return extension ? `.${extension}` : "";
}
const pendingDownloads = new Map<string, Promise<string>>();
function downloadToCache(url: string, destination: File, ticket: AccessState): Promise<string> {
  requireCurrentAccess(ticket);
  const key = `${ticket.generation}:${destination.uri}`;
  const pending = pendingDownloads.get(key);
  if (pending) return pending;
  if (destination.exists && destination.size > 0) return Promise.resolve(destination.uri);
  const partial = new File(`${destination.uri}.${ticket.generation}.download`);
  const download = File.downloadFileAsync(url, partial, {
    headers: Platform.OS === "web" ? {} : { cookie: authClient.getCookie() }, idempotent: true,
  }).then((file) => {
    requireCurrentAccess(ticket);
    if (file.size === 0) throw new Error("The downloaded file is empty. Try downloading it again.");
    file.move(destination);
    return destination.uri;
  }).catch((error: unknown) => {
    if (partial.exists) partial.delete();
    if (error instanceof Error && /response has status (401|403)/i.test(error.message)) {
      requireCurrentAccess(ticket);
      revokeProjectAccess();
    }
    throw error instanceof AccessDeniedError ? error : downloadError(error);
  }).finally(() => pendingDownloads.delete(key));
  pendingDownloads.set(key, download);
  return download;
}

export async function cacheVersionFile(projectId: string, documentId: string, versionId: string, fileName: string): Promise<string> {
  const ticket = ticketFor(projectId);
  const destination = new File(cacheDir(ticket.scope!, "documents"), `${segment(versionId)}${extensionOf(fileName)}`);
  return downloadToCache(documentsApi.versionDownloadUrl(projectId, documentId, versionId), destination, ticket);
}

export function cachePickedVersion(ticket: AccessState, uri: string, versionId: string, fileName: string): string {
  requireCurrentAccess(ticket);
  const destination = new File(cacheDir(ticket.scope!, "documents"), `${segment(versionId)}${extensionOf(fileName)}`);
  if (!destination.exists || destination.size === 0) new File(uri).copy(destination);
  return destination.uri;
}

export async function cacheFileById(fileId: string, fileName: string, area: FileArea = "documents", allowDownload = true): Promise<string> {
  const ticket = ticketFor(projectAccess.getState().scope?.projectId ?? "", area);
  if (area === "messages") await verifyOnlineAttachment(fileId);
  requireCurrentAccess(ticket);
  const destination = new File(cacheDir(ticket.scope!, area), `${segment(fileId)}${extensionOf(fileName)}`);
  if (!allowDownload && (!destination.exists || destination.size === 0)) throw new Error("Connect once to download this voice note.");
  return downloadToCache(`${API_BASE_URL}/files/${encodeURIComponent(fileId)}/download`, destination, ticket);
}

async function verifyOnlineAttachment(fileId: string) {
  const network = await NetInfo.fetch();
  if (network.isConnected !== true || network.isInternetReachable !== true) throw new AccessDeniedError("Connect to verify access to this conversation attachment.");
  await verifyMessageAttachment(fileId);
}

/** Conversation membership is verified online before re-opening downloaded bytes. */
export async function verifyCachedFile(uri: string): Promise<void> {
  const ticket = requireCachedFile(uri);
  if (uri.startsWith(new Directory(scopeDirectory(ticket.scope!), "messages").uri)) {
    const name = new File(uri).name;
    const encodedId = /^s-(.+?)(?:\.[a-z0-9]{1,12})?$/i.exec(name)?.[1];
    if (!encodedId) throw new AccessDeniedError();
    await verifyOnlineAttachment(decodeURIComponent(encodedId));
    requireCurrentAccess(ticket);
  }
}

export async function cacheDocument(db: Db, projectId: string, documentId: string, expectedVersionId?: string): Promise<string | null> {
  const ticket = ticketFor(projectId);
  const row = await documentsRepository.findById(db, documentId);
  requireCurrentAccess(ticket);
  if (!row || row.projectId !== projectId) return null;
  if (!row.currentVersionId) throw new Error("No file is attached to this record yet.");
  if (expectedVersionId && expectedVersionId !== row.currentVersionId) throw new Error("This plan revision has changed. Reopen its current revision.");
  if (Platform.OS === "web") {
    // The browser tab is the viewer on web: there is no native file cache, and
    // the session cookie authorizes the download request itself. The access
    // ticket above still gates the attempt client-side.
    requireCurrentAccess(ticket);
    window.open(documentsApi.versionDownloadUrl(projectId, documentId, row.currentVersionId), "_blank", "noopener");
    return null;
  }
  if (row.localUri) {
    try {
      requireCachedFile(row.localUri);
      const existing = new File(row.localUri);
      if (existing.exists && existing.size > 0) return row.localUri;
    } catch { /* Old unpartitioned files are downloaded into the current scope. */ }
  }
  const uri = await cacheVersionFile(projectId, documentId, row.currentVersionId, row.fileName);
  requireCurrentAccess(ticket);
  await documentsRepository.setLocalUri(db, documentId, uri, row.currentVersionId);
  return uri;
}

/** Unsent originals remain quarantined in their owner's SQLite records. */
export async function clearDocumentCache(scope?: AccessScope): Promise<void> {
  await clearContentImages(scope);
  // Web never creates the native file cache; its data lives in SQLite/query storage.
  if (Platform.OS === "web") return;
  const dir = scope ? scopeDirectory(scope) : new Directory(Paths.document, CACHE_DIR_NAME);
  if (dir.exists) dir.delete();
  const legacy = new Directory(Paths.document, "offline-docs");
  if (legacy.exists) legacy.delete();
}

/** Remove every downloaded revision when a confirmed deletion removes its document. */
export function removeCachedVersions(projectId: string, versionIds: readonly string[]): void {
  if (Platform.OS === "web") return;
  const ticket = ticketFor(projectId);
  const directory = cacheDir(ticket.scope!, "documents");
  for (const entry of directory.list()) if (entry instanceof File && versionIds.some((id) => entry.name === segment(id) || entry.name.startsWith(`${segment(id)}.`))) entry.delete();
}
