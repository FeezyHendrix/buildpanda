import { useMemo, useState } from "react";
import { useInspectionDraft } from "@/hooks/use-inspection-draft";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { Switcher } from "@/components/atoms/switcher";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { InspectionCategoryPicker } from "@/components/molecules/inspection-category-picker";
import { useProjectActivities } from "@/hooks/use-activities";
import { useProjectProfile } from "@/hooks/use-projects";

const EMPTY_ACTIVITIES: never[] = [];

export interface RequestInspectionInput {
  title: string;
  category: string;
  description: string;
  scheduledAt: string;
  activityId: string | null;
  location: string | null;
  holdPoint: boolean;
  contractorName: string | null;
  feeAmount: number | null;
  feeCurrency: string | null;
}

interface RequestInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** The project's own currency — what the recorded fee is quoted in. */
  currency: string;
  /** Only a workspace admin may extend the category list. */
  canAddCategory: boolean;
  onSubmit: (input: RequestInspectionInput) => Promise<unknown>;
  error?: string | null;
}

/** Planned but never started: inspecting it is a wasted trip (finding F44). */
function hasNotStarted(activity: Activity | undefined): boolean {
  return Boolean(activity && activity.status === "Planned" && !activity.actualStartAt);
}

/**
 * Ordering the service. The client asks BuildPanda to inspect the contractor's
 * work: it names who is being inspected, what it holds on the programme, and
 * the fee agreed off-platform. Nobody inspects anything until BuildPanda
 * assigns an inspector, so this form never picks one.
 */
function InspectionRequestForm({
  open,
  onOpenChange,
  projectId,
  currency,
  canAddCategory,
  onSubmit,
  error,
}: RequestInspectionDialogProps) {
  // Stay busy through the successful navigation so the draft exit guard allows it.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const draft = useInspectionDraft(projectId);
  const { title, category, description, scheduledAt, activityId, location, holdPoint, feeAmount } = draft.values;

  const { data: activities = EMPTY_ACTIVITIES } = useProjectActivities(open ? projectId : undefined);
  const { data: profile } = useProjectProfile(open ? projectId : undefined);
  const defaultContractor = profile?.contractorEntity ?? "";

  const contractorName = draft.values.contractorName ?? defaultContractor;

  const activityItems = useMemo<ComboItem[]>(
    () => activities.filter((a) => !a.isSummary).map((a) => ({ id: a.id, label: a.name })),
    [activities],
  );
  const linkedActivity = activities.find((a) => a.id === activityId);
  const warnUnstarted = hasNotStarted(linkedActivity);

  const isValid =
    title.trim().length > 0 &&
    category.length > 0 &&
    description.trim().length > 0 &&
    scheduledAt.trim().length > 0;

  async function handleSubmit(): Promise<void> {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    const fee = Number.parseFloat(feeAmount);
    try {
      await onSubmit({
        title: title.trim(),
        category,
        description: description.trim(),
        scheduledAt: scheduledAt.trim(),
        activityId,
        location: location.trim() || null,
        holdPoint,
        contractorName: contractorName.trim() || null,
        feeAmount: Number.isFinite(fee) && fee >= 0 ? fee : null,
        feeCurrency: Number.isFinite(fee) && fee >= 0 ? currency : null,
      });
      draft.clear();
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Request an inspection"
      description="BuildPanda assigns an inspector and issues the report. A hold point stops the work until it is passed — link the activity and the chainage so it sits on the programme, not beside it."
      submitLabel="Request inspection"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      dirty={draft.dirty}
      onDiscard={draft.clear}
      error={error ?? null}
      onSubmit={handleSubmit}
      width="lg"
    >
      <fieldset disabled={isSubmitting} className="contents">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inspection-title">Title</Label>
          <input
            id="inspection-title"
            value={title}
            onChange={(e) => draft.setField("title", e.target.value)}
            autoFocus
            maxLength={200}
            placeholder="e.g. Formation approval proof roll, ch 0+000 – 0+600"
            className={INPUT_CLASS}
          />
        </div>

        <InspectionCategoryPicker
          projectId={projectId}
          value={category}
          onChange={(value) => draft.setField("category", value)}
          canAddCategory={canAddCategory}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inspection-contractor">Contractor being inspected</Label>
          <input
            id="inspection-contractor"
            value={contractorName}
            onChange={(e) => {
              draft.setField("contractorName", e.target.value);
            }}
            maxLength={200}
            placeholder={defaultContractor || "Name the party whose work is inspected"}
            className={INPUT_CLASS}
          />
          <p className="text-xs text-ink-muted">
            The contractor is the subject of the report, never its author. Defaults to the
            project's contractor entity; change it only when a third party is being inspected.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inspection-description">What needs inspecting?</Label>
          <textarea
            id="inspection-description"
            value={description}
            onChange={(e) => draft.setField("description", e.target.value)}
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
              onChange={(e) => draft.setField("scheduledAt", e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inspection-location">Location / chainage</Label>
            <input
              id="inspection-location"
              value={location}
              onChange={(e) => draft.setField("location", e.target.value)}
              maxLength={200}
              placeholder="e.g. ch 0+000 – 0+600"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inspection-activity">Activity being inspected</Label>
          <ComboSelect
            id="inspection-activity"
            items={activityItems}
            value={activityId}
            onChange={(value) => draft.setField("activityId", value)}
            placeholder="Not linked to an activity"
            searchPlaceholder="Search activities…"
            emptyText="No activities match"
          />
          {warnUnstarted ? (
            <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
              ⚠ {linkedActivity?.name} has not started yet. Check the date before the inspector
              travels — the request is still allowed.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inspection-fee">Fee agreed ({currency})</Label>
          <input
            id="inspection-fee"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={feeAmount}
            onChange={(e) => draft.setField("feeAmount", e.target.value)}
            placeholder="0.00"
            className={INPUT_CLASS}
          />
          <p className="text-xs text-ink-muted">
            Recorded against the order, never charged — BuildPanda moves no money.
          </p>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border border-line-hair p-3">
          <span className="text-sm text-gray-700">
            <span className="block font-medium text-gray-900">This is a hold point</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              Work on the linked activity must not proceed past it until the inspection passes.
            </span>
          </span>
          <Switcher
            value={holdPoint ? "yes" : "no"}
            onChange={(next) => draft.setField("holdPoint", next === "yes")}
          />
        </div>
      </fieldset>
    </FormDrawer>
  );
}

function RequestInspectionDialog(props: RequestInspectionDialogProps) {
  return props.open ? <InspectionRequestForm key={props.projectId} {...props} /> : null;
}

RequestInspectionDialog.displayName = "RequestInspectionDialog";

export { RequestInspectionDialog, type RequestInspectionDialogProps };
