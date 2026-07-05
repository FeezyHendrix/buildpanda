import api from "./client";
import type { SearchResults } from "@/lib/project-types";

export const searchApi = {
  search: (q: string) =>
    api.get<SearchResults>("/search", { params: { q } }).then((r) => r.data),
};
