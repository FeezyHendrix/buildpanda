function openDrafts(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("buildpanda-file-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readDraftFiles(key: string): Promise<File[]> {
  const db = await openDrafts();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("drafts").objectStore("drafts").get(key);
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function writeDraftFiles(key: string, files: File[]): Promise<void> {
  const db = await openDrafts();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("drafts", "readwrite");
      const store = transaction.objectStore("drafts");
      if (files.length) store.put(files, key);
      else store.delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
