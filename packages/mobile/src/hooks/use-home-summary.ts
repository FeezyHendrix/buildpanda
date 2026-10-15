import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useMemo } from "react";
import type { Db } from "@/db/client";
import { dailyLogsRepository, todayIso } from "@/db/daily-logs-repository";
import { materialLogRepository } from "@/db/material-log-repository";
import { outboxQuery } from "@/db/outbox";
import { tasksRepository } from "@/db/tasks-repository";
import { isMyTask } from "@/db/record-visibility";
import { useProjectAccess } from "./use-project-access";

/**
 * The numbers at the top of Home, read straight from SQLite so they show with
 * no signal. Each tool's own screen refreshes its data; Home only counts.
 */
export function useHomeSummary(db: Db, projectId: string, buildingId: string) {
  const today = todayIso();
  const { userId, generation } = useProjectAccess();
  const tasksQuery = useMemo(() => tasksRepository.tasksQuery(db, projectId, buildingId), [db, projectId, buildingId, generation]);
  const columnsQuery = useMemo(() => tasksRepository.columnsQuery(db, projectId, buildingId), [db, projectId, buildingId]);
  const ledgerQuery = useMemo(() => materialLogRepository.entriesQuery(db, projectId), [db, projectId]);
  const entriesQuery = useMemo(() => dailyLogsRepository.entriesQuery(db, projectId, today, buildingId), [db, projectId, today, buildingId]);
  const queueQuery = useMemo(() => outboxQuery(db), [db]);

  const tasks = useLiveQuery(tasksQuery, [tasksQuery]);
  const columns = useLiveQuery(columnsQuery, [columnsQuery]);
  const ledger = useLiveQuery(ledgerQuery, [ledgerQuery]);
  const entries = useLiveQuery(entriesQuery, [entriesQuery]);
  const queue = useLiveQuery(queueQuery, [queueQuery]);

  return useMemo(() => {
    const done = new Set((columns.data ?? []).filter((c) => c.status === "Done").map((c) => c.id));
    const myOpen = (tasks.data ?? []).filter((t) => isMyTask(t, userId) && !done.has(t.columnId));
    const overdue = myOpen.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today).length;
    const awaiting = (ledger.data ?? []).filter((e) => e.entryType === "IN" && e.status !== "Voided" && e.approvalStatus === "Pending").length;
    const todaysEntries = (entries.data ?? []).filter((e) => e.logDate === today && e.buildingId === buildingId && e.projectId === projectId).length;
    const toSync = (queue.data ?? []).filter((row) => row.status === "pending").length;
    const failed = (queue.data ?? []).filter((row) => row.status === "failed").length;
    return {
      myOpen: myOpen.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
      overdue,
      awaiting,
      todaysEntries,
      toSync,
      failed,
    };
  }, [tasks.data, columns.data, ledger.data, entries.data, queue.data, today, buildingId, projectId, userId]);
}
