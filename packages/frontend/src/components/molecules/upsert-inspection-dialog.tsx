import { useEffect, useMemo, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { Switcher } from "@/components/atoms/switcher";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { InspectionCategoryPicker } from "@/components/molecules/inspection-category-picker";
import { useProjectActivities } from "@/hooks/use-activities";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

/**
 * Editing the service order — what was asked for, of whom, where and when.
 * Status, risk level and the outcome are deliberately absent: those are the
 * assigned inspector's acts, recorded through the outcome dialog.
 */
export interface UpsertInspectionValues {
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

interface UpsertInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "edit";
  projectId: string;
  currency: string;
  canAddCategory: boolean;
  initial?: UpsertInspectionValues;
  onSubmit: (values: UpsertInspectionValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function UpsertInspectionDialog({
  open,
  onOpenChange,
  projectId,
  currency,
  canAddCategory,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertInspectionDialogProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [activityId, setActivityId] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [holdPoint, setHoldPoint] = useState(false);
  const [contractorName, setContractorName] = useState("");
  const [feeAmount, setFeeAmount] = useState("");

  const { data: activities = [] } = useProjectActivities(open ? projectId : undefined);
  const activityItems = useMemo<ComboItem[]>(
    () => activities.filter((a) => !a.isSummary).map((a) => ({ id: a.id, label: a.name })),
    [activities],
  );

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setCategory(initial?.category ?? "");
      setDescription(initial?.description ?? "");
      setScheduledAt(initial?.scheduledAt ?? "");
      setActivityId(initial?.activityId ?? null);
      setLocation(initial?.location ?? "");
      setHoldPoint(initial?.holdPoint ?? false);
      setContractorName(initial?.contractorName ?? "");
      setFeeAmount(initial?.feeAmount != null ? String(initial.feeAmount) : "");
    }
  }, [open, initial]);

  const isValid =
    title.trim().length > 0 &&
    category.length > 0 &&
    description.trim().length > 0 &&
    scheduledAt.trim().length > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    const fee = Number.parseFloat(feeAmount);
    const hasFee = Number.isFinite(fee) && fee >= 0;
    onSubmit({
      title: title.trim(),
      category,
      description: description.trim(),
      scheduledAt: scheduledAt.trim(),
      activityId,
      location: location.trim() || null,
      holdPoint,
      contractorName: contractorName.trim() || null,
      feeAmount: hasFee ? fee : null,
      feeCurrency: hasFee ? (initial?.feeCurrency ?? currency) : null,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit inspection request"
      description="What was asked for, of whom and when. The result is recorded by the BuildPanda inspector, not here."
      submitLabel="Save changes"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      width="lg"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-inspection-title">Title</Label>
        <input
          id="edit-inspection-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Formation approval proof roll"
          maxLength={200}
          autoFocus
          className={INPUT_CLASS}
        />
      </div>

      <InspectionCategoryPicker
        projectId={projectId}
        value={category}
        onChange={setCategory}
        canAddCategory={canAddCategory}
        id="edit-inspection-category"
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-inspection-contractor">Contractor being inspected</Label>
        <input
          id="edit-inspection-contractor"
          value={contractorName}
          onChange={(e) => setContractorName(e.target.value)}
          maxLength={200}
          placeholder="Name the party whose work is inspected"
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-inspection-description">What needs inspecting?</Label>
        <textarea
          id="edit-inspection-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Scope of the inspection, areas to check, any concerns."
          maxLength={2000}
          rows={4}
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-inspection-scheduled">Scheduled date</Label>
          <input
            id="edit-inspection-scheduled"
            type="date"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-inspection-location">Location / chainage</Label>
          <input
            id="edit-inspection-location"
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
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-inspection-fee">Fee agreed ({initial?.feeCurrency ?? currency})</Label>
        <input
          id="edit-inspection-fee"
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
          Recorded against the order, never charged.
        </p>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-lg border border-line-hair p-3">
        <span className="text-sm text-gray-700">
          <span className="block font-medium text-gray-900">This is a hold point</span>
          <span className="mt-0.5 block text-xs text-gray-500">
            Work must not proceed past it until the inspection passes.
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

UpsertInspectionDialog.displayName = "UpsertInspectionDialog";

export { UpsertInspectionDialog, type UpsertInspectionDialogProps };
