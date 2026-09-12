import { useMemo, useState } from "react";
import { useProjectChannels, useAllChannels } from "@/hooks/use-chat";
import { useFeatureFlagState } from "@/hooks/use-feature-flags";
import { useBuildings } from "@/hooks/use-buildings";
import { useBuildingScope } from "@/contexts/building-scope-context";
import type { Project, ProjectAccess } from "@/lib/project-types";
import { CompanyNav } from "./project-sidebar/company-nav";
import { SidebarGroupHeading, ProjectNavLink } from "./project-sidebar/nav-components";
import { ProjectSwitcher } from "./project-sidebar/project-switcher";
import { SidebarFooter, SidebarHeader, SidebarShell } from "./project-sidebar/sidebar-chrome";
import { useProjectNav } from "./project-sidebar/use-project-nav";

interface SidebarUser {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
}

interface ProjectSidebarProps {
  project: Project;
  className?: string;
  access?: ProjectAccess;
  user: SidebarUser;
  onLogout: () => void;
  open?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
}

// Desktop-only preference: shrink the sidebar to an icon rail. The mobile
// slide-over is a separate mechanism (`open` prop).
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

function ProjectSidebar({ project, className, access, user, onLogout, open = false, onClose, onOpen }: ProjectSidebarProps) {
  const [collapsed, setCollapsed] = useState(readCollapsedPref);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      writeCollapsedPref(!prev);
      return !prev;
    });
  };
  const isClient = access?.relationship !== "company";
  const nav = useProjectNav(project, access);

  const { data: channels = [] } = useProjectChannels(project.id);
  const { data: allChannels = [] } = useAllChannels();
  // DMs are global (project_id null), so they are NOT returned by the per-project
  // channels endpoint. Count this project's channels plus the user's DM channels
  // so a direct message also bumps the Messages badge.
  const totalUnread =
    channels.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0) +
    allChannels.filter((c) => c.type === "dm").reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  // Multi-building is off by default and its /buildings route is flag-gated
  // (403 when disabled). Fetch only once the flag is known-enabled, so a
  // disabled feature never triggers the global 403 error toast.
  const multiBuilding = useFeatureFlagState("projects.multiBuilding");
  const { data: buildingsData = [] } = useBuildings(
    project.id,
    multiBuilding.enabled && !multiBuilding.isLoading,
  );
  const realBuildings = useMemo(() => buildingsData.filter((b) => b.kind === "real"), [buildingsData]);
  const { selectedBuildingId } = useBuildingScope();
  const activeBuilding = realBuildings.find((b) => b.id === selectedBuildingId);

  return (
    <SidebarShell
      open={open}
      collapsed={collapsed}
      onToggleCollapsed={toggleCollapsed}
      onClose={onClose}
      onOpen={onOpen}
      className={className}
    >
      <SidebarHeader to={isClient ? "/my-build" : "/dashboard"} collapsed={collapsed} />
      {!collapsed && <ProjectSwitcher project={project} onClose={onClose} />}

      {isClient ? (
        <nav data-tour="project-nav" className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4 no-scrollbar">
          <SidebarGroupHeading collapsed={collapsed}>My build</SidebarGroupHeading>
          {nav.clientItems.map((entry) => (
            <ProjectNavLink key={entry.slug} item={entry} collapsed={collapsed} onClose={onClose} />
          ))}
        </nav>
      ) : (
        <CompanyNav
          project={project}
          access={access}
          nav={nav}
          collapsed={collapsed}
          buildings={realBuildings}
          activeBuildingName={activeBuilding?.name}
          unreadMessages={totalUnread}
          onClose={onClose}
        />
      )}

      <SidebarFooter
        name={user.name}
        email={user.email}
        avatarUrl={user.avatarUrl}
        onLogout={onLogout}
        collapsed={collapsed}
      />
    </SidebarShell>
  );
}

ProjectSidebar.displayName = "ProjectSidebar";

export default ProjectSidebar;
export { ProjectSidebar, type ProjectSidebarProps };
