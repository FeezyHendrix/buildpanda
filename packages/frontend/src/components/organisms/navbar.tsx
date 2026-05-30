import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/atoms/avatar";
import { NotificationBell } from "@/components/atoms/notification-bell";
import { SearchInput } from "@/components/atoms/search-input";
import { cn } from "@/lib/utils";
import logo from "@/assets/images/logo.svg";

interface NavbarUser {
  name: string;
  avatarUrl?: string | null;
}

type NavbarUserSlot =
  | { userSlot: ReactNode; user?: NavbarUser }
  | { userSlot?: undefined; user: NavbarUser };

type NavbarProps = {
  notificationCount?: number;
  showLogo?: boolean;
  sticky?: boolean;
  searchPlaceholder?: string;
  className?: string;
} & NavbarUserSlot;

function Navbar({
  user,
  notificationCount = 0,
  showLogo = false,
  sticky = false,
  searchPlaceholder = "Search Build Panda",
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

      <SearchInput
        className="w-72 bg-[#F6F6F6]"
        placeholder={searchPlaceholder}
      />

      <div className="ml-auto flex items-center gap-2 rounded-full bg-[#F6F6F6] p-1.5">
        <NotificationBell count={notificationCount} />
        {userSlot ??
          (user && <Avatar name={user.name} src={user.avatarUrl} size="sm" />)}
      </div>
    </nav>
  );
}

Navbar.displayName = "Navbar";

export default Navbar;
export { Navbar, type NavbarProps, type NavbarUser };
