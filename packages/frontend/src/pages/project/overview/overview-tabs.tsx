import { useSearchParams } from "react-router-dom";
import type { TabItem } from "@/components/molecules/tabs";

export const OVERVIEW_TABS = [
  { id: "activity", label: "Activity" },
  { id: "risks", label: "Risks" },
  { id: "weather", label: "Weather" },
  { id: "actions", label: "Recommended actions" },
  { id: "buildings", label: "Buildings" },
] as const satisfies readonly TabItem<string>[];

export type OverviewTab = (typeof OVERVIEW_TABS)[number]["id"];

const DEFAULT_TAB: OverviewTab = "activity";

/**
 * The active tab lives in `?tab=` so a reload or a deep link lands on the same
 * panel. A tab that is hidden (feature flag off, single building) falls back
 * to Activity.
 */
export function useOverviewTab(visible: readonly TabItem<OverviewTab>[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: OverviewTab = visible.some((t) => t.id === raw) ? (raw as OverviewTab) : DEFAULT_TAB;

  const setTab = (next: OverviewTab) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === DEFAULT_TAB) params.delete("tab");
        else params.set("tab", next);
        return params;
      },
      { replace: true },
    );
  };

  return { tab, setTab };
}
