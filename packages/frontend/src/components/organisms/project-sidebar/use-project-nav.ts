import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { extraRouteGroup } from "@/layouts/use-project-breadcrumbs";
import { canViewSection } from "@/lib/project-types";
import type { Project, ProjectAccess } from "@/lib/project-types";
import {
  NAV_ENTRIES,
  MATERIALS_ENTRIES,
  SCHEDULE_ENTRIES,
  SITE_TOOL_ENTRIES,
  DOCUMENT_TOOL_ENTRIES,
  FINANCE_ENTRIES,
  CLIENT_ENTRIES,
  type NavEntry,
  type ProjectNavItem,
  type GroupNavItem,
} from "./constants";

export interface ProjectNav {
  isOn: (key?: string) => boolean;
  items: ProjectNavItem[];
  scheduleItems: GroupNavItem[];
  materialsItems: GroupNavItem[];
  siteToolItems: GroupNavItem[];
  documentToolItems: ProjectNavItem[];
  financeItems: GroupNavItem[];
  clientItems: ProjectNavItem[];
  isScheduleActive: boolean;
  isMaterialsActive: boolean;
  isFieldToolsActive: boolean;
  isFinanceActive: boolean;
}

function isUnder(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Resolves the sidebar's entries for one project against feature flags and the viewer's access. */
export function useProjectNav(project: Project, access: ProjectAccess | undefined): ProjectNav {
  const location = useLocation();
  const { data: flagsData } = useFeatureFlags();
  const enabledKeys = useMemo(
    () => new Map((flagsData?.flags ?? []).map((f) => [f.key, f.enabled])),
    [flagsData],
  );

  return useMemo(() => {
    const isOn = (key?: string) => !key || (enabledKeys.get(key) ?? true);
    const resolve = <T extends NavEntry>(entries: readonly T[]) =>
      entries
        .filter((e) => isOn(e.flag) && canViewSection(access, e.flag, e.resource))
        .map((entry) => ({ ...entry, to: `/project/${project.id}/${entry.slug}` }));

    const scheduleItems = resolve(SCHEDULE_ENTRIES);
    const materialsItems = resolve(MATERIALS_ENTRIES);
    const siteToolItems = resolve(SITE_TOOL_ENTRIES);
    const financeItems = resolve(FINANCE_ENTRIES);
    const extraGroup = extraRouteGroup(location.pathname, project.id);
    const activeIn = (list: { to: string }[], heading: string) =>
      extraGroup === heading || list.some((item) => isUnder(location.pathname, item.to));

    return {
      isOn,
      items: resolve(NAV_ENTRIES),
      scheduleItems,
      materialsItems,
      siteToolItems,
      documentToolItems: resolve(DOCUMENT_TOOL_ENTRIES),
      financeItems,
      clientItems: resolve(CLIENT_ENTRIES),
      isScheduleActive: activeIn(scheduleItems, "Schedules"),
      isMaterialsActive: activeIn(materialsItems, "Materials & Equipment"),
      isFieldToolsActive: activeIn(siteToolItems, "Field Tools"),
      isFinanceActive: activeIn(financeItems, "Finance"),
    };
  }, [enabledKeys, access, project.id, location.pathname]);
}
