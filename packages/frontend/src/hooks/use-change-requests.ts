import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeRequestsApi,
  type ChangeActionInput,
  type ChangeRequestBudgetLink,
  type ChangeRequestInput,
  type ChangeRequestSummary,
} from "@/api/change-requests";
import { changeRequestKeys, financeKeys, keyDateKeys, stageKeys } from "./query-keys";
import type { ChangeAction, ChangeStatus } from "@/lib/project-types";

export type { ChangeActionInput, ChangeRequestInput, ChangeRequestBudgetLink, ChangeRequestSummary };

export function useChangeRequests(projectId: string | undefined, status?: ChangeStatus) {
  return useQuery({
    queryKey: changeRequestKeys.list(projectId ?? "__none__", status),
    queryFn: () => changeRequestsApi.list(projectId!, status),
    enabled: Boolean(projectId),
  });
}

/** Status counts for the cards; the endpoint may not be live yet, so a failure reads as "no data" (cards show a dash). */
export function useChangeRequestSummary(projectId: string | undefined) {
  return useQuery({
    queryKey: changeRequestKeys.summary(projectId ?? "__none__"),
    queryFn: () => changeRequestsApi.summary(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useChangeRequest(projectId: string | undefined, changeId: string | undefined) {
  return useQuery({
    queryKey: changeRequestKeys.detail(projectId ?? "__none__", changeId ?? "__none__"),
    queryFn: () => changeRequestsApi.detail(projectId!, changeId!),
    enabled: Boolean(projectId && changeId),
  });
}

export function useCreateChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: ChangeRequestInput & { projectId: string }) =>
      changeRequestsApi.create(projectId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: changeRequestKeys.all(projectId) }),
  });
}

export function useUpdateChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      changeId,
      ...body
    }: Partial<ChangeRequestInput> & { projectId: string; changeId: string }) =>
      changeRequestsApi.update(projectId, changeId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: changeRequestKeys.all(projectId) }),
  });
}

/**
 * The only way the ladder moves: submit, approve, reject (with a reason),
 * resubmit, execute. Executing an approved change shifts the stage it was
 * claimed against and awards EOT days, so the programme is refreshed too.
 */
export function useChangeRequestAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      changeId,
      action,
      ...body
    }: ChangeActionInput & { projectId: string; changeId: string; action: ChangeAction }) =>
      changeRequestsApi.action(projectId, changeId, action, body),
    onSuccess: (_d, { projectId }) => {
      qc.invalidateQueries({ queryKey: changeRequestKeys.all(projectId) });
      qc.invalidateQueries({ queryKey: financeKeys.all(projectId) });
      qc.invalidateQueries({ queryKey: stageKeys.all(projectId) });
      qc.invalidateQueries({ queryKey: keyDateKeys.all(projectId) });
    },
  });
}

export function useDeleteChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, changeId }: { projectId: string; changeId: string }) =>
      changeRequestsApi.remove(projectId, changeId),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: changeRequestKeys.all(projectId) }),
  });
}

export function useAddChangeComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      changeId,
      body,
    }: {
      projectId: string;
      changeId: string;
      body: { content: string; internalOnly?: boolean };
    }) => changeRequestsApi.addComment(projectId, changeId, body),
    onSuccess: (_d, { projectId, changeId }) =>
      qc.invalidateQueries({ queryKey: changeRequestKeys.detail(projectId, changeId) }),
  });
}

export function useChangeRequestBudgetLinks(
  projectId: string | undefined,
  changeId: string | undefined,
) {
  return useQuery({
    queryKey: [
      ...changeRequestKeys.detail(projectId ?? "__none__", changeId ?? "__none__"),
      "budget-links",
    ],
    queryFn: () => changeRequestsApi.listBudgetLinks(projectId!, changeId!),
    enabled: Boolean(projectId && changeId),
  });
}

export function useSetChangeRequestBudgetLinks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      changeId,
      links,
    }: {
      projectId: string;
      changeId: string;
      links: ChangeRequestBudgetLink[];
    }) => changeRequestsApi.setBudgetLinks(projectId, changeId, links),
    onSuccess: (_d, { projectId, changeId }) => {
      qc.invalidateQueries({ queryKey: changeRequestKeys.detail(projectId, changeId) });
      qc.invalidateQueries({ queryKey: ["projects", projectId, "budget"] });
    },
  });
}
