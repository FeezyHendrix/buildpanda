import {
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { ErrorBoundary } from "@/components/atoms/error-boundary";
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
      <AppShell session={session} onLogout={logout}>
        <main className="flex flex-1 items-center justify-center px-6">
          <EmptyState
            title="Project not found"
            description="We couldn't find the project you're looking for. It may have been removed or you don't have access."
            action={
              <Button variant="primary" onClick={() => navigate("/")}>
                Back to home
              </Button>
            }
          />
        </main>
      </AppShell>
    );
  }

  return (
    <BuildingScopeProvider projectId={project.id}>
    <AppShell session={session} onLogout={logout}>
      <div className="flex flex-1 overflow-hidden no-scrollbar">
        <ProjectSidebar
          project={project}
          access={access}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpen={() => setSidebarOpen(true)}
        />
        <main className="relative flex-1 overflow-y-auto no-scrollbar">
          <ErrorBoundary>
            <Outlet context={{ project, access } satisfies ProjectOutletContext} />
          </ErrorBoundary>
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
    </AppShell>
    </BuildingScopeProvider>
  );
}

interface AppShellProps {
  session: Session;
  onLogout: () => void;
  children: ReactNode;
}

function AppShell({ session, onLogout, children }: AppShellProps) {
  const notificationsEnabled = useFeatureFlag("collaboration.notifications");
  return (
    <div className="flex h-dvh flex-col">
      <Navbar
        showLogo
        sticky
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
      {children}
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
