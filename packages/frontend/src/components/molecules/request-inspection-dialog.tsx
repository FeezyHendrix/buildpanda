import { useEffect, useMemo, useState } from "react";
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
  onSubmit: (input: RequestInspectionInput) => void;
  isSubmitting?: boolean;
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
function RequestInspectionDialog({
  open,
  onOpenChange,
  projectId,
  currency,
  canAddCategory,
  onSubmit,
  isSubmitting = false,
  error,
}: RequestInspectionDialogProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [activityId, setActivityId] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [holdPoint, setHoldPoint] = useState(false);
  const [contractorName, setContractorName] = useState("");
  const [contractorTouched, setContractorTouched] = useState(false);
  const [feeAmount, setFeeAmount] = useState("");

  const { data: activities = [] } = useProjectActivities(open ? projectId : undefined);
  const { data: profile } = useProjectProfile(open ? projectId : undefined);
  const defaultContractor = profile?.contractorEntity ?? "";

  useEffect(() => {
    if (!open) {
      setTitle("");
      setCategory("");
      setDescription("");
      setScheduledAt("");
      setActivityId(null);
      setLocation("");
      setHoldPoint(false);
      setContractorName("");
      setContractorTouched(false);
      setFeeAmount("");
    }
  }, [open]);

  // The project's contractor entity is the subject unless a third-party builder
  // is named, so it fills in — until the requester types over it.
  useEffect(() => {
    if (open && !contractorTouched && defaultContractor) setContractorName(defaultContractor);
  }, [open, contractorTouched, defaultContractor]);

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

  function handleSubmit(): void {
    if (!isValid) return;
    const fee = Number.parseFloat(feeAmount);
    onSubmit({
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

      <InspectionCategoryPicker
        projectId={projectId}
        value={category}
        onChange={setCategory}
        canAddCategory={canAddCategory}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-contractor">Contractor being inspected</Label>
        <input
          id="inspection-contractor"
          value={contractorName}
          onChange={(e) => {
            setContractorTouched(true);
            setContractorName(e.target.value);
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
          onChange={(e) => setFeeAmount(e.target.value)}
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
          onChange={(next) => setHoldPoint(next === "yes")}
        />
      </div>
    </FormDrawer>
  );
}

RequestInspectionDialog.displayName = "RequestInspectionDialog";

export { RequestInspectionDialog, type RequestInspectionDialogProps };
