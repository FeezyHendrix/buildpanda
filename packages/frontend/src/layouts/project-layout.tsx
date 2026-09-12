import {
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { useMemo, useState } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { ErrorBoundary } from "@/components/atoms/error-boundary";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { EmptyState } from "@/components/molecules/empty-state";
import { Navbar } from "@/components/organisms/navbar";
import { ProjectSidebar } from "@/components/organisms/project-sidebar";
import { PandaAiPane } from "@/components/organisms/panda-ai-pane";
import { QuickCapture } from "@/components/molecules/quick-capture-sheet";
import { UserMenu } from "@/components/molecules/user-menu";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useProject } from "@/hooks/use-projects";
import { useProjectAccess } from "@/hooks/use-participants";
import { useFeatureFlag, useFeatureFlags } from "@/hooks/use-feature-flags";
import { BuildingScopeProvider } from "@/contexts/building-scope-context";
import { AppBarTitleProvider, type AppBarTitleApi } from "@/contexts/app-bar-title-context";
import { useProjectBreadcrumbs } from "./use-project-breadcrumbs";
import type { Session } from "@/stores/auth";
import type { Project, ProjectAccess } from "@/lib/project-types";

interface ProjectOutletContext {
  project: Project;
  access: ProjectAccess | undefined;
}

export function useProjectContext(): ProjectOutletContext {
  return useOutletContext<ProjectOutletContext>();
}

export default function ProjectLayout() {
  const { session, isPending: sessionPending, logout } = useAuthGuard();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isPending: projectPending } = useProject(projectId);
  const { data: access } = useProjectAccess(projectId);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const titleApi = useMemo<AppBarTitleApi>(() => ({ setTitle: setPageTitle }), []);
  const { data: featureFlags } = useFeatureFlags();
  const pandaAiChatEnabled =
    featureFlags?.flags.some((flag) => flag.key === "ai.chatAgent" && flag.enabled) ?? false;

  if (projectId === "marbella") {
    return (
      <Navigate
        to={location.pathname.replace("/project/marbella", "/project/sample-project")}
        replace
      />
    );
  }

  if (sessionPending || projectPending) {
    return <FullPageLoader />;
  }

  if (!session) {
    return null;
  }

  if (!project) {
    return (
      <div className="flex h-dvh flex-col">
        <AppBar session={session} onLogout={logout} title="Project" />
        <main className="flex flex-1 items-center justify-center px-6">
          <EmptyState
            title="Project not found"
            description="We couldn't find the project you're looking for. It may have been removed or you don't have access."
            action={{ label: "Back to home", onClick: () => navigate("/") }}
          />
        </main>
      </div>
    );
  }

  const user = { name: session.user.name, email: session.user.email, avatarUrl: session.user.image };

  return (
    <BuildingScopeProvider projectId={project.id}>
      <AppBarTitleProvider value={titleApi}>
        <div className="flex h-dvh overflow-hidden">
          <ProjectSidebar
            project={project}
            access={access}
            user={user}
            onLogout={logout}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onOpen={() => setSidebarOpen(true)}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <ProjectAppBar project={project} access={access} session={session} onLogout={logout} pageTitle={pageTitle} />
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-surface no-scrollbar">
                <ProjectBreadcrumbs project={project} access={access} />
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <ErrorBoundary>
                    <Outlet context={{ project, access } satisfies ProjectOutletContext} />
                  </ErrorBoundary>
                </div>
              </main>
              {pandaAiChatEnabled && !location.pathname.endsWith("/chat") && (
                <PandaAiPane projectId={project.id} />
              )}
              {access &&
                access.relationship !== "none" &&
                access.capabilities.canComment &&
                !location.pathname.endsWith("/chat") && (
                  <QuickCapture projectId={project.id} />
                )}
            </div>
          </div>
        </div>
      </AppBarTitleProvider>
    </BuildingScopeProvider>
  );
}

interface ProjectAppBarProps {
  project: Project;
  access: ProjectAccess | undefined;
  session: Session;
  onLogout: () => void;
  /** Title registered by the page's `PageHeader`; falls back to the last breadcrumb. */
  pageTitle: string | null;
}

/** The 64px app bar: page title on the left, search, notifications and the user on the right. */
function ProjectAppBar({ project, access, session, onLogout, pageTitle }: ProjectAppBarProps) {
  const items = useProjectBreadcrumbs(project, access?.relationship !== "company");
  const title = pageTitle ?? items[items.length - 1]?.label ?? project.name;
  return <AppBar session={session} onLogout={onLogout} title={title} />;
}

interface ProjectBreadcrumbsProps {
  project: Project;
  access: ProjectAccess | undefined;
}

function ProjectBreadcrumbs({ project, access }: ProjectBreadcrumbsProps) {
  const items = useProjectBreadcrumbs(project, access?.relationship !== "company");
  return (
    <div className="shrink-0 px-6 pt-6">
      <Breadcrumbs items={items} />
    </div>
  );
}

interface AppBarProps {
  session: Session;
  onLogout: () => void;
  title: string;
}

function AppBar({ session, onLogout, title }: AppBarProps) {
  const notificationsEnabled = useFeatureFlag("collaboration.notifications");
  return (
    <Navbar
      title={title}
      showNotifications={notificationsEnabled}
      userSlot={
        <UserMenu
          name={session.user.name}
          email={session.user.email}
          avatarUrl={session.user.image}
          onLogout={onLogout}
        />
      }
    />
  );
}

function FullPageLoader() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
