// Facade for the take-off hooks. The bill-line, geometry and programme
// mutations live in domain-scoped siblings and are re-exported here, so every
// existing `from "@/hooks/use-precon"` import keeps resolving.
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  preconApi,
  preconApplyApi,
  preconAssembliesApi,
  preconManualApi,
  preconPresenceApi,
  type ApplyConflictDetails,
  type ApplyPins,
  type CreateAssemblyMeasurementBody,
  type LayerMap,
  type PreconSnapshot,
  type PreconSummarySettings,
  type PresenceUser,
  type TakeoffMode,
  type TakeoffScope,
  type UpdateSheetInput,
  type UpdateStructureInput,
  type UpsertAssemblyInput,
} from "@/api/precon";
import { preconAssemblyKeys, preconKeys, preconPresenceKeys, proposalKeys } from "@/hooks/query-keys";
import { useRowMutation } from "@/hooks/use-precon-rows";
import { useRealtime } from "@/lib/realtime";

export * from "./use-precon-rows";
export * from "./use-precon-geometry";
export * from "./use-precon-programme";

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

export function useCreateBlankPreconSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ title, proposalId }: { title: string; proposalId?: string }) =>
      preconApi.createBlankSession(title, proposalId),
    onSuccess: () => qc.invalidateQueries({ queryKey: preconKeys.sessions() }),
  });
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

/** 409 = someone else edited the row; the snapshot refetch already picked up their version. */
export function isVersionConflict(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "response" in error && (error as { response?: { status?: number } }).response?.status === 409,
  );
}

/**
 * The refreshed state a refused apply carries (409 `details`): reasons plus the
 * re-read source/target/review, so the dialog demands a DELIBERATE re-preview
 * and re-acknowledgement instead of silently resubmitting.
 */
export function getApplyConflictDetails(error: unknown): ApplyConflictDetails | null {
  const details =
    error && typeof error === "object" && "response" in error
      ? ((error as { response?: { status?: number; data?: { details?: ApplyConflictDetails } } }).response?.status === 409
          ? (error as { response?: { data?: { details?: ApplyConflictDetails } } }).response?.data?.details
          : undefined)
      : undefined;
  return details && Array.isArray(details.reasons) ? details : null;
}

/** Preview or PINNED apply of a take-off's lines onto an estimate revision (contract 23). */
export function useApplyTakeoffToEstimate(sessionId: string, proposalId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variables: { estimateId: string; mode: "preview" } | { estimateId: string; mode: "apply"; pins: ApplyPins }) =>
      variables.mode === "preview"
        ? preconApplyApi.previewApply(sessionId, variables.estimateId)
        : preconApplyApi.applyPinned(sessionId, variables.estimateId, variables.pins),
    onSuccess: (_result, variables) => {
      if (variables.mode === "apply" && proposalId) {
        void qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
      }
    },
  });
}

// ---- WS-M1C · from-plan with a mode ----
/** Start a take-off on a drawing, by Panda AI or by hand; both land on the sessions list. */
export function useCreatePreconSessionFromPlanWithMode(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, scope, mode }: { planId: string; scope: TakeoffScope; mode: TakeoffMode }) =>
      preconManualApi.createSessionFromPlan(proposalId, planId, scope, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: preconKeys.sessions() }),
  });
}

/** The proposal's take-offs, fetched only when a proposal is named (the overlay resolves the previous revision through it). */
export function usePreconSessionsFor(proposalId: string | null) {
  return useQuery({
    queryKey: [...preconKeys.sessions(), proposalId ?? "all"],
    queryFn: () => preconApi.listSessions(proposalId ?? undefined),
    enabled: Boolean(proposalId),
  });
}

// ---- WS-M3B · assemblies, presence and focus ----

export function useAssemblies() {
  return useQuery({ queryKey: preconAssemblyKeys.list(), queryFn: () => preconAssembliesApi.list() });
}

function useInvalidateAssemblies() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: preconAssemblyKeys.all });
}

export function useCreateAssembly() {
  const invalidate = useInvalidateAssemblies();
  return useMutation({ mutationFn: (body: UpsertAssemblyInput) => preconAssembliesApi.create(body), onSuccess: invalidate });
}

export function useUpdateAssembly() {
  const invalidate = useInvalidateAssemblies();
  return useMutation({
    mutationFn: ({ assemblyId, body }: { assemblyId: string; body: Partial<UpsertAssemblyInput> }) =>
      preconAssembliesApi.update(assemblyId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteAssembly() {
  const invalidate = useInvalidateAssemblies();
  return useMutation({ mutationFn: (assemblyId: string) => preconAssembliesApi.remove(assemblyId), onSuccess: invalidate });
}

/**
 * One drawn shape, several bill lines. Like `useCreateMeasurement`, the rows
 * and geometry land in the snapshot before the refetch so the viewer can
 * select the first of them without a flash.
 */
export function useCreateAssemblyMeasurement(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAssemblyMeasurementBody) => preconAssembliesApi.createMeasurement(sessionId, body),
    onSuccess: ({ rows, geometry }) => {
      qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), (prev) => {
        if (!prev) return prev;
        const incoming = new Set(rows.map((r) => r.id));
        return {
          ...prev,
          rows: [...prev.rows.filter((r) => !incoming.has(r.id)), ...rows],
          geometries: [...prev.geometries.filter((g) => g.id !== geometry.id), geometry],
        };
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) }),
  });
}

/**
 * Everyone on the session right now. The list is written by the realtime
 * handler on `precon.presence`; nothing is fetched, so an unsubscribed tab
 * simply sees nobody.
 */
export function usePreconPresence(sessionId: string): PresenceUser[] {
  const { data = [] } = useQuery<PresenceUser[]>({
    queryKey: preconPresenceKeys.session(sessionId),
    queryFn: () => [],
    enabled: false,
    staleTime: Infinity,
    gcTime: 0,
  });
  return data;
}

/**
 * Tell the others which row this user is on. Posts on every change and clears
 * on unmount; a failed post is not worth a toast — presence is a courtesy.
 */
export function usePreconFocus(sessionId: string | null, rowId: string | null): void {
  useEffect(() => {
    if (!sessionId) return;
    void preconPresenceApi.focus(sessionId, rowId).catch(() => undefined);
  }, [sessionId, rowId]);
  useEffect(() => {
    if (!sessionId) return;
    return () => {
      void preconPresenceApi.focus(sessionId, null).catch(() => undefined);
    };
  }, [sessionId]);
}
