import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SettingsIcon } from "@/components/atoms/settings-icon";
import {
  BackArrowIcon,
  CalendarIcon,
  ChevronRightIcon,
  ContractorsIcon,
  DocumentsIcon,
  FinancesIcon,
  InspectionsIcon,
  MaterialsIcon,
  MessagesIcon,
  SparkleIcon,
  TrendingUpIcon,
} from "@/components/atoms/project-nav-icons";
import { cn } from "@/lib/utils";
import type { Project, ProjectAccess } from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { useProjectChannels, useAllChannels } from "@/hooks/use-chat";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

import {
  SidebarNavGroup,
  ProjectNavLink,
} from "./project-sidebar/nav-components";
import {
  NAV_ENTRIES,
  MATERIALS_ENTRIES,
  SCHEDULE_ENTRIES,
  SITE_CONTROL_ENTRIES,
  FINANCE_ENTRIES,
  CLIENT_ENTRIES,
  type ProjectNavItem,
  type GroupNavItem,
} from "./project-sidebar/constants";
interface ProjectSidebarProps {
  project: Project;
  className?: string;
  access?: ProjectAccess;
  open?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
}

// Desktop-only preference: hide the sidebar entirely to give the main pane
// full width. The mobile slide-over is a separate mechanism (`open` prop).
const COLLAPSE_PREF_KEY = "prefs:v1:project-sidebar-collapsed";

function readCollapsedPref(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsedPref(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSE_PREF_KEY, collapsed ? "1" : "0");
  } catch {
    // Private mode / quota — the toggle still works for the session.
  }
}

function ProjectSidebar({ project, className, access, open = false, onClose, onOpen }: ProjectSidebarProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsedPref);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      writeCollapsedPref(!prev);
      return !prev;
    });
  };
  const isClient = access?.relationship !== "company";
  const { data: channels = [] } = useProjectChannels(project.id);
  const { data: allChannels = [] } = useAllChannels();
  // DMs are global (project_id null), so they are NOT returned by the per-project
  // channels endpoint. Count this project's channels plus the user's DM channels
  // so a direct message also bumps the Messages badge.
  const dmChannels = allChannels.filter((c) => c.type === "dm");
  const totalUnread =
    channels.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0) +
    dmChannels.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  const { data: flagsData } = useFeatureFlags();
  const enabledKeys = useMemo(
    () => new Map((flagsData?.flags ?? []).map((f) => [f.key, f.enabled])),
    [flagsData],
  );
  const isOn = (key?: string) => !key || (enabledKeys.get(key) ?? true);

  const items = useMemo<ProjectNavItem[]>(
    () =>
      NAV_ENTRIES.filter((e) => isOn(e.flag)).map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id, enabledKeys],
  );
  const scheduleItems = useMemo<GroupNavItem[]>(
    () =>
      SCHEDULE_ENTRIES.filter((e) => isOn(e.flag)).map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id, enabledKeys],
  );
  const materialsItems = useMemo<GroupNavItem[]>(
    () =>
      MATERIALS_ENTRIES.filter((e) => isOn(e.flag)).map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id, enabledKeys],
  );
  const siteControlItems = useMemo<GroupNavItem[]>(
    () =>
      SITE_CONTROL_ENTRIES.filter((e) => isOn(e.flag)).map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id, enabledKeys],
  );
  const financeItems = useMemo<GroupNavItem[]>(
    () =>
      FINANCE_ENTRIES.filter((e) => isOn(e.flag)).map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id, enabledKeys],
  );
  const clientItems = useMemo<ProjectNavItem[]>(
    () =>
      CLIENT_ENTRIES.filter((e) => isOn(e.flag)).map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id, enabledKeys],
  );

  const isScheduleActive = scheduleItems.some(
    (item) =>
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`),
  );
  const isMaterialsActive = materialsItems.some(
    (item) =>
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`),
  );
  const isSiteControlActive = siteControlItems.some(
    (item) =>
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`),
  );
  const isFinanceActive = financeItems.some(
    (item) =>
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`),
  );

  return (
    <>
      {/* Mobile backdrop */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      >
        {/* <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
          className="absolute top-4 left-[276px] flex size-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
        >
          <XIcon />
        </button> */}
      </div>

      {/* Wrapper handles positioning & slide animation; tab hangs off the right edge */}
      <div
        className={cn(
          "relative",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:inset-auto lg:z-auto lg:translate-x-0 lg:max-h-full lg:shrink-0",
        )}
      >
        {/* Pull-tab — peeks from left edge of screen when sidebar is closed (mobile only) */}
        <button
          type="button"
          onClick={open ? onClose : onOpen}
          aria-label={open ? "Close sidebar" : "Open sidebar"}
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 translate-x-full",
            "flex h-14 w-7 items-center justify-center",
            "rounded-r-xl border border-l-0 border-[#F0F0F0] bg-white shadow-sm",
            "lg:hidden",
          )}
        >
          <ChevronRightIcon className={cn("size-4 text-gray-400 transition-transform duration-300", open && "rotate-180")} />
        </button>

        {/* Desktop pull-tab — hides/shows the whole sidebar for a full-width main pane */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
          className={cn(
            "absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-full",
            "hidden h-14 w-7 items-center justify-center lg:flex",
            "rounded-r-xl border border-l-0 border-[#F0F0F0] bg-white shadow-sm",
            "text-gray-400 hover:text-gray-600",
          )}
        >
          <ChevronRightIcon className={cn("size-4 transition-transform duration-300", !collapsed && "rotate-180")} />
        </button>

      <aside
        className={cn(
          "flex h-full flex-col overflow-hidden border-r border-[#F0F0F0] bg-white w-[260px]",
          "transition-[width] duration-300 ease-in-out",
          collapsed && "lg:w-0 lg:border-r-0",
          className,
        )}
      >
      <div className="flex h-full w-[260px] shrink-0 flex-col gap-6 px-4 py-6">
      <Link
        to={isClient ? "/my-build" : "/dashboard"}
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-gray-600",
          "outline-none transition-colors hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/10",
        )}
      >
        <BackArrowIcon className="size-4" />
        Projects
      </Link>

      <div className="bg-white">
        <div className="flex items-start gap-3">
          <ReactSVG src={icons.coloredFolder} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {project.name}
            </p>
            <p className="line-clamp-2 text-xs text-gray-500">
              {project.address}
            </p>
          </div>
        </div>
      </div>

      {isClient ? (
        <nav data-tour="project-nav" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1 no-scrollbar">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            My build
          </p>
          {clientItems.map((entry) => (
            <ProjectNavLink
              key={entry.slug}
              item={{ ...entry, to: `/project/${project.id}/${entry.slug}` }}
              onClose={onClose}
            />
          ))}
        </nav>
      ) : (
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1 no-scrollbar">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Main menu
          </p>
          {items.slice(0, 2).map((item) => (
            <ProjectNavLink key={item.slug} item={item} onClose={onClose} />
          ))}
          {isOn("projects.schedule") && (
            <ProjectNavLink
              item={{
                label: "Tasks",
                slug: "tasks",
                Icon: TrendingUpIcon,
                to: `/project/${project.id}/tasks`,
              }}
              onClose={onClose}
          />
          )}
          {scheduleItems.length > 0 && (
            <SidebarNavGroup
              label="Schedules"
              Icon={CalendarIcon}
              items={scheduleItems}
              active={isScheduleActive}
              onClose={onClose}
          />
          )}
          {siteControlItems.length > 0 && (
            <SidebarNavGroup
              label="Site Control"
              Icon={InspectionsIcon}
              items={siteControlItems}
              active={isSiteControlActive}
              onClose={onClose}
          />
          )}
          {materialsItems.length > 0 && (
            <SidebarNavGroup
              label="Materials & Equipment"
              Icon={MaterialsIcon}
              items={materialsItems}
              active={isMaterialsActive}
              activeIconClassName="text-[#004DE7]"
              onClose={onClose}
          />
          )}
          {financeItems.length > 0 && (
            <SidebarNavGroup
              label="Finance"
              Icon={FinancesIcon}
              items={financeItems}
              active={isFinanceActive}
              onClose={onClose}
          />
          )}
          {isOn("projects.documents") && (
            <ProjectNavLink
              item={{
                label: "Documents",
                slug: "documents",
                Icon: DocumentsIcon,
                to: `/project/${project.id}/documents`,
              }}
              onClose={onClose}
          />
          )}
          {isOn("project.team") && (
            <ProjectNavLink
              item={{
                label: "Team",
                slug: "team",
                Icon: ContractorsIcon,
                to: `/project/${project.id}/team`,
              }}
              onClose={onClose}
          />
          )}
          {isOn("collaboration.messaging") && (
            <ProjectNavLink
              item={{
                label: "Messages",
                slug: "chat",
                Icon: MessagesIcon,
                to: `/project/${project.id}/chat`,
                badge: totalUnread > 0 ? totalUnread : undefined,
              }}
              onClose={onClose}
          />
          )}
          <ProjectNavLink
            item={{
              label: "Panda AI",
              slug: "panda-ai",
              Icon: SparkleIcon,
              to: `/project/${project.id}/panda-ai`,
            }}
            onClose={onClose}
          />
          <ProjectNavLink
            item={{
              label: "Settings",
              slug: "settings",
              Icon: SettingsIcon,
              to: `/project/${project.id}/settings`,
            }}
            onClose={onClose}
          />
        </nav>
      )}
      </div>
      </aside>
      </div>
    </>
  );
}


ProjectSidebar.displayName = "ProjectSidebar";

export default ProjectSidebar;
export { ProjectSidebar, type ProjectSidebarProps };
