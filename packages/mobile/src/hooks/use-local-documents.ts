import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useMemo } from "react";
import { documentFolders, UNFILED_CATEGORY } from "@/lib/document-folders";
import type { Db } from "@/db/client";
import {
  documentsRepository,
  toCategory,
  toDocument,
  type DocumentGroup,
} from "@/db/documents-repository";

/**
 * Category folders for a group, from SQLite with a background refresh.
 *
 * One live query for all groups so switching the segment filters in memory
 * rather than tearing down and re-subscribing. Media folders exist in the
 * table but no tab asks for them, the same as the web's Documents page.
 */
export function useDocumentCategories(db: Db, projectId: string, group: DocumentGroup) {
  const query = useMemo(() => documentsRepository.categoriesQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query, [query]);
  const filesQuery = useMemo(() => documentsRepository.listQuery(db, projectId), [db, projectId]);
  const files = useLiveQuery(filesQuery, [filesQuery]);
  const data = useMemo(() => documentFolders(
    (live.data ?? []).map(toCategory), (files.data ?? []).map(toDocument), group,
  ), [live.data, files.data, group]);
  return { data, isPending: (live.updatedAt === undefined && !live.error) || (files.updatedAt === undefined && !files.error), error: live.error ?? files.error };
}

/** Files in a group, optionally narrowed to one category folder by its id. Queued uploads are included. */
export function useLocalDocuments(
  db: Db,
  projectId: string,
  group: DocumentGroup,
  categoryId?: string,
) {
  const query = useMemo(() => documentsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query, [query]);

  const all = useMemo(() => (live.data ?? []).map(toDocument), [live.data]);
  const data = useMemo(
    () =>
      all.filter(
        (doc) => doc.group === group && (!categoryId || (categoryId === UNFILED_CATEGORY ? !doc.categoryId : doc.categoryId === categoryId)),
      ),
    [all, group, categoryId],
  );

  return { data, isPending: live.updatedAt === undefined && !live.error, error: live.error };
}

/** Top 5 recently opened files, for the Plans page header. */
export function useRecentDocuments(db: Db, projectId: string) {
  const query = useMemo(() => documentsRepository.recentQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query, [query]);
  const data = useMemo(() => (live.data ?? []).map(toDocument), [live.data]);
  return { data, isPending: live.updatedAt === undefined && !live.error, error: live.error };
}
