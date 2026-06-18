import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const LAST_SUITE_KEY = "buildpanda:last-suite";
const SUITE_SALES = "sales";
const SUITE_CONSTRUCTION = "construction";

const SUITES = [
  {
    id: SUITE_CONSTRUCTION,
    href: "/dashboard",
    label: "Construction",
    icon: "🏗",
    matches: (pathname: string) =>
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname.startsWith("/project/"),
  },
  {
    id: SUITE_SALES,
    href: "/sales",
    label: "Pre-Construction",
    icon: "📐",
    matches: (pathname: string) => pathname === "/sales" || pathname.startsWith("/sales/"),
  },
] as const;

interface SuiteSwitcherProps {
  variant?: "sidebar" | "navbar" | "segmented";
  className?: string;
}

function SuiteSwitcher({ variant = "navbar", className }: SuiteSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const active = SUITES.find((s) => s.matches(location.pathname)) ?? SUITES[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Both workspaces always visible as a segmented toggle — no dropdown needed
  // for a two-way switch. Used in the full-height sidebar.
  if (variant === "segmented") {
    return (
      <div className={cn("flex flex-col gap-0.5 rounded-xl bg-[#ECECEC] p-1", className)}>
        {SUITES.map((suite) => {
          const isActive = suite.id === active.id;
          return (
            <Link
              key={suite.id}
              to={suite.href}
              onClick={() => localStorage.setItem(LAST_SUITE_KEY, suite.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800",
              )}
            >
              <span className="text-base leading-none">{suite.icon}</span>
              <span>{suite.label}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  const trigger =
    variant === "sidebar" ? (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="text-xl">{active.icon}</span>
        <span className="text-sm font-semibold text-gray-900">{active.label}</span>
        <ChevronDown />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-full bg-white px-3 text-sm font-medium text-gray-700 outline-none ring-1 ring-gray-200 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-[#004DE7]/30"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="text-base leading-none">{active.icon}</span>
        <span>{active.label}</span>
        <ChevronDown />
      </button>
    );

  return (
    <div ref={ref} className={cn("relative", className)}>
      {trigger}

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg",
            variant === "sidebar" ? "left-3 top-full" : "right-0 top-full",
          )}
          role="menu"
        >
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Workspaces
          </p>
          {SUITES.map((suite) => {
            const isActive = suite.id === active.id;
            const baseClass =
              "flex items-center gap-3 px-3 py-2.5 text-sm font-medium";
            if (isActive) {
              return (
                <div
                  key={suite.id}
                  className={cn(baseClass, "bg-blue-50 text-[#004DE7]")}
                  aria-current="true"
                >
                  <span className="text-base">{suite.icon}</span>
                  <span>{suite.label}</span>
                  <CheckMark />
                </div>
              );
            }
            return (
              <Link
                key={suite.id}
                to={suite.href}
                onClick={() => {
                  localStorage.setItem(LAST_SUITE_KEY, suite.id);
                  setOpen(false);
                }}
                className={cn(baseClass, "text-gray-600 hover:bg-gray-50")}
                role="menuitem"
              >
                <span className="text-base">{suite.icon}</span>
                <span>{suite.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-gray-400">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-auto size-3.5 opacity-60">
      <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

SuiteSwitcher.displayName = "SuiteSwitcher";

export { SuiteSwitcher, LAST_SUITE_KEY, SUITE_SALES, SUITE_CONSTRUCTION };
