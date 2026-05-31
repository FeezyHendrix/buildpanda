import { useMemo, useState, type ComponentType, type SVGAttributes } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { IconBox } from "@/components/atoms/icon-box";
import { SettingsIcon } from "@/components/atoms/settings-icon";
import {
  BackArrowIcon,
  CalendarIcon,
  ChevronRightIcon,
  ContractorsIcon,
  DocumentsIcon,
  FinancesIcon,
  FolderIcon,
  InspectionsIcon,
  MaterialsIcon,
  MessagesIcon,
  OverviewIcon,
  TrendingUpIcon,
  UpdatesIcon,
} from "@/components/atoms/project-nav-icons";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/project-mock-data";

type IconComponent = ComponentType<SVGAttributes<SVGSVGElement>>;

interface NavEntry {
  label: string;
  slug: string;
  Icon: IconComponent;
}

interface ProjectNavItem extends NavEntry {
  to: string;
}

interface ScheduleNavItem extends ProjectNavItem {
  helper: string;
}

const NAV_ENTRIES: readonly NavEntry[] = [
  { label: "Overview", slug: "overview", Icon: OverviewIcon },
  { label: "Updates", slug: "updates", Icon: UpdatesIcon },
  { label: "Inspections", slug: "inspections", Icon: InspectionsIcon },
  { label: "Action Items", slug: "action-items", Icon: TrendingUpIcon },
  { label: "Finances", slug: "finances", Icon: FinancesIcon },
  { label: "Documents", slug: "documents", Icon: DocumentsIcon },
  { label: "Materials", slug: "materials", Icon: MaterialsIcon },
  { label: "Team", slug: "team", Icon: ContractorsIcon },
  { label: "Messages", slug: "messages", Icon: MessagesIcon },
  { label: "Settings", slug: "settings", Icon: SettingsIcon },
] as const;

const SCHEDULE_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  {
    label: "Build Stages",
    slug: "stages",
    Icon: OverviewIcon,
    helper: "Phases & progress",
  },
  {
    label: "Site Activity",
    slug: "activities",
    Icon: TrendingUpIcon,
    helper: "Work items",
  },
  {
    label: "Daily Log",
    slug: "daily-log",
    Icon: CalendarIcon,
    helper: "Field reports",
  },
  {
    label: "Project Chart",
    slug: "project-chart",
    Icon: CalendarIcon,
    helper: "Gantt chart",
  },
] as const;

interface ProjectSidebarProps {
  project: Project;
  className?: string;
}

function ProjectSidebar({ project, className }: ProjectSidebarProps) {
  const location = useLocation();
  const [scheduleOpen, setScheduleOpen] = useState(() =>
    location.pathname.includes("/stages") ||
    location.pathname.includes("/activities") ||
    location.pathname.includes("/daily-log") ||
    location.pathname.includes("/project-chart"),
  );
  const items = useMemo<ProjectNavItem[]>(
    () =>
      NAV_ENTRIES.map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id],
  );
  const scheduleItems = useMemo<ScheduleNavItem[]>(
    () =>
      SCHEDULE_ENTRIES.map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id],
  );

  const isScheduleActive = scheduleItems.some(
    (item) =>
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );

  return (
    <aside
      className={cn(
        "flex w-[260px] shrink-0 flex-col gap-6 border-r border-[#F0F0F0] bg-[#FAFAFA] px-4 py-6",
        className,
      )}
    >
      <Link
        to="/dashboard"
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-gray-600",
          "outline-none transition-colors hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/10",
        )}
      >
        <BackArrowIcon className="size-4" />
        Projects
      </Link>

      <div className="rounded-2xl border border-[#EDEDED] bg-white p-3">
        <div className="flex items-start gap-3">
          <IconBox
            tone={project.folderTone}
            size="md"
            icon={<FolderIcon className="size-5" />}
          />
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

      <nav className="flex flex-1 flex-col gap-1">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Main menu
        </p>
        {items.slice(0, 2).map((item) => (
          <ProjectNavLink key={item.slug} item={item} />
        ))}
        <ScheduleNavGroup
          items={scheduleItems}
          active={isScheduleActive}
          open={scheduleOpen}
          onToggle={() => setScheduleOpen((open) => !open)}
        />
        {items.slice(2).map((item) => (
          <ProjectNavLink key={item.slug} item={item} />
        ))}
      </nav>
    </aside>
  );
}

function ScheduleNavGroup({
  items,
  active,
  open,
  onToggle,
}: {
  items: ScheduleNavItem[];
  active: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl bg-white/70 p-1 ring-1 ring-[#EDEDED]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-semibold",
          "outline-none transition-colors hover:bg-[#EDEDED]/60 focus-visible:ring-2 focus-visible:ring-gray-900/10",
          active ? "text-gray-900" : "text-gray-600",
        )}
      >
        <CalendarIcon />
        <span className="flex-1 truncate">Schedules</span>
        <ChevronRightIcon
          className={cn("size-4 text-gray-400 transition-transform", open && "rotate-90")}
        />
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1 border-l border-[#E5E7EB] pl-3">
          {items.map((item) => (
            <ProjectScheduleNavLink key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectScheduleNavLink({ item }: { item: ScheduleNavItem }) {
  const { Icon, label, helper, to } = item;
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-gray-500",
          "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "hover:bg-[#EDEDED]/60 hover:text-gray-900",
          isActive && "bg-[#EDEDED] text-gray-900",
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        <span className="block truncate text-[10px] font-normal text-gray-400">
          {helper}
        </span>
      </span>
    </NavLink>
  );
}

function ProjectNavLink({ item }: { item: ProjectNavItem }) {
  const { Icon, label, to } = item;
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500",
          "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "hover:bg-[#EDEDED]/60 hover:text-gray-900",
          isActive && "bg-[#EDEDED] text-gray-900",
        )
      }
    >
      <Icon />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

ProjectSidebar.displayName = "ProjectSidebar";

export default ProjectSidebar;
export { ProjectSidebar, type ProjectSidebarProps };
