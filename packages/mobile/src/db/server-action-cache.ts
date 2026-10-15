import { and, eq, inArray } from 'drizzle-orm';
import { features } from '@/lib/feature-access';
import { repositoryAccess } from './permissions';
import { taskReadWhere } from './record-visibility';
import type { TaskRow } from './schema';
import type { Db } from './client';
import { documents, drawingMarkups, drawingMarkupComments, projectUpdates, projectUpdateMedia, tasks } from './schema';

/** Reflect confirmed online writes without scheduling a second mutation. */
export const serverActionCache = {
  async task(db: Db, projectId: string, id: string, patch?: Partial<Pick<TaskRow, 'title' | 'description' | 'dueDate' | 'priority' | 'assignees' | 'assignedToMe'>>) {
    const access = repositoryAccess(features.tasks);
    await access.transaction(db, projectId, 'read', (tx) => {
      const where = access.where(db, tasks.projectId, taskReadWhere(), eq(tasks.id, id), eq(tasks.isPendingSync, false));
      if (patch) tx.update(tasks).set({ ...patch, updatedAt: Date.now() }).where(where).run();
      else tx.delete(tasks).where(where).run();
    });
  },
  async document(db: Db, projectId: string, id: string, patch?: { fileName?: string; currentVersionId?: string; versionNo?: number; localUri?: null }) {
    const access = repositoryAccess(features.documents);
    await access.transaction(db, projectId, 'read', (tx) => {
      const where = access.where(db, documents.projectId, eq(documents.id, id), eq(documents.isPendingSync, false));
      if (patch) tx.update(documents).set({ ...patch, updatedAt: Date.now() }).where(where).run();
      else {
        const ids = tx.select({ id: drawingMarkups.id }).from(drawingMarkups).where(access.where(db, drawingMarkups.projectId, eq(drawingMarkups.documentId, id))).all().map((row) => row.id);
        if (ids.length) tx.delete(drawingMarkupComments).where(access.where(db, drawingMarkupComments.projectId, inArray(drawingMarkupComments.markupId, ids), eq(drawingMarkupComments.isPendingSync, false))).run();
        tx.delete(drawingMarkups).where(access.where(db, drawingMarkups.projectId, eq(drawingMarkups.documentId, id), eq(drawingMarkups.isPendingSync, false))).run();
        tx.delete(documents).where(where).run();
      }
    });
  },
  async update(db: Db, projectId: string, id: string, patch?: { title?: string; description?: string }) {
    const access = repositoryAccess(features.updates);
    await access.transaction(db, projectId, 'read', (tx) => {
      const where = access.where(db, projectUpdates.projectId, eq(projectUpdates.id, id), eq(projectUpdates.isPendingSync, false));
      if (patch) tx.update(projectUpdates).set({ ...patch, ...(patch.description !== undefined ? { descriptionHtml: null } : {}), updatedAt: Date.now() }).where(where).run();
      else {
        tx.delete(projectUpdateMedia).where(and(eq(projectUpdateMedia.updateId, id), inArray(projectUpdateMedia.updateId, tx.select({ id: projectUpdates.id }).from(projectUpdates).where(where)))).run();
        tx.delete(projectUpdates).where(where).run();
      }
    });
  },
};
