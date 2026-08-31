import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { documentsApi } from "@/api/documents";
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
 * rather than tearing down and re-subscribing.
 */
export function useDocumentCategories(db: Db, projectId: string, group: DocumentGroup) {
  const query = useMemo(() => documentsRepository.categoriesQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);

  useEffect(() => {
    let cancelled = false;
    documentsApi
      .categories(projectId)
      .then((rows) => {
        if (!cancelled) return documentsRepository.upsertCategories(db, projectId, rows);
      })
      .catch(() => undefined); // offline: cached folders already rendered
    return () => {
      cancelled = true;
    };
  }, [db, projectId]);

  const all = useMemo(() => (live.data ?? []).map(toCategory), [live.data]);
  const data = useMemo(() => all.filter((c) => c.group === group), [all, group]);
  return { data, isPending: live.data === undefined };
}

/** Files, optionally narrowed to one category folder. */
export function useLocalDocuments(
  db: Db,
  projectId: string,
  group: DocumentGroup,
  categoryName?: string,
) {
  const query = useMemo(() => documentsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);

  useEffect(() => {
    let cancelled = false;
    documentsApi
      .list(projectId)
      .then((rows) => {
        if (!cancelled) return documentsRepository.upsertFromServer(db, projectId, rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, projectId]);

  const all = useMemo(() => (live.data ?? []).map(toDocument), [live.data]);
  const data = useMemo(
    () =>
      all.filter(
        (doc) => doc.group === group && (!categoryName || doc.category === categoryName),
      ),
    [all, group, categoryName],
  );

  return { data, isPending: live.data === undefined };
}

/** Top 5 recently opened files, for the Plans page header. */
export function useRecentDocuments(db: Db, projectId: string) {
  const query = useMemo(() => documentsRepository.recentQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);
  const data = useMemo(() => (live.data ?? []).map(toDocument), [live.data]);
  return { data, isPending: live.data === undefined };
}
