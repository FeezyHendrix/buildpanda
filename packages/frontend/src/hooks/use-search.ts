import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { searchKeys } from "./query-keys";
import type { SearchResults } from "@/lib/project-mock-data";

const DEBOUNCED_STALE_MS = 30_000;

export function useSearch(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: searchKeys.query(trimmed),
    queryFn: async () => {
      const { data } = await api.get<SearchResults>("/search", {
        params: { q: trimmed },
      });
      return data;
    },
    enabled: trimmed.length > 0,
    staleTime: DEBOUNCED_STALE_MS,
  });
}
