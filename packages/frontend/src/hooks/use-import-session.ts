import { useMutation, useQuery } from "@tanstack/react-query";
import {
  importSessionApi,
  type ImportSession,
  type SessionDocument,
  type SessionDocumentKind,
  type SessionDocumentStatus,
  type ImportSessionStatus,
} from "@/api/import-session";

export type {
  SessionDocumentKind,
  SessionDocumentStatus,
  ImportSessionStatus,
  SessionDocument,
  ImportSession,
};

export function useCreateImportSession() {
  return useMutation({
    mutationFn: async () => {
      return importSessionApi.create();
    },
  });
}

export function useImportSession(sessionId: string | null) {
  return useQuery({
    queryKey: ["import-sessions", sessionId ?? "__none__"],
    queryFn: async () => {
      return importSessionApi.get(sessionId!);
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
      return importSessionApi.linkProject(sessionId, projectId);
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
      return importSessionApi.attachDocument(sessionId, { kind, jobId, fileName, status });
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
      return importSessionApi.updateDocument(sessionId, documentId, {
        jobId,
        fileName,
        status,
        error,
      });
    },
  });
}
