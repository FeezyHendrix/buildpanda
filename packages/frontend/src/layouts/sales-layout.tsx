import { useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/atoms/error-boundary";
import { Spinner } from "@/components/atoms/spinner";
import { Navbar } from "@/components/organisms/navbar";
import { UserMenu } from "@/components/molecules/user-menu";
import { OrgSwitcher } from "@/components/molecules/org-switcher";
import {
  SuiteSwitcher,
  LAST_SUITE_KEY,
  SUITE_SALES,
} from "@/components/molecules/suite-switcher";
import { authClient } from "@/lib/auth-client";
import { AbilityProvider } from "@/contexts/ability-context";
import logo from "@/assets/images/logo.svg";

export { LAST_SUITE_KEY, SUITE_SALES };
export { SUITE_CONSTRUCTION } from "@/components/molecules/suite-switcher";

const salesNav = [
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
    label: "Settings",
    to: "/sales/settings",
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

function SalesSidebar({
  user,
  onLogout,
}: {
  user: SidebarUser;
  onLogout: () => void;
}) {
  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-[#EFEFEF] bg-[#F8F8F8]">
      <div className="flex flex-col gap-3 px-3 pb-4 pt-5">
        <Link to="/sales" className="px-1" aria-label="BuildPanda home">
          <img src={logo} alt="BuildPanda" className="h-8 w-auto" />
        </Link>
        <OrgSwitcher />
      </div>

      <div className="px-3 pb-1">
        <SuiteSwitcher variant="segmented" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 pt-3">
        {salesNav.map((item) => (
          <SalesNavLink key={item.to} item={item} />
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
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar showLogo={false} sticky />
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
