import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { projectKeys } from "./query-keys";
import type { Project } from "@/lib/project-mock-data";

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
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const { data } = await api.post<Project>("/projects", input);
      return data;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      navigate(`/project/${project.id}/overview`);
    },
  });
}
