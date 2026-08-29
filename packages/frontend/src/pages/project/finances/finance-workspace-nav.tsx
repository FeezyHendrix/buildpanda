import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useProjectContext } from "@/layouts/project-layout";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { canViewSection } from "@/lib/project-types";
import { cn } from "@/lib/utils";

/**
 * Single in-Finance navigation. The project sidebar now shows one "Finance"
 * entry; this hub is how users move between the finance areas without a nine-item
 * submenu. Each area is gated by the same flag + resource the sidebar used, so
 * nobody sees an area they couldn't reach before, and nothing is stranded.
 */
interface Workspace {
  label: string;
  slug: string;
  helper: string;
  flag?: string;
  resource?: string;
  /** Primary workspaces render as prominent tabs; the rest as secondary links. */
  primary?: boolean;
}

const WORKSPACES: readonly Workspace[] = [
  { label: "Overview", slug: "finances", helper: "Money position", flag: "commercial.finances", resource: "finances", primary: true },
  { label: "Invoices", slug: "finances/invoices", helper: "Send & track invoices", flag: "commercial.invoices", resource: "finances", primary: true },
  { label: "Expenses", slug: "finances/transactions", helper: "Site expenses & receipts", flag: "commercial.transactions", resource: "transactions", primary: true },
  { label: "Payments", slug: "finances/payments", helper: "Stage payments & requests", flag: "commercial.finances", resource: "finances", primary: true },
  { label: "Contract", slug: "finances/contract", helper: "Amount, changes & terms", flag: "commercial.finances", resource: "finances", primary: true },
  { label: "Payment requests", slug: "finances/payment-claims", helper: "Contractor requests", flag: "commercial.paymentClaims", resource: "finances" },
  { label: "Budget", slug: "finances/budget", helper: "Planning & allocation", flag: "commercial.budget", resource: "finances" },
  { label: "Final account", slug: "finances/final-account", helper: "Closeout summary", flag: "commercial.finances", resource: "finances" },
  { label: "Orders", slug: "finances/purchase-orders", helper: "Committed spend", flag: "commercial.purchaseOrders", resource: "finances" },
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
  const primary = visible.filter((w) => w.primary);
  const secondary = visible.filter((w) => !w.primary);

  const hrefFor = (slug: string) => `/project/${project.id}/${slug}`;
  const isActive = (slug: string) => {
    const to = hrefFor(slug);
    return slug === "finances"
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  if (visible.length <= 1) return null;

  return (
    <nav aria-label="Finance areas" className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-2">
        {primary.map((w) => {
          const active = isActive(w.slug);
          return (
            <Link
              key={w.slug}
              to={hrefFor(w.slug)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex flex-col rounded-xl border px-4 py-2.5 transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20",
                active
                  ? "border-transparent bg-[#004DE7] text-white"
                  : "border-[#EDEDED] bg-white text-gray-700 hover:border-[#004DE7]/40 hover:text-gray-900",
              )}
            >
              <span className="text-sm font-semibold">{w.label}</span>
              <span className={cn("text-[11px]", active ? "text-white/80" : "text-gray-500")}>
                {w.helper}
              </span>
            </Link>
          );
        })}
      </div>

      {secondary.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">More</span>
          {secondary.map((w) => {
            const active = isActive(w.slug);
            return (
              <Link
                key={w.slug}
                to={hrefFor(w.slug)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "font-medium transition-colors outline-none focus-visible:underline",
                  active ? "text-[#004DE7]" : "text-gray-500 hover:text-gray-900",
                )}
              >
                {w.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}

FinanceWorkspaceNav.displayName = "FinanceWorkspaceNav";
