import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { inspectionKeys } from "./query-keys";
import type {
  InspectionReport,
  InspectionCategory,
} from "@/lib/project-mock-data";

export function useProjectInspections(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? inspectionKeys.list(projectId)
      : inspectionKeys.list("__none__"),
    queryFn: async () => {
      const { data } = await api.get<InspectionReport[]>(
        `/projects/${projectId!}/inspections`,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

interface RequestInspectionVariables {
  projectId: string;
  title: string;
  category: Exclude<InspectionCategory, "All Reports">;
  description: string;
  scheduledAt: string;
}

export function useRequestInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, ...body }: RequestInspectionVariables) => {
      const { data } = await api.post<InspectionReport>(
        `/projects/${projectId}/inspections`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: inspectionKeys.list(projectId) });
    },
  });
}
