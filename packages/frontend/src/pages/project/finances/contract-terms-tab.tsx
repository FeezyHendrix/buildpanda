import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { Spinner } from "@/components/atoms/spinner";
import { RecordVariationDialog } from "@/components/molecules/record-variation-dialog";
import { useProjectFinances, useUpdateContractTerms } from "@/hooks/use-finances";
import { useProjectContext } from "@/layouts/project-layout";
import { getApiErrorMessage } from "@/lib/api-error";
import { currencySymbol as symbolFor, formatCurrency } from "@/lib/formatters";
import {
  ADVANCE_RECOVERY_MODES,
  CONTRACT_TYPES,
  RETENTION_RELEASE_MODES,
  canResourceAction,
} from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { TabHeader } from "./finance-tabs";
import {
  ADVANCE_MODE_LABELS,
  CONTRACT_TYPE_LABELS,
  RETENTION_MODE_LABELS,
  diffToPatch,
  toForm,
  type ContractTermsForm,
} from "./contract/contract-terms-model";
import { RadioCard, TermsSection, UnitNumberField } from "./contract/contract-terms-fields";

/**
 * Terms — the contract sum and the commercial terms that govern how it is
 * certified, retained and paid. Saving records the agreed terms; nothing here
 * moves money.
 */
export function ContractTermsTab() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const { data: finances, isPending, isError, error } = useProjectFinances(project.id);
  const update = useUpdateContractTerms();

  const [form, setForm] = useState<ContractTermsForm | null>(null);
  const [variationOpen, setVariationOpen] = useState(false);

  useEffect(() => {
    if (finances) setForm(toForm(finances));
  }, [finances]);

  const patch = useMemo(() => {
    if (!form || !finances) return null;
    return diffToPatch(form, finances);
  }, [form, finances]);

  const dirty = patch !== null;

  function set<K extends keyof ContractTermsForm>(key: K, value: ContractTermsForm[K]): void {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleReset(): void {
    if (finances) setForm(toForm(finances));
  }

  function handleSave(): void {
    if (!patch || !finances) return;
    update.mutate(
      { projectId: project.id, ...patch },
      {
        onSuccess: () => toast("Contract terms saved", "success"),
        onError: (err) => toast(getApiErrorMessage(err), "error"),
      },
    );
  }

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !finances || !form) {
    return (
      <Card padding="lg" className="mt-8 text-center text-sm text-red-600">
        {getApiErrorMessage(error, "Failed to load contract terms.")}
      </Card>
    );
  }

  const disabled = !canManage || update.isPending;
  const isPercentRecovery = form.advanceRecoveryMode === "percentage";

  return (
    <section aria-label="Contract terms">
      <TabHeader
        heading="Terms"
        description="The agreed contract sum and the terms that govern retention, advances and payment."
      />

      <TermsSection
        title="Contract amount"
        description="The base amount agreed with the contractor before changes. Revised contract = contract amount + changes."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contract-sum">Contract sum</Label>
            <MoneyInput
              id="contract-sum"
              value={form.contractSum}
              onChange={(v) => set("contractSum", v)}
              currencySymbol={symbolFor(finances.currency)}
              disabled={disabled}
            />
            <p className="text-xs text-gray-400">
              Currently{" "}
              <span className="font-medium tabular-nums text-gray-600">
                {formatCurrency(finances.contractSum, finances.currency)}
              </span>
              . Variations recorded so far:{" "}
              <span
                className={cn(
                  "font-medium tabular-nums",
                  finances.variationsTotal > 0
                    ? "text-emerald-600"
                    : finances.variationsTotal < 0
                      ? "text-rose-600"
                      : "text-gray-600",
                )}
              >
                {finances.variationsTotal >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(finances.variationsTotal), finances.currency)}
              </span>
              .
            </p>
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl bg-[#FAFAFA] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Adjusted contract (live)
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-[#004DE7]">
              {formatCurrency(
                (Number(form.contractSum) || 0) + finances.variationsTotal,
                finances.currency,
              )}
            </p>
            <p className="text-xs text-gray-400">
              Preview based on the value in the field above. Save to apply.
            </p>
          </div>
        </div>
        {canManage ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-gray-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Approved change to the contract value?
              </p>
              <p className="text-xs text-gray-500">
                Record it as a variation — positive for additional works, negative
                for omissions. Every entry is kept in the audit trail.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setVariationOpen(true)}>
              Record variation
            </Button>
          </div>
        ) : null}
      </TermsSection>

      <TermsSection
        title="Contract type"
        description="Which pricing structure governs this contract? This affects how changes and approvals are handled."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CONTRACT_TYPES.map((type) => (
            <RadioCard
              key={type}
              name="contract-type"
              value={type}
              checked={form.contractType === type}
              disabled={disabled}
              onChange={(v) => set("contractType", v)}
              label={CONTRACT_TYPE_LABELS[type].label}
              hint={CONTRACT_TYPE_LABELS[type].hint}
            />
          ))}
        </div>
      </TermsSection>

      <TermsSection
        title="Retention"
        description="Percentage held from each approved payment as security against defects."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <UnitNumberField
            id="retention-rate"
            label="Retention rate"
            value={form.retentionRatePercent}
            onChange={(v) => set("retentionRatePercent", v)}
            disabled={disabled}
            unit="%"
            max={100}
            step={0.1}
            hint="Typical range 3% – 10%. Held per certification until released."
          />
          <div className="flex flex-col gap-1.5">
            <Label>Release schedule</Label>
            <div className="flex flex-col gap-2">
              {RETENTION_RELEASE_MODES.map((mode) => (
                <RadioCard
                  key={mode}
                  name="retention-release"
                  value={mode}
                  checked={form.retentionReleaseMode === mode}
                  disabled={disabled}
                  onChange={(v) => set("retentionReleaseMode", v)}
                  label={RETENTION_MODE_LABELS[mode].label}
                  hint={RETENTION_MODE_LABELS[mode].hint}
                />
              ))}
            </div>
          </div>
        </div>
      </TermsSection>

      <TermsSection
        title="Advance / mobilisation"
        description="Up-front payment made to the contractor for mobilisation, recovered from later payments."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <UnitNumberField
            id="advance-percentage"
            label="Advance percentage"
            value={form.advancePercentagePercent}
            onChange={(v) => set("advancePercentagePercent", v)}
            disabled={disabled}
            unit="%"
            max={100}
            step={0.1}
            hint="% of adjusted contract sum released as mobilisation. Typical 10% – 20%."
          />
          <UnitNumberField
            id="advance-recovery-rate"
            label={`Recovery ${isPercentRecovery ? "rate" : "amount"}`}
            value={form.advanceRecoveryRate}
            onChange={(v) => set("advanceRecoveryRate", v)}
            disabled={disabled}
            unit={isPercentRecovery ? "%" : finances.currency}
            step={isPercentRecovery ? 0.1 : 1}
            hint={
              isPercentRecovery
                ? "% deducted from every certified payment until the advance is recovered."
                : `Fixed ${finances.currency} amount deducted per certification.`
            }
          />
        </div>

        <div className="mt-6">
          <Label>Recovery mode</Label>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ADVANCE_RECOVERY_MODES.map((mode) => (
              <RadioCard
                key={mode}
                name="advance-mode"
                value={mode}
                checked={form.advanceRecoveryMode === mode}
                disabled={disabled}
                onChange={(v) => set("advanceRecoveryMode", v)}
                label={ADVANCE_MODE_LABELS[mode].label}
                hint={ADVANCE_MODE_LABELS[mode].hint}
              />
            ))}
          </div>
        </div>
      </TermsSection>

      <TermsSection
        title="Payment terms"
        description="Timelines that govern when invoices are due and how long retention is held after completion."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <UnitNumberField
            id="payment-days"
            label="Payment terms"
            value={form.paymentTermsDays}
            onChange={(v) => set("paymentTermsDays", v)}
            disabled={disabled}
            unit="days"
            hint={`Net-${form.paymentTermsDays || 0} — days until an invoice is considered overdue.`}
          />
          <UnitNumberField
            id="defects-days"
            label="Defects liability"
            value={form.defectsLiabilityDays}
            onChange={(v) => set("defectsLiabilityDays", v)}
            disabled={disabled}
            unit="days"
            hint="How long the contractor is responsible for defects after practical completion."
          />
        </div>
      </TermsSection>

      <TermsSection
        title="Contract notes"
        description="Free-form notes about this contract — key clauses, referenced documents, agreed exclusions."
      >
        <textarea
          id="contract-notes"
          value={form.contractNotes}
          onChange={(e) => set("contractNotes", e.target.value)}
          disabled={disabled}
          rows={5}
          maxLength={2000}
          placeholder="e.g. JCT SBC/Q 2016 with amendments. Insurance clause 6.5.1 waived by side letter dated 3 Feb."
          className="w-full resize-y rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:opacity-60"
        />
        <p className="mt-1 text-[11px] text-gray-400">
          {form.contractNotes.trim().length}/2000
        </p>
      </TermsSection>

      {canManage ? (
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={handleReset} disabled={!dirty || update.isPending}>
            Discard changes
          </Button>
          <Button onClick={handleSave} disabled={!dirty} loading={update.isPending}>
            Save contract terms
          </Button>
        </div>
      ) : (
        <Card padding="md" className="mt-6 text-xs text-gray-500">
          You have read-only access. Contact a finance manager to change contract terms.
        </Card>
      )}

      <RecordVariationDialog
        open={variationOpen}
        onOpenChange={setVariationOpen}
        projectId={project.id}
        currency={finances.currency}
        currentAdjustedContract={finances.adjustedContract}
        currentVariationsTotal={finances.variationsTotal}
      />
    </section>
  );
}

ContractTermsTab.displayName = "ContractTermsTab";
