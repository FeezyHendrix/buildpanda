import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  preconApi,
  type PreconGeometryKind,
  type PreconProgramme,
  type PreconSummarySettings,
  type UpdateProgrammeTaskInput,
  type UpdateRowInput,
  type PreconSnapshot,
} from "@/api/precon";
import { preconKeys, proposalKeys } from "@/hooks/query-keys";
import { useRealtime } from "@/lib/realtime";

export function usePreconSessions(proposalId?: string) {
  return useQuery({
    queryKey: [...preconKeys.sessions(), proposalId ?? "all"],
    queryFn: () => preconApi.listSessions(proposalId),
  });
}

export function useCreatePreconSessionFromPlan(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => preconApi.createSessionFromPlan(proposalId, planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: preconKeys.sessions() }),
  });
}

export function usePreconSnapshot(sessionId: string) {
  return useQuery({
    queryKey: preconKeys.snapshot(sessionId),
    queryFn: () => preconApi.snapshot(sessionId),
    enabled: Boolean(sessionId),
    // while the engine runs, poll as a fallback to the websocket feed
    refetchInterval: (query) => (query.state.data?.session.status === "generating" ? 4000 : false),
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
    ({ rowId, version, kind, vertices }: { rowId: string; version: number; kind: PreconGeometryKind; vertices: number[][] }) =>
      preconApi.updateGeometry(rowId, { version, kind, vertices }),
  );
}

export function useAddPreconDeduction(sessionId: string) {
  return useRowMutation(
    sessionId,
    ({ rowId, version, label, vertices }: { rowId: string; version: number; label: string; vertices: number[][] }) =>
      preconApi.addDeduction(rowId, { version, label, vertices }),
  );
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
    onSuccess: (result) => qc.invalidateQueries({ queryKey: proposalKeys.boq(result.proposalId) }),
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
