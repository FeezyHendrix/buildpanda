import { scopeKey, type AccessScope } from "./access-policy";

let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("buildpanda-pending-media-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("originals");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
  });
}
async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("originals", mode);
    const request = run(tx.objectStore("originals"));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Attachment storage was interrupted."));
  });
}
export async function stagePendingMedia(scope: AccessScope, uri: string, id: string, _name: string, maxBytes = 100 * 1024 * 1024): Promise<string> {
  if (!/^(blob:|data:)/.test(uri)) throw new Error("Choose a file from this browser first.");
  const blob = await fetch(uri).then((response) => response.blob());
  if (!blob.size || blob.size > maxBytes) throw new Error("This attachment is empty or too large.");
  const key = `pending-media:${scopeKey(scope)}:${id}`;
  await transact("readwrite", (store) => store.put(blob, key));
  return key;
}
export async function loadPendingMedia(uri: string): Promise<string> {
  const blob = await transact<Blob | undefined>("readonly", (store) => store.get(uri));
  if (!blob) throw new Error("This attachment is no longer in this browser.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
export async function discardPendingMedia(uri: string | null): Promise<void> {
  if (uri) await transact("readwrite", (store) => store.delete(uri));
}
