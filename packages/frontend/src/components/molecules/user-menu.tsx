import { Menu } from "@base-ui-components/react/menu";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  onLogout: () => void;
  className?: string;
  /** "compact" = avatar + chevron (navbar). "full" = avatar + name row that
   * opens upward, for a sidebar footer. */
  variant?: "compact" | "full";
}

function ChevronDownIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 4.5 3 3 3-3" />
    </svg>
  );
}

function UserMenu({
  name,
  email,
  avatarUrl,
  onLogout,
  className,
  variant = "compact",
}: UserMenuProps) {
  const isFull = variant === "full";
  return (
    <Menu.Root>
      {isFull ? (
        <Menu.Trigger
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left outline-none",
            "hover:bg-[#EFEFEF] focus-visible:ring-2 focus-visible:ring-gray-900/10",
            className,
          )}
          aria-label="Open user menu"
        >
          <Avatar name={name} src={avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{name}</p>
            {email ? (
              <p className="truncate text-xs text-gray-500">{email}</p>
            ) : null}
          </div>
          <ChevronDownIcon />
        </Menu.Trigger>
      ) : (
        <Menu.Trigger
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full text-gray-500 outline-none",
            "hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900/10",
            className,
          )}
          aria-label="Open user menu"
        >
          <Avatar name={name} src={avatarUrl} size="sm" />
          <ChevronDownIcon />
        </Menu.Trigger>
      )}

      <Menu.Portal>
        <Menu.Positioner
          side={isFull ? "top" : "bottom"}
          align={isFull ? "start" : "end"}
          sideOffset={8}
        >
          <Menu.Popup
            className={cn(
              "z-50 min-w-[220px] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5",
              isFull ? "origin-bottom-left" : "origin-top-right",
              "outline-none",
            )}
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-gray-900">
                {name}
              </p>
              {email && (
                <p className="truncate text-xs text-gray-500">{email}</p>
              )}
            </div>

            <Menu.Separator className="my-1 h-px bg-gray-100" />

            <Menu.Item
              className={cn(
                "flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-gray-700",
                "outline-none data-[highlighted]:bg-[#F6F6F6] data-[highlighted]:text-gray-900",
              )}
              render={<Link to="/dashboard" />}
            >
              Dashboard
            </Menu.Item>

            <Menu.Item
              className={cn(
                "flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-gray-700",
                "outline-none data-[highlighted]:bg-[#F6F6F6] data-[highlighted]:text-gray-900",
              )}
              render={<Link to="/dashboard/settings/notifications" />}
            >
              Notifications
            </Menu.Item>

            <Menu.Separator className="my-1 h-px bg-gray-100" />

            <Menu.Item
              className={cn(
                "flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-red-600",
                "outline-none data-[highlighted]:bg-red-50",
              )}
              onClick={onLogout}
            >
              Log out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

UserMenu.displayName = "UserMenu";

export { UserMenu, type UserMenuProps };
