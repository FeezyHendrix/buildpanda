import { useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs } from "@/components/molecules/tabs";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import type { FinanceTab } from "@/lib/finance-routes";

/**
 * The active tab lives in `?tab=` so a sidebar link, a notification deep link
 * or a reload all land on the same tab. Tabs whose feature flag is off are
 * hidden, mirroring the flag gate their standalone routes used to carry; other
 * query params (e.g. `?compose=1`) survive a tab change.
 */
export function useFinanceTab<T extends string>(tabs: readonly FinanceTab<T>[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: flagsData } = useFeatureFlags();

  const visible = useMemo(() => {
    const enabled = new Map((flagsData?.flags ?? []).map((f) => [f.key, f.enabled]));
    return tabs.filter((t) => !t.flag || (enabled.get(t.flag) ?? true));
  }, [tabs, flagsData]);

  const fallback = visible[0]?.id ?? tabs[0]!.id;
  const raw = searchParams.get("tab");
  const tab: T = visible.some((t) => t.id === raw) ? (raw as T) : fallback;

  const setTab = (next: T) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === fallback) params.delete("tab");
        else params.set("tab", next);
        return params;
      },
      { replace: true },
    );
  };

  return { tab, setTab, visible };
}

interface FinanceTabBarProps<T extends string> {
  tabs: readonly FinanceTab<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}

export function FinanceTabBar<T extends string>({ tabs, value, onChange, ariaLabel }: FinanceTabBarProps<T>) {
  return <Tabs items={tabs} value={value} onChange={onChange} ariaLabel={ariaLabel} className="mt-6" />;
}

FinanceTabBar.displayName = "FinanceTabBar";

interface TabHeaderProps {
  heading: string;
  description?: string;
  actions?: ReactNode;
}

/** The heading row every tab body opens with; the page above it owns the title. */
export function TabHeader({ heading, description, actions }: TabHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{heading}</h3>
        {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

TabHeader.displayName = "TabHeader";

/** Outer frame shared by the finance pages so every page sits on the same gutter. */
export function FinancePageFrame({ children }: { children: ReactNode }) {
  return <div className="w-full px-4 pt-4 pb-8 sm:px-10 lg:px-6">{children}</div>;
}

FinancePageFrame.displayName = "FinancePageFrame";
