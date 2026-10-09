import { useMemo } from "react";
import { useStageScope } from "@/contexts/stage-scope-context";
import { useProjectActivities } from "@/hooks/use-activities";
import { stageActivityIds } from "@/lib/stage-filter";

/** Only activity-linked registers need the programme lookup, and only with a stage selected. */
export function useStageActivities(projectId: string) {
  const { selectedStageId } = useStageScope();
  const { data: activities = [], isLoading, error, refetch } = useProjectActivities(selectedStageId ? projectId : undefined);
  const activityIds = useMemo(() => stageActivityIds(activities, selectedStageId), [activities, selectedStageId]);
  return { activityIds, isLoading, error, refetch };
}
