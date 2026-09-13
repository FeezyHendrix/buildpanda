import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  extensionsOfTimeApi,
  type DecideEotClaimInput,
  type UpsertEotClaimInput,
} from "@/api/extensions-of-time";
import { activityKeys, eotKeys, keyDateKeys, projectKeys, reportingKeys } from "./query-keys";

/**
 * Awarding days moves the project's revised completion date and every
 * contractual key date, so a decision invalidates the programme, not just the
 * claim list.
 */
function invalidateAward(
  invalidate: (args: { queryKey: readonly unknown[] }) => void,
  projectId: string,
): void {
  invalidate({ queryKey: eotKeys.all(projectId) });
  invalidate({ queryKey: keyDateKeys.all(projectId) });
  invalidate({ queryKey: activityKeys.all(projectId) });
  invalidate({ queryKey: projectKeys.detail(projectId) });
  // The completion position on this page and on the Overview both read the
  // reporting snapshot, which the server caches for a minute.
  invalidate({ queryKey: reportingKeys.all(projectId) });
}

export function useEotClaims(projectId: string | undefined) {
  return useQuery({
    queryKey: eotKeys.list(projectId ?? "__none__"),
    queryFn: () => extensionsOfTimeApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateEotClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: UpsertEotClaimInput & { projectId: string }) =>
      extensionsOfTimeApi.create(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: eotKeys.all(projectId) });
    },
  });
}

export function useUpdateEotClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      claimId,
      ...body
    }: Partial<UpsertEotClaimInput> & { projectId: string; claimId: string }) =>
      extensionsOfTimeApi.update(projectId, claimId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: eotKeys.all(projectId) });
    },
  });
}

export function useSubmitEotClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, claimId }: { projectId: string; claimId: string }) =>
      extensionsOfTimeApi.submit(projectId, claimId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: eotKeys.all(projectId) });
    },
  });
}

export function useDecideEotClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      claimId,
      ...body
    }: DecideEotClaimInput & { projectId: string; claimId: string }) =>
      extensionsOfTimeApi.decide(projectId, claimId, body),
    onSuccess: (_data, { projectId }) => {
      invalidateAward((args) => queryClient.invalidateQueries(args), projectId);
    },
  });
}
