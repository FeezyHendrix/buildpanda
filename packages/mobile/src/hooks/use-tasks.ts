import { features } from "@/lib/feature-access";
import { canAccess } from "@/lib/project-access-store";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { tasksApi } from "@/api/tasks";
import type { Db } from "@/db/client";
import { flushOutbox } from "@/db/outbox";
import { tasksRepository, type LocalTaskInput } from "@/db/tasks-repository";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { useSyncState } from "@/lib/sync-provider";
import { useAuthGate } from "@/lib/use-auth-gate";
import { missingBuilding } from "./use-project-building";
import { useProjectAccess } from "./use-project-access";

/**
 * One building's task board from SQLite, refreshed in the background. With
 * `full` off the server sends only the caller's own tasks, which is all a
 * crew member without the full board may see anyway.
 */
export function useTaskBoard(db: Db, projectId: string, buildingId: string, full: boolean) {
  const { isOnline } = useSyncState();
  const { user } = useAuthGate();
  const { generation } = useProjectAccess();
  const selfId = user?.id ?? null;
  const columnsQuery = useMemo(() => tasksRepository.columnsQuery(db, projectId, buildingId), [db, projectId, buildingId]);
  const tasksQuery = useMemo(() => tasksRepository.tasksQuery(db, projectId, buildingId), [db, projectId, buildingId, generation]);
  const columns = useLiveQuery(columnsQuery, [columnsQuery]);
  const rows = useLiveQuery(tasksQuery, [tasksQuery]);

  useEffect(() => {
    if (!isOnline || !buildingId || !canAccess(projectId, features.tasks.read)) return;
    let cancelled = false;
    tasksApi.board(projectId, buildingId, full)
      .then((board) => {
        if (!cancelled) return tasksRepository.replaceBoard(db, projectId, buildingId, board, selfId);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, projectId, buildingId, full, isOnline, selfId, generation]);

  return {
    columns: columns.data ?? [],
    tasks: rows.data ?? [],
    isPending: rows.updatedAt === undefined && !rows.error,
  };
}

export function useTask(db: Db, id: string) {
  const { generation } = useProjectAccess();
  const query = useMemo(() => tasksRepository.byIdQuery(db, id), [db, id, generation]);
  const live = useLiveQuery(query, [query]);
  return { data: live.data?.[0] ?? null, isPending: live.updatedAt === undefined && !live.error };
}

/** People and teams a task can go to, cached for picking with no signal. */
export function useAssignable(projectId: string | undefined) {
  const { storageOwnerId } = useFieldSession();
  const query = usePersistentQuery({
    permission: features.tasks.read, projectId,
    queryKey: ["tasks", projectId ?? "none", "assignable"],
    ownerId: storageOwnerId,
    queryFn: () => tasksApi.assignable(projectId!),
    enabled: Boolean(projectId),
  });
  return query.data ?? [];
}

export function useCreateTask(db: Db | null, projectId: string | undefined, buildingId: string | undefined) {
  const { user } = useAuthGate();
  return async (input: LocalTaskInput) => {
    if (!db) throw new Error("Local database is not ready yet.");
    if (!projectId) throw new Error("Choose a project first.");
    if (!buildingId) throw missingBuilding(0);
    await tasksRepository.createLocal(db, projectId, buildingId, input, user?.id ?? null);
    void flushOutbox(db).catch(() => undefined);
  };
}

export function useMoveTask(db: Db | null, projectId: string | undefined) {
  return async (id: string, columnId: string) => {
    if (!db) throw new Error("Local database is not ready yet.");
    if (!projectId) throw new Error("Choose a project first.");
    await tasksRepository.moveLocal(db, projectId, id, columnId);
    void flushOutbox(db).catch(() => undefined);
  };
}
