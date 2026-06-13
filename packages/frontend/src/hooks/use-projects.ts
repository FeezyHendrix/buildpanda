import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { projectKeys } from "./query-keys";
import type { Project } from "@/lib/project-types";

export interface CreateProjectInput {
  title: string;
  projectType: string;
  location: {
    state: string;
    city: string;
    ownsLand: boolean;
  };
  details: {
    buildingType: string;
    currency: "NGN" | "USD";
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
  currency?: "NGN" | "USD";
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
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      queryClient.setQueryData(projectKeys.detail(project.id), project);
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
