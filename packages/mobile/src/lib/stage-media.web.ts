// The native sibling copies staged media into the document directory;
// browsers have no durable file system, so staged bytes live in IndexedDB
// (the same pattern as pending-media.web.ts) and the returned key stands in
// for the file path until the outbox pushes it.

const KEY_PREFIX = "outbox-media:";

let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("buildpanda-outbox-media-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("staged");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  }));
}

async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("staged", mode);
    const request = run(tx.objectStore("staged"));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Staged media storage was interrupted."));
  });
}

function extensionOf(fileName: string): string {
  return fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
}

export async function stageMedia(sourceUri: string, id: string, fileName: string): Promise<string> {
  if (!/^(blob:|data:)/.test(sourceUri)) throw new Error("Choose a file from this browser first.");
  const blob = await fetch(sourceUri).then((response) => response.blob());
  if (!blob.size) throw new Error("This file is empty. Choose another one.");
  const key = `${KEY_PREFIX}${id}${extensionOf(fileName)}`;
  await transact("readwrite", (store) => store.put(blob, key));
  return key;
}

export async function stagedMediaExists(uri: string): Promise<boolean> {
  if (!uri.startsWith(KEY_PREFIX)) return /^(blob:|data:)/.test(uri);
  const blob = await transact<Blob | undefined>("readonly", (store) => store.get(uri));
  return Boolean(blob);
}

/** A data: url the uploader's web branch can fetch, standing in for a file path. */
export async function loadStagedUploadUri(uri: string): Promise<string> {
  if (!uri.startsWith(KEY_PREFIX)) return uri;
  const blob = await transact<Blob | undefined>("readonly", (store) => store.get(uri));
  if (!blob) throw new Error("This file is no longer in this browser. Pick it again.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function discardStagedMedia(uri: string | null): void {
  if (!uri || !uri.startsWith(KEY_PREFIX)) return;
  void transact("readwrite", (store) => store.delete(uri)).catch(() => undefined);
}
