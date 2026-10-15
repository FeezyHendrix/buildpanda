import type { Db } from "@/db/client";
import { canReadCachedContentFile } from "@/db/content-file-access";
import { randomUUID } from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { imageError, referencedFileIds } from '@buildpanda/rich-content';
import { uploadProjectFile } from '@/api/files';
import { request, ApiError } from '@/api/client';
import { isAccessRejection } from '@/api/error';
import { VERIFIED } from './access-requirement';
import { uploadAccess } from './feature-access';
import { requireAccess, requireCurrentAccess, revokeProjectAccess } from './project-access-store';
import { accessFingerprint, OFFLINE_ACCESS_MS } from './access-policy';
import { savePickedContentImage, loadContentImage, rememberContentUpload, cacheContentImage, clearContentImages, verifyCachedContentImage } from './content-image-storage';
import type { PickedContentImage } from './content-image-types';

export async function stageContentImage(projectId: string, picked: PickedContentImage) {
  const ticket = requireAccess(projectId, uploadAccess);
  const error = imageError(picked.mimeType, picked.size ?? 1);
  if (error) throw new Error(error);
  const id = `local_image_${randomUUID().replace(/-/g, '')}`;
  await savePickedContentImage(ticket.scope, id, picked);
  requireCurrentAccess(ticket);
  return { fileId: id, name: picked.fileName };
}

/** Original and downloaded bytes are partitioned by user/workspace/project. */
export async function resolveContentImage(projectId: string, fileId: string, db?: Db | null, format: "dataUrl" | "uri" = "dataUrl"): Promise<string> {
  const ticket = requireAccess(projectId, VERIFIED);
  const local = await loadContentImage(ticket.scope, fileId);
  requireCurrentAccess(ticket);
  if (fileId.startsWith('local_image_')) {
    if (!local) throw new Error('This image is no longer on this device. Add it again.');
    return local[format];
  }
  const network = await NetInfo.fetch();
  requireCurrentAccess(ticket);
  const fingerprint = accessFingerprint(ticket.snapshot);
  if (!network.isConnected || network.isInternetReachable === false) {
    if (!db || !canReadCachedContentFile(db, projectId, fileId)) throw new Error('This image is not available in your current offline records.');
    if (local?.fingerprint === fingerprint && local.verifiedAt && Date.now() - local.verifiedAt < OFFLINE_ACCESS_MS) return local[format];
    throw new Error('Connect once to download this image.');
  }
  try {
    const [metadata, source] = await Promise.all([
      request<{ fileName: string; mimeType: string; sizeBytes: number }>(`/files/${fileId}`),
      request<{ url: string }>(`/files/${fileId}/url`),
    ]);
    requireCurrentAccess(ticket);
    const invalid = imageError(metadata.mimeType, metadata.sizeBytes);
    if (invalid) throw new Error(invalid);
    if (local?.fingerprint === fingerprint) {
      await verifyCachedContentImage(ticket.scope, fileId);
      try { requireCurrentAccess(ticket); }
      catch (error) { await clearContentImages(ticket.scope); throw error; }
      return local[format];
    }
    await cacheContentImage(ticket.scope, { id: fileId, name: metadata.fileName, mimeType: metadata.mimeType, fingerprint, verifiedAt: Date.now() }, source.url);
    try { requireCurrentAccess(ticket); }
    catch (error) { await clearContentImages(ticket.scope); throw error; }
    const stored = await loadContentImage(ticket.scope, fileId);
    requireCurrentAccess(ticket);
    if (!stored) throw new Error('Could not save this image for offline use.');
    return stored[format];
  } catch (error) {
    if (error instanceof ApiError && isAccessRejection(error)) {
      requireCurrentAccess(ticket); revokeProjectAccess(); await clearContentImages(ticket.scope);
    }
    throw error;
  }
}

const uploads = new Map<string, Promise<string>>();
async function uploadOriginal(projectId: string, id: string) {
  const ticket = requireAccess(projectId, uploadAccess);
  const key = `${JSON.stringify(ticket.scope)}:${id}`;
  if (uploads.has(key)) return uploads.get(key)!;
  const upload = (async () => {
    const local = await loadContentImage(ticket.scope, id);
    requireCurrentAccess(ticket);
    if (!local) throw new Error('An image is no longer on this device. Reopen the record and replace it.');
    if (local.uploadedId) return local.uploadedId;
    const result = await uploadProjectFile(projectId, local.uri, local.name, local.mimeType);
    requireCurrentAccess(ticket);
    await rememberContentUpload(ticket.scope, id, result.id, accessFingerprint(ticket.snapshot));
    try { requireCurrentAccess(ticket); }
    catch (error) { await clearContentImages(ticket.scope); throw error; }
    return result.id;
  })().finally(() => uploads.delete(key));
  uploads.set(key, upload);
  return upload;
}

/** Every API writer uses this boundary, including the offline outbox and voice. */
export async function prepareContentImages(projectId: string, value: unknown): Promise<unknown> {
  const replacements = new Map<string, string>();
  for (const id of referencedFileIds(value).filter((id) => id.startsWith('local_image_'))) replacements.set(id, await uploadOriginal(projectId, id));
  function replace(item: unknown): unknown {
    if (typeof item === 'string') {
      for (const [id, uploaded] of replacements) item = (item as string).replaceAll(`/files/${id}/`, `/files/${uploaded}/`)
        .replaceAll(`data-file-id="${id}"`, `data-file-id="${uploaded}"`).replaceAll(`data-file-id='${id}'`, `data-file-id='${uploaded}'`);
      return item;
    }
    if (Array.isArray(item)) return item.map(replace);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([key, next]) => [key, replace(next)]));
    return item;
  }
  return replace(value);
}
