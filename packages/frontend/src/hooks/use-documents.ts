import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { documentKeys } from "./query-keys";
import type {
  DocumentCategory,
  DocumentVersion,
  ProjectDocument,
} from "@/lib/project-mock-data";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

/** Direct URL for inline viewing of a document version's file. */
export function documentVersionViewUrl(
  projectId: string,
  documentId: string,
  versionId: string,
): string {
  return `${API_BASE}/projects/${projectId}/documents/${documentId}/versions/${versionId}/view`;
}

export function useProjectDocuments(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? documentKeys.list(projectId)
      : documentKeys.list("__none__"),
    queryFn: async () => {
      const { data } = await api.get<ProjectDocument[]>(
        `/projects/${projectId!}/documents`,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useProjectDocumentCategories(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? documentKeys.categories(projectId)
      : documentKeys.categories("__none__"),
    queryFn: async () => {
      const { data } = await api.get<DocumentCategory[]>(
        `/projects/${projectId!}/documents/categories`,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

interface CreateDocumentVariables {
  projectId: string;
  categoryId: string;
  fileId: string;
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      categoryId,
      fileId,
    }: CreateDocumentVariables) => {
      const { data } = await api.post<ProjectDocument>(
        `/projects/${projectId}/documents`,
        { categoryId, fileId },
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all(projectId) });
    },
  });
}

interface EditDocumentVariables {
  projectId: string;
  documentId: string;
  categoryId: string;
}

export function useEditDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      documentId,
      categoryId,
    }: EditDocumentVariables) => {
      const { data } = await api.put<ProjectDocument>(
        `/projects/${projectId}/documents/${documentId}`,
        { categoryId },
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all(projectId) });
    },
  });
}

interface DeleteDocumentVariables {
  projectId: string;
  documentId: string;
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, documentId }: DeleteDocumentVariables) => {
      await api.delete(`/projects/${projectId}/documents/${documentId}`);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all(projectId) });
    },
  });
}

export function useDocumentVersions(
  projectId: string | undefined,
  documentId: string | undefined,
) {
  return useQuery({
    queryKey: documentKeys.versions(projectId ?? "__none__", documentId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<DocumentVersion[]>(
        `/projects/${projectId!}/documents/${documentId!}/versions`,
      );
      return data;
    },
    enabled: Boolean(projectId && documentId),
  });
}

interface AddVersionVariables {
  projectId: string;
  documentId: string;
  fileId: string;
  revisionLabel?: string;
  notes?: string;
}

export function useAddDocumentVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      documentId,
      fileId,
      revisionLabel,
      notes,
    }: AddVersionVariables) => {
      const { data } = await api.post<DocumentVersion>(
        `/projects/${projectId}/documents/${documentId}/versions`,
        { fileId, revisionLabel, notes },
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all(projectId) });
    },
  });
}
