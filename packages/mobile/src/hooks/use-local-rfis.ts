import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useMemo } from "react";
import type { UpsertRfiInput } from "@/api/rfis";
import type { Db } from "@/db/client";
import { flushOutbox } from "@/db/outbox";
import { useLocalDb } from "@/db/provider";
import { rfisRepository, toRfi } from "@/db/rfis-repository";
import { useFieldSession } from "@/lib/field-session";

/**
 * RFIs straight from SQLite.
 *
 * `useLiveQuery` re-runs on writes to the tables it touches, so a local create
 * appears without a refetch and without polling. It needs a real query on every
 * render, so callers mount this only once the database is open — scoped to one
 * project so an unrelated write doesn't re-render this list.
 */
export function useLocalRfis(db: Db, projectId: string) {
  const query = useMemo(() => rfisRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);
  const data = useMemo(() => (live.data ?? []).map(toRfi), [live.data]);
  return { data, isPending: live.data === undefined };
}

export function useCreateLocalRfi() {
  const { projectId } = useFieldSession();
  const { db } = useLocalDb();

  return async (input: UpsertRfiInput) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    const id = await rfisRepository.createLocal(db, projectId, input);
    // Fire-and-forget: the row is already durable, so a failed push leaves it
    // queued rather than failing the crew member's action.
    void flushOutbox(db).catch(() => undefined);
    return id;
  };
}

/**
 * Only subject, question and priority are editable: those are the fields the
 * outbox pushes on an RFI update, so exposing more would save locally and
 * never reach the server.
 */
export function useUpdateLocalRfi() {
  const { projectId } = useFieldSession();
  const { db } = useLocalDb();

  return async (
    rfiId: string,
    patch: Pick<UpsertRfiInput, "subject" | "question" | "questionHtml" | "priority">,
  ) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await rfisRepository.updateLocal(db, projectId, rfiId, patch);
    void flushOutbox(db).catch(() => undefined);
  };
}
