import { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { SettingsIcon } from "@/components/atoms/settings-icon";
import { LogOutIcon } from "@/components/atoms/logout-icon";
import { authClient } from "@/lib/auth-client";
import logo from "@/assets/images/logo.svg";
import dashboardIcon from "@/assets/icons/dashboard.svg";
import projectIcon from "@/assets/icons/project.svg";
import documentIcon from "@/assets/icons/document.svg";
import financeIcon from "@/assets/icons/finance.svg";

interface SidebarItem {
  label: string;
  to: string;
  icon: string | React.FC;
}

const mainMenu: SidebarItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: dashboardIcon },
  { label: "Project", to: "/dashboard/project", icon: projectIcon },
  { label: "Document", to: "/dashboard/document", icon: documentIcon },
  { label: "Finance", to: "/dashboard/finance", icon: financeIcon },
];

const settingsItem: SidebarItem = {
  label: "Settings",
  to: "/dashboard/settings",
  icon: SettingsIcon,
};

function SidebarLink({ item }: { item: SidebarItem }) {
  const isString = typeof item.icon === "string";
  const Icon = isString ? null : item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === "/dashboard"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500",
          "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
          isActive && "bg-[#EDEDED] text-gray-900",
        )
      }
    >
      {Icon ? (
        <Icon />
      ) : (
        <img src={item.icon as string} alt="" className="size-[18px]" />
      )}
      {item.label}
    </NavLink>
  );
}

export default function Sidebar() {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <aside className="flex w-[220px] shrink-0 flex-col bg-[#F8F8F8] px-4 pb-6 pt-8">
      <Link to="/" className="px-3">
        <img src={logo} alt="BuildPanda" className="h-9" />
      </Link>

      <nav className="mt-[73px] flex flex-1 flex-col gap-1">
        {mainMenu.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
      </nav>

      <div className="flex flex-col gap-1">
        <SidebarLink item={settingsItem} />
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-500",
            "outline-none hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-gray-900/10",
          )}
        >
          <LogOutIcon />
          Log Out
        </button>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={async () => {
          await authClient.signOut();
          navigate("/auth/sign-in");
        }}
        title="Log out?"
        description="Are you sure you want to log out of your account?"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        variant="danger"
      />
    </aside>
  );
}
