import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { preconApi, type PreconGeometryKind, type PreconSummarySettings, type UpdateRowInput } from "@/api/precon";
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
  return useRowMutation(sessionId, ({ rowId, input }: { rowId: string; input: UpdateRowInput }) =>
    preconApi.updateRow(rowId, input),
  );
}

export function useVerifyPreconRow(sessionId: string) {
  return useRowMutation(sessionId, ({ rowId, version }: { rowId: string; version: number }) =>
    preconApi.verifyRow(rowId, version),
  );
}

export function useRejectPreconRow(sessionId: string) {
  return useRowMutation(sessionId, ({ rowId, version }: { rowId: string; version: number }) =>
    preconApi.rejectRow(rowId, version),
  );
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

/** 409 = someone else edited the row; the snapshot refetch already picked up their version. */
export function isVersionConflict(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "response" in error && (error as { response?: { status?: number } }).response?.status === 409,
  );
}
