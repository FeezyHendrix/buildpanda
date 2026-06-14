import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { bimKeys } from "./query-keys";
import type {
  BimCoordinationIssue,
  BimModel,
  BimUploadTicket,
} from "@/lib/project-types";

export function useBimModels(projectId: string | undefined) {
  return useQuery({
    queryKey: bimKeys.models(projectId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<BimModel[]>(`/projects/${projectId!}/bim/models`);
      return data;
    },
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
    queryFn: async () => {
      const { data } = await api.get<BimModel>(`/projects/${projectId!}/bim/models/${modelId!}`);
      return data;
    },
    enabled: Boolean(projectId && modelId),
  });
}

export function useBimModelIssues(projectId: string | undefined, modelId: string | undefined) {
  return useQuery({
    queryKey: bimKeys.issues(projectId ?? "__none__", modelId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<BimCoordinationIssue[]>(
        `/projects/${projectId!}/bim/models/${modelId!}/issues`,
      );
      return data;
    },
    enabled: Boolean(projectId && modelId),
  });
}

async function uploadSingle(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

async function uploadMultipart(
  parts: { partNumber: number; url: string }[],
  partSize: number,
  file: File,
): Promise<{ partNumber: number; etag: string }[]> {
  const results: { partNumber: number; etag: string }[] = [];
  for (const part of parts) {
    const start = (part.partNumber - 1) * partSize;
    const chunk = file.slice(start, Math.min(start + partSize, file.size));
    const res = await fetch(part.url, { method: "PUT", body: chunk });
    if (!res.ok) throw new Error(`Part ${part.partNumber} upload failed (${res.status})`);
    const etag = res.headers.get("ETag") ?? res.headers.get("etag") ?? "";
    results.push({ partNumber: part.partNumber, etag: etag.replace(/"/g, "") });
  }
  return results;
}

export interface UploadModelInput {
  projectId: string;
  name: string;
  discipline?: string | null;
  file: File;
}

export function useUploadBimModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, name, discipline, file }: UploadModelInput) => {
      const { data: ticket } = await api.post<BimUploadTicket>(
        `/projects/${projectId}/bim/upload-url`,
        { fileName: file.name, sizeBytes: file.size },
      );

      if (ticket.mode === "single") {
        await uploadSingle(ticket.url, file);
      } else {
        const parts = await uploadMultipart(ticket.parts, ticket.partSize, file);
        await api.post(`/projects/${projectId}/bim/complete-upload`, {
          storagePath: ticket.storagePath,
          uploadId: ticket.uploadId,
          parts,
        });
      }

      const { data: model } = await api.post<BimModel>(`/projects/${projectId}/bim/models`, {
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
    mutationFn: async ({ projectId, modelId }: { projectId: string; modelId: string }) => {
      const { data } = await api.get<{ url: string; fileName: string }>(
        `/projects/${projectId}/bim/models/${modelId}/file-url`,
      );
      return data;
    },
  });
}

export function useCreateBimIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      modelId,
      title,
      description,
      elementGuid,
    }: {
      projectId: string;
      modelId: string;
      title: string;
      description?: string | null;
      elementGuid?: string | null;
    }) => {
      const { data } = await api.post<BimCoordinationIssue>(
        `/projects/${projectId}/bim/models/${modelId}/issues`,
        { title, description, elementGuid },
      );
      return data;
    },
    onSuccess: (_d, { projectId, modelId }) =>
      qc.invalidateQueries({ queryKey: bimKeys.issues(projectId, modelId) }),
  });
}

export function usePromoteIssueToRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      modelId,
      issueId,
    }: {
      projectId: string;
      modelId: string;
      issueId: string;
    }) => {
      const { data } = await api.post<BimCoordinationIssue>(
        `/projects/${projectId}/bim/models/${modelId}/issues/${issueId}/promote-to-rfi`,
      );
      return data;
    },
    onSuccess: (_d, { projectId, modelId }) =>
      qc.invalidateQueries({ queryKey: bimKeys.issues(projectId, modelId) }),
  });
}
