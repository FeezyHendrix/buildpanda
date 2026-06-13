import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { siteQueryKeys } from "./query-keys";
import type {
  QueryStatus,
  SiteQuery,
  SiteQueryComment,
  SiteQueryDetail,
} from "@/lib/project-types";

export function useProjectQueries(projectId: string | undefined, status?: QueryStatus) {
  return useQuery({
    queryKey: siteQueryKeys.list(projectId ?? "__none__", status),
    queryFn: async () => {
      const { data } = await api.get<SiteQuery[]>(`/projects/${projectId!}/queries`, {
        params: status ? { status } : undefined,
      });
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useProjectQuery(projectId: string | undefined, queryId: string | undefined) {
  return useQuery({
    queryKey: siteQueryKeys.detail(projectId ?? "__none__", queryId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<SiteQueryDetail>(
        `/projects/${projectId!}/queries/${queryId!}`,
      );
      return data;
    },
    enabled: Boolean(projectId && queryId),
  });
}

export interface QueryCreateInput {
  subject: string;
  question: string;
  dueDate?: string | null;
}

export interface QueryUpdateInput {
  subject?: string;
  question?: string;
  status?: QueryStatus;
  answer?: string | null;
  dueDate?: string | null;
}

export function useCreateQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: QueryCreateInput & { projectId: string }) => {
      const { data } = await api.post<SiteQuery>(`/projects/${projectId}/queries`, body);
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: siteQueryKeys.all(projectId) }),
  });
}

export function useUpdateQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      queryId,
      ...body
    }: QueryUpdateInput & { projectId: string; queryId: string }) => {
      const { data } = await api.patch<SiteQuery>(
        `/projects/${projectId}/queries/${queryId}`,
        body,
      );
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: siteQueryKeys.all(projectId) }),
  });
}

export function useDeleteQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, queryId }: { projectId: string; queryId: string }) => {
      await api.delete(`/projects/${projectId}/queries/${queryId}`);
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: siteQueryKeys.all(projectId) }),
  });
}

export function useAddQueryComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      queryId,
      body,
    }: {
      projectId: string;
      queryId: string;
      body: string;
    }) => {
      const { data } = await api.post<SiteQueryComment>(
        `/projects/${projectId}/queries/${queryId}/comments`,
        { body },
      );
      return data;
    },
    onSuccess: (_d, { projectId, queryId }) => {
      qc.invalidateQueries({ queryKey: siteQueryKeys.detail(projectId, queryId) });
      qc.invalidateQueries({ queryKey: siteQueryKeys.all(projectId) });
    },
  });
}
