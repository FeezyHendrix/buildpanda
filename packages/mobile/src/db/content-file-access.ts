import { and, eq, getTableColumns, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { FILE_ID } from '@buildpanda/rich-content';
import { features } from '@/lib/feature-access';
import type { FeatureAccess } from '@/lib/access-requirement';
import { canAccess, projectAccess } from '@/lib/project-access-store';
import type { Db } from './client';
import { repositoryAccess } from './permissions';
import { rfiReadWhere, rfiCommentReadWhere } from './rfi-access';
import * as tables from './schema';

type Table = SQLiteTable & { id: AnySQLiteColumn; projectId: AnySQLiteColumn };

/** Offline bytes remain readable only through a currently readable local record. */
export function canReadCachedContentFile(db: Db, projectId: string, fileId: string): boolean {
  if (!FILE_ID.test(fileId)) return false;
  const pattern = `%/files/${fileId.replace(/[!%_]/g, '!$&')}/%`;
  function contains(table: Table, feature: FeatureAccess, condition?: SQL): boolean {
    if (!canAccess(projectId, feature.read)) return false;
    const fields = Object.values(getTableColumns(table)).filter((column) => column.dataType === 'string');
    const reference = or(...fields.map((column) => sql`${column} LIKE ${pattern} ESCAPE '!'`));
    return !!db.select({ id: table.id }).from(table).where(and(
      repositoryAccess(feature).where(db, table.projectId, eq(table.projectId, projectId)), condition, reference,
    )).limit(1).get();
  }
  if (contains(tables.rfis, features.rfis, rfiReadWhere(db, isNull(tables.rfis.deletedAt))) ||
      contains(tables.rfiComments, features.rfis, rfiCommentReadWhere(db))) return true;
  const taskVisible = projectAccess.getState().snapshot?.capabilities.canSeeFullTaskBoard ? undefined : eq(tables.tasks.assignedToMe, true);
  if (contains(tables.tasks, features.tasks, taskVisible)) return true;
  const sources: readonly [Table, FeatureAccess, SQL?][] = [
    [tables.changeRequests, features.changeRequests],
    [tables.changeRequestComments, features.changeRequests, inArray(tables.changeRequestComments.changeRequestId,
      db.select({ id: tables.changeRequests.id }).from(tables.changeRequests))],
    [tables.projectUpdates, features.updates], [tables.dailyLogEntries, features.dailyLog],
    [tables.dailyLogTemplates, features.dailyLog], [tables.dailyLogs, features.dailyLog],
    [tables.materialLedgerEntries, features.materialLog], [tables.materialOrders, features.materialOrders],
    [tables.materialApprovals, features.materialApprovals], [tables.materialApprovalComments, features.materialApprovals],
    [tables.lookAheads, features.schedule], [tables.expenses, features.expenses],
    [tables.drawingMarkupComments, features.documents, inArray(tables.drawingMarkupComments.markupId,
      db.select({ id: tables.drawingMarkups.id }).from(tables.drawingMarkups))],
  ];
  return sources.some(([table, feature, condition]) => contains(table, feature, condition));
}
