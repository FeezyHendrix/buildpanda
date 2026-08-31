import { stagesApi } from "@/api/stages";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { stageKeys } from "./query-keys";

export function useStages(projectId: string | undefined, enabled = true) {
  const { storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: stageKeys.list(projectId),
    ownerId: storageOwnerId,
    queryFn: () => stagesApi.list(projectId!),
    enabled: enabled && Boolean(projectId),
  });
}
