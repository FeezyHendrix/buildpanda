import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  participantsApi,
  type InviteParticipantInput,
  type UpdateParticipantInput,
  type ProjectInvitePreview,
} from "@/api/participants";

export type { ProjectInvitePreview };

export const participantKeys = {
  list: (projectId: string) => ["projects", projectId, "participants"] as const,
  access: (projectId: string) => ["projects", projectId, "access"] as const,
  myProjects: () => ["me", "projects"] as const,
  invite: (token: string) => ["project-invite", token] as const,
  catalog: () => ["permissions", "catalog"] as const,
};

export function usePermissionCatalog() {
  return useQuery({
    queryKey: participantKeys.catalog(),
    queryFn: () => participantsApi.getCatalog(),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });
}

/**
 * The caller's relationship + capabilities for a project (drives the UI).
 * Cached indefinitely: invalidated only by participant writes (below) or the
 * `access.updated` realtime event pushed when the caller's own access changes.
 */
export function useProjectAccess(projectId: string | undefined) {
  return useQuery({
    queryKey: participantKeys.access(projectId ?? "__none__"),
    queryFn: () => participantsApi.getAccess(projectId!),
    enabled: Boolean(projectId),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });
}

export function useMyProjects() {
  return useQuery({
    queryKey: participantKeys.myProjects(),
    queryFn: () => participantsApi.getMyProjects(),
  });
}

export function useParticipants(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: participantKeys.list(projectId ?? "__none__"),
    queryFn: () => participantsApi.list(projectId!),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useInviteParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      ...body
    }: InviteParticipantInput & { projectId: string }) => participantsApi.invite(projectId, body),
    onSuccess: (_d, { projectId }) => {
      void qc.invalidateQueries({ queryKey: participantKeys.list(projectId) });
      void qc.invalidateQueries({ queryKey: participantKeys.access(projectId) });
    },
  });
}

export function useUpdateParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      participantId,
      ...body
    }: UpdateParticipantInput & { projectId: string; participantId: string }) =>
      participantsApi.update(projectId, participantId, body),
    onSuccess: (_d, { projectId }) => {
      void qc.invalidateQueries({ queryKey: participantKeys.list(projectId) });
      void qc.invalidateQueries({ queryKey: participantKeys.access(projectId) });
    },
  });
}

export function useRemoveParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, participantId }: { projectId: string; participantId: string }) =>
      participantsApi.remove(projectId, participantId),
    onSuccess: (_d, { projectId }) => {
      void qc.invalidateQueries({ queryKey: participantKeys.list(projectId) });
      void qc.invalidateQueries({ queryKey: participantKeys.access(projectId) });
    },
  });
}

export function useProjectInvite(token: string | undefined) {
  return useQuery({
    queryKey: participantKeys.invite(token ?? "__none__"),
    queryFn: () => participantsApi.getInvite(token!),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useAcceptProjectInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => participantsApi.acceptInvite(token),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: participantKeys.myProjects() });
      qc.invalidateQueries({ queryKey: participantKeys.access(data.projectId) });
    },
  });
}
