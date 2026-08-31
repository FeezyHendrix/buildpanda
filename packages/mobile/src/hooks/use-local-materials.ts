import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { materialsApi, type CreateMaterialOrderInput } from "@/api/materials";
import type { Db } from "@/db/client";
import { flushOutbox } from "@/db/outbox";
import { materialsRepository, toMaterialOrder } from "@/db/materials-repository";

/** SQLite first, background refresh — opens with no signal. */
export function useLocalMaterialOrders(db: Db, projectId: string) {
  const query = useMemo(() => materialsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);

  useEffect(() => {
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
  }, [db, projectId]);

  const data = useMemo(() => (live.data ?? []).map(toMaterialOrder), [live.data]);
  return { data, isPending: live.data === undefined };
}

export function useCreateMaterialOrder(db: Db | null, projectId: string | undefined) {
  return async (input: CreateMaterialOrderInput) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await materialsRepository.createLocal(db, projectId, input);
    void flushOutbox(db).catch(() => undefined);
  };
}
