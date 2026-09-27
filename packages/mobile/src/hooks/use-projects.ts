import { projectsApi } from "@/api/projects";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { projectKeys } from "./query-keys";

export function useProjects() {
  const { organizationId, storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: projectKeys.list(organizationId),
    ownerId: storageOwnerId,
    queryFn: projectsApi.list,
    enabled: Boolean(organizationId),
  });
}

export function useProject(projectId: string | undefined) {
  const { storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: projectKeys.detail(projectId),
    ownerId: storageOwnerId,
    queryFn: () => projectsApi.detail(projectId!),
    enabled: Boolean(projectId),
  });
}
