import { scopeKey, type AccessScope } from "./access-policy";
import { features } from "./feature-access";
import { AccessDeniedError, projectAccess, requireAccess, requireCurrentAccess } from "./project-access-store";
// Browser counterpart of the native plan-file cache: version bytes live in
// IndexedDB under a key partitioned by user/workspace/project, so a plan
// downloaded once opens offline, a scope switch cannot read another scope's
// bytes, and revocation can purge exactly one partition.
const KEY_PREFIX = "doc-cache:";
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
    return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("buildpanda-doc-cache-v1", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("files");
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
        const tx = db.transaction("files", mode);
        const request = run(tx.objectStore("files"));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("Plan storage was interrupted."));
    });
}
const keyFor = (scope: AccessScope, versionId: string) => `${KEY_PREFIX}${scopeKey(scope)}:${versionId}`;
export async function cacheVersionBytes(scope: AccessScope, versionId: string, bytes: Blob): Promise<string> {
    const key = keyFor(scope, versionId);
    await transact("readwrite", (store) => store.put(bytes, key));
    return key;
}
export async function cachedVersionUri(scope: AccessScope, versionId: string): Promise<string | null> {
    const blob = await transact<Blob | undefined>("readonly", (store) => store.get(keyFor(scope, versionId)));
    return blob ? keyFor(scope, versionId) : null;
}
const removedVersions=new Set<string>();
export async function readCachedDocumentBlob(uri:string):Promise<Blob>{
 const {scope}=projectAccess.getState();
 if(!scope||!uri.startsWith(`${KEY_PREFIX}${scopeKey(scope)}:`)||removedVersions.has(uri))throw new AccessDeniedError();
 const ticket=requireAccess(scope.projectId,features.documents.read);
 const blob=await transact<Blob|undefined>('readonly',store=>store.get(uri));
 requireCurrentAccess(ticket);
 if(!blob||removedVersions.has(uri))throw new Error('This plan is not downloaded in this browser. Connect once to open it.');
 return blob;
}
export async function readCachedDocumentDataUrl(uri:string):Promise<string>{
 const {scope}=projectAccess.getState();if(!scope)throw new AccessDeniedError();
 const ticket=requireAccess(scope.projectId,features.documents.read);const blob=await readCachedDocumentBlob(uri);
 const value=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
 requireCurrentAccess(ticket);return value;
}
export async function readCachedDocumentBase64(uri:string):Promise<string>{const url=await readCachedDocumentDataUrl(uri);return url.slice(url.indexOf(',')+1);}
export async function removeCachedDocumentVersions(scope:AccessScope,versionIds:readonly string[]){
 const keys=versionIds.map(id=>keyFor(scope,id));keys.forEach(key=>removedVersions.add(key));
 await Promise.all(keys.map(key=>transact('readwrite',store=>store.delete(key))));
}
export async function clearCachedDocuments(scope?: AccessScope): Promise<void> {
    if (!scope) {
        await transact("readwrite", (store) => store.clear());
        return;
    }
    const prefix = `${KEY_PREFIX}${scopeKey(scope)}:`;
    await transact("readwrite", (store) => store.delete(IDBKeyRange.bound(prefix, `${prefix}\uffff`)));
}
