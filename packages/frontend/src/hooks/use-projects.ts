import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { projectKeys, projectTemplateKeys } from "./query-keys";
import type { Currency, Project } from "@/lib/project-types";

export interface ProjectTemplateSummary {
  id: string;
  name: string;
  description: string;
  stageCount: number;
  taskCount: number;
  totalWeeks: number;
  stages: Array<{ name: string; durationWeeks: number; dateRange: string }>;
}

export interface CreateProjectInput {
  title: string;
  projectType: string;
  templateId?: string;
  location: {
    state: string;
    city: string;
    ownsLand: boolean;
  };
  details: {
    buildingType: string;
    currency: Currency;
    budgetMin: number;
    budgetMax: number;
    timeline: string;
    fundingMethod: string;
  };
  management: {
    involvementLevel: string;
    riskOptions: string[];
  };
}

export interface UpdateProjectBudgetInput {
  budgetMin: number;
  budgetMax: number;
  currency?: Currency;
}

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: async () => {
      const { data } = await api.get<Project[]>("/projects");
      return data;
    },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: id ? projectKeys.detail(id) : projectKeys.detail("__none__"),
    queryFn: async () => {
      const { data } = await api.get<Project>(`/projects/${id!}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useProjectTemplates() {
  return useQuery({
    queryKey: projectTemplateKeys.list(),
    queryFn: async () => {
      const { data } = await api.get<ProjectTemplateSummary[]>("/project-templates");
      return data;
    },
    staleTime: 5 * 60 * 1000, // static definitions; no need to refetch per step change
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const { data } = await api.post<Project>("/projects", input);
      return data;
    },
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
    mutationFn: async (projectId: string) => {
      await api.delete(`/projects/${projectId}`);
    },
    onSuccess: (_data, projectId) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useUpdateProjectBudget(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProjectBudgetInput) => {
      const { data } = await api.patch<Project>(
        `/projects/${projectId}/budget`,
        input,
      );
      return data;
    },
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useUpdateProjectCurrency(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (currency: string) => {
      const { data } = await api.patch<Project>(
        `/projects/${projectId}/currency`,
        { currency },
      );
      return data;
    },
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}
