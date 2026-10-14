import { tasksApi } from '@/api/tasks';
import { materialApprovalsApi } from '@/api/material-approvals';
import { materialsApi } from '@/api/materials';
import { documentsApi } from '@/api/documents';
import { drawingMarkupApi } from '@/api/drawing-markup';
import { rfisApi } from '@/api/rfis';
import { tasksRepository } from '@/db/tasks-repository';
import { materialApprovalsRepository } from '@/db/material-approvals-repository';
import { materialsRepository } from '@/db/materials-repository';
import { documentsRepository } from '@/db/documents-repository';
import { drawingMarkupsRepository } from '@/db/drawing-markups-repository';
import { rfisRepository } from '@/db/rfis-repository';
import { requireCurrentAccess } from '@/lib/project-access-store';
import { option, required, type VoiceExecutionContext } from './types';

/** Hydration uses the same scoped APIs/cache guards as the hand-entered forms. */
export function voiceRecords(context: VoiceExecutionContext) {
  const { db, projectId, online, ticket } = context;
  async function hydrate<T>(read: () => Promise<T>, refresh: () => Promise<void>): Promise<NonNullable<T>> {
    if (online) await refresh();
    requireCurrentAccess(ticket);
    const row = await read();
    requireCurrentAccess(ticket);
    if (!row) throw new Error('This record is not available offline. Connect and try again.');
    return row;
  }
  const records = {
    async board(buildingId: string) {
      if (online) {
        const board = await tasksApi.board(projectId, buildingId, ticket.snapshot?.capabilities.canSeeFullTaskBoard === true);
        requireCurrentAccess(ticket);
        await tasksRepository.replaceBoard(db, projectId, buildingId, board, context.userId);
      }
      requireCurrentAccess(ticket);
    },
    async task(id: string) {
      await records.board(required(option(context, 'tasks', id).buildingId));
      return required(await tasksRepository.findById(db, id));
    },
    approval: (id: string) => hydrate(() => materialApprovalsRepository.findById(db, id), async () => {
      const row = await materialApprovalsApi.detail(projectId, id);
      requireCurrentAccess(ticket);
      await materialApprovalsRepository.upsertFromServer(db, projectId, [row]);
    }),
    order: (id: string) => hydrate(() => materialsRepository.findById(db, id), async () => {
      const rows = await materialsApi.list(projectId);
      requireCurrentAccess(ticket);
      await materialsRepository.upsertFromServer(db, projectId, rows);
    }),
    rfi: (id: string) => hydrate(() => rfisRepository.byIdQuery(db, id).then((rows) => rows[0]), async () => {
      const row = await rfisApi.detail(projectId, id);
      requireCurrentAccess(ticket);
      await rfisRepository.upsertFromServer(db, projectId, [row]);
    }),
    document: (id: string) => hydrate(() => documentsRepository.findById(db, id), async () => {
      const rows = await documentsApi.list(projectId);
      requireCurrentAccess(ticket);
      await documentsRepository.upsertFromServer(db, projectId, rows);
    }),
    markup: (id: string) => hydrate(() => drawingMarkupsRepository.findById(db, id), async () => {
      const target = option(context, 'markups', id);
      const rows = await drawingMarkupApi.listForVersion(projectId, required(target.versionId));
      requireCurrentAccess(ticket);
      for (const pageNo of new Set(rows.map((row) => row.pageNo))) {
        await drawingMarkupsRepository.replacePage(db, projectId, required(target.versionId), pageNo, rows.filter((row) => row.pageNo === pageNo));
      }
      if (!rows.some((row) => row.id === id)) throw new Error('This annotation no longer exists.');
    }),
  };
  return records;
}
