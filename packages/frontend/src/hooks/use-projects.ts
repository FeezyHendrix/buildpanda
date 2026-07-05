import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectKeys, projectTemplateKeys } from "./query-keys";
import { projectsApi } from "@/api/projects";
import type { ProjectTemplateSummary, CreateProjectInput, UpdateProjectBudgetInput } from "@/api/projects";

export type { ProjectTemplateSummary, CreateProjectInput, UpdateProjectBudgetInput };

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => projectsApi.list(),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: id ? projectKeys.detail(id) : projectKeys.detail("__none__"),
    queryFn: () => projectsApi.detail(id!),
    enabled: Boolean(id),
  });
}

export function useProjectTemplates() {
  return useQuery({
    queryKey: projectTemplateKeys.list(),
    queryFn: () => projectsApi.templates(),
    staleTime: 5 * 60 * 1000, // static definitions; no need to refetch per step change
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
    // Caller owns navigation so it can finish post-create work (e.g. uploading
    // land documents) before leaving the page.
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => projectsApi.delete(projectId),
    onSuccess: (_data, projectId) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useUpdateProjectBudget(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProjectBudgetInput) => projectsApi.updateBudget(projectId, input),
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useUpdateProjectCurrency(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (currency: string) => projectsApi.updateCurrency(projectId, currency),
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}
