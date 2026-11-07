
export type ProjectSort = "recent" | "name-asc" | "name-desc" | "newest" | "oldest";

export const SORT_OPTIONS: { value: ProjectSort; label: string }[] = [
  { value: "recent", label: "Recently Updated" },
  { value: "name-asc", label: "Project Name (A - Z)" },
  { value: "name-desc", label: "Project Name (Z - A)" },
  { value: "newest", label: "Date (Newest First)" },
  { value: "oldest", label: "Date (Oldest First)" },
];

export interface ProjectFilters {
  search: string;
  /** yyyy-mm-dd, inclusive; compared with the day the project was created. */
  from: string;
  to: string;
}

export const NO_PROJECT_FILTERS: ProjectFilters = { search: "", from: "", to: "" };

export function isFiltering(filters: ProjectFilters): boolean {
  return filters.search.trim() !== "" || filters.from !== "" || filters.to !== "";
}
