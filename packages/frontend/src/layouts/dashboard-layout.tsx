import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { ErrorBoundary } from "@/components/atoms/error-boundary";
import { Spinner } from "@/components/atoms/spinner";
import { Navbar } from "@/components/organisms/navbar";
import { UserMenu } from "@/components/molecules/user-menu";
import { WorkspaceSwitcher } from "@/components/molecules/workspace-switcher";
import { LAST_SUITE_KEY, SUITE_CONSTRUCTION } from "@/components/molecules/suite-switcher";
import { useAuthGuard } from "@/hooks/use-auth-guard";

export default function DashboardLayout() {
  const { session, isPending, logout } = useAuthGuard();

  useEffect(() => {
    localStorage.setItem(LAST_SUITE_KEY, SUITE_CONSTRUCTION);
  }, []);

  if (isPending) {
    return <FullPageLoader />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-dvh flex-col">
      <Navbar
        showLogo
        sticky
        leadingSlot={<WorkspaceSwitcher />}
        userSlot={
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            avatarUrl={session.user.image}
            onLogout={logout}
          />
        }
      />
      <main className="flex-1 overflow-y-auto bg-white">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
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
