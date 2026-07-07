import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inspectionsApi, type RequestInspectionVariables, type EditInspectionVariables, type DeleteInspectionVariables } from "@/api/inspections";
import { inspectionKeys } from "./query-keys";

export function useProjectInspections(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? inspectionKeys.list(projectId)
      : inspectionKeys.list("__none__"),
    queryFn: () => inspectionsApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useRequestInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...body }: RequestInspectionVariables) => 
      inspectionsApi.request(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: inspectionKeys.list(projectId) });
    },
  });
}

export function useEditInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, inspectionId, ...patch }: EditInspectionVariables) => 
      inspectionsApi.edit(projectId, inspectionId, patch),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: inspectionKeys.list(projectId) });
    },
  });
}

export function useDeleteInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, inspectionId }: DeleteInspectionVariables) => 
      inspectionsApi.delete(projectId, inspectionId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: inspectionKeys.list(projectId) });
    },
  });
}
