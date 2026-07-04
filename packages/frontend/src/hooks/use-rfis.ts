import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { rfiKeys } from "./query-keys";
import type { Rfi, RfiDetail, RfiPriority, RfiStatus } from "@/lib/project-types";

export function useProjectRfis(projectId: string | undefined, status?: RfiStatus) {
  return useQuery({
    queryKey: rfiKeys.list(projectId ?? "__none__", status),
    queryFn: async () => {
      const { data } = await api.get<Rfi[]>(`/projects/${projectId!}/rfis`, {
        params: status ? { status } : undefined,
      });
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useProjectRfi(projectId: string | undefined, rfiId: string | undefined) {
  return useQuery({
    queryKey: rfiKeys.detail(projectId ?? "__none__", rfiId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<RfiDetail>(`/projects/${projectId!}/rfis/${rfiId!}`);
      return data;
    },
    enabled: Boolean(projectId && rfiId),
  });
}

export interface RfiCreateInput {
  subject: string;
  question: string;
  priority?: RfiPriority;
  dueDate?: string | null;
  costImpact?: boolean;
  scheduleImpact?: boolean;
  ballInCourtId?: string | null;
  ballInCourtName?: string | null;
  ballInCourtEmail?: string | null;
}

export interface RfiUpdateInput {
  subject?: string;
  question?: string;
  priority?: RfiPriority;
  dueDate?: string | null;
  costImpact?: boolean;
  scheduleImpact?: boolean;
  ballInCourtId?: string | null;
  ballInCourtName?: string | null;
  ballInCourtEmail?: string | null;
  assigneeRole?: string | null;
}

export function useUpdateRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, rfiId, ...body }: RfiUpdateInput & { projectId: string; rfiId: string }) => {
      const { data } = await api.patch<Rfi>(`/projects/${projectId}/rfis/${rfiId}`, body);
      return data;
    },
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: rfiKeys.all(projectId) }),
  });
}

export function useCreateRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: RfiCreateInput & { projectId: string }) => {
      const { data } = await api.post<Rfi>(`/projects/${projectId}/rfis`, body);
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: rfiKeys.all(projectId) }),
  });
}

export function useRespondRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      rfiId,
      body,
      official,
      contentHtml,
      attachments,
      references,
    }: {
      projectId: string;
      rfiId: string;
      body: string;
      official?: boolean;
      contentHtml?: string | null;
      attachments?: { fileId: string; url: string; name: string }[];
      references?: { type: "action_item" | "activity"; id: string; label: string }[];
    }) => {
      const { data } = await api.post<RfiDetail>(
        `/projects/${projectId}/rfis/${rfiId}/respond`,
        { body, official, contentHtml, attachments, references },
      );
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: rfiKeys.all(projectId) }),
  });
}

export function useTransitionRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      rfiId,
      status,
    }: {
      projectId: string;
      rfiId: string;
      status: "Closed" | "Void" | "Open";
    }) => {
      const { data } = await api.post<Rfi>(
        `/projects/${projectId}/rfis/${rfiId}/transition`,
        { status },
      );
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: rfiKeys.all(projectId) }),
  });
}

export function useRfiComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      rfiId,
      body,
    }: {
      projectId: string;
      rfiId: string;
      body: string;
    }) => {
      const { data } = await api.post(`/projects/${projectId}/rfis/${rfiId}/comments`, { body });
      return data;
    },
    onSuccess: (_d, { projectId, rfiId }) =>
      qc.invalidateQueries({ queryKey: rfiKeys.detail(projectId, rfiId) }),
  });
}

export function useConvertRfiToChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, rfiId }: { projectId: string; rfiId: string }) => {
      const { data } = await api.post<Rfi>(
        `/projects/${projectId}/rfis/${rfiId}/convert-to-change`,
      );
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: rfiKeys.all(projectId) }),
  });
}
