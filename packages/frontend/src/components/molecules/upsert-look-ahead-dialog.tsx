import { useEffect, useMemo, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Select, type SelectOption } from "@/components/atoms/select";
import { TextInput } from "@/components/atoms/text-input";
import { cn } from "@/lib/utils";
import { useProjectActivities } from "@/hooks/use-activities";
import { LOOK_AHEAD_STATUSES } from "@/lib/project-types";
import type { LookAhead, LookAheadStatus } from "@/lib/project-types";

const STATUS_LABEL: Record<LookAheadStatus, string> = {
  Draft: "Draft",
  UnderReview: "Under Review",
  Approved: "Approved",
};

const STATUS_OPTIONS: SelectOption[] = LOOK_AHEAD_STATUSES.map((s) => ({
  value: s,
  label: STATUS_LABEL[s],
}));

export interface LookAheadFormValues {
  name: string;
  description: string | null;
  status: LookAheadStatus;
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
  const [status, setStatus] = useState<LookAheadStatus>("Draft");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(nextWeek());
  const [totalWorkers, setTotalWorkers] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setStatus(initial?.status ?? "Draft");
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

  const isValid =
    name.trim().length > 0 &&
    startDate.length > 0 &&
    endDate.length > 0 &&
    endDate >= startDate;

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
      status,
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
      title={initial ? "Edit look ahead" : "Add Look Ahead"}
      description="Pick the activities from the project chart or imported programme that this look-ahead period covers"
      submitLabel={initial ? "Save changes" : "Create Look Ahead"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      footerVariant="stacked"
    >
      {/* Name */}
      <TextInput
        label="Name"
        value={name}
        onChange={setName}
        placeholder="e.g Week of 14 Jul - Foundations"
        autoFocus
      />

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="la-description"
          className="text-[13px] font-medium leading-none text-[#1E1E1E]"
        >
          Description
        </label>
        <textarea
          id="la-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is the lookahead about?"
          rows={4}
          className={cn(
            "min-h-[108px] w-full resize-none border border-[#EBEBEB] bg-white px-3.5 py-3 text-[14px] text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none transition-colors",
            "focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10",
          )}
        />
      </div>

      {/* Start / End Date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="la-start"
            className="text-[13px] font-medium leading-none text-[#1E1E1E]"
          >
            Start Date
          </label>
          <input
            id="la-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="DD/MM/YYYY"
            className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-[14px] text-[#1E1E1E] outline-none placeholder:text-[#B0B0B0] focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="la-end"
            className="text-[13px] font-medium leading-none text-[#1E1E1E]"
          >
            End Date
          </label>
          <input
            id="la-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="DD/MM/YYYY"
            className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-[14px] text-[#1E1E1E] outline-none placeholder:text-[#B0B0B0] focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
          />
        </div>
      </div>

      {/* Status / Total Workers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-[13px] font-medium leading-none text-[#1E1E1E]">Status</p>
          <Select
            id="la-status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => v && setStatus(v as LookAheadStatus)}
            placeholder="Select Status"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label
            htmlFor="la-workers"
            className="text-[13px] font-medium leading-none text-[#1E1E1E]"
          >
            Total Workers Planned
          </label>
          <input
            id="la-workers"
            type="number"
            min={0}
            value={totalWorkers}
            onChange={(e) => setTotalWorkers(e.target.value)}
            placeholder="e.g 12"
            className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-[14px] text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
          />
        </div>
      </div>

      {/* Activities */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] font-medium leading-none text-[#1E1E1E]">
          Activities ({selectedActivityIds.size} selected)
        </p>
        <input
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value)}
          placeholder="Search for activities"
          className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-[14px] text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
        />
        <div className="max-h-56 overflow-y-auto border border-[#EBEBEB] bg-white">
          {filteredActivities.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-[#B0B0B0]">
              No activities found.
            </p>
          ) : (
            filteredActivities.map((activity) => {
              const selected = selectedActivityIds.has(activity.id);
              return (
                <label
                  key={activity.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 border-b border-[#F0F0F0] px-3 py-2.5 text-sm transition-colors last:border-b-0",
                    selected ? "bg-[#EEF3FF]" : "hover:bg-[#FAFAFA]",
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
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                      selected
                        ? "border-[#004DE7] bg-[#004DE7]"
                        : "border-[#D6D6D6] bg-white",
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
                      "flex-1 truncate text-[13px]",
                      selected ? "font-medium text-[#004DE7]" : "text-[#1E1E1E]",
                    )}
                  >
                    {activity.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      selected ? "text-[#6B8AFF]" : "text-[#B0B0B0]",
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
