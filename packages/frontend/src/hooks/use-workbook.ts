import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workbookApi, classifyWorkbookFailure } from "@/api/workbook";
import type {
  WorkbookDocument,
  WorkbookHistory,
  WorkbookSaveRequest,
  WorkbookSaveResult,
  WorkbookReverseResult,
} from "@/api/workbook-types";
import {
  candidateFingerprint,
  mintOperationId,
  planSave,
  type PendingSave,
} from "@/components/molecules/precon-workbook/save-plan";
import { preconKeys, workbookKeys } from "@/hooks/query-keys";

/**
 * The stored workbook.
 *
 * `staleTime: Infinity` and no polling on purpose. Refetching under an editor
 * is how a draft dies, so this cache only moves when something says it moved:
 * a realtime frame, a save's own answer, or an explicit reload from the
 * conflict panel. The editor keeps its own copy of what the user is typing and
 * decides when to adopt a newer document.
 */
export function useWorkbook(sessionId: string, enabled: boolean) {
  return useQuery<WorkbookDocument>({
    queryKey: workbookKeys.document(sessionId),
    queryFn: () => workbookApi.get(sessionId),
    enabled: enabled && Boolean(sessionId),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useWorkbookHistory(sessionId: string, enabled: boolean) {
  return useQuery<WorkbookHistory>({
    queryKey: workbookKeys.history(sessionId),
    queryFn: () => workbookApi.history(sessionId, 20),
    enabled: enabled && Boolean(sessionId),
    staleTime: 30 * 1000,
  });
}

export interface SaveWorkbookInput {
  readonly expectedVersion: number;
  readonly expectedSourceFingerprint: string;
  readonly snapshot: WorkbookSaveRequest["snapshot"];
  readonly rowPatches?: WorkbookSaveRequest["rowPatches"];
}

/**
 * Saving, with the retry rule the server's exactly-once index needs.
 *
 * The operation id is held in a ref keyed by the CONTENT of the attempt, so a
 * retry after a timeout reuses it — and is answered with the original receipt
 * if the first attempt actually landed — while a retry after the user typed
 * something else gets a fresh one. Keeping this here rather than in the
 * component means a remount cannot quietly mint a second id for work that is
 * already in flight.
 */
export function useSaveWorkbook(sessionId: string) {
  const queryClient = useQueryClient();
  const pending = useRef<PendingSave | null>(null);

  const mutation = useMutation<WorkbookSaveResult, unknown, SaveWorkbookInput>({
    mutationFn: (input) => {
      const fingerprint = candidateFingerprint(input);
      const plan = planSave(pending.current, fingerprint, mintOperationId);
      pending.current = plan;
      return workbookApi.save(sessionId, { operationId: plan.operationId, ...input });
    },
    onSuccess: (result) => {
      pending.current = null;
      queryClient.setQueryData(workbookKeys.document(sessionId), result.document);
      void queryClient.invalidateQueries({ queryKey: workbookKeys.history(sessionId) });
      if (result.receipt.rows.length > 0) {
        void queryClient.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
      }
    },
  });

  return {
    ...mutation,
    failure: mutation.error === null ? null : classifyWorkbookFailure(mutation.error),
    attempts: pending.current?.attempts ?? 0,
    /** Drops the held id, so the next save is a new operation rather than a retry. */
    abandonRetry: useCallback(() => {
      pending.current = null;
      mutation.reset();
    }, [mutation]),
  };
}

/**
 * Saved undo. Distinct from the grid's own undo, which only reaches unsaved
 * local work: a committed edit is reversed by the server as a compensating
 * save, so it survives a reload and stays in the audit trail.
 */
export function useReverseWorkbook(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    WorkbookReverseResult,
    unknown,
    { eventId: string; expectedVersion: number; expectedSourceFingerprint: string }
  >({
    mutationFn: ({ eventId, expectedVersion, expectedSourceFingerprint }) =>
      workbookApi.reverse(sessionId, eventId, {
        operationId: mintOperationId(),
        expectedVersion,
        expectedSourceFingerprint,
      }),
    onSuccess: (result) => {
      if (!result.reversed) return;
      queryClient.setQueryData(workbookKeys.document(sessionId), result.document);
      void queryClient.invalidateQueries({ queryKey: workbookKeys.history(sessionId) });
      if (result.receipt.rows.length > 0) {
        void queryClient.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
      }
    },
  });
}
