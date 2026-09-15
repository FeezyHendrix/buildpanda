import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useMemo } from "react";
import type { Db } from "@/db/client";
import { documentsRepository, toDocument, type DocumentGroup } from "@/db/documents-repository";

/** All cached project files; the drawing viewer can request just its sheets. */
export function useLocalDocuments(db: Db, projectId: string, group?: DocumentGroup) {
  const query = useMemo(() => documentsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query, [query]);
  const data = useMemo(() => (live.data ?? []).map(toDocument).filter((file) => !group || file.group === group), [live.data, group]);
  return { data, isPending: live.updatedAt === undefined && !live.error, error: live.error };
}
