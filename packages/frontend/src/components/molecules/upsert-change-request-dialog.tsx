import { useEffect, useMemo, useState } from "react";
import { SearchableSelect } from "@/components/atoms/searchable-select";
import { Select } from "@/components/atoms/select";
import { DRAWER_FIELD_CLASS, DRAWER_LABEL_CLASS } from "@/components/molecules/drawer-fields";
import { AddImageButton, FileLink } from "@/components/molecules/image-attach";
import { RichTextEditor } from "@/components/molecules/rich-text-editor";
import { SHEET_HEADER_RULED, SheetRule, WIDE_SHEET } from "@/components/molecules/wide-sheet";
import { ClaimableDelayPicker } from "./claimable-delay-picker";
import { FormDrawer } from "./form-drawer";
import { useProjectActivities } from "@/hooks/use-activities";
import { useProjectRfis } from "@/hooks/use-rfis";
import { useStages } from "@/hooks/use-stages";
import { claimableDelays } from "@/lib/delay-meta";
import { currencySymbol } from "@/lib/formatters";
import { htmlFromPlainText } from "@/lib/rich-text";
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
  /** The create button's label. "Send for approval" where creating also submits; "Create" where it saves a draft. */
  createLabel?: string;
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

/** A chosen value gets the darker rule; an empty optional field keeps the light one. */
const SELECT_FILLED = "border-[#525252]";
const SELECT_EMPTY = "border-[#EEEEEE]";
const SELECT_BASE = "h-[45px] px-[16px] text-caption-l";
const CHEVRON = "text-[#A3A3A3]";
const HINT = "text-caption-m text-[#737373]";

const CURRENCY_OPTIONS = [
  { value: "NGN", label: "NGN" },
  { value: "USD", label: "USD" },
];
const TYPE_OPTIONS = CHANGE_TYPES.map((value) => ({ value, label: CHANGE_TYPE_LABELS[value].label }));

const NO_STAGE = "No stage";
const NO_RFI = "Not from an RFI";
const UNASSIGNED = "Unassigned";

/** Digits, one decimal point and a leading minus (an omission is a negative cost). */
function sanitiseAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  const negative = cleaned.startsWith("-");
  const [whole = "", ...rest] = cleaned.replace(/-/g, "").split(".");
  return `${negative ? "-" : ""}${whole}${rest.length > 0 ? `.${rest.join("")}` : ""}`;
}

function Field({ label, htmlFor, optional, hint, children, className }: { label: string; htmlFor?: string; optional?: boolean; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-[4px]", className)}>
      <label htmlFor={htmlFor} className={DRAWER_LABEL_CLASS}>
        {label}
        {optional ? <span className="font-normal text-[#737373]"> (optional)</span> : null}
      </label>
      {children}
      {hint ? <p className={cn(HINT, "mt-[3px]")}>{hint}</p> : null}
    </div>
  );
}

Field.displayName = "Field";

/**
 * A change request is a contractual proposal, not a status someone types: the
 * form captures what is changing, what kind of change it is and what it hangs
 * off. Images attached to the details are picked but not sent — the API has no
 * field for them (docs/change-orders-backend.md).
 */
function UpsertChangeRequestDialog({
  open,
  onOpenChange,
  projectId,
  mode,
  initial,
  assigneeOptions = [],
  onSubmit,
  isSubmitting = false,
  error,
  createLabel = "Send for approval",
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
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

  const isTimeClaim = type === "eot_only";
  const { data: stages = [] } = useStages(open ? projectId : undefined);
  const { data: rfis = [] } = useProjectRfis(open ? projectId : undefined);
  const { data: activities = [] } = useProjectActivities(open && isTimeClaim ? projectId : undefined);
  const delays = claimableDelays(activities);

  const stageItems = useMemo(() => [NO_STAGE, ...stages.map((stage) => stage.name)], [stages]);
  const rfiLabels = useMemo(() => rfis.map((rfi) => ({ id: rfi.id, label: `RFI-${rfi.number} · ${rfi.subject}` })), [rfis]);
  const rfiItems = useMemo(() => [NO_RFI, ...rfiLabels.map((rfi) => rfi.label)], [rfiLabels]);
  const assigneeItems = useMemo(() => [UNASSIGNED, ...assigneeOptions.map((option) => option.name)], [assigneeOptions]);
  const stageName = stages.find((stage) => stage.id === stageId)?.name ?? null;
  const rfiLabel = rfiLabels.find((rfi) => rfi.id === rfiId)?.label ?? null;
  const assigneeName = assigneeOptions.find((option) => option.id === assigneeId)?.name ?? UNASSIGNED;

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setImages([]);
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
      title={mode === "create" ? "New change request" : "Edit change request"}
      description="Propose a change to scope, cost or schedule."
      submitLabel={mode === "create" ? createLabel : "Save changes"}
      submitDisabled={!title.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      footerVariant="split"
      className="w-[min(698px,100vw)]"
      headerClassName={SHEET_HEADER_RULED}
      {...WIDE_SHEET}
    >
      <SheetRule />

      <Field label="Title" htmlFor="cr-title">
        <input
          id="cr-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Upgrade to imported floors"
          autoFocus
          className={DRAWER_FIELD_CLASS}
        />
      </Field>

      <div className="flex flex-col gap-[16px]">
        <Field label="Details" htmlFor="cr-desc" optional>
          <textarea
            id="cr-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what is changing"
            className={cn(DRAWER_FIELD_CLASS, "h-[132px] resize-none py-[16px]")}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[8px]">
          <AddImageButton onFiles={(files) => setImages((curr) => [...curr, ...files])} />
          {images.map((file, index) => (
            <FileLink key={`${file.name}-${index}`} file={file} onRemove={() => setImages((curr) => curr.filter((_, i) => i !== index))} />
          ))}
        </div>
      </div>

      <Field label="Reason" optional>
        <RichTextEditor
          variant="panel"
          value={reasonHtml}
          onChange={(html, text) => {
            setReasonHtml(html);
            setReason(text);
          }}
          projectId={projectId}
          placeholder="Why is the change needed?"
          ariaLabel="Reason"
        />
      </Field>

      <Field label="Type" htmlFor="cr-type" hint={CHANGE_TYPE_LABELS[type].hint}>
        <Select
          id="cr-type"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(next) => setType((next ?? "variation") as ChangeType)}
          className={cn(SELECT_BASE, SELECT_FILLED)}
          iconClassName={CHEVRON}
        />
        {isTimeClaim ? (
          <p className={HINT}>
            An award moves the revised completion date and every contractual key date by that many calendar days. The decision may grant fewer.
          </p>
        ) : null}
      </Field>

      <div className="mt-[4px] grid gap-[16px] sm:grid-cols-3">
        {isTimeClaim ? null : (
          <>
            <Field label="Currency" htmlFor="cr-currency">
              <Select
                id="cr-currency"
                options={CURRENCY_OPTIONS}
                value={currency}
                onChange={(next) => setCurrency((next ?? "NGN") as "NGN" | "USD")}
                className={cn(SELECT_BASE, SELECT_FILLED)}
                iconClassName={CHEVRON}
              />
            </Field>
            <Field label="Cost impact" htmlFor="cr-cost">
              <div className="flex h-[45px] border border-[#EEEEEE] bg-white focus-within:border-[#004DE7]">
                <span className="flex w-[42px] shrink-0 items-center justify-center border-r border-[#EEEEEE] text-caption-l font-semibold text-[#1E1E1E]">
                  {currencySymbol(currency)}
                </span>
                <input
                  id="cr-cost"
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(sanitiseAmount(e.target.value))}
                  placeholder="0"
                  className="h-full min-w-0 flex-1 bg-transparent px-[16px] text-caption-l text-[#1E1E1E] outline-none placeholder:text-[#B0B0B0]"
                />
              </div>
            </Field>
          </>
        )}
        <Field label={isTimeClaim ? "Days claimed" : "Time(days)"} htmlFor="cr-days">
          <input
            id="cr-days"
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value.replace(isTimeClaim ? /\D/g : /[^\d-]/g, ""))}
            placeholder="0"
            className={DRAWER_FIELD_CLASS}
          />
        </Field>
      </div>

      {isTimeClaim ? <ClaimableDelayPicker delays={delays} selected={delayIds} onToggle={toggleDelay} /> : null}

      <div className="grid gap-x-[16px] gap-y-[24px] sm:grid-cols-2">
        <Field label="Stage affected" htmlFor="cr-stage" hint="Its end date shifts by the time impact when the change is executed.">
          <SearchableSelect
            id="cr-stage"
            items={stageItems}
            value={stageName}
            onChange={(name) => setStageId(stages.find((stage) => stage.name === name)?.id ?? "")}
            placeholder="No stage"
            searchPlaceholder="Search stages"
            className={cn(SELECT_BASE, stageName ? SELECT_FILLED : SELECT_EMPTY)}
            iconClassName={CHEVRON}
          />
        </Field>
        <Field label="Originating RFI" htmlFor="cr-rfi" hint="Links the change back to the query that caused it.">
          <SearchableSelect
            id="cr-rfi"
            items={rfiItems}
            value={rfiLabel}
            onChange={(label) => setRfiId(rfiLabels.find((rfi) => rfi.label === label)?.id ?? "")}
            placeholder="Not from an RFI"
            searchPlaceholder="Search RFIs"
            className={cn(SELECT_BASE, rfiLabel ? SELECT_FILLED : SELECT_EMPTY)}
            iconClassName={CHEVRON}
          />
        </Field>
      </div>

      <Field label="Assignee" htmlFor="cr-assignee" className="mt-[4px]">
        <SearchableSelect
          id="cr-assignee"
          items={assigneeItems}
          value={assigneeName}
          onChange={(name) => setAssigneeId(assigneeOptions.find((option) => option.name === name)?.id ?? "")}
          searchPlaceholder="Search people"
          className={cn(SELECT_BASE, SELECT_FILLED)}
          iconClassName={CHEVRON}
        />
      </Field>
    </FormDrawer>
  );
}

UpsertChangeRequestDialog.displayName = "UpsertChangeRequestDialog";

export { UpsertChangeRequestDialog };
