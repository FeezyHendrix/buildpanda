import { useQueries } from "@tanstack/react-query";
import { personalWorkApi } from "@/api/personal-work";
import { useSession } from "@/stores/auth";
import { personalWorkKeys } from "./personal-work-keys";

export function usePersonalWork(projects: readonly { id: string; name: string }[]) {
  const { data: session } = useSession();
  const userId = session?.user.id ?? "";
  const queries = useQueries({ queries: projects.map(project => ({
    queryKey: personalWorkKeys.user(project.id, userId),
    queryFn: () => personalWorkApi.list(project.id, userId),
    enabled: Boolean(userId),
    staleTime: 30_000,
  })) });
  const items = queries.flatMap((query, index) => (query.data ?? []).map(item => ({ ...item, projectName: projects[index]!.name })));
  items.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  return {
    items,
    pending: queries.some(query => query.isPending),
    error: queries.find(query => query.error)?.error,
    refresh: () => Promise.all(queries.map(query => query.refetch())),
  };
}
