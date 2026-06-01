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

interface MaterialsNavItem extends ProjectNavItem {
  helper: string;
}

const NAV_ENTRIES: readonly NavEntry[] = [
  { label: "Overview", slug: "overview", Icon: OverviewIcon },
  { label: "Updates", slug: "updates", Icon: UpdatesIcon },
  { label: "Inspections", slug: "inspections", Icon: InspectionsIcon },
  { label: "Action Items", slug: "action-items", Icon: TrendingUpIcon },
  { label: "Queries", slug: "queries", Icon: MessagesIcon },
  { label: "Approvals", slug: "approvals", Icon: InspectionsIcon },
  { label: "Change Requests", slug: "change-requests", Icon: FinancesIcon },
  { label: "Permits", slug: "permits", Icon: DocumentsIcon },
  { label: "Finances", slug: "finances", Icon: FinancesIcon },
  { label: "Documents", slug: "documents", Icon: DocumentsIcon },
  { label: "Team", slug: "team", Icon: ContractorsIcon },
  { label: "Messages", slug: "messages", Icon: MessagesIcon },
  { label: "Panda AI", slug: "panda-ai", Icon: TrendingUpIcon },
  { label: "Settings", slug: "settings", Icon: SettingsIcon },
] as const;

const MATERIALS_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  { label: "Materials", slug: "materials", Icon: MaterialsIcon, helper: "Orders & requests" },
  {
    label: "Equipment Requests",
    slug: "equipment-requests",
    Icon: MaterialsIcon,
    helper: "Rental workflow",
  },
] as const;

const SCHEDULE_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  {
    label: "What's Next",
    slug: "whats-next",
    Icon: TrendingUpIcon,
    helper: "Next 2 weeks",
  },
  {
    label: "Build Stages",
    slug: "stages",
    Icon: OverviewIcon,
    helper: "Phases & progress",
  },
  {
    label: "Key Dates",
    slug: "key-dates",
    Icon: CalendarIcon,
    helper: "Milestone dates",
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
  {
    label: "Milestones",
    slug: "milestones",
    Icon: FinancesIcon,
    helper: "Cost gates",
  },
] as const;

interface ProjectSidebarProps {
  project: Project;
  className?: string;
}

function ProjectSidebar({ project, className }: ProjectSidebarProps) {
  const location = useLocation();
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
  const materialsItems = useMemo<MaterialsNavItem[]>(
    () =>
      MATERIALS_ENTRIES.map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id],
  );

  const isScheduleActive = scheduleItems.some(
    (item) =>
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );
  const isMaterialsActive = materialsItems.some(
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
        <ScheduleNavGroup items={scheduleItems} active={isScheduleActive} />
        {items.slice(2, 9).map((item) => (
          <ProjectNavLink key={item.slug} item={item} />
        ))}
        <MaterialsNavGroup items={materialsItems} active={isMaterialsActive} />
        {items.slice(9).map((item) => (
          <ProjectNavLink key={item.slug} item={item} />
        ))}
      </nav>
    </aside>
  );
}

function ScheduleNavGroup({
  items,
  active,
}: {
  items: ScheduleNavItem[];
  active: boolean;
}) {
  const [open, setOpen] = useState(active);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
          "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "hover:bg-[#EDEDED]/60",
          active ? "text-gray-900" : "text-gray-500 hover:text-gray-900",
        )}
      >
        <CalendarIcon />
        <span className="flex-1 truncate text-left">Schedules</span>
        <ChevronRightIcon
          className={cn(
            "size-4 text-gray-400 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-4">
          {items.map((item) => (
            <ProjectScheduleNavLink key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectScheduleNavLink({ item }: { item: ScheduleNavItem }) {
  const { Icon, label, to } = item;
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500",
          "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "hover:bg-[#EDEDED]/60 hover:text-gray-900",
          isActive && "bg-[#EDEDED] text-gray-900",
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function MaterialsNavGroup({
  items,
  active,
}: {
  items: MaterialsNavItem[];
  active: boolean;
}) {
  const [open, setOpen] = useState(active);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
          "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "hover:bg-[#EDEDED]/60",
          active ? "text-gray-900" : "text-gray-600",
        )}
      >
        <MaterialsIcon className={cn("size-[18px]", active ? "text-[#004DE7]" : "text-gray-500")} />
        <span className="flex-1 text-left">Materials & Equipment</span>
        <ChevronRightIcon className={cn("size-4 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1 pl-7">
          {items.map((item) => (
            <NavLink
              key={item.slug}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-2 text-xs transition-colors",
                  isActive ? "bg-[#E6EFFE] text-[#004DE7]" : "text-gray-500 hover:bg-[#EDEDED]/60 hover:text-gray-900",
                )
              }
            >
              <span className="block font-semibold">{item.label}</span>
              <span className="block text-[11px] opacity-80">{item.helper}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
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
