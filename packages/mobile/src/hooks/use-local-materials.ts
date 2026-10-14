import { useStageScope } from "@/lib/stage-scope";
import { matchesStage } from "@/lib/stage-filter";
import { projectAccess } from "@/lib/project-access-store";
import { useSyncState } from "@/lib/sync-provider";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { materialsApi, type CreateMaterialOrderInput } from "@/api/materials";
import type { Db } from "@/db/client";
import { flushOutbox } from "@/db/outbox";
import { materialsRepository, toMaterialOrder } from "@/db/materials-repository";

/** SQLite first, background refresh — opens with no signal. */
export function useLocalMaterialOrders(db: Db, projectId: string, scoped = true) {
  const { stageId } = useStageScope();
  const { isOnline } = useSyncState();
  const query = useMemo(() => materialsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query, [query]);

  useEffect(() => {
    if (!isOnline || !projectAccess.can(projectId, "materials", "view")) return;
    let cancelled = false;
    materialsApi
      .list(projectId)
      .then((rows) => {
        if (!cancelled) return materialsRepository.upsertFromServer(db, projectId, rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, projectId, isOnline]);

  const data = useMemo(() => (live.data ?? []).map(toMaterialOrder).filter((row) => !scoped || matchesStage(row.phaseId, stageId)), [live.data, scoped, stageId]);
  return { data, isPending: live.updatedAt === undefined && !live.error, error: live.error };
}

/** One order from SQLite; `null` once the query has run and found nothing. */
export function useLocalMaterialOrder(db: Db, id: string) {
  const query = useMemo(() => materialsRepository.byIdQuery(db, id), [db, id]);
  const live = useLiveQuery(query, [query]);
  const row = live.data?.[0];
  const data = useMemo(() => (row ? toMaterialOrder(row) : null), [row]);
  return { data, isPending: live.updatedAt === undefined && !live.error, error: live.error };
}

export function useCreateMaterialOrder(db: Db | null, projectId: string | undefined) {
  return async (input: CreateMaterialOrderInput) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await materialsRepository.createLocal(db, projectId, input);
    void flushOutbox(db).catch(() => undefined);
  };
}

export function useUpdateMaterialOrder(db: Db | null, projectId: string | undefined) {
  return async (id: string, patch: Partial<CreateMaterialOrderInput>) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await materialsRepository.updateLocal(db, projectId, id, patch);
    void flushOutbox(db).catch(() => undefined);
  };
}

/**
 * Goods received against an order, full or part. Recorded here first; the push
 * books the stock and cost on the server and moves the order's status.
 */
export function useRecordDelivery(db: Db | null, projectId: string | undefined) {
  return async (id: string, quantity: number, note: string | null) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    if (!(quantity > 0)) throw new Error("Enter how much arrived.");
    await materialsRepository.recordDeliveryLocal(db, projectId, id, quantity, note);
    void flushOutbox(db).catch(() => undefined);
  };
}

export function useDeleteMaterialOrder(db: Db | null, projectId: string | undefined) {
  return async (id: string) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await materialsRepository.deleteLocal(db, projectId, id);
    void flushOutbox(db).catch(() => undefined);
  };
}
