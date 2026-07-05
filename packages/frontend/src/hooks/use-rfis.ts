import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rfisApi, type RfiCreateInput, type RfiUpdateInput, type RfiRespondInput } from "@/api/rfis";
import { rfiKeys } from "./query-keys";
import type { RfiStatus } from "@/lib/project-types";

export type { RfiCreateInput, RfiUpdateInput };

export function useProjectRfis(projectId: string | undefined, status?: RfiStatus) {
  return useQuery({
    queryKey: rfiKeys.list(projectId ?? "__none__", status),
    queryFn: () => rfisApi.list(projectId!, status),
    enabled: Boolean(projectId),
  });
}

export function useProjectRfi(projectId: string | undefined, rfiId: string | undefined) {
  return useQuery({
    queryKey: rfiKeys.detail(projectId ?? "__none__", rfiId ?? "__none__"),
    queryFn: () => rfisApi.detail(projectId!, rfiId!),
    enabled: Boolean(projectId && rfiId),
  });
}

export function useUpdateRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, rfiId, ...body }: RfiUpdateInput & { projectId: string; rfiId: string }) =>
      rfisApi.update(projectId, rfiId, body),
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: rfiKeys.all(projectId) }),
  });
}

export function useCreateRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: RfiCreateInput & { projectId: string }) =>
      rfisApi.create(projectId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: rfiKeys.all(projectId) }),
  });
}

export function useRespondRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      rfiId,
      ...body
    }: RfiRespondInput & { projectId: string; rfiId: string }) =>
      rfisApi.respond(projectId, rfiId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: rfiKeys.all(projectId) }),
  });
}

export function useTransitionRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      rfiId,
      status,
    }: {
      projectId: string;
      rfiId: string;
      status: "Closed" | "Void" | "Open";
    }) =>
      rfisApi.transition(projectId, rfiId, status),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: rfiKeys.all(projectId) }),
  });
}

export function useRfiComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      rfiId,
      body,
    }: {
      projectId: string;
      rfiId: string;
      body: string;
    }) =>
      rfisApi.comment(projectId, rfiId, body),
    onSuccess: (_d, { projectId, rfiId }) =>
      qc.invalidateQueries({ queryKey: rfiKeys.detail(projectId, rfiId) }),
  });
}

export function useConvertRfiToChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, rfiId }: { projectId: string; rfiId: string }) =>
      rfisApi.convertToChange(projectId, rfiId),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: rfiKeys.all(projectId) }),
  });
}
