import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useMemo } from "react";
import type { Db } from "@/db/client";
import { outboxContextQuery } from "@/db/outbox-context";

/**
 * Every queued write on this device, newest first. Live: a row appears the
 * moment a screen queues it and leaves when the dispatcher clears it.
 */
export function useOutboxRows(db: Db) {
  const query = useMemo(() => outboxContextQuery(db), [db]);
  const live = useLiveQuery(query, [query]);
  const data = useMemo(
    () => [...(live.data ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [live.data],
  );
  return { data, isPending: live.updatedAt === undefined && !live.error, error: live.error };
}
