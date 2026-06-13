import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ErrorBoundary } from "@/components/atoms/error-boundary";
import { Spinner } from "@/components/atoms/spinner";
import { Navbar } from "@/components/organisms/navbar";
import { UserMenu } from "@/components/molecules/user-menu";
import { OrgSwitcher } from "@/components/molecules/org-switcher";
import {
  SuiteSwitcher,
  LAST_SUITE_KEY,
  SUITE_CONSTRUCTION,
} from "@/components/molecules/suite-switcher";
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
        leadingSlot={
          <div className="flex items-center gap-3">
            <OrgSwitcher />
            <SuiteSwitcher />
            <NavLink
              to="/dashboard/settings/team"
              className={({ isActive }) =>
                `text-sm font-medium px-2 py-1 rounded transition-colors ${
                  isActive ? "text-gray-900" : "text-gray-500 hover:text-gray-900"
                }`
              }
            >
              Team
            </NavLink>
          </div>
        }
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
