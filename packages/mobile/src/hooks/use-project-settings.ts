import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, type ProjectSettings } from "@/api/projects";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { projectSettingsKeys } from "./query-keys";

export function useProjectSettings(projectId: string | undefined) {
  const { storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: projectSettingsKeys.detail(projectId),
    ownerId: storageOwnerId,
    queryFn: () => projectsApi.settings(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useUpdateProjectSettings(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: ProjectSettings) => projectsApi.updateSettings(projectId!, settings),
    onSuccess: (settings) => {
      queryClient.setQueryData(projectSettingsKeys.detail(projectId), settings);
    },
  });
}
