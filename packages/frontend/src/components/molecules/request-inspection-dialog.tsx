import { useEffect, useMemo, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";
import type { Activity, InspectionCategory } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Button } from "@/components/atoms/button";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { useProjectActivities } from "@/hooks/use-activities";

type ApiInspectionCategory = Exclude<InspectionCategory, "All Reports">;

// Unchanged on purpose: the category list is moving to admin-managed reference
// data in its own workstream, which will replace this with an API-fed picker.
const CATEGORIES: ApiInspectionCategory[] = [
  "Structural",
  "Quantity Survey",
  "General Progress",
  "Electrical",
  "Plumbing",
];

export interface RequestInspectionInput {
  title: string;
  category: ApiInspectionCategory;
  description: string;
  scheduledAt: string;
  activityId: string | null;
  location: string | null;
  holdPoint: boolean;
}

interface RequestInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSubmit: (input: RequestInspectionInput) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

/** Planned but never started: inspecting it is a wasted trip (finding F44). */
function hasNotStarted(activity: Activity | undefined): boolean {
  return Boolean(activity && activity.status === "Planned" && !activity.actualStartAt);
}

function RequestInspectionDialog({
  open,
  onOpenChange,
  projectId,
  onSubmit,
  isSubmitting = false,
  error,
}: RequestInspectionDialogProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ApiInspectionCategory>("Structural");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [activityId, setActivityId] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [holdPoint, setHoldPoint] = useState(false);

  const { data: activities = [] } = useProjectActivities(open ? projectId : undefined);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setCategory("Structural");
      setDescription("");
      setScheduledAt("");
      setActivityId(null);
      setLocation("");
      setHoldPoint(false);
    }
  }, [open]);

  const activityItems = useMemo<ComboItem[]>(
    () => activities.filter((a) => !a.isSummary).map((a) => ({ id: a.id, label: a.name })),
    [activities],
  );
  const linkedActivity = activities.find((a) => a.id === activityId);
  const warnUnstarted = hasNotStarted(linkedActivity);

  const isValid =
    title.trim().length > 0 && description.trim().length > 0 && scheduledAt.trim().length > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      title: title.trim(),
      category,
      description: description.trim(),
      scheduledAt: scheduledAt.trim(),
      activityId,
      location: location.trim() || null,
      holdPoint,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Request a new inspection"
      description="A hold point stops the work until it is passed. Link the activity and the chainage so it sits on the programme, not beside it."
      submitLabel="Request inspection"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      width="lg"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-title">Title</Label>
        <input
          id="inspection-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          maxLength={200}
          placeholder="e.g. Formation approval proof roll, ch 0+000 – 0+600"
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Category</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              aria-pressed={category === cat}
              variant={category === cat ? "primary" : "secondary"}
              onClick={() => setCategory(cat)}
            >
              {category === cat ? "✓ " : ""}
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-description">What needs inspecting?</Label>
        <textarea
          id="inspection-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Scope of the inspection, areas to check, any concerns."
          className={cn(INPUT_CLASS, "h-auto min-h-24 resize-none py-3")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inspection-date">Date</Label>
          <input
            id="inspection-date"
            type="date"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inspection-location">Location / chainage</Label>
          <input
            id="inspection-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={200}
            placeholder="e.g. ch 0+000 – 0+600"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Activity being inspected</Label>
        <ComboSelect
          items={activityItems}
          value={activityId}
          onChange={setActivityId}
          placeholder="Not linked to an activity"
          searchPlaceholder="Search activities…"
          emptyText="No activities match"
        />
        {warnUnstarted ? (
          <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
            ⚠ {linkedActivity?.name} has not started yet. Check the date before the inspector travels.
          </p>
        ) : null}
      </div>

      <label className="flex items-start gap-2 rounded-lg border border-line-hair p-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={holdPoint}
          onChange={(event) => setHoldPoint(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium text-gray-900">This is a hold point</span>
          <span className="mt-0.5 block text-xs text-gray-500">
            Work on the linked activity must not proceed past it until the inspection passes.
          </span>
        </span>
      </label>
    </FormDrawer>
  );
}

RequestInspectionDialog.displayName = "RequestInspectionDialog";

export { RequestInspectionDialog, type RequestInspectionDialogProps };
