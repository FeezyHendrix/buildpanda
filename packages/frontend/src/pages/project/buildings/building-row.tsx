import { Link } from "react-router-dom";
import { Copy } from "lucide-react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { Badge } from "@/components/atoms/badge";
import { ProgressBar } from "@/components/atoms/progress-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import type { Building } from "@/api/buildings";
import { BuildingStatusBadge } from "./building-status-badge";

interface BuildingRowProps {
  building: Building;
  stagesHref: string;
  canManage: boolean;
  onClone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** One building: name and status, how far along it is, and its ⋮ actions. */
export function BuildingRow({ building, stagesHref, canManage, onClone, onEdit, onDelete }: BuildingRowProps) {
  const done = building.progressPercent >= 100;

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:h-14 sm:flex-row sm:items-center sm:gap-6 sm:py-0">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link
          to={stagesHref}
          className="truncate text-caption-l! font-semibold text-[#1E1E1E] transition-colors hover:text-primary-500"
        >
          {building.name}
        </Link>
        {building.code ? (
          <Badge tone="neutral" size="sm">
            {building.code}
          </Badge>
        ) : null}
        <BuildingStatusBadge status={building.status} />
      </div>

      <div className="flex w-full shrink-0 items-center gap-3 sm:w-[375px]">
        <ProgressBar
          value={building.progressPercent}
          tone={done ? "success" : "brand"}
          size="md"
          className="flex-1 bg-[#E5E5E5]"
          fillClassName="rounded-none"
          aria-label={`${building.name} progress`}
        />
        <span className="w-10 shrink-0 text-caption-l! font-medium text-[#1E1E1E]">{building.progressPercent}%</span>
      </div>

      <div className="flex w-8 shrink-0 justify-end">
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={`Actions for ${building.name}`}
                  className="flex size-8 items-center justify-center rounded-md text-[#1E1E1E] hover:bg-[#F5F5F5]"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                    <circle cx="7" cy="2.5" r="1.3" />
                    <circle cx="7" cy="7" r="1.3" />
                    <circle cx="7" cy="11.5" r="1.3" />
                  </svg>
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-[144px]">
              <DropdownMenuItem onSelect={onClone}>
                <Copy className="size-4 shrink-0" />
                Clone Project
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEdit}>
                <ReactSVG src={icons2.edit} className="[&_svg]:size-4 shrink-0" />
                Edit Building
              </DropdownMenuItem>
              <DropdownMenuItem tone="danger" onSelect={onDelete}>
                <ReactSVG src={icons2.delete} className="[&_svg]:size-4 shrink-0" />
                Delete Building
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

BuildingRow.displayName = "BuildingRow";
