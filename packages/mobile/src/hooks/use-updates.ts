import { updatesApi } from "@/api/updates";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { updateKeys } from "./query-keys";

export function useProjectUpdates(projectId: string | undefined) {
  const { storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: updateKeys.list(projectId),
    ownerId: storageOwnerId,
    queryFn: () => updatesApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}
