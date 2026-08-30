import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/atoms/error-boundary";
import { Spinner } from "@/components/atoms/spinner";
import { Navbar } from "@/components/organisms/navbar";
import { UserMenu } from "@/components/molecules/user-menu";
import {
  SuiteSwitcher,
  LAST_SUITE_KEY,
  SUITE_SALES,
} from "@/components/molecules/suite-switcher";
import { authClient } from "@/lib/auth-client";
import { AbilityProvider } from "@/contexts/ability-context";
import { useFeatureFlag, useFeatureFlags } from "@/hooks/use-feature-flags";
import { useOrgPermissions } from "@/hooks/use-organization";
import logo from "@/assets/images/logo.svg";

export { LAST_SUITE_KEY, SUITE_SALES };
export { SUITE_CONSTRUCTION } from "@/components/molecules/suite-switcher";

const salesNav: Array<{
  label: string;
  to: string;
  flag?: string;
  permission?: { resource: string; action: string };
  section?: string;
  icon: ReactNode;
}> = [
  {
    label: "Dashboard",
    to: "/sales",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Leads",
    to: "/sales/leads",
    flag: "sales.leads",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Proposals",
    to: "/sales/proposals",
    flag: "sales.proposals",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    label: "Team",
    to: "/sales/team",
    permission: { resource: "teamMembers", action: "manage" },
    section: "People & Admin",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
  },
  {
    label: "Settings",
    to: "/sales/settings",
    section: "People & Admin",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

function SalesNavLink({ item }: { item: (typeof salesNav)[0] }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/sales"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors",
          "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
          isActive && "bg-[#EDEDED] text-gray-900",
        )
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  );
}

interface SidebarUser {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 4l10 10M14 4L4 14" />
    </svg>
  );
}

function SalesSidebar({
  user,
  onLogout,
  open,
  onClose,
  onOpen,
}: {
  user: SidebarUser;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
}) {
  const { data: flagsData } = useFeatureFlags();
  const { data: permissionsData } = useOrgPermissions();
  // Not cosmetic: OrgPermissionGate redirects to /dashboard, so an unpermitted
  // link would eject the user out of the sales suite.
  const visibleNav = salesNav.filter((item) => {
    const flagOn =
      !item.flag || (flagsData?.flags.find((f) => f.key === item.flag)?.enabled ?? true);
    const permitted =
      !item.permission ||
      (permissionsData?.permissions?.[item.permission.resource] ?? []).includes(
        item.permission.action,
      );
    return flagOn && permitted;
  });

  return (
    <>
      {/* Mobile backdrop */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
          className="absolute top-4 left-[256px] flex size-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
        >
          <XIcon />
        </button>
      </div>

      {/* Wrapper handles slide animation; tab hangs off the right edge */}
      <div
        className={cn(
          "relative",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:inset-auto lg:z-auto lg:translate-x-0 lg:max-h-full lg:shrink-0",
        )}
      >
        {/* Pull-tab */}
        <button
          type="button"
          onClick={open ? onClose : onOpen}
          aria-label={open ? "Close sidebar" : "Open sidebar"}
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 translate-x-full",
            "flex h-14 w-7 items-center justify-center",
            "rounded-r-xl border border-l-0 border-[#EFEFEF] bg-[#F8F8F8] shadow-sm",
            "lg:hidden",
          )}
        >
          <ChevronRightIcon />
        </button>

        <aside className="flex h-full w-[240px] flex-col border-r border-[#EFEFEF] bg-[#F8F8F8]">
          <div className="flex flex-col gap-3 px-3 pb-4 pt-5">
            <Link to="/sales" className="px-1" aria-label="BuildPanda home">
              <img src={logo} alt="BuildPanda" className="h-8 w-auto" />
            </Link>
          </div>

          <div className="px-3 pb-1">
            <SuiteSwitcher variant="segmented" />
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 pt-3">
            {visibleNav.map((item, index) => (
              <Fragment key={item.to}>
                {item.section && item.section !== visibleNav[index - 1]?.section ? (
                  <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {item.section}
                  </p>
                ) : null}
                <SalesNavLink item={item} />
              </Fragment>
            ))}
          </nav>

          <div className="border-t border-[#EFEFEF] px-3 py-3">
            <UserMenu
              variant="full"
              name={user.name}
              email={user.email}
              avatarUrl={user.avatarUrl}
              onLogout={onLogout}
            />
          </div>
        </aside>
      </div>
    </>
  );
}

function FullPageLoader() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export default function SalesLayout() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const notificationsEnabled = useFeatureFlag("collaboration.notifications");

  // Stamp the last suite so HomeRedirect returns here for company users
  useEffect(() => {
    localStorage.setItem(LAST_SUITE_KEY, SUITE_SALES);
  }, []);

  if (isPending) return <FullPageLoader />;
  if (!session?.user) return null;

  async function handleLogout() {
    await authClient.signOut();
    navigate("/auth/sign-in");
  }

  return (
    <div className="flex h-dvh">
      <SalesSidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          avatarUrl: session.user.image,
        }}
        onLogout={handleLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpen={() => setSidebarOpen(true)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar showLogo={false} sticky showNotifications={notificationsEnabled} />
        <main className="flex-1 overflow-y-auto bg-white no-scrollbar">
          <ErrorBoundary>
            <AbilityProvider>
              <Outlet />
            </AbilityProvider>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
