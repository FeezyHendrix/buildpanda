import { useMemo, useState, type ComponentType, type SVGAttributes } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { SettingsIcon } from "@/components/atoms/settings-icon";
import {
  BackArrowIcon,
  AlertIcon,
  CalendarIcon,
  ChevronRightIcon,
  ContractorsIcon,
  DocumentsIcon,
  FinancesIcon,
  InspectionsIcon,
  MaterialsIcon,
  MessagesIcon,
  OverviewIcon,
  SparkleIcon,
  TrendingUpIcon,
  UpdatesIcon,
} from "@/components/atoms/project-nav-icons";
import { cn } from "@/lib/utils";
import type { Project, ProjectAccess } from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { useProjectChannels } from "@/hooks/use-chat";

type IconComponent = ComponentType<SVGAttributes<SVGSVGElement>>;

interface NavEntry {
  label: string;
  slug: string;
  Icon: IconComponent | string;
}

interface ProjectNavItem extends NavEntry {
  to: string;
  badge?: number;
}

interface GroupNavItem extends ProjectNavItem {
  helper: string;
}

const NAV_ENTRIES: readonly NavEntry[] = [
  { label: "Overview", slug: "overview", Icon: OverviewIcon },
  { label: "Updates", slug: "updates", Icon: UpdatesIcon },
] as const;

const MATERIALS_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  { label: "Materials", slug: "materials", Icon: MaterialsIcon, helper: "Orders & requests" },
  { label: "Material Log", slug: "material-log", Icon: MaterialsIcon, helper: "Stock & audit trail" },
  {
    label: "Equipment Requests",
    slug: "equipment-requests",
    Icon: MaterialsIcon,
    helper: "Rental workflow",
  },
] as const;

const SCHEDULE_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  {
    label: "Build Stages",
    slug: "schedules/stages",
    Icon: OverviewIcon,
    helper: "Phases & progress",
  },
  {
    label: "Key Dates",
    slug: "schedules/key-dates",
    Icon: CalendarIcon,
    helper: "Milestone dates",
  },
  {
    label: "Site Activity",
    slug: "schedules/activities",
    Icon: TrendingUpIcon,
    helper: "Work items",
  },
  {
    label: "Daily Log",
    slug: "schedules/daily-log",
    Icon: CalendarIcon,
    helper: "Field reports",
  },
  {
    label: "Project Chart",
    slug: "schedules/project-chart",
    Icon: CalendarIcon,
    helper: "Gantt chart",
  },
] as const;

const SITE_CONTROL_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  { label: "Inspections", slug: "inspections", Icon: InspectionsIcon, helper: "Quality checks" },
  { label: "Action Items", slug: "action-items", Icon: TrendingUpIcon, helper: "Open blockers" },
  { label: "Queries", slug: "queries", Icon: MessagesIcon, helper: "Field questions" },
  { label: "RFIs", slug: "rfis", Icon: AlertIcon, helper: "Requests for information" },
  // { label: "BIM Models", slug: "bim", Icon: DocumentsIcon, helper: "3D model viewer" },
  { label: "Approvals", slug: "approvals", Icon: InspectionsIcon, helper: "Owner sign-offs" },
  { label: "Change Requests", slug: "change-requests", Icon: FinancesIcon, helper: "Scope changes" },
  { label: "Permits", slug: "permits", Icon: DocumentsIcon, helper: "Authority records" },
] as const;

const FINANCE_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  { label: "Overview", slug: "finances", Icon: FinancesIcon, helper: "Cashflow & escrow" },
  {
    label: "Milestones",
    slug: "milestones",
    Icon: FinancesIcon,
    helper: "Cost gates",
  },
  { label: "Budgeting", slug: "finances/budget", Icon: FinancesIcon, helper: "Cost codes" },
  {
    label: "Budget Allocation",
    slug: "finances/budget-allocation",
    Icon: FinancesIcon,
    helper: "Planned vs actual",
  },
  { label: "Invoicing", slug: "finances/invoices", Icon: FinancesIcon, helper: "Vendor bills" },
  {
    label: "Milestone Payments",
    slug: "finances/milestone-payments",
    Icon: FinancesIcon,
    helper: "Payment gates",
  },
] as const;

// Homeowner / client portal: a curated, read-mostly subset of the workspace.
const CLIENT_ENTRIES: readonly NavEntry[] = [
  { label: "Overview", slug: "overview", Icon: OverviewIcon },
  { label: "What's Next", slug: "whats-next", Icon: TrendingUpIcon },
  { label: "Build Stages", slug: "stages", Icon: OverviewIcon },
  { label: "Approvals", slug: "approvals", Icon: InspectionsIcon },
  { label: "Queries", slug: "queries", Icon: MessagesIcon },
  { label: "RFIs", slug: "rfis", Icon: AlertIcon },
  // { label: "BIM Models", slug: "bim", Icon: DocumentsIcon },
];

interface ProjectSidebarProps {
  project: Project;
  className?: string;
  access?: ProjectAccess;
}

function ProjectSidebar({ project, className, access }: ProjectSidebarProps) {
  const location = useLocation();
  const isClient = access?.relationship !== "company";
  const { data: channels = [] } = useProjectChannels(project.id);
  const totalUnread = channels.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  const items = useMemo<ProjectNavItem[]>(
    () =>
      NAV_ENTRIES.map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id],
  );
  const scheduleItems = useMemo<GroupNavItem[]>(
    () =>
      SCHEDULE_ENTRIES.map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id],
  );
  const materialsItems = useMemo<GroupNavItem[]>(
    () =>
      MATERIALS_ENTRIES.map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id],
  );
  const siteControlItems = useMemo<GroupNavItem[]>(
    () =>
      SITE_CONTROL_ENTRIES.map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id],
  );
  const financeItems = useMemo<GroupNavItem[]>(
    () =>
      FINANCE_ENTRIES.map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id],
  );

  const isScheduleActive =
    location.pathname === `/project/${project.id}/schedules` ||
    scheduleItems.some(
      (item) =>
        location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
    );
  const isMaterialsActive = materialsItems.some(
    (item) =>
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );
  const isSiteControlActive = siteControlItems.some(
    (item) =>
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );
  const isFinanceActive = financeItems.some(
    (item) =>
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );

  return (
    <aside
      className={cn(
        "flex max-h-full w-[260px] shrink-0 flex-col gap-6 overflow-hidden border-r border-[#F0F0F0]  px-4 py-6",
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
        <nav data-tour="project-nav" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            My build
          </p>
          {CLIENT_ENTRIES.map((entry) => (
            <ProjectNavLink
              key={entry.slug}
              item={{ ...entry, to: `/project/${project.id}/${entry.slug}` }}
            />
          ))}
        </nav>
      ) : (
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Main menu
          </p>
          {items.slice(0, 2).map((item) => (
            <ProjectNavLink key={item.slug} item={item} />
          ))}
          <ProjectNavLink
            item={{
              label: "Tasks",
              slug: "tasks",
              Icon: TrendingUpIcon,
              to: `/project/${project.id}/tasks`,
            }}
          />
          <SidebarNavGroup
            label="Schedules"
            Icon={CalendarIcon}
            items={scheduleItems}
            active={isScheduleActive}
          />
          <SidebarNavGroup
            label="Site Control"
            Icon={InspectionsIcon}
            items={siteControlItems}
            active={isSiteControlActive}
          />
          <SidebarNavGroup
            label="Materials & Equipment"
            Icon={MaterialsIcon}
            items={materialsItems}
            active={isMaterialsActive}
            activeIconClassName="text-[#004DE7]"
          />
          <SidebarNavGroup
            label="Finance"
            Icon={FinancesIcon}
            items={financeItems}
            active={isFinanceActive}
          />
          <ProjectNavLink
            item={{
              label: "Documents",
              slug: "documents",
              Icon: DocumentsIcon,
              to: `/project/${project.id}/documents`,
            }}
          />
          <ProjectNavLink
            item={{
              label: "Team",
              slug: "team",
              Icon: ContractorsIcon,
              to: `/project/${project.id}/team`,
            }}
          />
          <ProjectNavLink
            item={{
              label: "Messages",
              slug: "chat",
              Icon: MessagesIcon,
              to: `/project/${project.id}/chat`,
              badge: totalUnread > 0 ? totalUnread : undefined,
            }}
          />
          <ProjectNavLink
            item={{
              label: "Panda AI",
              slug: "panda-ai",
              Icon: SparkleIcon,
              to: `/project/${project.id}/panda-ai`,
            }}
          />
          <ProjectNavLink
            item={{
              label: "Settings",
              slug: "settings",
              Icon: SettingsIcon,
              to: `/project/${project.id}/settings`,
            }}
          />
        </nav>
      )}
    </aside>
  );
}

function SidebarNavGroup({
  label,
  Icon,
  items,
  active,
  activeIconClassName,
}: {
  label: string;
  Icon: IconComponent;
  items: GroupNavItem[];
  active: boolean;
  activeIconClassName?: string;
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
        <Icon className={cn("size-[18px]", active && activeIconClassName)} />
        <span className="flex-1 truncate text-left">{label}</span>
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
            <ProjectGroupNavLink key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectGroupNavLink({ item }: { item: GroupNavItem }) {
  const { label, slug, to } = item;
  const location = useLocation();
  const isActive =
    slug === "finances" || slug === "schedules"
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(`${to}/`);
  return (
    <Link
      to={to}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500",
        "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
        "hover:bg-[#EDEDED]/60 hover:text-gray-900",
        isActive && "bg-[#EDEDED] text-gray-900",
      )}
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}

function ProjectNavLink({ item }: { item: ProjectNavItem }) {
  const { Icon, label, to, badge } = item;
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
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#004DE7] px-1.5 text-[10px] font-bold leading-none text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}

ProjectSidebar.displayName = "ProjectSidebar";

export default ProjectSidebar;
export { ProjectSidebar, type ProjectSidebarProps };
