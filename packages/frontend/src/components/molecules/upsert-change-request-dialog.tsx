import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { currencySymbol } from "@/lib/formatters";
import { RichTextField } from "@/components/molecules/rich-text-field";
import { htmlFromPlainText } from "@/lib/rich-text";
import { FormDrawer } from "./form-drawer";
import { useProjectRfis } from "@/hooks/use-rfis";
import { useStages } from "@/hooks/use-stages";
import { CHANGE_TYPES, type ChangeType } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

/**
 * A change request is a contractual proposal, not a status someone types. The
 * form captures what is being changed, what kind of change it is and what it
 * hangs off — the stage whose dates move, the RFI it came out of, the EOT
 * claim carrying its days. The ladder itself (submit → approve / reject →
 * resubmit → execute) is walked from the detail dialog's actions.
 */
export interface UpsertChangeValues {
  title: string;
  description: string | null;
  reason: string | null;
  reasonHtml: string | null;
  costImpact: number;
  timeImpactDays: number;
  currency: "NGN" | "USD";
  assigneeId: string | null;
  type: ChangeType;
  stageId: string | null;
  rfiId: string | null;
}

export interface AssigneeOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  mode: "create" | "edit";
  initial?: Partial<UpsertChangeValues>;
  assigneeOptions?: AssigneeOption[];
  onSubmit: (values: UpsertChangeValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

export const CHANGE_TYPE_LABELS: Record<ChangeType, { label: string; hint: string }> = {
  variation: { label: "Variation", hint: "Additional work instructed against the contract." },
  omission: { label: "Omission", hint: "Work removed from the contract; the cost impact is negative." },
  eot_only: { label: "Extension of time only", hint: "A claim for time with no money attached." },
  provisional_sum: {
    label: "Provisional sum adjustment",
    hint: "Converts a sum already in the contract into measured work.",
  },
};

const field = INPUT_CLASS;

function UpsertChangeRequestDialog({ open, onOpenChange, projectId, mode, initial, assigneeOptions = [], onSubmit, isSubmitting = false, error }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [reasonHtml, setReasonHtml] = useState("");
  const [cost, setCost] = useState("0");
  const [days, setDays] = useState("0");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [assigneeId, setAssigneeId] = useState("");
  const [type, setType] = useState<ChangeType>("variation");
  const [stageId, setStageId] = useState("");
  const [rfiId, setRfiId] = useState("");

  const symbol = currencySymbol(currency);
  const { data: stages = [] } = useStages(open ? projectId : undefined);
  const { data: rfis = [] } = useProjectRfis(open ? projectId : undefined);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setReason(initial?.reason ?? "");
      setReasonHtml(initial?.reasonHtml ?? htmlFromPlainText(initial?.reason ?? ""));
      setCost(String(initial?.costImpact ?? 0));
      setDays(String(initial?.timeImpactDays ?? 0));
      setCurrency(initial?.currency ?? "NGN");
      setAssigneeId(initial?.assigneeId ?? "");
      setType(initial?.type ?? "variation");
      setStageId(initial?.stageId ?? "");
      setRfiId(initial?.rfiId ?? "");
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      reason: reason.trim() || null,
      reasonHtml: reasonHtml || null,
      costImpact: Number(cost) || 0,
      timeImpactDays: Math.round(Number(days) || 0),
      currency,
      assigneeId: assigneeId || null,
      type,
      stageId: stageId || null,
      rfiId: rfiId || null,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "New change request" : "Edit change request"}
      description="Propose a change to scope, cost or schedule."
      submitLabel={mode === "create" ? "Create" : "Save changes"}
      submitDisabled={!title.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cr-title">Title</Label>
        <input id="cr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Additional 120 m lined drain at ch. 2+400" className={field} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cr-desc">Details</Label>
        <textarea id="cr-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What's changing?" className={cn(INPUT_CLASS, "h-auto min-h-24 py-3 lg:text-sm")} />
      </div>
      <RichTextField
        label="Reason"
        value={reasonHtml}
        onChange={setReasonHtml}
        onChangeText={setReason}
        projectId={projectId}
        placeholder="Why is it needed?"
      />
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-currency">Currency</Label>
          <select id="cr-currency" value={currency} onChange={(e) => setCurrency(e.target.value as "NGN" | "USD")} className={field}>
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-cost">Cost impact</Label>
          <MoneyInput id="cr-cost" value={cost} onChange={setCost} currencySymbol={symbol} placeholder="0.00" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-days">Time (days)</Label>
          <input id="cr-days" type="number" value={days} onChange={(e) => setDays(e.target.value)} className={field} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cr-type">Type</Label>
        <select id="cr-type" value={type} onChange={(e) => setType(e.target.value as ChangeType)} className={field}>
          {CHANGE_TYPES.map((value) => (
            <option key={value} value={value}>
              {CHANGE_TYPE_LABELS[value].label}
            </option>
          ))}
        </select>
        <p className="text-xs text-ink-muted">{CHANGE_TYPE_LABELS[type].hint}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-stage">Stage affected</Label>
          <select id="cr-stage" value={stageId} onChange={(e) => setStageId(e.target.value)} className={field}>
            <option value="">No stage</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-muted">Its end date shifts by the time impact when the change is executed.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-rfi">Originating RFI</Label>
          <select id="cr-rfi" value={rfiId} onChange={(e) => setRfiId(e.target.value)} className={field}>
            <option value="">Not from an RFI</option>
            {rfis.map((rfi) => (
              <option key={rfi.id} value={rfi.id}>
                RFI-{rfi.number} · {rfi.subject}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-muted">Links the change back to the query that caused it.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cr-assignee">Assignee</Label>
        <select id="cr-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={field}>
          <option value="">Unassigned</option>
          {assigneeOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
    </FormDrawer>
  );
}

UpsertChangeRequestDialog.displayName = "UpsertChangeRequestDialog";

export { UpsertChangeRequestDialog };
