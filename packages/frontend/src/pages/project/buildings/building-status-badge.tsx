import type { BuildingStatus } from "@/api/buildings";
import { cn } from "@/lib/utils";

export const BUILDING_STATUS_LABEL: Record<BuildingStatus, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  on_hold: "On hold",
};

const STATUS_CLASS: Record<BuildingStatus, string> = {
  planned: "border-[#EBEBEB] bg-white text-[#1E1E1E]",
  active: "border-[#DBE7FF] bg-[#EAF1FF] text-[#004DE7]",
  completed: "border-[#B9F8CF] bg-[#F0FDF4] text-[#00A63E]",
  on_hold: "border-[#FEE685] bg-[#FFFBEB] text-[#E17100]",
};

export function BuildingStatusBadge({ status }: { status: BuildingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2 text-caption-m! font-medium whitespace-nowrap",
        STATUS_CLASS[status],
      )}
    >
      {BUILDING_STATUS_LABEL[status]}
    </span>
  );
}

BuildingStatusBadge.displayName = "BuildingStatusBadge";
