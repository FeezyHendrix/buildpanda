import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Select } from "@/components/atoms/select";
import { UnitInputField } from "@/components/molecules/unit-input-field";
import { RichTextField } from "@/components/molecules/rich-text-field";
import { htmlFromPlainText } from "@/lib/rich-text";
import { ClaimableDelayPicker } from "./claimable-delay-picker";
import { FormDrawer } from "./form-drawer";
import { useProjectActivities } from "@/hooks/use-activities";
import { useProjectRfis } from "@/hooks/use-rfis";
import { useStages } from "@/hooks/use-stages";
import { claimableDelays } from "@/lib/delay-meta";
import { CHANGE_TYPES, type ChangeType } from "@/lib/project-types";
import { cn } from "@/lib/utils";

/**
 * A change request is a contractual proposal, not a status someone types. The
 * form captures what is being changed, what kind of change it is and what it
 * hangs off — the stage whose dates move, the RFI it came out of, and for a
 * time claim the delays it is argued from. The ladder itself (submit → approve
 * / reject → resubmit → execute) is walked from the detail dialog's actions.
 *
 * A time claim asks for days and no money, so choosing that type drops the cost
 * field entirely rather than leaving a zero a reader has to interpret.
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
  delayIds: string[];
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

const LABEL_CLASS = "text-[12px] font-semibold leading-[16px] text-[#1E1E1E]";
const FIELD_CLASS = "h-[45px] border border-[#EEEEEE] px-4 text-[14px]";
const AREA_CLASS =
  "w-full resize-none border border-[#EEEEEE] bg-white px-4 py-[14px] text-[14px] text-[#1E1E1E] outline-none placeholder:text-[#A5A5A5] focus:border-primary";
const GROUP_CLASS = "flex flex-col gap-[5px]";

const CURRENCY_OPTIONS = [
  { value: "NGN", label: "NGN" },
  { value: "USD", label: "USD" },
];
/** The register records time in days only; the selector is there for the design and for room to grow. */
const TIME_UNIT_OPTIONS = [{ value: "days", label: "Days" }];
const TYPE_OPTIONS = CHANGE_TYPES.map((value) => ({ value, label: CHANGE_TYPE_LABELS[value].label }));

/** Digits, one decimal point and a leading minus (an omission is a negative cost). */
function sanitiseAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  const negative = cleaned.startsWith("-");
  const [whole = "", ...rest] = cleaned.replace(/-/g, "").split(".");
  return `${negative ? "-" : ""}${whole}${rest.length > 0 ? `.${rest.join("")}` : ""}`;
}

function UpsertChangeRequestDialog({ open, onOpenChange, projectId, mode, initial, assigneeOptions = [], onSubmit, isSubmitting = false, error }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [reasonHtml, setReasonHtml] = useState("");
  const [cost, setCost] = useState("");
  const [days, setDays] = useState("");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [assigneeId, setAssigneeId] = useState("");
  const [type, setType] = useState<ChangeType>("variation");
  const [stageId, setStageId] = useState("");
  const [rfiId, setRfiId] = useState("");
  const [delayIds, setDelayIds] = useState<Set<string>>(new Set());
  const [moreOpen, setMoreOpen] = useState(false);

  const isTimeClaim = type === "eot_only";
  const { data: stages = [] } = useStages(open ? projectId : undefined);
  const { data: rfis = [] } = useProjectRfis(open ? projectId : undefined);
  const { data: activities = [] } = useProjectActivities(
    open && isTimeClaim ? projectId : undefined,
  );
  const delays = claimableDelays(activities);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setReason(initial?.reason ?? "");
      setReasonHtml(initial?.reasonHtml ?? htmlFromPlainText(initial?.reason ?? ""));
      setCost(initial?.costImpact ? String(initial.costImpact) : "");
      setDays(initial?.timeImpactDays ? String(initial.timeImpactDays) : "");
      setCurrency(initial?.currency ?? "NGN");
      setAssigneeId(initial?.assigneeId ?? "");
      setType(initial?.type ?? "variation");
      setStageId(initial?.stageId ?? "");
      setRfiId(initial?.rfiId ?? "");
      setDelayIds(new Set(initial?.delayIds ?? []));
      // The extra fields stay out of the way unless the change already uses them.
      setMoreOpen(Boolean(initial && ((initial.type ?? "variation") !== "variation" || initial.stageId || initial.rfiId)));
    }
  }, [open, initial]);

  function toggleDelay(delayId: string): void {
    setDelayIds((curr) => {
      const next = new Set(curr);
      if (next.has(delayId)) next.delete(delayId);
      else next.add(delayId);
      return next;
    });
  }

  function handleSubmit(): void {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      reason: reason.trim() || null,
      reasonHtml: reasonHtml || null,
      // A time claim asks for days and no money — never a stale cost figure
      // left behind by switching the type.
      costImpact: isTimeClaim ? 0 : Number(cost) || 0,
      timeImpactDays: Math.round(Number(days) || 0),
      currency,
      assigneeId: assigneeId || null,
      type,
      stageId: stageId || null,
      rfiId: rfiId || null,
      delayIds: isTimeClaim ? [...delayIds] : [],
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "New Change Request" : "Edit Change Request"}
      description="Propose a change to scope, cost or schedule."
      // A new change is proposed to whoever decides it, so creating also submits it.
      submitLabel={mode === "create" ? "Send for approval" : "Save changes"}
      submitDisabled={!title.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      footerVariant="stacked"
      className="w-[min(430px,100vw)]"
      titleClassName="text-[20px] leading-[28px] tracking-normal"
      headerClassName="px-[24px] pb-[22px] pt-[40px]"
      bodyClassName="gap-[19px] px-[24px] py-0"
      footerClassName="gap-[3px] px-[24px] pb-[17px] pt-6 [&>button]:h-[46px]"
    >
      <div className={GROUP_CLASS}>
        <label htmlFor="cr-title" className={LABEL_CLASS}>Title</label>
        <input
          id="cr-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Upgrade to imported floors"
          autoFocus
          className={cn(FIELD_CLASS, "w-full bg-white text-[#1E1E1E] outline-none placeholder:text-[#A5A5A5] focus:border-primary")}
        />
      </div>

      <div className={GROUP_CLASS}>
        <label htmlFor="cr-desc" className={LABEL_CLASS}>Details</label>
        <textarea
          id="cr-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what is changing"
          className={cn(AREA_CLASS, "h-[123px]")}
        />
      </div>

      {mode === "create" ? (
        <div className={GROUP_CLASS}>
          <label htmlFor="cr-reason" className={LABEL_CLASS}>Reason for Change</label>
          <textarea
            id="cr-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonHtml(htmlFromPlainText(e.target.value));
            }}
            placeholder="Why is the change needed?"
            className={cn(AREA_CLASS, "h-[110px]")}
          />
        </div>
      ) : (
        // An existing reason may carry formatting or images, which a plain box would flatten.
        <RichTextField
          label="Reason for Change"
          value={reasonHtml}
          onChange={setReasonHtml}
          onChangeText={setReason}
          projectId={projectId}
          placeholder="Why is the change needed?"
        />
      )}

      {isTimeClaim ? (
        <UnitInputField
          id="cr-days"
          label="Days Claimed"
          unitOptions={TIME_UNIT_OPTIONS}
          unit="days"
          onUnitChange={() => undefined}
          value={days}
          onChange={(v) => setDays(v.replace(/\D/g, ""))}
          placeholder="Enter Time Impact"
          inputMode="numeric"
          unitWidthClass="w-[80px]"
        />
      ) : (
        <>
          <UnitInputField
            id="cr-cost"
            label="Cost Impact"
            unitOptions={CURRENCY_OPTIONS}
            unit={currency}
            onUnitChange={(next) => setCurrency(next as "NGN" | "USD")}
            value={cost}
            onChange={(v) => setCost(sanitiseAmount(v))}
            placeholder="Enter Amount"
          />
          <UnitInputField
            id="cr-days"
            label="Time Impact"
            unitOptions={TIME_UNIT_OPTIONS}
            unit="days"
            onUnitChange={() => undefined}
            value={days}
            onChange={(v) => setDays(v.replace(/[^\d-]/g, ""))}
            placeholder="Enter Time Impact"
            inputMode="numeric"
            unitWidthClass="w-[80px]"
          />
        </>
      )}

      <div className={GROUP_CLASS}>
        <label htmlFor="cr-assignee" className={LABEL_CLASS}>Assigned to</label>
        <Select
          id="cr-assignee"
          options={[{ value: "", label: "Unassigned" }, ...assigneeOptions.map((a) => ({ value: a.id, label: a.name }))]}
          value={assigneeId || null}
          onChange={(next) => setAssigneeId(next ?? "")}
          placeholder="Select who it's assigned to"
          className={cn(FIELD_CLASS, "placeholder:text-[#A5A5A5]")}
        />
      </div>

      <div className="flex flex-col gap-[19px]">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className="flex items-center gap-[6px] self-start text-[12px] font-semibold leading-[16px] text-[#004DE7] outline-none hover:underline"
        >
          More options
          <ChevronDown className={cn("size-[14px] transition-transform", moreOpen && "rotate-180")} aria-hidden />
        </button>

        {moreOpen ? (
          <>
            <div className={GROUP_CLASS}>
              <label htmlFor="cr-type" className={LABEL_CLASS}>Type</label>
              <Select
                id="cr-type"
                options={TYPE_OPTIONS}
                value={type}
                onChange={(next) => setType((next ?? "variation") as ChangeType)}
                className={FIELD_CLASS}
              />
              <p className="text-[12px] leading-[16px] text-[#737373]">{CHANGE_TYPE_LABELS[type].hint}</p>
              {isTimeClaim ? (
                <p className="text-[12px] leading-[16px] text-[#737373]">
                  An award moves the revised completion date and every contractual key date by that many calendar days.
                  The decision may grant fewer.
                </p>
              ) : null}
            </div>
            {isTimeClaim ? (
              <ClaimableDelayPicker delays={delays} selected={delayIds} onToggle={toggleDelay} />
            ) : null}
            <div className={GROUP_CLASS}>
              <label htmlFor="cr-stage" className={LABEL_CLASS}>Stage affected</label>
              <Select
                id="cr-stage"
                options={[{ value: "", label: "No stage" }, ...stages.map((stage) => ({ value: stage.id, label: stage.name }))]}
                value={stageId || null}
                onChange={(next) => setStageId(next ?? "")}
                placeholder="No stage"
                className={FIELD_CLASS}
              />
              <p className="text-[12px] leading-[16px] text-[#737373]">Its end date shifts by the time impact when the change is executed.</p>
            </div>
            <div className={GROUP_CLASS}>
              <label htmlFor="cr-rfi" className={LABEL_CLASS}>Originating RFI</label>
              <Select
                id="cr-rfi"
                options={[{ value: "", label: "Not from an RFI" }, ...rfis.map((rfi) => ({ value: rfi.id, label: `RFI-${rfi.number} · ${rfi.subject}` }))]}
                value={rfiId || null}
                onChange={(next) => setRfiId(next ?? "")}
                placeholder="Not from an RFI"
                className={FIELD_CLASS}
              />
              <p className="text-[12px] leading-[16px] text-[#737373]">Links the change back to the query that caused it.</p>
            </div>
          </>
        ) : null}
      </div>
    </FormDrawer>
  );
}

UpsertChangeRequestDialog.displayName = "UpsertChangeRequestDialog";

export { UpsertChangeRequestDialog };
