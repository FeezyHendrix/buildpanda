import { useLocation } from "react-router-dom";
import type { BreadcrumbItem } from "@/components/molecules/breadcrumbs";
import {
  CLIENT_ENTRIES,
  DOCUMENT_TOOL_ENTRIES,
  FINANCE_ENTRIES,
  MATERIALS_ENTRIES,
  NAV_ENTRIES,
  SCHEDULE_ENTRIES,
  SITE_TOOL_ENTRIES,
  type NavEntry,
} from "@/components/organisms/project-sidebar/constants";
import { FINANCE_TABBED_PAGES } from "@/lib/finance-routes";
import type { Project } from "@/lib/project-types";

/**
 * Derives the breadcrumb trail for the current project route from the sidebar
 * config, so every page gets `Project › Group › Page` without typing it.
 */

type GroupHeading =
  | "Schedules"
  | "Field Tools"
  | "Materials & Equipment"
  | "Finance"
  | "Documents"
  | "Buildings";

interface Group {
  heading: GroupHeading;
  entries: readonly NavEntry[];
}

// Headings mirror the group labels rendered in `project-sidebar.tsx`.
const GROUPS: readonly Group[] = [
  { heading: "Schedules", entries: SCHEDULE_ENTRIES },
  { heading: "Field Tools", entries: SITE_TOOL_ENTRIES },
  { heading: "Materials & Equipment", entries: MATERIALS_ENTRIES },
  { heading: "Finance", entries: FINANCE_ENTRIES },
  { heading: "Documents", entries: DOCUMENT_TOOL_ENTRIES },
];

/** Route tail each group crumb links to: the first entry of the group. */
const GROUP_LINK: Record<GroupHeading, string> = {
  Schedules: SCHEDULE_ENTRIES[0]!.slug,
  "Field Tools": SITE_TOOL_ENTRIES[0]!.slug,
  "Materials & Equipment": MATERIALS_ENTRIES[0]!.slug,
  Finance: FINANCE_ENTRIES[0]!.slug,
  Documents: "documents",
  Buildings: "buildings",
};

interface ExtraRoute {
  label: string;
  group?: GroupHeading;
  /** An intermediate crumb between the group and the page (e.g. Plans › Review). */
  via?: { label: string; to: string };
}

/**
 * Routes in `App.tsx` that are not sidebar entries. Keys are route tails;
 * a `:param` segment matches any single path segment.
 */
const EXTRA_ROUTES = {
  tasks: { label: "Tasks" },
  chat: { label: "Messages" },
  messages: { label: "Messages" },
  settings: { label: "Settings" },
  "panda-ai": { label: "Panda AI" },
  team: { label: "Team" },
  people: { label: "People" },
  documents: { label: "Documents" },
  "action-items": { label: "Action items" },
  queries: { label: "Queries" },
  selections: { label: "Selections" },
  permits: { label: "Permits" },
  inspections: { label: "Inspections", group: "Field Tools" },
  "daily-log": { label: "Daily log", group: "Field Tools" },
  "plans/review": { label: "Review", group: "Field Tools", via: { label: "Plans", to: "plans" } },
  "whats-next": { label: "What's next", group: "Schedules" },
  "schedules/whats-next": { label: "What's next", group: "Schedules" },
  "key-dates": { label: "Key dates", group: "Schedules" },
  activities: { label: "Site activity", group: "Schedules" },
  "activities/:activityId": { label: "Site activity", group: "Schedules" },
  "project-chart": { label: "Project chart", group: "Schedules" },
  schedule: { label: "Project chart", group: "Schedules" },
  stages: { label: "Build stages", group: "Schedules" },
  buildings: { label: "Buildings" },
  "buildings/:buildingId/stages": { label: "Stages", group: "Buildings" },
} as const satisfies Record<string, ExtraRoute>;

function matchesPattern(pattern: string, tail: string): boolean {
  const patternParts = pattern.split("/");
  const tailParts = tail.split("/");
  if (patternParts.length !== tailParts.length) return false;
  return patternParts.every((part, i) => part.startsWith(":") || part === tailParts[i]);
}

function findExtraRoute(tail: string): ExtraRoute | undefined {
  const key = (Object.keys(EXTRA_ROUTES) as (keyof typeof EXTRA_ROUTES)[]).find((pattern) =>
    matchesPattern(pattern, tail),
  );
  return key ? EXTRA_ROUTES[key] : undefined;
}

function slugMatches(slug: string, tail: string): boolean {
  return tail === slug || tail.startsWith(`${slug}/`);
}

/** Longest-slug-prefix match so `schedules/stages` beats `schedules`. */
function findEntry(entries: readonly NavEntry[], tail: string): NavEntry | undefined {
  let best: NavEntry | undefined;
  for (const entry of entries) {
    if (slugMatches(entry.slug, tail) && (!best || entry.slug.length > best.slug.length)) {
      best = entry;
    }
  }
  return best;
}

function findGroupEntry(tail: string): { group: Group; entry: NavEntry } | undefined {
  let best: { group: Group; entry: NavEntry } | undefined;
  for (const group of GROUPS) {
    const entry = findEntry(group.entries, tail);
    if (entry && (!best || entry.slug.length > best.entry.slug.length)) {
      best = { group, entry };
    }
  }
  return best;
}

function humanise(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function routeTail(pathname: string, projectId: string): string {
  const base = `/project/${projectId}/`;
  return pathname.startsWith(base) ? pathname.slice(base.length).replace(/\/+$/, "") : "";
}

/** Finance pages are tabbed: the trail ends with the active tab (Finance › Contract › Terms). */
function financeTabCrumb(tail: string, search: string): BreadcrumbItem | undefined {
  const tabs = FINANCE_TABBED_PAGES[tail];
  if (!tabs) return undefined;
  const wanted = new URLSearchParams(search).get("tab");
  const tab = tabs.find((t) => t.id === wanted) ?? tabs[0];
  return tab ? { label: tab.label } : undefined;
}

function resolveTrail(tail: string, isClient: boolean, search: string): BreadcrumbItem[] {
  if (tail === "") return [];

  if (isClient) {
    const entry = findEntry(CLIENT_ENTRIES, tail);
    if (entry) return [{ label: entry.label }];
  }

  const topLevel = findEntry(NAV_ENTRIES, tail);
  if (topLevel) return [{ label: topLevel.label }];

  const extra = findExtraRoute(tail);
  if (extra) {
    const items: BreadcrumbItem[] = [];
    if (extra.group) items.push({ label: extra.group, to: GROUP_LINK[extra.group] });
    if (extra.via) items.push(extra.via);
    items.push({ label: extra.label });
    return items;
  }

  const grouped = findGroupEntry(tail);
  if (grouped) {
    const tabCrumb = financeTabCrumb(tail, search);
    return [
      { label: grouped.group.heading, to: GROUP_LINK[grouped.group.heading] },
      tabCrumb ? { label: grouped.entry.label, to: grouped.entry.slug } : { label: grouped.entry.label },
      ...(tabCrumb ? [tabCrumb] : []),
    ];
  }

  return [{ label: humanise(tail.split("/").pop() ?? tail) }];
}

export function useProjectBreadcrumbs(project: Project, isClient: boolean): BreadcrumbItem[] {
  const { pathname, search } = useLocation();
  const prefix = `/project/${project.id}`;
  const trail = resolveTrail(routeTail(pathname, project.id), isClient, search).map((item) =>
    item.to ? { ...item, to: `${prefix}/${item.to}` } : item,
  );
  return [{ label: project.name, to: `${prefix}/overview` }, ...trail];
}
