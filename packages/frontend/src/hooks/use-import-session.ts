import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export type SessionDocumentKind = "programme" | "boq" | "drawing" | "ifc" | "project_file";
export type SessionDocumentStatus = "pending" | "processing" | "ready" | "applied" | "skipped" | "failed";
export type ImportSessionStatus = "active" | "completed";

export interface SessionDocument {
  id: string;
  sessionId: string;
  kind: SessionDocumentKind;
  jobId: string | null;
  fileName: string | null;
  status: SessionDocumentStatus;
  error: string | null;
  appliedAt: string | null;
  createdAt: string;
}

export interface ImportSession {
  id: string;
  projectId: string | null;
  status: ImportSessionStatus;
  documents: SessionDocument[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function useCreateImportSession() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ImportSession>("/import-sessions");
      return data;
    },
  });
}

export function useImportSession(sessionId: string | null) {
  return useQuery({
    queryKey: ["import-sessions", sessionId ?? "__none__"],
    queryFn: async () => {
      const { data } = await api.get<ImportSession>(`/import-sessions/${sessionId!}`);
      return data;
    },
    enabled: Boolean(sessionId),
    refetchInterval: (query) => {
      return query.state.data?.status === "active" ? 1500 : false;
    },
  });
}

export function useLinkSessionProject() {
  return useMutation({
    mutationFn: async ({ sessionId, projectId }: { sessionId: string; projectId: string }) => {
      const { data } = await api.post<void>(`/import-sessions/${sessionId}/project`, { projectId });
      return data;
    },
  });
}

export function useAttachSessionDocument() {
  return useMutation({
    mutationFn: async ({
      sessionId,
      kind,
      jobId,
      fileName,
      status,
    }: {
      sessionId: string;
      kind: SessionDocumentKind;
      jobId?: string;
      fileName?: string;
      status?: SessionDocumentStatus;
    }) => {
      const { data } = await api.post<SessionDocument>(`/import-sessions/${sessionId}/documents`, {
        kind,
        jobId,
        fileName,
        status,
      });
      return data;
    },
  });
}

export function useUpdateSessionDocument() {
  return useMutation({
    mutationFn: async ({
      sessionId,
      documentId,
      jobId,
      fileName,
      status,
      error,
    }: {
      sessionId: string;
      documentId: string;
      jobId?: string;
      fileName?: string;
      status?: SessionDocumentStatus;
      error?: string | null;
    }) => {
      const { data } = await api.patch<SessionDocument>(
        `/import-sessions/${sessionId}/documents/${documentId}`,
        {
          jobId,
          fileName,
          status,
          error,
        },
      );
      return data;
    },
  });
}
