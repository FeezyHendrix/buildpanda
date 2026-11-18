import { useState, type ReactNode } from "react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import type { BuildingPhaseStatus } from "@/api/building-phases";
import { ProgressBar } from "@/components";
import { Badge } from "@/components/atoms/badge";
import { cn } from "@/lib/utils";

function PhaseStatusBadge({ status }: { status: BuildingPhaseStatus }) {
  if (status === "Completed")
    return (
      <Badge tone="success" size="md">
        Completed
      </Badge>
    );
  if (status === "In Progress")
    return (
      <Badge tone="info" size="md">
        In progress
      </Badge>
    );
  return (
    <Badge tone="neutral" variant="outline" size="md">
      Not Started
    </Badge>
  );
}

const STAGE_COLUMNS = ["Build Stages", "Status", "Start date", "End date", "Progress"] as const;

interface PhaseSectionProps {
  name: string;
  stageCount: number;
  /** Server-derived; null for the group of stages that sit outside every phase. */
  summary: { status: BuildingPhaseStatus; progressPercent: number } | null;
  isOpen: boolean;
  onToggle: () => void;
  /** Omitted when the caller may not rename (or there is no phase to rename). */
  onRename?: (name: string) => void;
  /** Shown instead of the table when there are no rows to render. */
  emptyText: string | null;
  /** The stage rows. */
  children: ReactNode;
}

export function PhaseSection({
  name,
  stageCount,
  summary,
  isOpen,
  onToggle,
  onRename,
  emptyText,
  children,
}: PhaseSectionProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  function commit() {
    const v = value.trim();
    setEditing(false);
    if (v && v !== name) onRename?.(v);
  }

  return (
    <div className="border-b-[0.5px] border-border last:border-b-0">
      {/* Phase header — mirrors table colgroup: w-8 | 18%×5 | w-8 */}
      {editing ? (
        // Editing collapses the row to just the name input — count, status,
        // progress and the edit action hide until committed (Enter/blur) or
        // cancelled (Escape), matching the Figma.
        <div className="flex min-w-0 items-center py-3 pl-4 pr-2">
          <div className="w-8 shrink-0" aria-hidden />
          <input
            autoFocus
            value={value}
            maxLength={80}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label={`Rename ${name}`}
            className="h-9 w-[280px] max-w-full border border-[#EBEBEB] bg-white px-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#111827]"
          />
        </div>
      ) : (
        <div className="flex min-w-0 items-center py-3 pl-4 pr-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-8 shrink-0 items-center justify-center text-[#6B7280] hover:text-[#111827]"
            aria-label={isOpen ? `Collapse ${name}` : `Expand ${name}`}
            aria-expanded={isOpen}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn("transition-transform", isOpen && "rotate-180")}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <div className="w-[18%] min-w-0 pr-3">
            <span className="block truncate text-sm font-semibold text-[#111827]">
              {name}
            </span>
          </div>

          <div className="w-[18%] pr-3">
            <span className="text-xs text-[#9CA3AF]">{stageCount} stages</span>
          </div>

          <div className="w-[18%] pr-3">
            {summary ? <PhaseStatusBadge status={summary.status} /> : null}
          </div>

          <div className="flex flex-1 items-center gap-1 pr-3">
            {summary ? (
              <>
                <ProgressBar value={summary.progressPercent} className="h-[7px] flex-1" />
                <span className="w-9 shrink-0 text-right text-xs font-medium text-[#111827] tabular-nums">
                  {summary.progressPercent}%
                </span>
              </>
            ) : null}
          </div>

          {onRename ? (
            <button
              type="button"
              onClick={() => {
                setValue(name);
                setEditing(true);
              }}
              className="flex w-8 shrink-0 items-center justify-center text-[#9CA3AF] hover:text-[#111827]"
              aria-label={`Edit ${name}`}
            >
              <ReactSVG src={icons2.editTwo} className="[&_svg]:size-4" />
            </button>
          ) : (
            <div className="w-8 shrink-0" aria-hidden />
          )}
        </div>
      )}

      {isOpen ? (
        <div className="border-t-[0.5px] border-border bg-[#FAFAFA] px-4 py-4">
          {emptyText ? (
            <div className="border border-dashed border-[#E5E7EB] bg-white px-4 py-6 text-center text-sm text-[#9CA3AF]">
              {emptyText}
            </div>
          ) : (
            <div className="overflow-hidden bg-white">
              <table className="w-full min-w-[680px] table-fixed text-left border-[0.5px] border-border">
                <colgroup>
                  <col className="w-8" />
                  {STAGE_COLUMNS.map((column) => (
                    <col key={column} className="w-[18%]" />
                  ))}
                  <col className="w-8" />
                </colgroup>
                <thead className="bg-gray-50">
                  <tr className="border-b-[0.5px] border-border text-caption-m text-[#606060] font-semibold">
                    <th className="px-2 py-3" />
                    {STAGE_COLUMNS.map((column) => (
                      <th key={column} className="px-3 py-3 text-caption-l font-semibold text-[#606060]">
                        {column}
                      </th>
                    ))}
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y-[0.5px] divide-border bg-white">{children}</tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
PhaseSection.displayName = "PhaseSection";
