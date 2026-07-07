import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { useDeleteActivity } from "@/hooks/use-activities";
import { formatCurrency, formatTimeAgo } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/project-types";

export function ActivityCard({
  projectId,
  activity,
  onEdit,
  onRaiseDelay,
}: {
  projectId: string;
  activity: Activity;
  onEdit: () => void;
  onRaiseDelay: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteActivity = useDeleteActivity();

  const plannedDays = daysBetween(activity.plannedStartAt, activity.plannedEndAt);
  const actualDays =
    activity.actualStartAt && activity.actualEndAt
      ? daysBetween(activity.actualStartAt, activity.actualEndAt)
      : null;
  const variance = actualDays !== null ? actualDays - plannedDays : null;
  const openDelays = activity.delays.filter((d) => d.resolvedAt === null);
  const totalCost = activity.delays.reduce((sum, d) => sum + d.costImpact, 0);
  const titlePrefix = activity.wbsCode ? `${activity.wbsCode} ` : "";

  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-white">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-gray-900 leading-snug">
              {titlePrefix}{activity.name}
            </p>
            <p className="mt-0.5 text-[12px] text-gray-400">
              {activity.isSummary ? "Programme summary" : activity.activityType}
              {activity.phaseName ? ` · ${activity.phaseName}` : ""}
              {activity.location ? ` · ${activity.location}` : ""}
            </p>
          </div>
          <CardMenu
            onEdit={onEdit}
            onDelete={() => setDeleteOpen(true)}
          />
        </div>

        {/* Stats table */}
        <div className="mx-5 mb-4 overflow-hidden rounded-xl border border-[#F0F0F0]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#FAFAFA]">
                {["Planned", "Actual", "Variance", "Delay Cost"].map((col) => (
                  <th key={col} className="px-4 py-2.5 text-[11px] font-medium text-gray-400">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#F0F0F0] bg-white">
                <td className="px-4 py-3 text-[13px] text-gray-900">
                  {plannedDays} days
                </td>
                <td className="px-4 py-3 text-[13px] text-gray-900">
                  {actualDays !== null ? `${actualDays} days` : "—"}
                </td>
                <td className={cn("px-4 py-3 text-[13px]",
                  variance === null ? "text-gray-900"
                  : variance > 0 ? "text-red-600"
                  : "text-[#1B8E45]",
                )}>
                  {variance === null ? "—" : variance > 0 ? `+${variance} days` : `${variance} days`}
                </td>
                <td className={cn("px-4 py-3 text-[13px]",
                  totalCost > 0 ? "text-[#C26A00]" : "text-gray-900",
                )}>
                  {totalCost > 0 ? formatCurrency(totalCost, "NGN") : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Delays list (when present) */}
        {activity.delays.length > 0 && (
          <div className="mx-5 mb-4 flex flex-col gap-2">
            {activity.delays.slice(0, 3).map((delay) => (
              <div
                key={delay.id}
                className="flex items-start gap-3 rounded-xl border border-[#F0F0F0] bg-white px-4 py-3"
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <span className="size-1.5 rounded-full bg-red-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-gray-900">
                    {delay.reasonName}
                    <span className="ml-1 text-[12px] font-normal text-gray-400">
                      · {delay.reasonCategory}
                    </span>
                  </p>
                  {delay.description && (
                    <p className="mt-0.5 text-[12px] text-gray-500 text-pretty">
                      {delay.description}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-gray-400">
                    Started {formatTimeAgo(delay.startedAt)}
                    {delay.costImpact > 0 &&
                      ` · cost ${formatCurrency(delay.costImpact, delay.currency)}`}
                    {delay.resolvedAt === null ? " · ongoing" : " · resolved"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#F0F0F0] px-5 py-3">
          <span className="text-[12px] text-gray-400">
            {openDelays.length > 0
              ? `${openDelays.length} open delay${openDelays.length === 1 ? "" : "s"}`
              : "No open delays"}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className='border border-primary text-primary bg-transparent rounded-[8px] py-[12px] px-[20px]'
            onClick={onRaiseDelay}
          >
            Log a delay
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() =>
          deleteActivity.mutate({ projectId, activityId: activity.id })
        }
        title="Delete activity"
        description="This permanently removes the activity and its logged delays. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}

// ── ⋮ Card menu ───────────────────────────────────────────────────────────────

function CardMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative ml-3 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        aria-label="Card actions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-gray-700 hover:bg-[#F6F6F6]"
            onClick={() => { setOpen(false); onEdit(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-red-600 hover:bg-red-50"
            onClick={() => { setOpen(false); onDelete(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.round((end - start) / (24 * 3600 * 1000)));
}
