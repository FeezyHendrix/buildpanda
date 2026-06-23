import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type {
  MyProjectCard,
  ParticipantRole,
  ProjectAccess,
  ProjectParticipant,
} from "@/lib/project-types";

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
    queryFn: async () => {
      const { data } = await api.get<ProjectAccess>(`/projects/${projectId!}/access`);
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useMyProjects() {
  return useQuery({
    queryKey: participantKeys.myProjects(),
    queryFn: async () => {
      const { data } = await api.get<MyProjectCard[]>("/me/projects");
      return data;
    },
  });
}

export function useParticipants(projectId: string | undefined) {
  return useQuery({
    queryKey: participantKeys.list(projectId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<ProjectParticipant[]>(`/projects/${projectId!}/participants`);
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useInviteParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      email,
      name,
      role,
    }: {
      projectId: string;
      email: string;
      name?: string;
      role?: string;
    }) => {
      const { data } = await api.post<ProjectParticipant>(
        `/projects/${projectId}/participants/invite`,
        { email, name, role },
      );
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: participantKeys.list(projectId) }),
  });
}

export function useRemoveParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, participantId }: { projectId: string; participantId: string }) => {
      await api.delete(`/projects/${projectId}/participants/${participantId}`);
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: participantKeys.list(projectId) }),
  });
}

export interface ProjectInvitePreview {
  email: string;
  role: ParticipantRole;
  projectName: string;
  inviterName: string | null;
  expired: boolean;
}

export function useProjectInvite(token: string | undefined) {
  return useQuery({
    queryKey: participantKeys.invite(token ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<ProjectInvitePreview>(`/project-invites/${token!}`);
      return data;
    },
    enabled: Boolean(token),
    retry: false,
  });
}

export function useAcceptProjectInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await api.post<{ projectId: string; role: string }>(
        `/project-invites/${token}/accept`,
      );
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: participantKeys.myProjects() });
      qc.invalidateQueries({ queryKey: participantKeys.access(data.projectId) });
    },
  });
}
