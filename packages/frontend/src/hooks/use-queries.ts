import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { siteQueryKeys } from "./query-keys";
import type { QueryStatus } from "@/lib/project-types";
import {
  queriesApi,
  type QueryCreateInput,
  type QueryUpdateInput,
} from "@/api/queries";

export type { QueryCreateInput, QueryUpdateInput };

export function useProjectQueries(projectId: string | undefined, status?: QueryStatus) {
  return useQuery({
    queryKey: siteQueryKeys.list(projectId ?? "__none__", status),
    queryFn: async () => {
      return queriesApi.list(projectId!, status);
    },
    enabled: Boolean(projectId),
  });
}

export function useProjectQuery(projectId: string | undefined, queryId: string | undefined) {
  return useQuery({
    queryKey: siteQueryKeys.detail(projectId ?? "__none__", queryId ?? "__none__"),
    queryFn: async () => {
      return queriesApi.get(projectId!, queryId!);
    },
    enabled: Boolean(projectId && queryId),
  });
}

export function useCreateQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: QueryCreateInput & { projectId: string }) => {
      return queriesApi.create(projectId, body);
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
      return queriesApi.update(projectId, queryId, body);
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: siteQueryKeys.all(projectId) }),
  });
}

export function useDeleteQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, queryId }: { projectId: string; queryId: string }) => {
      return queriesApi.delete(projectId, queryId);
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
      return queriesApi.addComment(projectId, queryId, { body });
    },
    onSuccess: (_d, { projectId, queryId }) => {
      qc.invalidateQueries({ queryKey: siteQueryKeys.detail(projectId, queryId) });
      qc.invalidateQueries({ queryKey: siteQueryKeys.all(projectId) });
    },
  });
}
