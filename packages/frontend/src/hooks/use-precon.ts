import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  preconApi,
  type CreateProgrammeTaskInput,
  type CreateMeasurementBody,
  preconApplyApi,
  type ApplyMode,
  type CreateRowInput,
  type LayerMap,
  type PreconGeometryKind,
  type PreconProgramme,
  type PreconSummarySettings,
  type TakeoffScope,
  type UpdateProgrammeTaskInput,
  type UpdateRowInput,
  type UpdateSheetInput,
  type UpdateStructureInput,
  type PreconSnapshot,
} from "@/api/precon";
import { preconKeys, proposalKeys } from "@/hooks/query-keys";
import { useRealtime } from "@/lib/realtime";

const RUNNING_STATUSES = new Set(["uploading", "generating"]);

export function usePreconSessions(proposalId?: string) {
  return useQuery({
    queryKey: [...preconKeys.sessions(), proposalId ?? "all"],
    queryFn: () => preconApi.listSessions(proposalId),
    // the list has no realtime channel of its own, so a running take-off is
    // polled until it settles; idle lists never poll
    refetchInterval: (query) =>
      query.state.data?.some((s) => RUNNING_STATUSES.has(s.status)) ? 4000 : false,
    refetchIntervalInBackground: true,
  });
}

export function useCreatePreconSessionFromPlan(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, scope }: { planId: string; scope: TakeoffScope }) =>
      preconApi.createSessionFromPlan(proposalId, planId, scope),
    onSuccess: () => qc.invalidateQueries({ queryKey: preconKeys.sessions() }),
  });
}

export function useRetryPreconSession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => preconApi.retrySession(sessionId),
    onSuccess: (session) => {
      qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), (prev) =>
        prev ? { ...prev, session, bills: [], rows: [], geometries: [] } : prev,
      );
      void qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
      void qc.invalidateQueries({ queryKey: preconKeys.sessions() });
    },
  });
}

export function useUpdatePreconSheet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sheetId, input }: { sheetId: string; input: UpdateSheetInput }) =>
      preconApi.updateSheet(sheetId, input),
    onSuccess: (sheet) => {
      qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), (prev) =>
        prev ? { ...prev, sheets: prev.sheets.map((s) => (s.id === sheet.id ? sheet : s)) } : prev,
      );
      void qc.invalidateQueries({ queryKey: preconKeys.snap(sheet.id) });
    },
  });
}

// Re-measure runs on the queue; the snapshot polls/streams the result in.
export function useRemeasurePreconSheet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sheetId: string) => preconApi.remeasureSheet(sheetId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) }),
  });
}

export function useUpdatePreconStructure(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStructureInput) => preconApi.updateStructure(sessionId, input),
    onSuccess: (session) => {
      qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), (prev) => (prev ? { ...prev, session } : prev));
    },
  });
}

// The corrected layer map re-runs the DWG measure on the queue; the session
// goes back to generating and the snapshot polls the new register in.
export function useUpdatePreconLayerMap(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (layerMap: LayerMap) => preconApi.updateLayerMap(sessionId, layerMap),
    onSuccess: (session) => {
      qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), (prev) => (prev ? { ...prev, session } : prev));
      void qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
    },
  });
}

export function useRedraftPreconBill(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => preconApi.redraftBill(sessionId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) }),
  });
}

// Batch verify: one request per row, sequential so version conflicts surface
// per row instead of a partial failure hiding inside Promise.all.
export function useVerifyPreconRows(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { rowId: string; version: number }[]) => {
      let done = 0;
      for (const row of rows) {
        await preconApi.verifyRow(row.rowId, row.version);
        done++;
      }
      return done;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) }),
  });
}

export function usePreconSnapshot(sessionId: string) {
  return useQuery({
    queryKey: preconKeys.snapshot(sessionId),
    queryFn: () => preconApi.snapshot(sessionId),
    enabled: Boolean(sessionId),
    // while the engine runs, poll as a fallback to the websocket feed; keep
    // polling when the tab is in the background so a run that finishes while
    // the user is elsewhere is already in review when they come back
    refetchInterval: (query) => (query.state.data?.session.status === "generating" ? 4000 : false),
    refetchIntervalInBackground: true,
  });
}

export function usePreconSnapIndex(sheetId: string | null) {
  return useQuery({
    queryKey: preconKeys.snap(sheetId ?? "none"),
    queryFn: () => preconApi.snapIndex(sheetId!),
    enabled: Boolean(sheetId),
    staleTime: Infinity,
  });
}

/** Subscribe to the session's realtime channel; events invalidate the snapshot. */
export function usePreconChannel(sessionId: string | null) {
  const { subscribe, unsubscribe } = useRealtime();
  useEffect(() => {
    if (!sessionId) return;
    const channel = `precon:${sessionId}`;
    subscribe(channel);
    return () => unsubscribe(channel);
  }, [sessionId, subscribe, unsubscribe]);
}

export function useCreatePreconSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ files, title }: { files: File[]; title?: string }) => preconApi.createSession(files, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: preconKeys.sessions() }),
  });
}

function useRowMutation<TVariables>(sessionId: string, mutationFn: (variables: TVariables) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) }),
  });
}

export function useUpdatePreconRow(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, input }: { rowId: string; input: UpdateRowInput }) =>
      preconApi.updateRow(rowId, input),
    onMutate: async ({ rowId, input }) => {
      await qc.cancelQueries({ queryKey: preconKeys.snapshot(sessionId) });
      const previous = qc.getQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId));
      if (previous) {
        qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), {
          ...previous,
          rows: previous.rows.map((r) =>
            r.id === rowId ? { ...r, ...input.changes } : r
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(preconKeys.snapshot(sessionId), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
    },
  });
}

export function useVerifyPreconRow(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, version }: { rowId: string; version: number }) =>
      preconApi.verifyRow(rowId, version),
    onMutate: async ({ rowId }) => {
      await qc.cancelQueries({ queryKey: preconKeys.snapshot(sessionId) });
      const previous = qc.getQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId));
      if (previous) {
        qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), {
          ...previous,
          rows: previous.rows.map((r) =>
            r.id === rowId ? { ...r, status: "verified" } : r
          ),
          progress: {
            ...previous.progress,
            verified: previous.progress.verified + (previous.rows.find(r => r.id === rowId)?.status !== "verified" ? 1 : 0)
          }
        });
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(preconKeys.snapshot(sessionId), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
    },
  });
}

export function useRejectPreconRow(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, version }: { rowId: string; version: number }) =>
      preconApi.rejectRow(rowId, version),
    onMutate: async ({ rowId }) => {
      await qc.cancelQueries({ queryKey: preconKeys.snapshot(sessionId) });
      const previous = qc.getQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId));
      if (previous) {
        qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), {
          ...previous,
          rows: previous.rows.map((r) =>
            r.id === rowId ? { ...r, status: "rejected" } : r
          ),
          progress: {
            ...previous.progress,
            verified: previous.progress.verified - (previous.rows.find(r => r.id === rowId)?.status === "verified" ? 1 : 0)
          }
        });
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(preconKeys.snapshot(sessionId), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
    },
  });
}

export function useUpdatePreconGeometry(sessionId: string) {
  return useRowMutation(
    sessionId,
    ({
      rowId,
      version,
      kind,
      vertices,
      sheetId,
    }: {
      rowId: string;
      version: number;
      kind: PreconGeometryKind;
      vertices: number[][];
      sheetId?: string;
    }) => preconApi.updateGeometry(rowId, { version, kind, vertices, sheetId }),
  );
}

export function useAddPreconDeduction(sessionId: string) {
  return useRowMutation(
    sessionId,
    ({
      rowId,
      version,
      label,
      vertices,
      sheetId,
    }: {
      rowId: string;
      version: number;
      label: string;
      vertices: number[][];
      sheetId?: string;
    }) => preconApi.addDeduction(rowId, { version, label, vertices, sheetId }),
  );
}

export function useCreateBlankPreconSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ title, proposalId }: { title: string; proposalId?: string }) =>
      preconApi.createBlankSession(title, proposalId),
    onSuccess: () => qc.invalidateQueries({ queryKey: preconKeys.sessions() }),
  });
}

export function useCreatePreconBill(sessionId: string) {
  return useRowMutation(sessionId, (title: string) => preconApi.createBill(sessionId, title));
}

export function useRenamePreconBill(sessionId: string) {
  return useRowMutation(sessionId, ({ billId, title }: { billId: string; title: string }) =>
    preconApi.renameBill(billId, title),
  );
}

export function useDeletePreconBill(sessionId: string) {
  return useRowMutation(sessionId, (billId: string) => preconApi.deleteBill(billId));
}

export function useCreatePreconRow(sessionId: string) {
  return useRowMutation(sessionId, ({ billId, input }: { billId: string; input: CreateRowInput }) =>
    preconApi.createRow(billId, input),
  );
}

export function useDeletePreconRow(sessionId: string) {
  return useRowMutation(sessionId, (rowId: string) => preconApi.deleteRow(rowId));
}

export function useUpdatePreconSettings(sessionId: string) {
  return useRowMutation(sessionId, (patch: Partial<PreconSummarySettings>) =>
    preconApi.updateSettings(sessionId, patch),
  );
}

export function useApplyPreconToProposal(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => preconApi.applyToProposal(sessionId),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: proposalKeys.boq(result.proposalId) });
      // applying can create + link a proposal, so the workspace header and
      // the take-off list both need a refresh
      void qc.invalidateQueries({ queryKey: proposalKeys.detail(result.proposalId) });
      void qc.invalidateQueries({ queryKey: preconKeys.sessions() });
    },
  });
}

export function usePreconProgramme(
  sessionId: string,
  { drafting }: { drafting?: (programme: PreconProgramme | undefined) => boolean } = {},
) {
  return useQuery({
    queryKey: preconKeys.programme(sessionId),
    queryFn: () => preconApi.programme(sessionId),
    enabled: Boolean(sessionId),
    // the draft is generated on a queue, so poll as a fallback to the websocket feed
    refetchInterval: (query) => (drafting?.(query.state.data) === true ? 4000 : false),
  });
}

export function useGeneratePreconProgramme(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => preconApi.generateProgramme(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: preconKeys.programme(sessionId) }),
  });
}

export function useSetPreconProgrammeStart(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (startDate: string) => preconApi.setProgrammeStart(sessionId, startDate),
    onSuccess: (programme) => qc.setQueryData(preconKeys.programme(sessionId), programme),
  });
}

export function useUpdatePreconProgrammeTask(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateProgrammeTaskInput }) =>
      preconApi.updateProgrammeTask(taskId, input),
    // every date downstream of an edited duration is re-planned server-side
    onSettled: () => qc.invalidateQueries({ queryKey: preconKeys.programme(sessionId) }),
  });
}

function useProgrammeStatusMutation(
  sessionId: string,
  status: "verified" | "rejected",
  mutationFn: (variables: { taskId: string; version: number }) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async ({ taskId }) => {
      await qc.cancelQueries({ queryKey: preconKeys.programme(sessionId) });
      const previous = qc.getQueryData<PreconProgramme>(preconKeys.programme(sessionId));
      if (previous) {
        const wasVerified = previous.tasks.find((t) => t.id === taskId)?.status === "verified";
        qc.setQueryData<PreconProgramme>(preconKeys.programme(sessionId), {
          ...previous,
          tasks: previous.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
          progress: {
            ...previous.progress,
            verified:
              previous.progress.verified +
              (status === "verified" ? (wasVerified ? 0 : 1) : wasVerified ? -1 : 0),
          },
        });
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) qc.setQueryData(preconKeys.programme(sessionId), context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: preconKeys.programme(sessionId) }),
  });
}

export function useCreatePreconProgrammeTask(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProgrammeTaskInput) => preconApi.createProgrammeTask(sessionId, input),
    onSettled: () => qc.invalidateQueries({ queryKey: preconKeys.programme(sessionId) }),
  });
}

export function useDeletePreconProgrammeTask(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => preconApi.deleteProgrammeTask(taskId),
    onSettled: () => qc.invalidateQueries({ queryKey: preconKeys.programme(sessionId) }),
  });
}

export function useVerifyPreconProgrammeTask(sessionId: string) {
  return useProgrammeStatusMutation(sessionId, "verified", ({ taskId, version }) =>
    preconApi.verifyProgrammeTask(taskId, version),
  );
}

export function useRejectPreconProgrammeTask(sessionId: string) {
  return useProgrammeStatusMutation(sessionId, "rejected", ({ taskId, version }) =>
    preconApi.rejectProgrammeTask(taskId, version),
  );
}

/** 409 = someone else edited the row; the snapshot refetch already picked up their version. */
export function isVersionConflict(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "response" in error && (error as { response?: { status?: number } }).response?.status === 409,
  );
}

/** Preview or apply a take-off's lines onto an estimate revision (WS-3). */
export function useApplyTakeoffToEstimate(sessionId: string, proposalId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, mode }: { estimateId: string; mode: ApplyMode }) =>
      preconApplyApi.applyToEstimate(sessionId, estimateId, mode),
    onSuccess: (_result, variables) => {
      if (variables.mode === "apply" && proposalId) {
        void qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
      }
    },
  });
}

// ---- manual measurements (WS-M1B) ----

/**
 * A hand-drawn line lands in the bill at once: the new row and its geometry are
 * written into the snapshot before the refetch so the viewer can select and
 * highlight it without a flash of "nothing measured".
 */
export function useCreateMeasurement(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMeasurementBody) => preconApi.createMeasurement(sessionId, body),
    onSuccess: ({ row, geometry }) => {
      qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), (prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.some((r) => r.id === row.id) ? prev.rows.map((r) => (r.id === row.id ? row : r)) : [...prev.rows, row],
              geometries: [...prev.geometries.filter((g) => g.id !== geometry.id), geometry],
            }
          : prev,
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) }),
  });
}
