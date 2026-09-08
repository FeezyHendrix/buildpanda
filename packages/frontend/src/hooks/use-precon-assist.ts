import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { preconAssistApi, type AssistRequest } from "@/api/precon-assist";
import { preconAssistKeys, preconKeys } from "@/hooks/query-keys";

export function useChangeSets(sessionId: string) {
  return useQuery({
    queryKey: preconAssistKeys.forSession(sessionId),
    queryFn: () => preconAssistApi.listForSession(sessionId),
    enabled: Boolean(sessionId),
  });
}

export function useProposeChangeSet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AssistRequest) => preconAssistApi.propose(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: preconAssistKeys.forSession(sessionId) }),
  });
}

// Applying or undoing edits the same rows the buttons edit, so the snapshot
// and programme queries refresh exactly as they would after a manual edit.
function useChangeSetAction(sessionId: string, action: (changeSetId: string) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changeSetId: string) => action(changeSetId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
      void qc.invalidateQueries({ queryKey: preconKeys.programme(sessionId) });
      void qc.invalidateQueries({ queryKey: preconAssistKeys.forSession(sessionId) });
    },
  });
}

export function useApplyChangeSet(sessionId: string) {
  return useChangeSetAction(sessionId, preconAssistApi.apply);
}

export function useUndoChangeSet(sessionId: string) {
  return useChangeSetAction(sessionId, preconAssistApi.undo);
}

export function useDiscardChangeSet(sessionId: string) {
  return useChangeSetAction(sessionId, preconAssistApi.discard);
}
