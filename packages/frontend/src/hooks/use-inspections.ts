import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  inspectionsApi,
  type RequestInspectionVariables,
  type EditInspectionVariables,
  type InspectionRefVariables,
  type CancelInspectionVariables,
  type RecordInspectionOutcomeVariables,
} from "@/api/inspections";
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

export function useRecordInspectionOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, inspectionId, ...body }: RecordInspectionOutcomeVariables) =>
      inspectionsApi.recordOutcome(projectId, inspectionId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: inspectionKeys.list(projectId) });
    },
  });
}

/** Only the assigned BuildPanda inspector may say they attended. */
export function useMarkInspectionAttended() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, inspectionId }: InspectionRefVariables) =>
      inspectionsApi.markAttended(projectId, inspectionId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: inspectionKeys.list(projectId) });
    },
  });
}

/** The requester (or BuildPanda) calling the service order off. */
export function useCancelInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, inspectionId, reason }: CancelInspectionVariables) =>
      inspectionsApi.cancel(projectId, inspectionId, { reason }),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: inspectionKeys.list(projectId) });
    },
  });
}

export function useDeleteInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, inspectionId }: InspectionRefVariables) =>
      inspectionsApi.delete(projectId, inspectionId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: inspectionKeys.list(projectId) });
    },
  });
}
