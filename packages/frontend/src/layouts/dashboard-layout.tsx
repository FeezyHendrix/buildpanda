import { Outlet } from "react-router-dom";
import { ErrorBoundary } from "@/components/atoms/error-boundary";
import { Navbar } from "@/components/organisms/navbar";
import { UserMenu } from "@/components/molecules/user-menu";
import { useAuthGuard } from "@/hooks/use-auth-guard";

export default function DashboardLayout() {
  const { session, isPending, logout } = useAuthGuard();

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
      <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#004DE7]" />
    </div>
  );
}
