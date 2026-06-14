import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import type { Activity, ProjectPhase } from "@/lib/project-types";

export interface CreateActivityValues {
  name: string;
  activityType: string;
  phaseId: string | null;
  location: string;
  plannedStartAt: string;
  plannedEndAt: string;
  workerCountPlanned: number;
  notes: string;
  assigneeId: string | null;
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
  onSubmit: (values: CreateActivityValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function toLocalInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T07:00`;
}

function CreateActivityDialog({
  open,
  onOpenChange,
  phases,
  initial,
  prefill,
  assigneeOptions = [],
  onSubmit,
  isSubmitting = false,
  error,
}: CreateActivityDialogProps) {
  const [name, setName] = useState("");
  const [activityType, setActivityType] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [location, setLocation] = useState("");
  const today = new Date();
  const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const [plannedStartAt, setPlannedStartAt] = useState(toLocalInput(today));
  const [plannedEndAt, setPlannedEndAt] = useState(toLocalInput(nextWeek));
  const [workerCountPlanned, setWorkerCountPlanned] = useState("8");
  const [notes, setNotes] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? prefill?.name ?? "");
    setActivityType(initial?.activityType ?? prefill?.activityType ?? "");
    setPhaseId(initial?.phaseId ?? "");
    setLocation(initial?.location ?? "");
    setPlannedStartAt(
      initial ? toLocalInput(new Date(initial.plannedStartAt)) : toLocalInput(new Date()),
    );
    setPlannedEndAt(
      initial
        ? toLocalInput(new Date(initial.plannedEndAt))
        : toLocalInput(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
    );
    setWorkerCountPlanned(String(initial?.workerCountPlanned ?? 8));
    setNotes(initial?.notes ?? "");
    setAssigneeId(initial?.assigneeId ?? "");
  }, [open, initial, prefill]);

  const isValid =
    name.trim().length > 0 &&
    activityType.trim().length > 0 &&
    plannedStartAt.length > 0 &&
    plannedEndAt.length > 0 &&
    new Date(plannedStartAt) <= new Date(plannedEndAt);

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      name: name.trim(),
      activityType: activityType.trim(),
      phaseId: phaseId || null,
      location: location.trim(),
      plannedStartAt: new Date(plannedStartAt).toISOString(),
      plannedEndAt: new Date(plannedEndAt).toISOString(),
      workerCountPlanned: Math.max(0, Number(workerCountPlanned) || 0),
      notes: notes.trim(),
      assigneeId: assigneeId || null,
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
        placeholder="e.g. Slab pour — Floor 2"
        maxLength={200}
        autoFocus
        className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
      />
    </div>
    
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-type">Type</Label>
        <input
          id="activity-type"
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          placeholder="concrete_pour"
          maxLength={100}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-phase">Milestone (optional)</Label>
        <select
          id="activity-phase"
          value={phaseId}
          onChange={(e) => setPhaseId(e.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        >
          <option value="">— Unassigned milestone —</option>
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
        className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
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
        placeholder="e.g. Block A · Floor 2"
        maxLength={200}
        className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
      />
    </div>
    
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-start">Planned start</Label>
        <input
          id="activity-start"
          type="datetime-local"
          value={plannedStartAt}
          onChange={(e) => setPlannedStartAt(e.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-end">Planned end</Label>
        <input
          id="activity-end"
          type="datetime-local"
          value={plannedEndAt}
          onChange={(e) => setPlannedEndAt(e.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </div>
    
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-workers">Planned crew size</Label>
        <input
          id="activity-workers"
          type="number"
          min={0}
          value={workerCountPlanned}
          onChange={(e) => setWorkerCountPlanned(e.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
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
        className="resize-none rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      />
    </div></FormDrawer>
  );
}

CreateActivityDialog.displayName = "CreateActivityDialog";

export { CreateActivityDialog, type CreateActivityDialogProps };
