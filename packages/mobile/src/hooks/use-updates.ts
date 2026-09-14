import { updatesApi } from "@/api/updates";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { updateKeys } from "./query-keys";

export function useProjectUpdates(projectId: string | undefined) {
  const { storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: updateKeys.list(projectId),
    ownerId: storageOwnerId,
    // The server includes drafts for anyone who could publish them. Field
    // Tools is for what has been posted, so drafts never reach the feed or
    // the offline cache.
    queryFn: async () => (await updatesApi.list(projectId!)).filter((update) => !update.isDraft),
    enabled: Boolean(projectId),
  });
}
