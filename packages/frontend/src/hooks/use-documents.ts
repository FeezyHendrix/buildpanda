import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { documentKeys } from "./query-keys";
import type {
  DocumentCategory,
  ProjectDocument,
} from "@/lib/project-mock-data";

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
