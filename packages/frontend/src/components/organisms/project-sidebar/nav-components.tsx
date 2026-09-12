import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import { cn } from "@/lib/utils";
import type { IconComponent, GroupNavItem, ProjectNavItem } from "./constants";

/**
 * Dark-sidebar nav pieces (Ernest's NavLinks): 48px rows with an 18px icon and
 * a 16px label, a white wash on hover and on the active row; sub-links sit
 * 28px in with a stronger wash. In the collapsed rail only the icon shows.
 */

const ROW_CLASS =
  "flex w-full items-center gap-2 px-6 py-3 text-base text-ink-inverted outline-none transition-colors duration-150 hover:bg-white/10 focus-visible:bg-white/10";
const ROW_ACTIVE_CLASS = "bg-white/10";
const ICON_CLASS = "size-[18px] shrink-0 text-ink-disabled [&_svg]:size-[18px]";

export function SidebarGroupHeading({ children, collapsed }: { children: string; collapsed: boolean }) {
  if (collapsed) return <div className="mx-4 my-2 h-px bg-white/10" aria-hidden="true" />;
  return (
    <p className="px-6 pb-2 pt-4 text-sm font-medium uppercase text-ink-muted">{children}</p>
  );
}

export function SidebarNavGroup({
  label,
  Icon,
  items,
  active,
  collapsed,
  onClose,
}: {
  label: string;
  Icon: IconComponent;
  items: GroupNavItem[];
  active: boolean;
  collapsed: boolean;
  activeIconClassName?: string;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(active);
  const expanded = open || active;

  if (collapsed) {
    return (
      <Link
        to={items[0]?.to ?? "#"}
        onClick={onClose}
        title={label}
        aria-current={active ? "page" : undefined}
        className={cn(ROW_CLASS, "justify-center px-0", active && ROW_ACTIVE_CLASS)}
      >
        <Icon className={ICON_CLASS} />
      </Link>
    );
  }

  return (
    <div className={cn("flex flex-col", expanded && "pb-1")}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={expanded}
        className={cn(ROW_CLASS, active && ROW_ACTIVE_CLASS)}
      >
        <Icon className={ICON_CLASS} />
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronRightIcon
          className={cn(
            "size-4 text-ink-disabled transition-transform duration-200",
            expanded && "rotate-90",
          )}
        />
      </button>
      {expanded && (
        <div className="flex flex-col gap-1 pl-7 pr-4 pt-1">
          {items.map((item) => (
            <ProjectGroupNavLink key={item.slug} item={item} onClose={onClose} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectGroupNavLink({ item, onClose }: { item: GroupNavItem; onClose?: () => void }) {
  const { label, slug, to } = item;
  const location = useLocation();
  const isActive =
    slug === "finances" || slug === "schedules"
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(`${to}/`);
  return (
    <Link
      to={to}
      onClick={onClose}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center rounded-lg px-4 py-1.5 text-base text-ink-inverted outline-none transition-colors duration-150",
        "hover:bg-white/30 focus-visible:bg-white/30",
        isActive && "bg-white/30",
      )}
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function ProjectNavLink({
  item,
  collapsed = false,
  onClose,
}: {
  item: ProjectNavItem;
  collapsed?: boolean;
  onClose?: () => void;
}) {
  const { Icon, label, to, badge } = item;
  const IconCmp = Icon as React.ElementType;

  return (
    <NavLink
      to={to}
      onClick={onClose}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(ROW_CLASS, collapsed && "justify-center px-0", isActive && ROW_ACTIVE_CLASS)
      }
    >
      <span className={cn("relative", ICON_CLASS)}>
        <IconCmp className="size-[18px]" />
        {collapsed && badge !== undefined && (
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary-400" aria-hidden="true" />
        )}
      </span>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge !== undefined && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-sm bg-primary-500 px-1.5 text-[10px] font-semibold leading-none text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}
