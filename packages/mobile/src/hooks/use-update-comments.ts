import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { updatesApi } from "@/api/updates";
import type { Db } from "@/db/client";
import { flushOutbox } from "@/db/outbox";
import { updateCommentsRepository, type NewLocalUpdateComment } from "@/db/update-comments-repository";
import { useProjectAccess } from "@/lib/project-access-provider";
import { useSyncState } from "@/lib/sync-provider";
import { requireAccess, requireCurrentAccess } from "@/lib/project-access-store";
import { features } from "@/lib/feature-access";

export function useUpdateComments(db: Db, projectId: string, updateId: string) {
  const { generation, allows } = useProjectAccess();
  const { isOnline } = useSyncState();
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const query = useMemo(() => updateCommentsRepository.listQuery(db, projectId, updateId), [db, projectId, updateId, generation]);
  const live = useLiveQuery(query, [query]);
  const refresh = useCallback(async () => {
    if (!isOnline || updateId.startsWith("local_")) return;
    const ticket = requireAccess(projectId, features.updates.read);
    setRefreshing(true);
    setError("");
    try {
      const rows = await updatesApi.comments(projectId, updateId);
      requireCurrentAccess(ticket);
      updateCommentsRepository.replaceFromServer(db, projectId, updateId, rows);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load comments."); }
    finally { setRefreshing(false); }
  }, [db, projectId, updateId, isOnline, generation]);
  useEffect(() => { if (allows(features.updates.read)) void refresh(); }, [refresh, allows]);
  async function add(input: NewLocalUpdateComment) {
    await updateCommentsRepository.addLocal(db, projectId, updateId, input);
    void flushOutbox(db).catch(() => undefined);
  }
  return { data: allows(features.updates.read) ? (live.data ?? []).filter((row) => row.projectId === projectId && row.updateId === updateId) : [],
    isPending: live.updatedAt === undefined && !live.error, refreshing, error: error || live.error?.message || "", refresh, add };
}
