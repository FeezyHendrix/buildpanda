import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  documentsApi,
  type CreateDocumentVariables,
  type EditDocumentVariables,
  type DeleteDocumentVariables,
  type AddVersionVariables,
} from "@/api/documents";
import { documentKeys } from "./query-keys";

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
    queryFn: () => documentsApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useProjectDocumentCategories(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? documentKeys.categories(projectId)
      : documentKeys.categories("__none__"),
    queryFn: () => documentsApi.categories(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      categoryId,
      fileId,
    }: CreateDocumentVariables) => 
      documentsApi.create(projectId, { categoryId, fileId }),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all(projectId) });
    },
  });
}

export function useEditDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      documentId,
      categoryId,
    }: EditDocumentVariables) => 
      documentsApi.edit(projectId, documentId, { categoryId }),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all(projectId) });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, documentId }: DeleteDocumentVariables) => 
      documentsApi.delete(projectId, documentId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all(projectId) });
    },
  });
}

export function useCreateShare() {
  return useMutation({
    mutationFn: ({ projectId, documentId }: { projectId: string; documentId: string }) => 
      documentsApi.share(projectId, documentId),
  });
}

export function useDocumentVersions(
  projectId: string | undefined,
  documentId: string | undefined,
) {
  return useQuery({
    queryKey: documentKeys.versions(projectId ?? "__none__", documentId ?? "__none__"),
    queryFn: () => documentsApi.versions(projectId!, documentId!),
    enabled: Boolean(projectId && documentId),
  });
}

export function useAddDocumentVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      documentId,
      fileId,
      revisionLabel,
      notes,
    }: AddVersionVariables) => 
      documentsApi.addVersion(projectId, documentId, { fileId, revisionLabel, notes }),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all(projectId) });
    },
  });
}
