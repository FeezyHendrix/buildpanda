import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import {
  ActivityPredecessorsField,
  type PredecessorChoice,
} from "./activity-predecessors-field";
import { Label } from "@/components/atoms/label";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";
import { errorFieldName } from "@/lib/api-error";
import { workingDaysLabel } from "@/lib/delay-meta";
import type { Activity, ActivityDependency, ProjectPhase } from "@/lib/project-types";

export interface CreateActivityValues {
  name: string;
  activityType: string;
  phaseId: string | null;
  location: string;
  plannedStartAt: string;
  plannedEndAt: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  workerCountPlanned: number;
  notes: string;
  assigneeId: string | null;
  percentComplete: number;
  predecessors: ActivityDependency[];
}

export interface AssigneeOption {
  id: string;
  name: string;
}

export interface ActivityPrefill {
  name: string;
  activityType: string;
}

interface CreateActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phases: ProjectPhase[];
  initial?: Activity | null;
  prefill?: ActivityPrefill | null;
  assigneeOptions?: AssigneeOption[];
  /** Every other activity on the programme, as candidate predecessors. */
  predecessorOptions?: PredecessorChoice[];
  onSubmit: (values: CreateActivityValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
  /** The raw mutation error, so a 400 can be shown beside the field it names. */
  errorSource?: unknown;
}

function toLocalInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function defaultStart(): Date {
  const d = new Date();
  d.setHours(7, 0, 0, 0);
  return d;
}

function defaultEnd(): Date {
  const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  d.setHours(17, 0, 0, 0);
  return d;
}

function CreateActivityDialog({
  open,
  onOpenChange,
  phases,
  initial,
  prefill,
  assigneeOptions = [],
  predecessorOptions = [],
  onSubmit,
  isSubmitting = false,
  error,
  errorSource,
}: CreateActivityDialogProps) {
  const [name, setName] = useState("");
  const [activityType, setActivityType] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [location, setLocation] = useState("");
  const [plannedStartAt, setPlannedStartAt] = useState(toLocalInput(defaultStart()));
  const [plannedEndAt, setPlannedEndAt] = useState(toLocalInput(defaultEnd()));
  const [actualStartAt, setActualStartAt] = useState("");
  const [actualEndAt, setActualEndAt] = useState("");
  const [workerCountPlanned, setWorkerCountPlanned] = useState("8");
  const [notes, setNotes] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [percentComplete, setPercentComplete] = useState("0");
  const [predecessors, setPredecessors] = useState<ActivityDependency[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? prefill?.name ?? "");
    setActivityType(initial?.activityType ?? prefill?.activityType ?? "");
    setPhaseId(initial?.phaseId ?? "");
    setLocation(initial?.location ?? "");
    setPlannedStartAt(
      initial ? toLocalInput(new Date(initial.plannedStartAt)) : toLocalInput(defaultStart()),
    );
    setPlannedEndAt(
      initial ? toLocalInput(new Date(initial.plannedEndAt)) : toLocalInput(defaultEnd()),
    );
    setActualStartAt(initial?.actualStartAt ? toLocalInput(new Date(initial.actualStartAt)) : "");
    setActualEndAt(initial?.actualEndAt ? toLocalInput(new Date(initial.actualEndAt)) : "");
    setWorkerCountPlanned(String(initial?.workerCountPlanned ?? 8));
    setNotes(initial?.notes ?? "");
    setAssigneeId(initial?.assigneeId ?? "");
    setPercentComplete(String(Math.round(initial?.percentComplete ?? 0)));
    setPredecessors(initial?.predecessors ?? []);
  }, [open, initial, prefill]);

  const actualRangeValid =
    !actualStartAt || !actualEndAt || new Date(actualStartAt) <= new Date(actualEndAt);
  // Say why the button is grey. A silently-disabled Create is the same thing as
  // a broken form to the PM (findings #34, #43).
  const plannedRangeValid =
    !plannedStartAt || !plannedEndAt || new Date(plannedStartAt) <= new Date(plannedEndAt);
  const typeMissing = activityType.trim().length === 0;
  // When the server blames a field, show the message beside that field.
  const locationRejected = errorFieldName(errorSource) === "location";
  const isValid =
    name.trim().length > 0 &&
    activityType.trim().length > 0 &&
    plannedStartAt.length > 0 &&
    plannedEndAt.length > 0 &&
    new Date(plannedStartAt) <= new Date(plannedEndAt) &&
    actualRangeValid;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      name: name.trim(),
      activityType: activityType.trim(),
      phaseId: phaseId || null,
      location: location.trim(),
      plannedStartAt: new Date(plannedStartAt).toISOString(),
      plannedEndAt: new Date(plannedEndAt).toISOString(),
      actualStartAt: actualStartAt ? new Date(actualStartAt).toISOString() : null,
      actualEndAt: actualEndAt ? new Date(actualEndAt).toISOString() : null,
      workerCountPlanned: Math.max(0, Number(workerCountPlanned) || 0),
      notes: notes.trim(),
      assigneeId: assigneeId || null,
      percentComplete: Math.max(0, Math.min(100, Math.round(Number(percentComplete) || 0))),
      predecessors,
    });
  }

  return (
    <FormDrawer open={open}
    onOpenChange={onOpenChange}
    title={initial ? "Edit site activity" : "New site activity"}
    description="Track a milestone work item with planned dates, crew size, and schedule impact."
    submitLabel={initial ? "Save activity" : "Create activity"}
    submitDisabled={!isValid}
    submitting={isSubmitting}
    error={error ?? null}
    onSubmit={handleSubmit}><div className="flex flex-col gap-1.5">
      <Label htmlFor="activity-name">Name</Label>
      <input
        id="activity-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Slab pour, Floor 2"
        maxLength={200}
        autoFocus
        className={INPUT_CLASS}
      />
    </div>
    
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-type">Type (required)</Label>
        <input
          id="activity-type"
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          placeholder="e.g. concrete_pour, earthworks, drainage"
          maxLength={100}
          aria-invalid={typeMissing || undefined}
          className={INPUT_CLASS}
        />
        {typeMissing ? (
          <p className="text-xs text-negative-600">A type is required — a short slug for the kind of work.</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-phase">Milestone (optional)</Label>
        <select
          id="activity-phase"
          value={phaseId}
          onChange={(e) => setPhaseId(e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">Unassigned milestone</option>
          {phases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>

    <div className="flex flex-col gap-1.5">
      <Label htmlFor="activity-assignee">Assignee</Label>
      <select
        id="activity-assignee"
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        className={INPUT_CLASS}
      >
        <option value="">Unassigned</option>
        {assigneeOptions.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
    
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="activity-location">Location (optional)</Label>
      <input
        id="activity-location"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="e.g. Block A · Floor 2, or ch 0+420"
        maxLength={200}
        aria-invalid={locationRejected || undefined}
        className={INPUT_CLASS}
      />
      {locationRejected ? <p className="text-xs text-negative-600">{error}</p> : null}
    </div>
    
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-start">Planned start</Label>
        <input
          id="activity-start"
          type="datetime-local"
          value={plannedStartAt}
          onChange={(e) => setPlannedStartAt(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-end">Planned end</Label>
        <input
          id="activity-end"
          type="datetime-local"
          value={plannedEndAt}
          onChange={(e) => setPlannedEndAt(e.target.value)}
          aria-invalid={!plannedRangeValid || undefined}
          className={INPUT_CLASS}
        />
        {!plannedRangeValid ? (
          <p className="text-xs text-negative-600">Planned end must be after planned start.</p>
        ) : null}
      </div>
      {initial ? (
        <p className="col-span-2 text-xs text-ink-muted">
          Currently {workingDaysLabel(initial.durationWorkingDays)} on the project calendar.
        </p>
      ) : null}
    </div>

    <div className="flex flex-col gap-1.5">
      <Label htmlFor="activity-progress">Progress ({percentComplete}%)</Label>
      <div className="flex items-center gap-3">
        <input
          id="activity-progress"
          type="range"
          min={0}
          max={100}
          step={5}
          value={percentComplete}
          onChange={(e) => setPercentComplete(e.target.value)}
          className="flex-1 accent-primary-500"
        />
        <input
          aria-label="Percent complete"
          type="number"
          min={0}
          max={100}
          step={1}
          value={percentComplete}
          onChange={(e) => setPercentComplete(e.target.value)}
          className={cn(INPUT_CLASS, "w-20 tabular-nums")}
        />
      </div>
    </div>

    <ActivityPredecessorsField
      value={predecessors}
      options={predecessorOptions}
      onChange={setPredecessors}
    />

    {initial && (
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-actual-start">Actual start</Label>
          <input
            id="activity-actual-start"
            type="datetime-local"
            value={actualStartAt}
            onChange={(e) => setActualStartAt(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-actual-end">Actual end</Label>
          <input
            id="activity-actual-end"
            type="datetime-local"
            value={actualEndAt}
            onChange={(e) => setActualEndAt(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        {!actualRangeValid && (
          <p className="col-span-2 text-xs text-negative-500">Actual end must be after actual start.</p>
        )}
      </div>
    )}
    
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-workers">Planned crew size</Label>
        <input
          id="activity-workers"
          type="number"
          min={0}
          value={workerCountPlanned}
          onChange={(e) => setWorkerCountPlanned(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
    </div>
    
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="activity-notes">Notes</Label>
      <textarea
        id="activity-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        maxLength={2000}
        className={cn(INPUT_CLASS, "min-h-24 resize-none py-3")}
      />
    </div></FormDrawer>
  );
}

CreateActivityDialog.displayName = "CreateActivityDialog";

export { CreateActivityDialog, type CreateActivityDialogProps };
