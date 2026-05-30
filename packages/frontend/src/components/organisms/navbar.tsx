import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/atoms/avatar";
import { SearchInput } from "@/components/atoms/search-input";
import { NotificationBell } from "@/components/atoms/notification-bell";
import logo from "@/assets/images/logo.svg";

interface NavbarUser {
  name: string;
  avatarUrl?: string | null;
}

interface NavbarProps {
  user: NavbarUser;
  notificationCount?: number;
  showLogo?: boolean;
  sticky?: boolean;
}

export default function Navbar({
  user,
  notificationCount = 0,
  showLogo = false,
  sticky = false,
}: NavbarProps) {
  return (
    <nav
      className={cn(
        "flex h-16 items-center border-b border-[#F6F6F6] bg-white px-8 py-3",
        sticky && "sticky top-0 z-40",
      )}
    >
      {showLogo && (
        <Link to="/" className="mr-[172px] shrink-0">
          <img src={logo} alt="BuildPanda" className="h-9" />
        </Link>
      )}

      <SearchInput className="w-72" />

      <div className="ml-auto flex items-center gap-2 rounded-full bg-[#F6F6F6] p-1.5">
        <NotificationBell count={notificationCount} />
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
      </div>
    </nav>
  );
}

export { type NavbarProps, type NavbarUser };
