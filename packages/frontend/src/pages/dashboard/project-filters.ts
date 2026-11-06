import type { Project } from "@/lib/project-types";

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

export function matchesProjectFilters(project: Project, { search, from, to }: ProjectFilters): boolean {
  const q = search.trim().toLowerCase();
  if (q && !`${project.name} ${project.address}`.toLowerCase().includes(q)) return false;
  const created = project.createdAt.slice(0, 10);
  return (!from || created >= from) && (!to || created <= to);
}

function time(value: string): number {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

const COMPARE: Record<ProjectSort, (a: Project, b: Project) => number> = {
  recent: (a, b) => time(b.updatedAt) - time(a.updatedAt),
  "name-asc": (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  "name-desc": (a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }),
  newest: (a, b) => time(b.createdAt) - time(a.createdAt),
  oldest: (a, b) => time(a.createdAt) - time(b.createdAt),
};

/** A sorted copy: the cached project list is never reordered in place. */
export function sortProjects(projects: Project[], sort: ProjectSort): Project[] {
  return [...projects].sort(COMPARE[sort]);
}
