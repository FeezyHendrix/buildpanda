import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useMemo } from "react";
import type { RfiStatusTransition, UpsertRfiInput } from "@/api/rfis";
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

/** One RFI from SQLite; `null` once the query has run and found nothing. */
export function useLocalRfi(db: Db, id: string) {
  const query = useMemo(() => rfisRepository.byIdQuery(db, id), [db, id]);
  const live = useLiveQuery(query);
  const row = live.data?.[0];
  const data = useMemo(() => (row ? toRfi(row) : null), [row]);
  return { data, isPending: live.data === undefined };
}

/**
 * The RFI raised from one plan pin, if this device raised it. The link is
 * read from the local row's `sourceMarkupId`, not the server's `linkedRfiId`,
 * so it shows in a basement and while the pin's own create is still queued.
 */
export function useLocalRfiForMarkup(db: Db, markupId: string) {
  const query = useMemo(() => rfisRepository.bySourceMarkupQuery(db, markupId), [db, markupId]);
  const live = useLiveQuery(query);
  const row = live.data?.[0];
  return useMemo(() => (row ? toRfi(row) : null), [row]);
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

/** Every field the update endpoint accepts; the source-sheet fields are create-only. */
export type EditableRfiPatch = Partial<
  Pick<
    UpsertRfiInput,
    | "subject"
    | "question"
    | "questionHtml"
    | "priority"
    | "ballInCourtId"
    | "ballInCourtName"
    | "dueDate"
    | "costImpact"
    | "scheduleImpact"
  >
>;

export function useUpdateLocalRfi() {
  const { projectId } = useFieldSession();
  const { db } = useLocalDb();

  return async (rfiId: string, patch: EditableRfiPatch) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await rfisRepository.updateLocal(db, projectId, rfiId, patch);
    void flushOutbox(db).catch(() => undefined);
  };
}

/**
 * Close, void or reopen. Applied locally and queued; the server enforces who
 * may do it and which statuses can be reopened, so a refused push surfaces
 * on the sync screen rather than silently reverting here.
 */
export function useTransitionLocalRfi() {
  const { projectId } = useFieldSession();
  const { db } = useLocalDb();

  return async (rfiId: string, status: RfiStatusTransition) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await rfisRepository.transitionLocal(db, projectId, rfiId, status);
    void flushOutbox(db).catch(() => undefined);
  };
}
