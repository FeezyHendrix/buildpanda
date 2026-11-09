import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import { materialsApi, type BoqMaterialOption } from "@/api/materials";
import { materialsLedgerApi } from "@/api/materials-ledger";
import type { Db } from "@/db/client";
import { materialLogRepository, type MaterialLogEntryInput } from "@/db/material-log-repository";
import { flushOutbox } from "@/db/outbox";
import { projectAccess } from "@/lib/project-access-store";
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

/**
 * The project's BoQ lines, the same list the desktop order dialog offers.
 * shortcut: fetched when online and kept in memory only, so out of signal the
 * pickers fall back to materials already in stock or the ledger; move it to
 * SQLite if crews ask for BoQ names offline.
 */
export function useBoqMaterials(projectId: string | undefined) {
  const { isOnline } = useSyncState();
  const [rows, setRows] = useState<BoqMaterialOption[]>([]);
  useEffect(() => {
    if (!projectId || !isOnline || !projectAccess.can(projectId, "materials", "view")) return;
    let cancelled = false;
    materialsApi.boqMaterials(projectId).then((list) => { if (!cancelled) setRows(list); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectId, isOnline]);
  return rows;
}

/** Materials the crew can pick with one tap: the BoQ first, then what is already in stock or the ledger. */
export function useKnownMaterials(db: Db, projectId: string) {
  const { entries, stock } = useMaterialLog(db, projectId);
  const boq = useBoqMaterials(projectId);
  return useMemo(() => {
    const byName = new Map<string, { name: string; unit: string }>();
    for (const row of [...boq, ...stock, ...entries]) {
      const key = row.materialName.trim().toLowerCase();
      if (key && !byName.has(key)) byName.set(key, { name: row.materialName.trim(), unit: row.unit });
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [boq, entries, stock]);
}

export function useLogMaterial(db: Db | null, projectId: string | undefined) {
  return async (input: MaterialLogEntryInput) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await materialLogRepository.createLocal(db, projectId, input);
    void flushOutbox(db).catch(() => undefined);
  };
}
