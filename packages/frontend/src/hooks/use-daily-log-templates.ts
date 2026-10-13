import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dailyLogTemplatesApi,
  type CreateDailyLogTemplateInput,
  type UpdateDailyLogTemplateInput,
} from "@/api/daily-log-templates";
import { dailyLogTemplateKeys } from "./query-keys";

export function useDailyLogTemplates(projectId: string | undefined, includeArchived = false) {
  return useQuery({
    queryKey: dailyLogTemplateKeys.list(projectId ?? "", includeArchived),
    queryFn: () => dailyLogTemplatesApi.list(projectId!, includeArchived),
    enabled: Boolean(projectId),
  });
}

function useInvalidate(projectId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: dailyLogTemplateKeys.all(projectId) });
}

export function useCreateDailyLogTemplate(projectId: string) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: (input: CreateDailyLogTemplateInput) => dailyLogTemplatesApi.create(projectId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateDailyLogTemplate(projectId: string) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateDailyLogTemplateInput & { id: string }) =>
      dailyLogTemplatesApi.update(projectId, id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteDailyLogTemplate(projectId: string) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: (templateId: string) => dailyLogTemplatesApi.remove(projectId, templateId),
    onSuccess: invalidate,
  });
}
