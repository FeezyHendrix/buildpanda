import { useMemo, type ComponentType, type SVGAttributes } from "react";
import { Link, NavLink } from "react-router-dom";
import { IconBox } from "@/components/atoms/icon-box";
import { SettingsIcon } from "@/components/atoms/settings-icon";
import {
  BackArrowIcon,
  CalendarIcon,
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

const NAV_ENTRIES: readonly NavEntry[] = [
  { label: "Overview", slug: "overview", Icon: OverviewIcon },
  { label: "Updates", slug: "updates", Icon: UpdatesIcon },
  { label: "Site Activities", slug: "activities", Icon: TrendingUpIcon },
  { label: "Schedule", slug: "schedule", Icon: CalendarIcon },
  { label: "Daily Log", slug: "daily-log", Icon: CalendarIcon },
  { label: "Inspections", slug: "inspections", Icon: InspectionsIcon },
  { label: "Finances", slug: "finances", Icon: FinancesIcon },
  { label: "Documents", slug: "documents", Icon: DocumentsIcon },
  { label: "Materials", slug: "materials", Icon: MaterialsIcon },
  { label: "Contractors", slug: "contractors", Icon: ContractorsIcon },
  { label: "Messages", slug: "messages", Icon: MessagesIcon },
  { label: "Settings", slug: "settings", Icon: SettingsIcon },
] as const;

interface ProjectSidebarProps {
  project: Project;
  className?: string;
}

function ProjectSidebar({ project, className }: ProjectSidebarProps) {
  const items = useMemo<ProjectNavItem[]>(
    () =>
      NAV_ENTRIES.map((entry) => ({
        ...entry,
        to: `/project/${project.id}/${entry.slug}`,
      })),
    [project.id],
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
        {items.map((item) => (
          <ProjectNavLink key={item.slug} item={item} />
        ))}
      </nav>
    </aside>
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
