import { useQuery } from "@tanstack/react-query";
import { activityReferencesApi } from "@/api/activity-references";
import { activityKeys } from "./query-keys";

/** What a delete would take with it: look-aheads referencing the activity, and its delays. */
export function useActivityReferences(projectId: string | undefined, activityId: string | undefined) {
  return useQuery({
    queryKey: activityKeys.references(projectId ?? "__none__", activityId ?? "__none__"),
    queryFn: () => activityReferencesApi.get(projectId!, activityId!),
    enabled: Boolean(projectId && activityId),
  });
}
