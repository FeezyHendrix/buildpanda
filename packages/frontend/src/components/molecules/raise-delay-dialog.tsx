import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { DelayLinkFields, type DelayLinkOptions } from "./delay-link-fields";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { Switcher } from "@/components/atoms/switcher";
import { currencySymbol } from "@/lib/formatters";
import type { ActivityDelay, Culpability, DelayReason } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";
import {
  CONTRACTOR_NO_EOT_REASON,
  CULPABILITY_OPTIONS,
  groupReasons,
  isFutureDay,
  toLocalDateTimeInput,
} from "@/lib/delay-meta";
import { cn } from "@/lib/utils";

export interface RaiseDelayValues {
  reasonCode: string;
  description: string;
  startedAt: string;
  endedAt: string | null;
  daysLost: number;
  culpability: Culpability;
  eotClaimable: boolean;
  linkedRfiId: string | null;
  linkedChangeRequestId: string | null;
  linkedMaterialOrderId: string | null;
  costImpact: number;
  preventionNotes: string;
}

interface RaiseDelayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityName: string;
  reasons: DelayReason[];
  /** Set to amend an existing delay instead of raising a new one. */
  initial?: ActivityDelay | null;
  links?: DelayLinkOptions;
  onSubmit: (values: RaiseDelayValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const FUTURE_MESSAGE =
  "A delay is a record of something that happened — it cannot start in the future.";

function RaiseDelayDialog({
  open,
  onOpenChange,
  activityName,
  reasons,
  initial,
  links,
  onSubmit,
  isSubmitting = false,
  error,
}: RaiseDelayDialogProps) {
  const isEdit = Boolean(initial);
  const [reasonCode, setReasonCode] = useState("");
  const [description, setDescription] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [daysLost, setDaysLost] = useState("0");
  const [culpability, setCulpability] = useState<Culpability>("neutral");
  const [eotClaimable, setEotClaimable] = useState(false);
  const [linkedRfiId, setLinkedRfiId] = useState("");
  const [linkedChangeRequestId, setLinkedChangeRequestId] = useState("");
  const [linkedMaterialOrderId, setLinkedMaterialOrderId] = useState("");
  const [costImpact, setCostImpact] = useState("0");
  const [preventionNotes, setPreventionNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setReasonCode(initial?.reasonCode ?? "");
    setDescription(initial?.description ?? "");
    setStartedAt(toLocalDateTimeInput(initial ? new Date(initial.startedAt) : new Date()));
    setEndedAt(initial?.endedAt ? toLocalDateTimeInput(new Date(initial.endedAt)) : "");
    setDaysLost(String(initial?.daysLost ?? 0));
    setCulpability(initial?.culpability ?? "neutral");
    setEotClaimable(initial?.eotClaimable ?? false);
    setLinkedRfiId(initial?.linkedRfiId ?? "");
    setLinkedChangeRequestId(initial?.linkedChangeRequestId ?? "");
    setLinkedMaterialOrderId(initial?.linkedMaterialOrderId ?? "");
    setCostImpact(String(initial?.costImpact ?? 0));
    setPreventionNotes(initial?.preventionNotes ?? "");
  }, [open, initial]);

  /** Picking a reason carries its contractual default; the PM can still override. */
  function handleReasonChange(code: string): void {
    setReasonCode(code);
    const reason = reasons.find((r) => r.code === code);
    if (!reason?.default_culpability) return;
    setCulpability(reason.default_culpability);
    setEotClaimable(
      reason.default_culpability === "contractor" ? false : (reason.default_eot_claimable ?? false),
    );
  }

  function handleCulpabilityChange(next: Culpability): void {
    setCulpability(next);
    if (next === "contractor") setEotClaimable(false);
  }

  const isContractor = culpability === "contractor";
  const startedInFuture = isFutureDay(startedAt);
  const daysLostValue = Number(daysLost);
  const daysLostInvalid = daysLost.trim().length === 0 || !Number.isFinite(daysLostValue) || daysLostValue < 0;
  const endedBeforeStart =
    Boolean(endedAt) && Boolean(startedAt) && new Date(endedAt) < new Date(startedAt);

  const isValid =
    reasonCode.length > 0 &&
    startedAt.length > 0 &&
    !startedInFuture &&
    !daysLostInvalid &&
    !endedBeforeStart;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      reasonCode,
      description: description.trim(),
      startedAt: new Date(startedAt).toISOString(),
      endedAt: endedAt ? new Date(endedAt).toISOString() : null,
      daysLost: Math.max(0, Math.trunc(daysLostValue)),
      culpability,
      eotClaimable: isContractor ? false : eotClaimable,
      linkedRfiId: linkedRfiId || null,
      linkedChangeRequestId: linkedChangeRequestId || null,
      linkedMaterialOrderId: linkedMaterialOrderId || null,
      costImpact: Math.max(0, Number(costImpact) || 0),
      preventionNotes: preventionNotes.trim(),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit delay on ${activityName}` : `Log a delay on ${activityName}`}
      description="Measured lost time pushes this activity and everything that follows it, on the project's working calendar."
      submitLabel={isEdit ? "Save changes" : "Log delay"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      width="lg"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="delay-reason">Reason</Label>
        <select
          id="delay-reason"
          value={reasonCode}
          onChange={(e) => handleReasonChange(e.target.value)}
          disabled={isEdit}
          className={INPUT_CLASS}
        >
          <option value="">Select a reason…</option>
          {groupReasons(reasons).map(([category, list]) => (
            <optgroup key={category} label={category}>
              {list.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {isEdit ? (
          <p className="text-xs text-ink-muted">
            The reason is part of the record — raise a new delay if the cause was different.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delay-started">Started at</Label>
          <input
            id="delay-started"
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            aria-invalid={startedInFuture || undefined}
            className={INPUT_CLASS}
          />
          {startedInFuture ? (
            <p className="text-xs text-negative-600">{FUTURE_MESSAGE}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delay-ended">Ended at (optional)</Label>
          <input
            id="delay-ended"
            type="datetime-local"
            value={endedAt}
            onChange={(e) => setEndedAt(e.target.value)}
            aria-invalid={endedBeforeStart || undefined}
            className={INPUT_CLASS}
          />
          {endedBeforeStart ? (
            <p className="text-xs text-negative-600">Ended at cannot be before started at.</p>
          ) : (
            <p className="text-xs text-ink-muted">Setting an end closes the delay.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delay-days-lost">Days lost (working days)</Label>
          <input
            id="delay-days-lost"
            type="number"
            min={0}
            step={1}
            value={daysLost}
            onChange={(e) => setDaysLost(e.target.value)}
            aria-invalid={daysLostInvalid || undefined}
            className={INPUT_CLASS}
          />
          {daysLostInvalid ? (
            <p className="text-xs text-negative-600">Days lost is required and cannot be negative.</p>
          ) : (
            <p className="text-xs text-ink-muted">The programme moves by this many working days.</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delay-culpability">Culpability</Label>
          <select
            id="delay-culpability"
            value={culpability}
            onChange={(e) => handleCulpabilityChange(e.target.value as Culpability)}
            className={INPUT_CLASS}
          >
            {CULPABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="delay-eot">Claimable as an extension of time</Label>
        <div className={cn("flex items-center gap-3", isContractor && "opacity-60")}>
          <Switcher
            value={eotClaimable ? "yes" : "no"}
            onChange={(next) => {
              if (isContractor) return;
              setEotClaimable(next === "yes");
            }}
            className={isContractor ? "pointer-events-none" : undefined}
          />
          <span id="delay-eot" className="text-xs text-ink-muted">
            {isContractor
              ? CONTRACTOR_NO_EOT_REASON
              : "Only a claimable delay can be cited on an EOT claim."}
          </span>
        </div>
      </div>

      <DelayLinkFields
        links={links}
        rfiId={linkedRfiId}
        changeRequestId={linkedChangeRequestId}
        materialOrderId={linkedMaterialOrderId}
        onRfiChange={setLinkedRfiId}
        onChangeRequestChange={setLinkedChangeRequestId}
        onMaterialOrderChange={setLinkedMaterialOrderId}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="delay-description">What happened?</Label>
        <textarea
          id="delay-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={2000}
          disabled={isEdit}
          placeholder="Brief description of the situation."
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3 resize-none")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="delay-cost">Estimated cost impact (NGN)</Label>
        <MoneyInput
          id="delay-cost"
          value={costImpact}
          onChange={setCostImpact}
          currencySymbol={currencySymbol("NGN")}
          placeholder="0.00"
          disabled={isEdit}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="delay-prevention">How can we prevent this?</Label>
        <textarea
          id="delay-prevention"
          value={preventionNotes}
          onChange={(e) => setPreventionNotes(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Optional, fill once known."
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3 resize-none")}
        />
      </div>
    </FormDrawer>
  );
}

RaiseDelayDialog.displayName = "RaiseDelayDialog";

export { RaiseDelayDialog, type RaiseDelayDialogProps };
