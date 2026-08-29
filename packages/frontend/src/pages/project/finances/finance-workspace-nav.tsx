import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useProjectContext } from "@/layouts/project-layout";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { canViewSection } from "@/lib/project-types";
import { cn } from "@/lib/utils";

// Lean underline tab bar for the finance section — mirrors the sidebar Finance
// group (same six areas, flags and resources) so the two navigations agree.
// Same gating as the sidebar, so nothing is shown a user couldn't already reach.
interface Workspace {
  label: string;
  slug: string;
  flag?: string;
  resource?: string;
}

const WORKSPACES: readonly Workspace[] = [
  { label: "Overview", slug: "finances", flag: "commercial.finances", resource: "finances" },
  { label: "Contract & Stages", slug: "finances/contract-stages", flag: "commercial.finances", resource: "finances" },
  { label: "Invoices", slug: "finances/invoices", flag: "commercial.invoices", resource: "finances" },
  { label: "Payments", slug: "finances/payments", flag: "commercial.finances", resource: "finances" },
  { label: "Expenses", slug: "finances/transactions", flag: "commercial.transactions", resource: "transactions" },
  { label: "Change Orders", slug: "change-requests", flag: "workflow.changeRequests", resource: "change-requests" },
] as const;

export function FinanceWorkspaceNav({ className }: { className?: string }) {
  const { project, access } = useProjectContext();
  const location = useLocation();
  const { data: flagsData } = useFeatureFlags();

  const enabled = useMemo(
    () => new Map((flagsData?.flags ?? []).map((f) => [f.key, f.enabled])),
    [flagsData],
  );
  const isOn = (key?: string) => !key || (enabled.get(key) ?? true);

  const visible = useMemo(
    () => WORKSPACES.filter((w) => isOn(w.flag) && canViewSection(access, w.flag, w.resource)),
    [enabled, access],
  );

  const hrefFor = (slug: string) => `/project/${project.id}/${slug}`;
  const isActive = (slug: string) => {
    const to = hrefFor(slug);
    return slug === "finances"
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  if (visible.length <= 1) return null;

  return (
    <nav
      aria-label="Finance areas"
      className={cn(
        "flex items-center gap-0.5 overflow-x-auto border-b border-[#EDEDED] no-scrollbar",
        className,
      )}
    >
      {visible.map((w) => {
        const active = isActive(w.slug);
        return (
          <Link
            key={w.slug}
            to={hrefFor(w.slug)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20",
              active ? "text-[#004DE7]" : "text-gray-500 hover:text-gray-900",
            )}
          >
            {w.label}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-3 -bottom-px h-0.5 rounded-full",
                active ? "bg-[#004DE7]" : "bg-transparent",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}

FinanceWorkspaceNav.displayName = "FinanceWorkspaceNav";
