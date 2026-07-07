import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { permitsApi, type PermitInput } from "@/api/permits";
import { permitKeys } from "./query-keys";

export type { PermitInput };

export function usePermits(projectId: string | undefined) {
  return useQuery({
    queryKey: permitKeys.list(projectId ?? "__none__"),
    queryFn: () => permitsApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreatePermit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: PermitInput & { projectId: string }) =>
      permitsApi.create(projectId, body),
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: permitKeys.all(projectId) }),
  });
}

export function useUpdatePermit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      permitId,
      ...body
    }: Partial<PermitInput> & { projectId: string; permitId: string }) =>
      permitsApi.update(projectId, permitId, body),
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: permitKeys.all(projectId) }),
  });
}

export function useDeletePermit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, permitId }: { projectId: string; permitId: string }) =>
      permitsApi.remove(projectId, permitId),
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: permitKeys.all(projectId) }),
  });
}
