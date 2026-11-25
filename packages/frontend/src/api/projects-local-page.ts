/**
 * TEMPORARY — delete this file and the `Array.isArray` branch in `projectsApi.page`
 * (api/projects.ts) once staging runs a backend with paging on `GET /projects`.
 *
 * Why it exists: search, date range, sort and paging for the dashboard were added to the
 * backend on `buildpanda-v2` only. A backend without them ignores those query params and
 * answers with the plain array, which the dashboard would read as `total: 0` and show as an
 * empty workspace. This does what the new backend does, in the browser, over the array.
 */
import type { Project } from "@/lib/project-types";
import type { ProjectPageQuery } from "./projects";

export interface ProjectPage {
  items: Project[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 12;

function time(value: string): number {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

const COMPARE: Record<NonNullable<ProjectPageQuery["sort"]>, (a: Project, b: Project) => number> = {
  recent: (a, b) => time(b.updatedAt) - time(a.updatedAt),
  name_asc: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  name_desc: (a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }),
  newest: (a, b) => time(b.createdAt) - time(a.createdAt),
  oldest: (a, b) => time(a.createdAt) - time(b.createdAt),
};

/** Filters, sorts and slices a plain project list the way the paged endpoint would. */
export function pageProjectsLocally(projects: Project[], query: ProjectPageQuery): ProjectPage {
  const q = (query.q ?? "").trim().toLowerCase();
  const matching = projects.filter((project) => {
    if (q && !`${project.name} ${project.address}`.toLowerCase().includes(q)) return false;
    const created = project.createdAt.slice(0, 10);
    return (!query.createdFrom || created >= query.createdFrom) && (!query.createdTo || created <= query.createdTo);
  });
  const sorted = [...matching].sort(COMPARE[query.sort ?? "recent"]);
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = Math.min(query.page ?? 1, Math.max(1, Math.ceil(sorted.length / pageSize)));
  return { items: sorted.slice((page - 1) * pageSize, page * pageSize), total: sorted.length, page, pageSize };
}
