import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teamKeys } from "./query-keys";
import { teamApi } from "@/api/team";
import type { TeamMemberStatus, TeamMember, TeamMemberInput } from "@/api/team";

export type { TeamMemberStatus, TeamMember, TeamMemberInput };

export function useProjectTeam(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? teamKeys.list(projectId)
      : teamKeys.list("__none__"),
    queryFn: () => teamApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

interface CreateTeamMemberVariables extends TeamMemberInput {
  projectId: string;
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...body }: CreateTeamMemberVariables) => teamApi.create(projectId, body),
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
    mutationFn: ({
      projectId,
      memberId,
      ...patch
    }: EditTeamMemberVariables) => teamApi.update(projectId, memberId, patch),
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
    mutationFn: ({ projectId, memberId }: DeleteTeamMemberVariables) => teamApi.delete(projectId, memberId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.list(projectId) });
    },
  });
}
