import { updatesApi } from "@/api/updates";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { updateKeys } from "./query-keys";
import { useMemo } from "react";
import { useStageScope } from "@/lib/stage-scope";
import { effectiveStageId, matchesStage } from "@/lib/stage-filter";

export function useProjectUpdates(projectId: string | undefined, scoped = true) {
  const { storageOwnerId } = useFieldSession();
  const { stageId, activityStages } = useStageScope();
  const query = usePersistentQuery({
    queryKey: updateKeys.list(projectId),
    ownerId: storageOwnerId,
    // The server includes drafts for anyone who could publish them. Field
    // Tools is for what has been posted, so drafts never reach the feed or
    // the offline cache.
    queryFn: async () => (await updatesApi.list(projectId!)).filter((update) => !update.isDraft),
    enabled: Boolean(projectId),
  });
  const data = useMemo(() => query.data?.filter((row) => !row.isDraft &&
    (!scoped || matchesStage(effectiveStageId(row, activityStages), stageId))),
  [query.data, scoped, stageId, activityStages]);
  return { ...query, data };
}
