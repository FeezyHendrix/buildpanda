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
};

/** The caller's relationship + capabilities for a project (drives the UI). */
export function useProjectAccess(projectId: string | undefined) {
  return useQuery({
    queryKey: participantKeys.access(projectId ?? "__none__"),
    queryFn: () => participantsApi.getAccess(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useMyProjects() {
  return useQuery({
    queryKey: participantKeys.myProjects(),
    queryFn: () => participantsApi.getMyProjects(),
  });
}

export function useParticipants(projectId: string | undefined) {
  return useQuery({
    queryKey: participantKeys.list(projectId ?? "__none__"),
    queryFn: () => participantsApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useInviteParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      ...body
    }: InviteParticipantInput & { projectId: string }) => participantsApi.invite(projectId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: participantKeys.list(projectId) }),
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
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: participantKeys.list(projectId) }),
  });
}

export function useRemoveParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, participantId }: { projectId: string; participantId: string }) =>
      participantsApi.remove(projectId, participantId),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: participantKeys.list(projectId) }),
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
