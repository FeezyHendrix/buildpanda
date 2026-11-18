import {clearContentImages} from './content-image-storage';
import {cacheVersionBytes,cachedVersionUri,clearCachedDocuments,removeCachedDocumentVersions,readCachedDocumentDataUrl} from './document-bytes';
import {documentsApi} from '@/api/documents';
import {verifyMessageAttachment} from '@/api/files';
import {documentsRepository} from '@/db/documents-repository';
import type {Db} from '@/db/client';
import {scopeKey,type AccessScope} from './access-policy';
import {API_BASE_URL} from './auth-client';
import {loadStagedUploadUri} from './stage-media';
import {isReviewableFile} from './reviewable-file';
import {features,messagingAccess} from './feature-access';
import {AccessDeniedError,projectAccess,requireAccess,requireCurrentAccess,revokeProjectAccess,type AccessState} from './project-access-store';

type FileArea='documents'|'messages'|'updates';
const policies={documents:features.documents.read,messages:messagingAccess,updates:features.updates.read};
const urls=new Map<string,{scope:string;area:FileArea;id:string}>();
const FILE_CACHE='buildpanda-field-files-v1';
function ticketFor(area:FileArea='documents'){
 return requireAccess(projectAccess.getState().scope?.projectId??'',policies[area]);
}

export function requireCachedFile(uri:string):AccessState{
 const scope=projectAccess.getState().scope;
 if(!scope)throw new AccessDeniedError();
 if(uri.startsWith(`doc-cache:${scopeKey(scope)}:`))return ticketFor();
 const file=urls.get(uri);
 if(file?.scope===scopeKey(scope))return ticketFor(file.area);
 throw new AccessDeniedError('This file is not available in the selected project.');
}
export const documentCacheDirUri=()=>'';

async function downloaded(url:string,ticket:AccessState){
 const response=await fetch(url,{credentials:'include'});
 requireCurrentAccess(ticket);
 if(!response.ok){
  if(response.status===401||response.status===403)revokeProjectAccess();
  throw new Error(`Could not download this file (${response.status}).`);
 }
 const bytes=await response.blob();
 requireCurrentAccess(ticket);
 if(!bytes.size)throw new Error('The downloaded file is empty.');
 return bytes;
}

export async function cacheVersionFile(projectId:string,documentId:string,versionId:string,name:string):Promise<string|null>{
 const ticket=requireAccess(projectId,features.documents.read);
 if(!isReviewableFile(name)){
  if(!navigator.onLine)throw new Error('Connect to download this file.');
  window.open(documentsApi.versionDownloadUrl(projectId,documentId,versionId),'_blank','noopener,noreferrer');
  return null;
 }
 const existing=await cachedVersionUri(ticket.scope,versionId);
 requireCurrentAccess(ticket);
 if(existing)return existing;
 const bytes=await downloaded(documentsApi.versionDownloadUrl(projectId,documentId,versionId),ticket);
 const uri=await cacheVersionBytes(ticket.scope,versionId,bytes);
 requireCurrentAccess(ticket);
 return uri;
}

export async function cachePickedVersion(ticket:AccessState,uri:string,versionId:string,_name:string){
 requireCurrentAccess(ticket);
 const source=await loadStagedUploadUri(uri);
 const bytes=await fetch(source).then(response=>response.blob());
 requireCurrentAccess(ticket);
 const saved=await cacheVersionBytes(ticket.scope!,versionId,bytes);
 requireCurrentAccess(ticket);
 return saved;
}

export async function cacheDocument(db:Db,projectId:string,documentId:string,expectedVersionId?:string){
 const ticket=requireAccess(projectId,features.documents.read);
 const row=await documentsRepository.findById(db,documentId);
 requireCurrentAccess(ticket);
 if(!row||row.projectId!==projectId)return null;
 if(!row.currentVersionId)throw new Error('No file is attached to this record yet.');
 if(expectedVersionId&&row.currentVersionId!==expectedVersionId)throw new Error('This plan revision has changed. Reopen its current revision.');
 if(row.stagedUri){
  const source=await loadStagedUploadUri(row.stagedUri);
  const bytes=await fetch(source).then(response=>response.blob());requireCurrentAccess(ticket);
  const uri=URL.createObjectURL(bytes);urls.set(uri,{scope:scopeKey(ticket.scope),area:'documents',id:row.currentVersionId});return uri;
 }
 const uri=await cacheVersionFile(projectId,documentId,row.currentVersionId,row.fileName);
 requireCurrentAccess(ticket);
 if(!uri)return null;
 await documentsRepository.setLocalUri(db,documentId,uri,row.currentVersionId);
 return uri;
}

async function verifyConversationFile(fileId:string,ticket:AccessState){
 if(!navigator.onLine)throw new AccessDeniedError('Connect to verify this conversation attachment.');
 await verifyMessageAttachment(fileId);
 requireCurrentAccess(ticket);
}

export async function cacheFileById(fileId:string,_name:string,area:FileArea='documents',allowDownload=true){
 const ticket=ticketFor(area);
 if(area==='messages')await verifyConversationFile(fileId,ticket);
 const key=`https://field-cache.invalid/${encodeURIComponent(scopeKey(ticket.scope))}/${area}/${encodeURIComponent(fileId)}`;
 const cache=await caches.open(FILE_CACHE);
 let response=await cache.match(key);
 requireCurrentAccess(ticket);
 if(!response){
  if(!allowDownload)throw new Error('Connect once to download this recording.');
  const blob=await downloaded(`${API_BASE_URL}/files/${encodeURIComponent(fileId)}/download`,ticket);
  await cache.put(key,new Response(blob));
  response=new Response(blob);
 }
 const blob=await response.blob();
 requireCurrentAccess(ticket);
 const uri=URL.createObjectURL(blob);
 urls.set(uri,{scope:scopeKey(ticket.scope),area,id:fileId});
 return uri;
}

export async function verifyCachedFile(uri:string){
 const ticket=requireCachedFile(uri);
 const entry=urls.get(uri);
 if(entry?.area==='messages')await verifyConversationFile(entry.id,ticket);
}

export async function readCachedFileDataUrl(uri:string):Promise<string>{
 const ticket=requireCachedFile(uri);
 if(uri.startsWith('doc-cache:'))return readCachedDocumentDataUrl(uri);
 await verifyCachedFile(uri);
 const blob=await fetch(uri).then(response=>response.blob());
 requireCurrentAccess(ticket);
 const value=await new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
 });
 requireCurrentAccess(ticket);
 return value;
}
export async function readCachedFileBase64(uri:string){
 const value=await readCachedFileDataUrl(uri);
 return value.slice(value.indexOf(',')+1);
}

export async function clearDocumentCache(scope?:AccessScope){
 for(const [uri,entry] of urls){
  if(!scope||entry.scope===scopeKey(scope)){URL.revokeObjectURL(uri);urls.delete(uri);}
 }
 const results=await Promise.allSettled([
  clearContentImages(scope),clearCachedDocuments(scope),
  (async()=>{
   const cache=await caches.open(FILE_CACHE);
   for(const request of await cache.keys())if(!scope||request.url.includes(encodeURIComponent(scopeKey(scope))))await cache.delete(request);
  })(),
 ]);
 if(results.some(result=>result.status==='rejected'))throw new Error('Could not clear the protected file cache.');
}
export function removeCachedVersions(projectId:string,versionIds:readonly string[]){
 const scope=projectAccess.getState().scope;
 if(scope?.projectId===projectId)void removeCachedDocumentVersions(scope,versionIds);
}
