import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  inspectionCategoriesApi,
  type CreateInspectionCategoryInput,
} from "@/api/inspection-categories";
import { inspectionCategoryKeys } from "./query-keys";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * The list a project inspects against: BuildPanda's global catalogue plus this
 * workspace's own additions. Archived categories are left out by the API.
 */
export function useInspectionCategories(projectId: string | undefined) {
  return useQuery({
    queryKey: inspectionCategoryKeys.list(projectId ?? "__none__"),
    queryFn: () => inspectionCategoriesApi.list(projectId!),
    enabled: Boolean(projectId),
    staleTime: FIVE_MINUTES_MS,
  });
}

/** Adding to the list. The API refuses anyone who is not a workspace admin. */
export function useCreateInspectionCategory(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInspectionCategoryInput) =>
      inspectionCategoriesApi.create(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inspectionCategoryKeys.all(projectId) });
    },
  });
}
