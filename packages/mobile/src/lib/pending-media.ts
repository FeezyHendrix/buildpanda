import { Directory, File, Paths } from "expo-file-system";
import type { AccessScope } from "./access-policy";

/** Durable originals are retained in their scope while queued work is quarantined. */
export async function stagePendingMedia(scope: AccessScope, uri: string, id: string, name: string, maxBytes = 100 * 1024 * 1024): Promise<string> {
  const dir = new Directory(Paths.document, "content-originals-v1", ...[scope.userId, scope.organizationId, scope.projectId].map((value) => `s-${encodeURIComponent(value)}`), "media");
  dir.create({ intermediates: true, idempotent: true });
  const source = new File(uri);
  if (!source.exists || source.size <= 0 || source.size > maxBytes) throw new Error("This attachment is empty or too large.");
  const extension = /\.([a-z0-9]{1,12})$/i.exec(name)?.[1] ?? "bin";
  const destination = new File(dir, `${id}.${extension}`);
  source.copy(destination);
  return destination.uri;
}

export async function loadPendingMedia(uri: string): Promise<string> {
  if (!new File(uri).exists) throw new Error("This attachment is no longer on the device.");
  return uri;
}

export async function discardPendingMedia(uri: string | null): Promise<void> {
  if (!uri) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
