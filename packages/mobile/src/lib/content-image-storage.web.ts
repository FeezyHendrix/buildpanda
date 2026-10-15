import { imageError } from "@buildpanda/rich-content";
import type { AccessScope } from './access-policy';
import { scopeKey } from './access-policy';
import type { LoadedContentImage, PickedContentImage, StoredContentImage } from './content-image-types';

interface Row extends StoredContentImage { key: string; scope: string; dataUrl: string }
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open('buildpanda-content-images-v1', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('images', { keyPath: 'key' });
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => { database = undefined; reject(open.error); };
  });
}
async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', mode);
    const request = run(tx.objectStore('images'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Image storage was interrupted.'));
  });
}
async function dataUrl(uri: string, mimeType: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Could not read this image.');
  const blob = await response.blob();
  const invalid = imageError(mimeType, blob.size);
  if (invalid) throw new Error(invalid);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
const key = (scope: AccessScope, id: string) => `${scopeKey(scope)}:${id}`;
export async function savePickedContentImage(scope: AccessScope, id: string, picked: PickedContentImage): Promise<void> {
  const row: Row = { key: key(scope, id), scope: scopeKey(scope), id, name: picked.fileName, mimeType: picked.mimeType, dataUrl: await dataUrl(picked.uri, picked.mimeType) };
  await transact('readwrite', (store) => store.put(row));
}
export async function loadContentImage(scope: AccessScope, id: string): Promise<LoadedContentImage | null> {
  const row = await transact<Row | undefined>('readonly', (store) => store.get(key(scope, id)));
  return row ? { ...row, uri: row.dataUrl } : null;
}
export async function rememberContentUpload(scope: AccessScope, id: string, uploadedId: string, fingerprint: string): Promise<void> {
  const row = await transact<Row | undefined>('readonly', (store) => store.get(key(scope, id)));
  if (!row) throw new Error('This image is no longer on this device. Add it again.');
  await transact('readwrite', (store) => store.put({ ...row, uploadedId }));
  await transact('readwrite', (store) => store.put({ ...row, id: uploadedId, key: key(scope, uploadedId), fingerprint, verifiedAt: Date.now() }));
}
export async function cacheContentImage(scope: AccessScope, info: StoredContentImage, url: string): Promise<void> {
  const row: Row = { ...info, key: key(scope, info.id), scope: scopeKey(scope), dataUrl: await dataUrl(url, info.mimeType) };
  await transact('readwrite', (store) => store.put(row));
}
export async function verifyCachedContentImage(scope: AccessScope, id: string): Promise<void> {
  const row = await transact<Row | undefined>('readonly', (store) => store.get(key(scope, id)));
  if (row) await transact('readwrite', (store) => store.put({ ...row, verifiedAt: Date.now() }));
}
export async function clearContentImages(scope?: AccessScope): Promise<void> {
  const rows = await transact<Row[]>('readonly', (store) => store.getAll());
  for (const row of rows) if (!row.id.startsWith('local_image_') && (!scope || row.scope === scopeKey(scope))) {
    await transact('readwrite', (store) => store.delete(row.key));
  }
}
