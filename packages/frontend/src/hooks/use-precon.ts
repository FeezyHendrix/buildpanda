import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { preconApi, type PreconGeometryKind, type PreconSummarySettings, type UpdateRowInput } from "@/api/precon";
import { preconKeys } from "@/hooks/query-keys";
import { useRealtime } from "@/lib/realtime";

export function usePreconSessions(projectId: string) {
  return useQuery({
    queryKey: preconKeys.sessions(projectId),
    queryFn: () => preconApi.listSessions(projectId),
    enabled: Boolean(projectId),
  });
}

export function usePreconSnapshot(projectId: string, sessionId: string) {
  return useQuery({
    queryKey: preconKeys.snapshot(projectId, sessionId),
    queryFn: () => preconApi.snapshot(projectId, sessionId),
    enabled: Boolean(projectId && sessionId),
    // while the engine runs, poll as a fallback to the websocket feed
    refetchInterval: (query) => (query.state.data?.session.status === "generating" ? 4000 : false),
  });
}

export function usePreconSnapIndex(projectId: string, sheetId: string | null) {
  return useQuery({
    queryKey: preconKeys.snap(projectId, sheetId ?? "none"),
    queryFn: () => preconApi.snapIndex(projectId, sheetId!),
    enabled: Boolean(projectId && sheetId),
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

export function useCreatePreconSession(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ files, title }: { files: File[]; title?: string }) =>
      preconApi.createSession(projectId, files, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: preconKeys.sessions(projectId) }),
  });
}

function useRowMutation<TVariables>(
  projectId: string,
  sessionId: string,
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => qc.invalidateQueries({ queryKey: preconKeys.snapshot(projectId, sessionId) }),
  });
}

export function useUpdatePreconRow(projectId: string, sessionId: string) {
  return useRowMutation(projectId, sessionId, ({ rowId, input }: { rowId: string; input: UpdateRowInput }) =>
    preconApi.updateRow(projectId, rowId, input),
  );
}

export function useVerifyPreconRow(projectId: string, sessionId: string) {
  return useRowMutation(projectId, sessionId, ({ rowId, version }: { rowId: string; version: number }) =>
    preconApi.verifyRow(projectId, rowId, version),
  );
}

export function useRejectPreconRow(projectId: string, sessionId: string) {
  return useRowMutation(projectId, sessionId, ({ rowId, version }: { rowId: string; version: number }) =>
    preconApi.rejectRow(projectId, rowId, version),
  );
}

export function useUpdatePreconGeometry(projectId: string, sessionId: string) {
  return useRowMutation(
    projectId,
    sessionId,
    ({ rowId, version, kind, vertices }: { rowId: string; version: number; kind: PreconGeometryKind; vertices: number[][] }) =>
      preconApi.updateGeometry(projectId, rowId, { version, kind, vertices }),
  );
}

export function useAddPreconDeduction(projectId: string, sessionId: string) {
  return useRowMutation(
    projectId,
    sessionId,
    ({ rowId, version, label, vertices }: { rowId: string; version: number; label: string; vertices: number[][] }) =>
      preconApi.addDeduction(projectId, rowId, { version, label, vertices }),
  );
}

export function useUpdatePreconSettings(projectId: string, sessionId: string) {
  return useRowMutation(projectId, sessionId, (patch: Partial<PreconSummarySettings>) =>
    preconApi.updateSettings(projectId, sessionId, patch),
  );
}

export function useSendPreconToProposals(projectId: string, sessionId: string) {
  return useMutation({
    mutationFn: () => preconApi.sendToProposals(projectId, sessionId),
  });
}

/** 409 = someone else edited the row; the snapshot refetch already picked up their version. */
export function isVersionConflict(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "response" in error && (error as { response?: { status?: number } }).response?.status === 409,
  );
}
