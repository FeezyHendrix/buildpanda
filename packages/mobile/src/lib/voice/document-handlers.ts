import { serverActionCache } from "@/db/server-action-cache";
import { remoteResult } from "./remote-result";
import { documentsApi } from '@/api/documents';
import { documentsRepository } from '@/db/documents-repository';
import { drawingMarkupsRepository } from '@/db/drawing-markups-repository';
import { features } from '@/lib/feature-access';
import { cacheDocument, removeCachedVersions } from '@/lib/download-file';
import { requireCurrentAccess } from '@/lib/project-access-store';
import { option, required, type VoiceHandlerMap } from './types';
import { voiceRecords } from './records';

export const documentHandlers = {
  async upload_document(p, c) {
    const file = required(p.file);
    const category = option(c, 'documentCategories', p.categoryId);
    await documentsRepository.createLocal(c.db, c.projectId, { ...file, sizeBytes: file.size,
      categoryId: category.value, categoryName: category.label, group: category.group === 'plan' ? 'plan' : 'document' });
    return { queued: true };
  },
  async rename_document(p, c) {
    await documentsApi.rename(c.projectId, required(p.documentId), required(p.fileName));
    return remoteResult(() => serverActionCache.document(c.db, c.projectId, required(p.documentId), { fileName: required(p.fileName) }));
  },
  async upload_document_version(p, c) {
    const file = required(p.file);
    const uploaded = await documentsApi.uploadFile(c.projectId, file.uri, file.fileName, file.mimeType, features.documents.actions.edit);
    requireCurrentAccess(c.ticket);
    const version = await documentsApi.addVersion(c.projectId, required(p.documentId), {
      fileId: uploaded.id, revisionLabel: p.revisionLabel ?? undefined, notes: p.notes ?? undefined,
    });
    return remoteResult(() => serverActionCache.document(c.db, c.projectId, required(p.documentId), { currentVersionId: version.id, versionNo: version.versionNo, localUri: null }));
  },
  async download_document(p, c) {
    const row = await voiceRecords(c).document(required(p.documentId));
    const expected = option(c, 'documents', p.documentId).versionId;
    if (!await cacheDocument(c.db, c.projectId, row.id, expected)) throw new Error('This document has no downloadable file.');
    return { queued: false, document: { id: row.id, name: row.fileName } };
  },
  async open_document(p, c) {
    const row = await voiceRecords(c).document(required(p.documentId));
    return { queued: false, document: { id: row.id, name: row.fileName } };
  },
  async delete_document(p, c) {
    const versions = await documentsApi.versions(c.projectId, required(p.documentId));
    await documentsApi.remove(c.projectId, required(p.documentId));
    return remoteResult(async () => {
      await serverActionCache.document(c.db, c.projectId, required(p.documentId));
      removeCachedVersions(c.projectId, versions.map((version) => version.id));
    });
  },
  async annotate_drawing(p, c) {
    const target = option(c, 'drawings', p.documentId);
    await voiceRecords(c).document(target.value);
    await drawingMarkupsRepository.createLocal(c.db, { projectId: c.projectId, documentId: target.value,
      documentVersionId: required(target.versionId), pageNo: required(p.pageNo), kind: 'pin',
      geometry: { kind: 'pin', space: 'percent', at: { x: required(p.x), y: required(p.y) } },
    }, required(p.body));
    return { queued: true };
  },
  async comment_drawing(p, c) {
    await voiceRecords(c).markup(required(p.markupId));
    await drawingMarkupsRepository.addCommentLocal(c.db, required(p.markupId), c.projectId, { body: required(p.body) });
    return { queued: true };
  },
  async resolve_drawing(p, c) {
    await voiceRecords(c).markup(required(p.markupId));
    await drawingMarkupsRepository.setResolvedLocal(c.db, c.projectId, required(p.markupId), p.status === 'resolved');
    return { queued: true };
  },
  async delete_drawing(p, c) {
    await voiceRecords(c).markup(required(p.markupId));
    await drawingMarkupsRepository.deleteLocal(c.db, c.projectId, required(p.markupId));
    return { queued: true };
  },
} satisfies Partial<VoiceHandlerMap>;
