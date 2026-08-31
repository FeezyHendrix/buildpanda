import { useCallback } from "react";
import type { ProposedAction } from "@/api/voice-report";
import { useLocalDb } from "@/db/provider";
import { useFieldSession } from "@/lib/field-session";
import { useAuthGate } from "@/lib/use-auth-gate";
import { useAddDailyLogEntry } from "./use-daily-logs";
import { useCreateChangeRequest } from "./use-local-change-requests";
import { useCreateLookAhead } from "./use-local-look-aheads";
import { useCreateMaterialOrder } from "./use-local-materials";
import { useCreateLocalRfi } from "./use-local-rfis";

/** Local calendar date (YYYY-MM-DD) — the daily log is keyed by the crew's day, not UTC. */
function localDateIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Turns a reviewed voice action into a real local record. Each branch calls the
 * same offline create hook the hand-typed forms use, so a voice-created RFI is
 * written to SQLite and queued to the outbox identically — it just skipped the
 * form.
 */
export function useApplyProposedAction() {
  const { db } = useLocalDb();
  const { projectId } = useFieldSession();
  const { user } = useAuthGate();

  const createRfi = useCreateLocalRfi();
  const addDailyEntry = useAddDailyLogEntry(db, projectId);
  const createChangeRequest = useCreateChangeRequest(db, projectId);
  const createMaterialOrder = useCreateMaterialOrder(db, projectId);
  const createLookAhead = useCreateLookAhead(db, projectId);

  return useCallback(
    async (action: ProposedAction): Promise<void> => {
      switch (action.kind) {
        case "rfi":
          await createRfi(action.payload);
          return;
        case "daily_log":
          await addDailyEntry(localDateIso(), action.payload.bodyText, user?.name ?? "Field team");
          return;
        case "change_request":
          await createChangeRequest(action.payload);
          return;
        case "material_order":
          await createMaterialOrder(action.payload);
          return;
        case "look_ahead":
          await createLookAhead(action.payload);
          return;
        default: {
          const unhandled: never = action;
          throw new Error(`Unsupported voice action: ${JSON.stringify(unhandled)}`);
        }
      }
    },
    [createRfi, addDailyEntry, createChangeRequest, createMaterialOrder, createLookAhead, user],
  );
}
