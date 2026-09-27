import { useEffect, useMemo, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { RichTextField } from "@/components/molecules/rich-text-field";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { useProjectActivities } from "@/hooks/use-activities";
import { RISK_STATUSES, type RiskFactor, type RiskLevel, type RiskStatus } from "@/lib/project-types";
import { RISK_STATUS_META } from "@/lib/risk-meta";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

export interface UpsertRiskValues {
  title: string;
  description: string;
  descriptionHtml: string | null;
  severity: RiskLevel;
  status: RiskStatus;
  ownerName: string | null;
  mitigation: string | null;
  reviewDate: string | null;
  linkedActivityId: string | null;
}

interface UpsertRiskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  projectId?: string;
  initial?: RiskFactor | null;
  onSubmit: (values: UpsertRiskValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const SEVERITIES: RiskLevel[] = ["Low", "Medium", "High"];

const EMPTY: UpsertRiskValues = {
  title: "",
  description: "",
  descriptionHtml: null,
  severity: "Medium",
  status: "open",
  ownerName: null,
  mitigation: null,
  reviewDate: null,
  linkedActivityId: null,
};

function fromRisk(risk: RiskFactor): UpsertRiskValues {
  return {
    title: risk.title,
    description: risk.description,
    // A risk drafted by the API or by Panda AI has plain text and no HTML; the
    // editor used to open blank over it and the user retyped it (finding #22).
    descriptionHtml: risk.descriptionHtml ?? (risk.description ? `<p>${risk.description}</p>` : null),
    severity: risk.severity,
    status: risk.status ?? "open",
    ownerName: risk.ownerName,
    mitigation: risk.mitigation,
    reviewDate: risk.reviewDate,
    linkedActivityId: risk.linkedActivityId,
  };
}

function UpsertRiskDialog({
  open,
  onOpenChange,
  mode,
  projectId,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertRiskDialogProps) {
  const [values, setValues] = useState<UpsertRiskValues>(EMPTY);
  const { data: activities = [] } = useProjectActivities(open ? projectId : undefined);

  useEffect(() => {
    if (open) setValues(initial ? fromRisk(initial) : EMPTY);
  }, [open, initial]);

  function update<K extends keyof UpsertRiskValues>(key: K, value: UpsertRiskValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const activityItems = useMemo<ComboItem[]>(
    () => activities.filter((a) => !a.isSummary).map((a) => ({ id: a.id, label: a.name })),
    [activities],
  );

  const isValid = values.title.trim().length > 0 && values.description.trim().length > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
      descriptionHtml: values.descriptionHtml?.trim() ? values.descriptionHtml : null,
      ownerName: values.ownerName?.trim() || null,
      mitigation: values.mitigation?.trim() || null,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "New risk" : "Edit risk"}
      description={
        mode === "create"
          ? "A risk is something that has not happened yet. Record the exposure, who owns it and what the response is."
          : "Update the exposure, the response, or where it now stands."
      }
      submitLabel={mode === "create" ? "Add risk" : "Save changes"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      width="lg"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="risk-title">Title</Label>
        <input
          id="risk-title"
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g. NNPC pipeline strike at culvert 1 (ch 0+420)"
          maxLength={200}
          autoFocus
          className={INPUT_CLASS}
        />
      </div>

      <RichTextField
        label="Description"
        value={values.descriptionHtml ?? ""}
        onChange={(html) => update("descriptionHtml", html)}
        onChangeText={(text) => update("description", text)}
        required
        placeholder="What is the exposure, and what does it cost the job if it happens?"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="risk-severity">Severity</Label>
          <select
            id="risk-severity"
            value={values.severity}
            onChange={(e) => update("severity", e.target.value as RiskLevel)}
            className={INPUT_CLASS}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="risk-status">Status</Label>
          <select
            id="risk-status"
            value={values.status}
            onChange={(e) => update("status", e.target.value as RiskStatus)}
            className={INPUT_CLASS}
          >
            {RISK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RISK_STATUS_META[s].label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400">{RISK_STATUS_META[values.status].hint}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="risk-owner">Owner</Label>
          <input
            id="risk-owner"
            value={values.ownerName ?? ""}
            onChange={(e) => update("ownerName", e.target.value)}
            placeholder="Who is managing this risk?"
            maxLength={120}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="risk-review">Review date</Label>
          <input
            id="risk-review"
            type="date"
            value={values.reviewDate ?? ""}
            onChange={(e) => update("reviewDate", e.target.value || null)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="risk-mitigation">Mitigation / response</Label>
        <textarea
          id="risk-mitigation"
          rows={3}
          value={values.mitigation ?? ""}
          onChange={(e) => update("mitigation", e.target.value)}
          placeholder="e.g. Trial pit at ch 0+420 before excavation; NNPC notified 14 days ahead."
          maxLength={2000}
          className={cn(INPUT_CLASS, "h-auto min-h-20 py-3")}
        />
      </div>

      {projectId ? (
        <div className="flex flex-col gap-1.5">
          <Label>Activity at risk (optional)</Label>
          <ComboSelect
            items={activityItems}
            value={values.linkedActivityId}
            onChange={(id) => update("linkedActivityId", id)}
            placeholder="Not linked to an activity"
            searchPlaceholder="Search activities…"
            emptyText="No activities match"
          />
        </div>
      ) : null}
    </FormDrawer>
  );
}

UpsertRiskDialog.displayName = "UpsertRiskDialog";

export { UpsertRiskDialog, type UpsertRiskDialogProps };
