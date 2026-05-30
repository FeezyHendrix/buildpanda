import {
  Outlet,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import type { ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { ErrorBoundary } from "@/components/atoms/error-boundary";
import { EmptyState } from "@/components/molecules/empty-state";
import { Navbar } from "@/components/organisms/navbar";
import { ProjectSidebar } from "@/components/organisms/project-sidebar";
import { UserMenu } from "@/components/molecules/user-menu";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useProject } from "@/hooks/use-projects";
import type { Session } from "@/stores/auth";
import type { Project } from "@/lib/project-mock-data";

interface ProjectOutletContext {
  project: Project;
}

export function useProjectContext(): ProjectOutletContext {
  return useOutletContext<ProjectOutletContext>();
}

export default function ProjectLayout() {
  const { session, isPending: sessionPending, logout } = useAuthGuard();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isPending: projectPending } = useProject(projectId);
  const navigate = useNavigate();

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
              <Button variant="primary" onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </Button>
            }
          />
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell session={session} onLogout={logout}>
      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar project={project} />
        <main className="flex-1 overflow-y-auto bg-[#FCFCFD]">
          <ErrorBoundary>
            <Outlet context={{ project } satisfies ProjectOutletContext} />
          </ErrorBoundary>
        </main>
      </div>
    </AppShell>
  );
}

interface AppShellProps {
  session: Session;
  onLogout: () => void;
  children: ReactNode;
}

function AppShell({ session, onLogout, children }: AppShellProps) {
  return (
    <div className="flex h-dvh flex-col">
      <Navbar
        showLogo
        sticky
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
      <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#004DE7]" />
    </div>
  );
}
