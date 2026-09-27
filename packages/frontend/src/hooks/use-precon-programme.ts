import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  preconApi,
  type CreateProgrammeTaskInput,
  type PreconProgramme,
  type UpdateProgrammeTaskInput,
} from "@/api/precon";
import { preconKeys } from "@/hooks/query-keys";

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
