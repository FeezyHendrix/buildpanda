import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bimKeys } from "./query-keys";
import {
  bimApi,
  uploadSingle,
  uploadMultipart,
} from "@/api/bim";
import type { BimModel } from "@/lib/project-types";

export interface UploadModelInput {
  projectId: string;
  name: string;
  discipline?: string | null;
  file: File;
}



export function useBimModels(projectId: string | undefined) {
  return useQuery({
    queryKey: bimKeys.models(projectId ?? "__none__"),
    queryFn: () => bimApi.getModels(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const models = query.state.data as BimModel[] | undefined;
      return models?.some((m) => m.status === "Processing") ? 4000 : false;
    },
  });
}

export function useBimModel(projectId: string | undefined, modelId: string | undefined) {
  return useQuery({
    queryKey: bimKeys.model(projectId ?? "__none__", modelId ?? "__none__"),
    queryFn: () => bimApi.getModel(projectId!, modelId!),
    enabled: Boolean(projectId && modelId),
  });
}

export function useBimModelIssues(projectId: string | undefined, modelId: string | undefined) {
  return useQuery({
    queryKey: bimKeys.issues(projectId ?? "__none__", modelId ?? "__none__"),
    queryFn: () => bimApi.getIssues(projectId!, modelId!),
    enabled: Boolean(projectId && modelId),
  });
}

export function useUploadBimModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, name, discipline, file }: UploadModelInput) => {
      const ticket = await bimApi.getUploadUrl(projectId, file.name, file.size);

      if (ticket.mode === "single") {
        await uploadSingle(ticket.url, file);
      } else {
        const parts = await uploadMultipart(ticket.parts, ticket.partSize, file);
        await bimApi.completeUpload(projectId, {
          storagePath: ticket.storagePath,
          uploadId: ticket.uploadId,
          parts,
        });
      }

      const model = await bimApi.createModel(projectId, {
        name,
        discipline: discipline ?? null,
        fileName: file.name,
        storagePath: ticket.storagePath,
        sizeBytes: file.size,
      });
      return model;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: bimKeys.all(projectId) }),
  });
}

export function useBimModelFileUrl() {
  return useMutation({
    mutationFn: ({ projectId, modelId }: { projectId: string; modelId: string }) =>
      bimApi.getFileUrl(projectId, modelId),
  });
}

export function useBimModelXktUrl() {
  return useMutation({
    mutationFn: ({ projectId, modelId }: { projectId: string; modelId: string }) =>
      bimApi.getXktUrl(projectId, modelId),
  });
}

export function useCreateBimIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      modelId,
      ...body
    }: {
      projectId: string;
      modelId: string;
      title: string;
      description?: string | null;
      elementGuid?: string | null;
      assigneeId?: string | null;
    }) => bimApi.createIssue(projectId, modelId, body),
    onSuccess: (_d, { projectId, modelId }) =>
      qc.invalidateQueries({ queryKey: bimKeys.issues(projectId, modelId) }),
  });
}

export function usePromoteIssueToRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      modelId,
      issueId,
    }: {
      projectId: string;
      modelId: string;
      issueId: string;
    }) => bimApi.promoteIssueToRfi(projectId, modelId, issueId),
    onSuccess: (_d, { projectId, modelId }) =>
      qc.invalidateQueries({ queryKey: bimKeys.issues(projectId, modelId) }),
  });
}
