import { activitiesApi } from "@/api/activities";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { activityKeys } from "./query-keys";

export function useActivities(projectId: string | undefined, enabled = true) {
  const { storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: activityKeys.list(projectId),
    ownerId: storageOwnerId,
    queryFn: () => activitiesApi.list(projectId!),
    enabled: enabled && Boolean(projectId),
  });
}

/** The delay reasons a crew member can pick when work did not go to plan. */
export function useDelayReasons() {
  const { storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: ["delay-reasons"],
    ownerId: storageOwnerId,
    queryFn: activitiesApi.delayReasons,
  });
}
