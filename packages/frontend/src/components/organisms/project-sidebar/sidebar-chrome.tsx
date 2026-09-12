import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import { UserMenu } from "@/components/molecules/user-menu";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/images/logo-white.svg";

interface SidebarShellProps {
  /** Mobile slide-over state. */
  open: boolean;
  /** Desktop rail state. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClose?: () => void;
  onOpen?: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * Ernest's dark sidebar: a 300px gradient column that collapses to a 72px
 * icon rail, with the collapse toggle hanging off its right edge. Below `lg`
 * it is a slide-over with a pull-tab.
 */
export function SidebarShell({ open, collapsed, onToggleCollapsed, onClose, onOpen, className, children }: SidebarShellProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:inset-auto lg:z-30 lg:h-full lg:shrink-0 lg:translate-x-0",
        )}
      >
        <button
          type="button"
          onClick={open ? onClose : onOpen}
          aria-label={open ? "Close sidebar" : "Open sidebar"}
          className={cn(
            "absolute right-0 top-1/2 flex h-14 w-7 -translate-y-1/2 translate-x-full items-center justify-center",
            "rounded-r-lg border border-l-0 border-line-hair bg-white shadow-card lg:hidden",
          )}
        >
          <ChevronRightIcon className={cn("size-4 text-ink-muted transition-transform duration-300", open && "rotate-180")} />
        </button>

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-4 top-5 z-20 hidden size-8 items-center justify-center rounded-full lg:flex"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-sidebar-flyout text-ink-inverted shadow-md">
            <ChevronRightIcon
              className={cn("size-4 transition-transform duration-500 ease-in-out", !collapsed && "rotate-180")}
            />
          </span>
        </button>

        <aside
          className={cn(
            "flex h-full w-[300px] flex-col overflow-hidden bg-sidebar-gradient text-ink-inverted",
            "transition-[width] duration-300 ease-in-out",
            collapsed && "lg:w-[72px]",
            className,
          )}
        >
          {children}
        </aside>
      </div>
    </>
  );
}
SidebarShell.displayName = "SidebarShell";

/** Logo row at the top of the sidebar; links back to the projects list. */
export function SidebarHeader({ to, collapsed }: { to: string; collapsed: boolean }) {
  return (
    <div className={cn("flex h-16 shrink-0 items-center px-6", collapsed && "lg:justify-center lg:px-0")}>
      <Link to={to} className="flex items-center" aria-label="All projects">
        <img
          src={logoWhite}
          alt="BuildPanda"
          className={cn("h-7 max-w-none transition-opacity duration-200", collapsed && "lg:h-6 lg:w-6 lg:object-cover lg:object-left")}
        />
      </Link>
    </div>
  );
}
SidebarHeader.displayName = "SidebarHeader";

interface SidebarFooterProps {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  onLogout: () => void;
  collapsed: boolean;
}

/** Avatar, name and email at the foot of the sidebar; opens the user menu upward. */
export function SidebarFooter({ name, email, avatarUrl, onLogout, collapsed }: SidebarFooterProps) {
  return (
    <div className={cn("shrink-0 border-t border-white/10 px-4 py-3", collapsed && "lg:px-2")}>
      <UserMenu
        variant={collapsed ? "rail" : "full"}
        name={name}
        email={email}
        avatarUrl={avatarUrl}
        onLogout={onLogout}
      />
    </div>
  );
}
SidebarFooter.displayName = "SidebarFooter";
