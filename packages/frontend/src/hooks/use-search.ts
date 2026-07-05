import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/api/search";
import { searchKeys } from "./query-keys";

const DEBOUNCED_STALE_MS = 30_000;

export function useSearch(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: searchKeys.query(trimmed),
    queryFn: () => searchApi.search(trimmed),
    enabled: trimmed.length > 0,
    staleTime: DEBOUNCED_STALE_MS,
  });
}
