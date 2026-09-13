import { useEffect, useMemo, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";
import { useProjectActivities } from "@/hooks/use-activities";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import type { LookAhead } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";
import {
  delayedActivityIds,
  LOOK_AHEAD_STATUS_META,
  overlapsWindow,
} from "@/pages/project/look-aheads/look-ahead-helpers";

const FIELD = INPUT_CLASS;

export interface LookAheadFormValues {
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  totalWorkers: number | null;
  activityIds: string[];
}

interface UpsertLookAheadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initial?: LookAhead | null;
  onSubmit: (values: LookAheadFormValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextWeek(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function UpsertLookAheadDialog({
  open,
  onOpenChange,
  projectId,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertLookAheadDialogProps) {
  const { data: activities = [] } = useProjectActivities(projectId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(nextWeek());
  const [totalWorkers, setTotalWorkers] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setStartDate(initial?.startDate ?? today());
    setEndDate(initial?.endDate ?? nextWeek());
    setTotalWorkers(initial?.totalWorkers != null ? String(initial.totalWorkers) : "");
    setSelectedActivityIds(new Set(initial?.activities.map((a) => a.activityId) ?? []));
    setActivityFilter("");
  }, [open, initial]);

  const filteredActivities = useMemo(() => {
    const term = activityFilter.trim().toLowerCase();
    if (!term) return activities;
    return activities.filter((a) => a.name.toLowerCase().includes(term));
  }, [activities, activityFilter]);

  // The window already knows which activities fall inside it — offer them
  // instead of making the PM tick 32 boxes by hand (finding F28).
  const inRange = useMemo(
    () => activities.filter((activity) => overlapsWindow(activity, startDate, endDate)),
    [activities, startDate, endDate],
  );
  const delayed = useMemo(() => delayedActivityIds(activities), [activities]);
  const unselectedInRange = inRange.filter((activity) => !selectedActivityIds.has(activity.id)).length;

  function selectAllInRange(): void {
    setSelectedActivityIds((prev) => {
      const next = new Set(prev);
      for (const activity of inRange) next.add(activity.id);
      return next;
    });
  }

  const isValid = name.trim().length > 0 && startDate.length > 0 && endDate.length > 0 && endDate >= startDate;

  function toggleActivity(activityId: string): void {
    setSelectedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      startDate,
      endDate,
      totalWorkers: totalWorkers.trim() ? Number(totalWorkers) : null,
      activityIds: [...selectedActivityIds],
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit look ahead" : "New look ahead"}
      description="Pick the activities from the project chart or imported programme that this look-ahead period covers."
      submitLabel={initial ? "Save changes" : "Create look ahead"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="la-name">Name</Label>
        <input
          id="la-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Week of 14 Jul — Foundations"
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="la-description">Description</Label>
        <textarea
          id="la-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="la-start">Start date</Label>
          <input
            id="la-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="la-end">End date</Label>
          <input
            id="la-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          {/* Approval is a sign-off with a name and a time against it, so it is
              its own action — never a value this form can set (finding F29). */}
          <div className="flex h-11 items-center gap-2 rounded-lg border border-line-hair bg-surface-alt px-3">
            <Badge tone={LOOK_AHEAD_STATUS_META[initial?.status ?? "Draft"].tone} size="sm">
              {LOOK_AHEAD_STATUS_META[initial?.status ?? "Draft"].label}
            </Badge>
          </div>
          <p className="text-xs text-ink-muted">
            {initial?.approvedByName
              ? `Approved by ${initial.approvedByName}. Revoke it from the look-ahead to edit the sign-off.`
              : "Approve from the look-ahead itself — it records who approved it and when."}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="la-workers">Total workers planned</Label>
          <input
            id="la-workers"
            type="number"
            min={0}
            value={totalWorkers}
            onChange={(e) => setTotalWorkers(e.target.value)}
            placeholder="e.g. 12"
            className={FIELD}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Activities ({selectedActivityIds.size} selected)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={unselectedInRange === 0}
            onClick={selectAllInRange}
          >
            {inRange.length === 0
              ? "Nothing planned in this window"
              : `Select all in range (${inRange.length})`}
          </Button>
        </div>
        <input
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value)}
          placeholder="Search activities…"
          className={FIELD}
        />
        <div className="max-h-56 overflow-y-auto rounded-lg border border-line-hair">
          {filteredActivities.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-gray-400">
              No activities on the project chart yet.
            </p>
          ) : (
            filteredActivities.map((activity) => {
              const selected = selectedActivityIds.has(activity.id);
              return (
                <label
                  key={activity.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 border-b border-line-hair px-3 py-2 text-sm transition-colors last:border-b-0",
                    selected ? "bg-primary-50" : "hover:bg-surface-alt",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected}
                    onChange={() => toggleActivity(activity.id)}
                  />
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                      selected ? "border-primary-500 bg-primary-500" : "border-gray-300 bg-white",
                    )}
                  >
                    {selected && (
                      <svg viewBox="0 0 6 5" fill="none" className="h-2 w-2">
                        <path
                          d="M0.5 2.5l2 2 3-4"
                          stroke="white"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span
                    className={cn(
                      "flex-1 truncate",
                      selected ? "font-medium text-primary-700" : "text-gray-900",
                    )}
                  >
                    {activity.name}
                  </span>
                  {delayed.has(activity.id) ? (
                    <Badge tone="danger" size="sm">⚠ Delayed</Badge>
                  ) : null}
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      selected ? "text-primary-400" : "text-gray-400",
                    )}
                  >
                    {activity.plannedStartAt.slice(0, 10)}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>
    </FormDrawer>
  );
}

export { UpsertLookAheadDialog };
