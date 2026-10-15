import { Directory, File, Paths } from 'expo-file-system';
import { FILE_ID, imageError } from '@buildpanda/rich-content';
import type { AccessScope } from './access-policy';
import type { LoadedContentImage, PickedContentImage, StoredContentImage } from './content-image-types';

function directory(scope: AccessScope, id: string) {
  if (!FILE_ID.test(id)) throw new Error('Invalid image reference.');
  // Unsynced originals stay quarantined when downloaded bytes are purged.
  const root = id.startsWith('local_image_') ? 'content-originals-v1' : 'protected-files-v1';
  return new Directory(Paths.document, root, ...[scope.userId, scope.organizationId, scope.projectId].map((value) => `s-${encodeURIComponent(value)}`), 'content');
}
function paths(scope: AccessScope, id: string) {
  const dir = directory(scope, id);
  if (!dir.exists) dir.create({ intermediates: true });
  return { bytes: new File(dir, id), metadata: new File(dir, `${id}.json`) };
}
export async function savePickedContentImage(scope: AccessScope, id: string, picked: PickedContentImage): Promise<void> {
  const { bytes, metadata } = paths(scope, id);
  const source = new File(picked.uri);
  const invalid = imageError(picked.mimeType, source.size);
  if (invalid) throw new Error(invalid);
  source.copy(bytes);
  metadata.write(JSON.stringify({ id, name: picked.fileName, mimeType: picked.mimeType } satisfies StoredContentImage));
}
export async function loadContentImage(scope: AccessScope, id: string): Promise<LoadedContentImage | null> {
  const { bytes, metadata } = paths(scope, id);
  if (!bytes.exists || !metadata.exists) return null;
  const info = JSON.parse(await metadata.text()) as StoredContentImage;
  return { ...info, uri: bytes.uri, dataUrl: `data:${info.mimeType};base64,${await bytes.base64()}` };
}
export async function rememberContentUpload(scope: AccessScope, id: string, uploadedId: string, fingerprint: string): Promise<void> {
  const { metadata } = paths(scope, id);
  const info = JSON.parse(await metadata.text()) as StoredContentImage;
  metadata.write(JSON.stringify({ ...info, uploadedId }));
  const uploaded = paths(scope, uploadedId);
  if (!uploaded.bytes.exists) paths(scope, id).bytes.copy(uploaded.bytes);
  uploaded.metadata.write(JSON.stringify({ ...info, id: uploadedId, fingerprint, verifiedAt: Date.now() }));
}
export async function cacheContentImage(scope: AccessScope, info: StoredContentImage, url: string): Promise<void> {
  const { bytes, metadata } = paths(scope, info.id);
  await File.downloadFileAsync(url, bytes, { idempotent: true });
  metadata.write(JSON.stringify(info));
}
export async function verifyCachedContentImage(scope: AccessScope, id: string): Promise<void> {
  const { metadata } = paths(scope, id);
  const info = JSON.parse(await metadata.text()) as StoredContentImage;
  metadata.write(JSON.stringify({ ...info, verifiedAt: Date.now() }));
}
export async function clearContentImages(scope?: AccessScope): Promise<void> {
  // clearDocumentCache removes this same directory on native, but this also
  // lets an individual failed authorization discard a downloaded image.
  const dir = scope ? directory(scope, 'server_image') : new Directory(Paths.document, 'protected-files-v1');
  if (dir.exists) dir.delete();
}
