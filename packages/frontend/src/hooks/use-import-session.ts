import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export const importSessionKeys = {
  detail: (sessionId: string | null) => ["import-sessions", sessionId] as const,
};

export function useCreateImportSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importSessionApi.create,
    onSuccess: session => qc.setQueryData<ImportSession>(importSessionKeys.detail(session.id), { ...session, documents: [] }),
  });
}

export function useImportSession(sessionId: string | null) {
  return useQuery({
    queryKey: importSessionKeys.detail(sessionId),
    queryFn: async () => {
      return importSessionApi.get(sessionId!);
    },
    enabled: Boolean(sessionId),
    refetchInterval: (query) => {
      const session = query.state.data;
      return session?.status === "active" && session.documents.some(document =>
        document.status === "pending" || document.status === "processing"
      ) ? 1500 : false;
    },
  });
}

export function useLinkSessionProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, projectId }: { sessionId: string; projectId: string }) => {
      return importSessionApi.linkProject(sessionId, projectId);
    },
    onSuccess: (_, { sessionId, projectId }) => {
      qc.setQueryData<ImportSession>(importSessionKeys.detail(sessionId), session =>
        session ? { ...session, projectId } : session
      );
      return qc.invalidateQueries({ queryKey: importSessionKeys.detail(sessionId) });
    },
  });
}

export function useAttachSessionDocument() {
  const qc = useQueryClient();
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
    onSuccess: (_, { sessionId }) => qc.invalidateQueries({ queryKey: importSessionKeys.detail(sessionId) }),
  });
}

export function useUpdateSessionDocument() {
  const qc = useQueryClient();
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
    onSuccess: (_, { sessionId }) => qc.invalidateQueries({ queryKey: importSessionKeys.detail(sessionId) }),
  });
}
