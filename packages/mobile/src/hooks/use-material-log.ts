import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { materialsLedgerApi } from "@/api/materials-ledger";
import type { Db } from "@/db/client";
import { materialLogRepository, type MaterialLogEntryInput } from "@/db/material-log-repository";
import { flushOutbox } from "@/db/outbox";
import { useSyncState } from "@/lib/sync-provider";

/** The ledger and stock from SQLite, refreshed in the background with signal. */
export function useMaterialLog(db: Db, projectId: string) {
  const { isOnline } = useSyncState();
  const entriesQuery = useMemo(() => materialLogRepository.entriesQuery(db, projectId), [db, projectId]);
  const stockQuery = useMemo(() => materialLogRepository.stockQuery(db, projectId), [db, projectId]);
  const entries = useLiveQuery(entriesQuery, [entriesQuery]);
  const stock = useLiveQuery(stockQuery, [stockQuery]);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    Promise.all([materialsLedgerApi.list(projectId), materialsLedgerApi.stock(projectId)])
      .then(([rows, levels]) => {
        if (cancelled) return;
        return Promise.all([
          materialLogRepository.replaceEntries(db, projectId, rows),
          materialLogRepository.replaceStock(db, projectId, levels),
        ]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, projectId, isOnline]);

  return {
    entries: entries.data ?? [],
    stock: stock.data ?? [],
    isPending: entries.updatedAt === undefined && !entries.error,
  };
}

/** Materials the crew has seen on this project, for one-tap picking. */
export function useKnownMaterials(db: Db, projectId: string) {
  const { entries, stock } = useMaterialLog(db, projectId);
  return useMemo(() => {
    const byName = new Map<string, { name: string; unit: string }>();
    for (const row of [...stock, ...entries]) {
      const key = row.materialName.trim().toLowerCase();
      if (key && !byName.has(key)) byName.set(key, { name: row.materialName, unit: row.unit });
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, stock]);
}

export function useLogMaterial(db: Db | null, projectId: string | undefined) {
  return async (input: MaterialLogEntryInput) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await materialLogRepository.createLocal(db, projectId, input);
    void flushOutbox(db).catch(() => undefined);
  };
}
