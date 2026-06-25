import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import { cn } from "@/lib/utils";
import type { IconComponent, GroupNavItem, ProjectNavItem } from "./constants";

export function SidebarNavGroup({
  label,
  Icon,
  items,
  active,
  activeIconClassName,
  onClose,
}: {
  label: string;
  Icon: IconComponent;
  items: GroupNavItem[];
  active: boolean;
  activeIconClassName?: string;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(active);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
          "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "hover:bg-[#EDEDED]/60",
          active ? "text-gray-900" : "text-gray-500 hover:text-gray-900",
        )}
      >
        <Icon className={cn("size-[18px]", active && activeIconClassName)} />
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronRightIcon
          className={cn(
            "size-4 text-gray-400 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-4">
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
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500",
        "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
        "hover:bg-[#EDEDED]/60 hover:text-gray-900",
        isActive && "bg-[#EDEDED] text-gray-900",
      )}
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function ProjectNavLink({ item, onClose }: { item: ProjectNavItem; onClose?: () => void }) {
  const { Icon, label, to, badge } = item;
  const IconCmp = Icon as React.ElementType;

  return (
    <NavLink
      to={to}
      onClick={onClose}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500",
          "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "hover:bg-[#EDEDED]/60 hover:text-gray-900",
          isActive && "bg-[#EDEDED] text-gray-900",
        )
      }
    >
      <IconCmp />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#004DE7] px-1.5 text-[10px] font-bold leading-none text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}
