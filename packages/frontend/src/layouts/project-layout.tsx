import {
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { useState } from "react";
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
import { InfoTooltip } from "@/components/atoms/tooltip";
import { PageTitleProvider, usePageTitleContext } from "@/contexts/page-title-context";
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
  const notificationsEnabled = useFeatureFlag("collaboration.notifications");
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
        <Navbar
          showLogo
          sticky
          showNotifications={notificationsEnabled}
          userSlot={
            <UserMenu
              name={session.user.name}
              email={session.user.email}
              avatarUrl={session.user.image}
              onLogout={logout}
            />
          }
        />
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
      </div>
    );
  }

  return (
    <BuildingScopeProvider projectId={project.id}>
      <PageTitleProvider>
        <div className="flex h-dvh">
          <ProjectSidebar
            project={project}
            access={access}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onOpen={() => setSidebarOpen(true)}
          />
          {/* Right column: navbar on top, then a flex-row zone that fills the rest (mirrors the
              original working layout where main.flex-1 lives inside a flex row, not a column) */}
          <div className="flex min-w-0 flex-1 flex-col">
            <ProjectTopBar
              session={session}
              onLogout={logout}
              notificationsEnabled={notificationsEnabled}
            />
            <div className="flex flex-1 overflow-hidden no-scrollbar">
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
          </div>
        </div>
      </PageTitleProvider>
    </BuildingScopeProvider>
  );
}

interface ProjectTopBarProps {
  session: Session;
  onLogout: () => void;
  notificationsEnabled: boolean;
}

function ProjectTopBar({ session, onLogout, notificationsEnabled }: ProjectTopBarProps) {
  const { title, description } = usePageTitleContext();
  return (
    <Navbar
      showNotifications={notificationsEnabled}
      leadingSlot={
        title ? (
          <div className="flex items-center gap-2">
            <span className="text-body-l font-semibold text-gray-900">{title}</span>
            {description && <InfoTooltip text={description} align="start" />}
          </div>
        ) : undefined
      }
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
