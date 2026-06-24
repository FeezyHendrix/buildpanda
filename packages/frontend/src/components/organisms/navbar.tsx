import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/atoms/avatar";
import { NotificationBell } from "@/components/atoms/notification-bell";
import { GlobalSearch } from "@/components/molecules/global-search";
import { cn } from "@/lib/utils";
import logo from "@/assets/images/logo.svg";

interface NavbarUser {
  name: string;
  avatarUrl?: string | null;
}

type NavbarProps = {
  notificationCount?: number;
  showNotifications?: boolean;
  showLogo?: boolean;
  sticky?: boolean;
  searchPlaceholder?: string;
  leadingSlot?: ReactNode;
  // Either is optional: a slim topbar (e.g. when the user lives in a sidebar)
  // can render with neither, leaving just search + notifications.
  userSlot?: ReactNode;
  user?: NavbarUser;
  className?: string;
};

function Navbar({
  user,
  notificationCount = 0,
  showNotifications = true,
  showLogo = false,
  sticky = false,
  searchPlaceholder = "Search Build Panda",
  leadingSlot,
  userSlot,
  className,
}: NavbarProps) {
  return (
    <nav
      className={cn(
        "flex h-16 items-center justify-between border-b border-[#F6F6F6] bg-white px-4 py-3",
        "lg:grid lg:grid-cols-3 lg:px-8",
        sticky && "sticky top-0 z-40",
        className,
      )}
    >
      <div className="flex items-center">
        {showLogo && (
          <Link to="/" className="shrink-0">
            <img src={logo} alt="BuildPanda" className="h-8 lg:h-9" />
          </Link>
        )}
        {leadingSlot && <div className="ml-3 flex items-center">{leadingSlot}</div>}
      </div>

      {/* Search — hidden on mobile to avoid overflow, centered on desktop */}
      <div className="hidden lg:flex lg:justify-center">
        <GlobalSearch className="w-72" placeholder={searchPlaceholder} />
      </div>

      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2 rounded-full bg-[#F6F6F6] p-1.5">
          {showNotifications && <NotificationBell count={notificationCount} />}
          {userSlot ??
            (user ? (
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            ) : null)}
        </div>
      </div>
    </nav>
  );
}

Navbar.displayName = "Navbar";

export default Navbar;
export { Navbar, type NavbarProps, type NavbarUser };
