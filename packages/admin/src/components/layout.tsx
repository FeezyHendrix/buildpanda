import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import {
  DashboardIcon,
  UsersIcon,
  OrgIcon,
  ProjectIcon,
  LogoutIcon,
  LeadsIcon,
  JobsIcon,
} from "@/components/icons";

const nav = [
  { to: "/", label: "Dashboard", icon: DashboardIcon, end: true },
  { to: "/users", label: "Users", icon: UsersIcon, end: false },
  { to: "/organizations", label: "Organizations", icon: OrgIcon, end: false },
  { to: "/projects", label: "Projects", icon: ProjectIcon, end: false },
  { to: "/leads", label: "Leads", icon: LeadsIcon, end: false },
  { to: "/jobs", label: "Import jobs", icon: JobsIcon, end: false },
];

export function Layout() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const user = session?.user;

  async function signOut() {
    await authClient.signOut();
    navigate("/sign-in", { replace: true });
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="flex h-16 items-center gap-2 px-6">
          <img src="/logo.svg" alt="BuildPanda" className="h-7 w-auto" />
          <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">
            Admin
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-muted hover:text-ink",
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar name={user?.name ?? "Admin"} image={user?.image} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <LogoutIcon className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line px-5 md:hidden">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="BuildPanda" className="h-7 w-auto" />
            <span className="text-sm font-bold text-brand">Admin</span>
          </div>
          <button type="button" onClick={signOut} className="text-muted hover:text-ink">
            <LogoutIcon className="h-5 w-5" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto bg-surface-faint">
          <div className="mx-auto w-full max-w-6xl p-5 sm:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
