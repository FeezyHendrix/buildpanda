import { useCallback } from "react";
import { changeRequestsApi } from "@/api/change-requests";
import { dailyLogsApi } from "@/api/daily-logs";
import { lookAheadsApi } from "@/api/look-aheads";
import { materialsApi } from "@/api/materials";
import { materialsLedgerApi } from "@/api/materials-ledger";
import { rfisApi } from "@/api/rfis";
import { stagesApi } from "@/api/stages";
import type { ProposedAction } from "@/api/voice-report-types";
import { changeRequestsRepository } from "@/db/change-requests-repository";
import { dailyLogsRepository } from "@/db/daily-logs-repository";
import { lookAheadsRepository } from "@/db/look-aheads-repository";
import { materialsRepository } from "@/db/materials-repository";
import { rfisRepository } from "@/db/rfis-repository";
import { flushOutbox } from "@/db/outbox";
import { useLocalDb } from "@/db/provider";
import { useFieldSession } from "@/lib/field-session";
import { useAuthGate } from "@/lib/use-auth-gate";
import { useAddDailyLogEntry, useSaveDailyLog } from "./use-daily-logs";
import { useCreateChangeRequest } from "./use-local-change-requests";
import { useCreateLookAhead } from "./use-local-look-aheads";
import { useCreateMaterialOrder } from "./use-local-materials";
import { useCreateLocalRfi } from "./use-local-rfis";
import { useAddRfiComment } from "./use-rfi-comments";

/** Local calendar date (YYYY-MM-DD) — the daily log is keyed by the crew's day, not UTC. */
function localDateIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Turns a reviewed voice action into a real change. Creates go through the same
 * offline repositories the hand-typed forms use; updates and deletes call the
 * server directly — the voice flow is online anyway (transcription), and the
 * target id came from the server snapshot, so the record exists there.
 */
export function useApplyProposedAction() {
  const { db } = useLocalDb();
  const { projectId } = useFieldSession();
  const { user } = useAuthGate();

  const createRfi = useCreateLocalRfi();
  const addDailyEntry = useAddDailyLogEntry(db, projectId);
  const saveDailyLog = useSaveDailyLog(db, projectId);
  const createChangeRequest = useCreateChangeRequest(db, projectId);
  const createMaterialOrder = useCreateMaterialOrder(db, projectId);
  const createLookAhead = useCreateLookAhead(db, projectId);
  const addRfiComment = useAddRfiComment(db, projectId);

  return useCallback(
    async (action: ProposedAction): Promise<void> => {
      const requireProject = (): string => {
        if (!projectId) throw new Error("Project is not ready yet.");
        return projectId;
      };

      // Edits go to the local row and the outbox, never straight to the API:
      // a crew member reviewing a note out of signal must not lose them.
      const queueEdit = async (run: (database: NonNullable<typeof db>) => Promise<void>) => {
        if (!db) throw new Error("Local database is not ready yet.");
        await run(db);
        void flushOutbox(db).catch(() => undefined);
      };

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
        case "material_log":
          await materialsLedgerApi.logEntry(requireProject(), action.payload);
          return;
        case "material_order":
          await createMaterialOrder(action.payload);
          return;
        case "look_ahead":
          await createLookAhead(action.payload);
          return;
        case "update_rfi":
          await queueEdit((database) =>
            rfisRepository.updateLocal(database, requireProject(), action.payload.rfiId, action.payload.patch),
          );
          return;
        case "transition_rfi":
          await rfisApi.transition(requireProject(), action.payload.rfiId, action.payload.status);
          return;
        case "update_change_request":
          await queueEdit((database) =>
            changeRequestsRepository.updateLocal(
              database,
              requireProject(),
              action.payload.changeRequestId,
              action.payload.patch,
            ),
          );
          return;
        case "delete_change_request":
          await changeRequestsApi.remove(requireProject(), action.payload.changeRequestId);
          return;
        case "update_material_order":
          await queueEdit((database) =>
            materialsRepository.updateLocal(database, requireProject(), action.payload.orderId, action.payload.patch),
          );
          return;
        case "delete_material_order":
          await materialsApi.remove(requireProject(), action.payload.orderId);
          return;
        case "update_look_ahead":
          await queueEdit((database) =>
            lookAheadsRepository.updateLocal(
              database,
              requireProject(),
              action.payload.lookAheadId,
              action.payload.patch,
            ),
          );
          return;
        case "delete_look_ahead":
          await lookAheadsApi.remove(requireProject(), action.payload.lookAheadId);
          return;
        case "update_daily_log":
          await saveDailyLog(localDateIso(), { totalHours: action.payload.totalHours });
          return;
        case "log_activity": {
          if (!db) throw new Error("Local database is not ready yet.");
          await dailyLogsRepository.logActivityLocal(db, requireProject(), localDateIso(), {
            activityId: action.payload.activityId,
            activityName: action.payload.activityName,
            hoursLogged: action.payload.hoursLogged,
            delayReasonCode: action.payload.delayReasonCode ?? null,
            delayNote: action.payload.delayNote ?? null,
          });
          void flushOutbox(db).catch(() => undefined);
          return;
        }
        case "comment_rfi":
          await addRfiComment(action.payload.rfiId, action.payload.body, user?.name ?? "Field team");
          return;
        case "transition_stage": {
          if (!action.payload.stageId || !action.payload.status) {
            throw new Error("Pick a stage and a status before applying this.");
          }
          await stagesApi.update(requireProject(), action.payload.stageId, {
            status: action.payload.status,
            ...(action.payload.buildingId ? { buildingId: action.payload.buildingId } : {}),
          });
          return;
        }
        case "comment_change_request":
          await changeRequestsApi.addComment(requireProject(), action.payload.changeRequestId, action.payload.body);
          return;
        case "void_ledger_entry":
          await materialsLedgerApi.voidEntry(requireProject(), action.payload.entryId, action.payload.reason);
          return;
        case "void_daily_log_entry":
          await dailyLogsApi.voidEntry(
            requireProject(),
            action.payload.logDate,
            action.payload.entryId,
            action.payload.reason,
          );
          return;
        default: {
          const unhandled: never = action;
          throw new Error(`Unsupported voice action: ${JSON.stringify(unhandled)}`);
        }
      }
    },
    [
      createRfi,
      addDailyEntry,
      saveDailyLog,
      createChangeRequest,
      createMaterialOrder,
      createLookAhead,
      addRfiComment,
      db,
      projectId,
      user,
    ],
  );
}
