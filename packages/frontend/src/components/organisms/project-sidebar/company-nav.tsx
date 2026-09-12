import { SettingsIcon } from "@/components/atoms/settings-icon";
import {
  AlertIcon,
  CalendarIcon,
  ContractorsIcon,
  DocumentsIcon,
  FinancesIcon,
  MaterialsIcon,
  MessagesIcon,
  SparkleIcon,
  BuildingIcon,
  TrendingUpIcon,
} from "@/components/atoms/project-nav-icons";
import { canViewSection } from "@/lib/project-types";
import type { Building } from "@/api/buildings";
import type { Project, ProjectAccess } from "@/lib/project-types";
import { BuildingSwitcher } from "./building-switcher";
import { SidebarGroupHeading, SidebarNavGroup, ProjectNavLink } from "./nav-components";
import type { ProjectNavItem } from "./constants";
import type { ProjectNav } from "./use-project-nav";

interface CompanyNavProps {
  project: Project;
  access: ProjectAccess | undefined;
  nav: ProjectNav;
  collapsed: boolean;
  buildings: Building[];
  activeBuildingName: string | undefined;
  unreadMessages: number;
  onClose?: () => void;
}

/** The company-side sidebar: Project → Schedules → Field tools → Materials → Finance → Documents → People & admin. */
export function CompanyNav({
  project,
  access,
  nav,
  collapsed,
  buildings,
  activeBuildingName,
  unreadMessages,
  onClose,
}: CompanyNavProps) {
  const { isOn } = nav;
  const base = `/project/${project.id}`;
  const link = (label: string, slug: string, Icon: ProjectNavItem["Icon"], badge?: number): ProjectNavItem => ({
    label,
    slug,
    Icon,
    to: `${base}/${slug}`,
    badge,
  });

  const canSeeBuildings = isOn("projects.multiBuilding") && canViewSection(access, "projects.schedule", "buildings");
  const multiBuilding = buildings.length > 1 && canSeeBuildings;
  const showDocumentsLink = isOn("projects.documents") && canViewSection(access, "projects.documents", "documents");
  const hasDocumentsSection = showDocumentsLink || nav.documentToolItems.length > 0;
  const tasksItem = isOn("projects.schedule") ? link("Tasks", "tasks", TrendingUpIcon) : null;
  const rowProps = { collapsed, onClose };

  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4 no-scrollbar">
      {multiBuilding ? (
        <>
          {!collapsed && <BuildingSwitcher buildings={buildings} onClose={onClose} />}
          <SidebarGroupHeading collapsed={collapsed}>{activeBuildingName ?? "All buildings"}</SidebarGroupHeading>
          {nav.scheduleItems.map((item) => (
            <ProjectNavLink key={item.slug} item={item} {...rowProps} />
          ))}
          {tasksItem && <ProjectNavLink item={tasksItem} {...rowProps} />}
          <ProjectNavLink item={link("Manage buildings", "buildings", BuildingIcon)} {...rowProps} />
        </>
      ) : null}

      <SidebarGroupHeading collapsed={collapsed}>Project</SidebarGroupHeading>
      {nav.items.slice(0, 2).map((item) => (
        <ProjectNavLink key={item.slug} item={item} {...rowProps} />
      ))}
      {!multiBuilding && tasksItem && <ProjectNavLink item={tasksItem} {...rowProps} />}
      {!multiBuilding && nav.scheduleItems.length > 0 && (
        <SidebarNavGroup label="Schedules" Icon={CalendarIcon} items={nav.scheduleItems} active={nav.isScheduleActive} {...rowProps} />
      )}
      {nav.siteToolItems.length > 0 && (
        <SidebarNavGroup label="Field tools" Icon={AlertIcon} items={nav.siteToolItems} active={nav.isFieldToolsActive} {...rowProps} />
      )}
      {nav.materialsItems.length > 0 && (
        <SidebarNavGroup label="Materials & equipment" Icon={MaterialsIcon} items={nav.materialsItems} active={nav.isMaterialsActive} {...rowProps} />
      )}
      {nav.financeItems.length > 0 && (
        <SidebarNavGroup label="Finance" Icon={FinancesIcon} items={nav.financeItems} active={nav.isFinanceActive} {...rowProps} />
      )}
      {!multiBuilding && canSeeBuildings && (
        <>
          <SidebarGroupHeading collapsed={collapsed}>Buildings</SidebarGroupHeading>
          <ProjectNavLink item={link("Manage buildings", "buildings", BuildingIcon)} {...rowProps} />
        </>
      )}

      {hasDocumentsSection && <SidebarGroupHeading collapsed={collapsed}>Documents</SidebarGroupHeading>}
      {showDocumentsLink && <ProjectNavLink item={link("Documents", "documents", DocumentsIcon)} {...rowProps} />}
      {nav.documentToolItems.map((item) => (
        <ProjectNavLink key={item.slug} item={item} {...rowProps} />
      ))}

      <SidebarGroupHeading collapsed={collapsed}>People & admin</SidebarGroupHeading>
      {isOn("project.team") && canViewSection(access, undefined, "teamMembers") && (
        <ProjectNavLink item={link("Team", "team", ContractorsIcon)} {...rowProps} />
      )}
      {isOn("collaboration.messaging") && canViewSection(access, "collaboration.messaging", "messages") && (
        <ProjectNavLink item={link("Messages", "chat", MessagesIcon, unreadMessages > 0 ? unreadMessages : undefined)} {...rowProps} />
      )}
      <ProjectNavLink item={link("Panda AI", "panda-ai", SparkleIcon)} {...rowProps} />
      <ProjectNavLink item={link("Settings", "settings", SettingsIcon)} {...rowProps} />
    </nav>
  );
}
CompanyNav.displayName = "CompanyNav";
