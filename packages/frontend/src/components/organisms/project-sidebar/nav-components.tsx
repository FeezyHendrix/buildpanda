import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ReactSVG } from "react-svg";
import { cn } from "@/lib/utils";
import type { IconComponent, GroupNavItem, ProjectNavItem } from "./constants";
import { ChevronRight } from "lucide-react";

// `Icon` is either a component (existing nav icons) or an icons2 asset src
// (rendered inline via ReactSVG so it can still inherit `currentColor`).
function NavIcon({ Icon, className }: { Icon: IconComponent | string; className?: string }) {
  return typeof Icon === "string" ? (
    <ReactSVG src={Icon} className={cn("[&_svg]:size-[18px] shrink-0", className)} />
  ) : (
    <Icon className={cn("size-[18px]", className)} />
  );
}

export function SidebarNavGroup({
  label,
  Icon,
  items,
  active,
  activeIconClassName,
  onClose,
}: {
  label: string;
  Icon: IconComponent | string;
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
          "group flex w-full items-center gap-3 px-3 py-2.5 text-caption-m font-medium",
          "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
          active ? "text-primary bg-primary-50" : "text-black-500 hover:text-primary hover:bg-primary-50",
        )}
      >
        <NavIcon
          Icon={Icon}
          className={cn(
            active && activeIconClassName,
            active ? "[&_path]:fill-primary" : "[&_path]:fill-black-500 group-hover:[&_path]:fill-primary",
          )}
        />
        <span className="flex-1 truncate text-left text-caption-m">{label}</span>
        {/* Mockup shows every group row with a static down chevron, open or
            closed — it's not an expand/collapse rotation indicator here. */}
        <ChevronRight className="size-4 rotate-90 text-grey-450" />
      </button>
      {open && (
        <div className="ml-6 mt-1 flex flex-col">
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
    <div className="ml- border-l border-gray-200 pl-3">
      <Link
        key={to}
        to={to}
        onClick={onClose}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex items-center py-2 pl-4 pr-3 text-caption-m font-medium",
          "outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-gray-900/10",
          isActive
            ? "bg-primary-50 font-semibold text-primary"
            : "text-black-500 hover:text-primary hover:bg-primary-50",
        )}
      >
        {isActive && (
          <span
            className={cn(
              "absolute -left-[12.5px] top-1/2",
              "h-5 w-[2px] -translate-y-1/2",
              "bg-primary-500",
            )}
          />
        )}

        <span className="truncate text-caption-m">{label}</span>
      </Link>
    </div>
  );
}

export function ProjectNavLink({ item, onClose }: { item: ProjectNavItem; onClose?: () => void }) {
  const { Icon, label, to, badge } = item;

  return (
    <NavLink
      to={to}
      onClick={onClose}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 px-3 py-2.5 text-caption-m font-medium text-black-500",
          "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "hover:bg-primary-50 hover:text-primary",
          isActive && "bg-primary-50 text-primary",
        )
      }
    >
      {({ isActive }) => (
        <>
          <NavIcon Icon={Icon} className={isActive ? "[&_path]:fill-primary" : "[&_path]:fill-black-500 group-hover:[&_path]:fill-primary"} />
          <span className="flex-1 truncate text-caption-m">{label}</span>
          {badge !== undefined && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#004DE7] px-1.5 text-[10px] font-bold leading-none text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
