import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { teamKeys } from "./query-keys";

export type TeamMemberStatus = "Active" | "Inactive";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  responsibilities: string | null;
  status: TeamMemberStatus;
}

export interface TeamMemberInput {
  name: string;
  role: string;
  company?: string;
  email?: string;
  phone?: string;
  responsibilities?: string;
  status: TeamMemberStatus;
}

export function useProjectTeam(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? teamKeys.list(projectId)
      : teamKeys.list("__none__"),
    queryFn: async () => {
      const { data } = await api.get<TeamMember[]>(
        `/projects/${projectId!}/team-members`,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

interface CreateTeamMemberVariables extends TeamMemberInput {
  projectId: string;
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, ...body }: CreateTeamMemberVariables) => {
      const { data } = await api.post<TeamMember>(
        `/projects/${projectId}/team-members`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.list(projectId) });
    },
  });
}

interface EditTeamMemberVariables extends TeamMemberInput {
  projectId: string;
  memberId: string;
}

export function useEditTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      memberId,
      ...patch
    }: EditTeamMemberVariables) => {
      const { data } = await api.put<TeamMember>(
        `/projects/${projectId}/team-members/${memberId}`,
        patch,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.list(projectId) });
    },
  });
}

interface DeleteTeamMemberVariables {
  projectId: string;
  memberId: string;
}

export function useDeleteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, memberId }: DeleteTeamMemberVariables) => {
      await api.delete(`/projects/${projectId}/team-members/${memberId}`);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.list(projectId) });
    },
  });
}
