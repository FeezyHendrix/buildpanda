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
        "flex h-16 items-center border-b border-[#F6F6F6] bg-white px-8 py-3",
        sticky && "sticky top-0 z-40",
        className,
      )}
    >
      {showLogo && (
        <Link to="/" className="mr-12 shrink-0 xl:mr-[172px]">
          <img src={logo} alt="BuildPanda" className="h-9" />
        </Link>
      )}

      <GlobalSearch className="w-72" placeholder={searchPlaceholder} />

      {leadingSlot && <div className="ml-4 flex items-center">{leadingSlot}</div>}

      <div className="ml-auto flex items-center gap-2 rounded-full bg-[#F6F6F6] p-1.5">
        <NotificationBell count={notificationCount} />
        {userSlot ??
          (user ? (
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
          ) : null)}
      </div>
    </nav>
  );
}

Navbar.displayName = "Navbar";

export default Navbar;
export { Navbar, type NavbarProps, type NavbarUser };
