import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "@/components/atoms/avatar";
import { NotificationBell } from "@/components/atoms/notification-bell";
import { GlobalSearch } from "@/components/molecules/global-search";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/use-notifications";
import { notificationHref } from "@/lib/notification-link";
import { formatTimeAgo } from "@/lib/formatters";
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
  /** Page title shown on the left (Ernest's app bar). When set the logo is not shown — the sidebar carries it. */
  title?: string;
  // Either is optional: a slim topbar (e.g. when the user lives in a sidebar)
  // can render with neither, leaving just search + notifications.
  userSlot?: ReactNode;
  user?: NavbarUser;
  className?: string;
};

function Navbar({
  user,
  notificationCount,
  showNotifications = true,
  showLogo = false,
  sticky = false,
  searchPlaceholder = "Search Build Panda",
  leadingSlot,
  title,
  userSlot,
  className,
}: NavbarProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data: notificationsData } = useNotifications({ limit: 8 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const resolvedNotificationCount = notificationCount ?? notificationsData?.unreadCount ?? 0;

  useEffect(() => {
    if (!notificationsOpen) return;
    const handlePointer = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [notificationsOpen]);

  return (
    <nav
      className={cn(
        "flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line-hair bg-surface-alt px-4",
        title ? "lg:px-6" : "lg:grid lg:grid-cols-3 lg:px-8",
        sticky && "sticky top-0 z-40",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {title ? (
          <h1 className="truncate text-2xl font-medium text-ink">{title}</h1>
        ) : null}
        {showLogo && !title && (
          <Link to="/" className="shrink-0">
            <img src={logo} alt="BuildPanda" className="h-8 lg:h-9" />
          </Link>
        )}
        {leadingSlot && (
          <>
            {showLogo && <span className="hidden h-6 w-px shrink-0 bg-gray-200 sm:block" aria-hidden="true" />}
            <div className="flex min-w-0 items-center">{leadingSlot}</div>
          </>
        )}
      </div>

      {/* Search — hidden on mobile to avoid overflow; centred in the 3-column (logo) layout */}
      {title ? null : (
        <div className="hidden lg:flex lg:justify-center">
          <GlobalSearch className="w-72" placeholder={searchPlaceholder} />
        </div>
      )}

      <div className="flex min-w-0 items-center justify-end gap-4">
        {title ? <GlobalSearch className="hidden w-[300px] lg:block" placeholder={searchPlaceholder} /> : null}
        <div className="flex items-center gap-2">
          {showNotifications && (
            <div ref={notificationsRef} className="relative">
              <NotificationBell
                count={resolvedNotificationCount}
                onClick={() => setNotificationsOpen((open) => !open)}
                aria-expanded={notificationsOpen}
              />
              {notificationsOpen && (
                <div className="absolute -right-15 lg:-right-10 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-line bg-white shadow-card">
                  <div className="flex items-center justify-between border-b border-line-hair px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">Notifications</p>
                      <p className="text-xs text-gray-500">{resolvedNotificationCount} unread</p>
                    </div>
                    {resolvedNotificationCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllRead.mutate()}
                        className="text-xs font-medium text-primary-500 hover:text-primary-600"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 space-y-1 overflow-y-auto p-2.5">
                    {(notificationsData?.notifications ?? []).length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">No notifications yet.</div>
                    ) : (
                      notificationsData!.notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => {
                            if (!notification.readAt) markRead.mutate(notification.id);
                            setNotificationsOpen(false);
                            navigate(notificationHref(notification));
                          }}
                          className={cn(
                            "flex w-full gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-black/5",
                            !notification.readAt && "bg-primary-50/60",
                          )}
                        >
                          <span className={cn("mt-1 size-2 shrink-0 rounded-full", notification.readAt ? "bg-gray-200" : "bg-primary-500")} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-gray-900">{notification.title}</span>
                            {notification.body && <span className="mt-0.5 block text-xs text-gray-500">{notification.body}</span>}
                            <span className="mt-1 block text-[11px] text-gray-400">{formatTimeAgo(notification.createdAt)}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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
