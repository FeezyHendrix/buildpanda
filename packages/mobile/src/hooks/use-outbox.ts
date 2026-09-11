import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useMemo } from "react";
import type { Db } from "@/db/client";
import { outboxQuery } from "@/db/outbox";
import type { OutboxRow } from "@/db/schema";

/**
 * Every queued write on this device, newest first. Live: a row appears the
 * moment a screen queues it and leaves when the dispatcher clears it.
 */
export function useOutboxRows(db: Db) {
  const query = useMemo(() => outboxQuery(db), [db]);
  const live = useLiveQuery(query);
  const data = useMemo<OutboxRow[]>(
    () => [...(live.data ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [live.data],
  );
  return { data, isPending: live.data === undefined };
}
