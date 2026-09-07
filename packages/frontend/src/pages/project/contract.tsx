import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { Spinner } from "@/components/atoms/spinner";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { PageHeader } from "@/components/molecules/page-header";
import { RecordVariationDialog } from "@/components/molecules/record-variation-dialog";
import {
  useProjectFinances,
  useUpdateContractTerms,
} from "@/hooks/use-finances";
import { useProjectContext } from "@/layouts/project-layout";
import { getApiErrorMessage } from "@/lib/api-error";
import { currencySymbol as symbolFor, formatCurrency } from "@/lib/formatters";
import {
  ADVANCE_RECOVERY_MODES,
  CONTRACT_TYPES,
  RETENTION_RELEASE_MODES,
  type AdvanceRecoveryMode,
  type ContractType,
  type ProjectFinances,
  type RetentionReleaseMode,
  type UpdateContractTermsInput,
} from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const CONTRACT_TYPE_LABELS: Record<ContractType, { label: string; hint: string }> = {
  lump_sum: {
    label: "Lump sum",
    hint: "Fixed total price for a fully defined scope.",
  },
  cost_plus: {
    label: "Cost plus",
    hint: "Contractor bills cost + agreed fee or markup.",
  },
  unit_rate: {
    label: "Unit rate / re-measurement",
    hint: "Price per measured unit; final total known at completion.",
  },
  gmp: {
    label: "Guaranteed maximum price",
    hint: "Cost-plus with a cap agreed up-front.",
  },
  design_build: {
    label: "Design–build",
    hint: "Single party responsible for design and construction.",
  },
  target_cost: {
    label: "Target cost",
    hint: "Shared pain/gain against an agreed target price.",
  },
};

const RETENTION_MODE_LABELS: Record<RetentionReleaseMode, { label: string; hint: string }> = {
  all_at_practical_completion: {
    label: "Released at practical completion",
    hint: "Full retention returned once the works reach practical completion.",
  },
  staged_pc_dlp: {
    label: "Staged (50% at PC, 50% at DLP)",
    hint: "Half at practical completion, remainder after defects liability.",
  },
  all_at_dlp: {
    label: "Released at end of defects liability",
    hint: "Full retention held until the defects liability period ends.",
  },
};

const ADVANCE_MODE_LABELS: Record<AdvanceRecoveryMode, { label: string; hint: string }> = {
  percentage: {
    label: "Percentage of each certification",
    hint: "A % of every certified payment is applied to the advance.",
  },
  fixed: {
    label: "Fixed amount per certification",
    hint: "A fixed sum is applied to the advance until fully recovered.",
  },
};

interface FormState {
  contractSum: string;
  contractType: ContractType;
  retentionRatePercent: string;
  retentionReleaseMode: RetentionReleaseMode;
  advancePercentagePercent: string;
  advanceRecoveryMode: AdvanceRecoveryMode;
  advanceRecoveryRate: string;
  paymentTermsDays: string;
  defectsLiabilityDays: string;
  contractNotes: string;
}

function toForm(finances: ProjectFinances): FormState {
  const terms = finances.contractTerms;
  return {
    contractSum: finances.contractSum ? finances.contractSum.toString() : "",
    contractType: terms.contractType,
    retentionRatePercent: (terms.retentionRate * 100).toString(),
    retentionReleaseMode: terms.retentionReleaseMode,
    advancePercentagePercent: (terms.advancePercentage * 100).toString(),
    advanceRecoveryMode: terms.advanceRecoveryMode,
    advanceRecoveryRate: terms.advanceRecoveryRate.toString(),
    paymentTermsDays: terms.paymentTermsDays.toString(),
    defectsLiabilityDays: terms.defectsLiabilityDays.toString(),
    contractNotes: terms.contractNotes ?? "",
  };
}

function diffToPatch(
  next: FormState,
  finances: ProjectFinances,
): UpdateContractTermsInput | null {
  const base = finances.contractTerms;
  const patch: UpdateContractTermsInput = {};
  const nextContractSum = Number(next.contractSum);
  if (
    next.contractSum.trim().length > 0 &&
    Number.isFinite(nextContractSum) &&
    nextContractSum !== finances.contractSum
  ) {
    patch.contractSum = nextContractSum;
  }
  if (next.contractType !== base.contractType) {
    patch.contractType = next.contractType;
  }
  const nextRetention = Number(next.retentionRatePercent) / 100;
  if (Number.isFinite(nextRetention) && nextRetention !== base.retentionRate) {
    patch.retentionRate = nextRetention;
  }
  if (next.retentionReleaseMode !== base.retentionReleaseMode) {
    patch.retentionReleaseMode = next.retentionReleaseMode;
  }
  const nextAdvance = Number(next.advancePercentagePercent) / 100;
  if (Number.isFinite(nextAdvance) && nextAdvance !== base.advancePercentage) {
    patch.advancePercentage = nextAdvance;
  }
  if (next.advanceRecoveryMode !== base.advanceRecoveryMode) {
    patch.advanceRecoveryMode = next.advanceRecoveryMode;
  }
  const nextRecoveryRate = Number(next.advanceRecoveryRate);
  if (
    Number.isFinite(nextRecoveryRate) &&
    nextRecoveryRate !== base.advanceRecoveryRate
  ) {
    patch.advanceRecoveryRate = nextRecoveryRate;
  }
  const nextPaymentDays = Number(next.paymentTermsDays);
  if (
    Number.isInteger(nextPaymentDays) &&
    nextPaymentDays >= 0 &&
    nextPaymentDays !== base.paymentTermsDays
  ) {
    patch.paymentTermsDays = nextPaymentDays;
  }
  const nextDefectsDays = Number(next.defectsLiabilityDays);
  if (
    Number.isInteger(nextDefectsDays) &&
    nextDefectsDays >= 0 &&
    nextDefectsDays !== base.defectsLiabilityDays
  ) {
    patch.defectsLiabilityDays = nextDefectsDays;
  }
  const nextNotes = next.contractNotes.trim();
  const baseNotes = base.contractNotes ?? "";
  if (nextNotes !== baseNotes) {
    patch.contractNotes = nextNotes.length > 0 ? nextNotes : null;
  }
  return Object.keys(patch).length === 0 ? null : patch;
}

const inputClass =
  "h-11 w-full rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";
const numericInputClass = cn(inputClass, "tabular-nums pr-14");

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card padding="lg" className="mt-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      {children}
    </Card>
  );
}

function RadioCard<TValue extends string>({
  name,
  value,
  checked,
  disabled,
  onChange,
  label,
  hint,
}: {
  name: string;
  value: TValue;
  checked: boolean;
  disabled: boolean;
  onChange: (value: TValue) => void;
  label: string;
  hint: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
        checked
          ? "border-[#004DE7] bg-[#004DE7]/5"
          : "border-gray-200 hover:border-gray-300",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="mt-1 h-4 w-4 accent-[#004DE7]"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="mt-0.5 text-xs text-gray-500">{hint}</div>
      </div>
    </label>
  );
}

export default function ProjectContract() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const { data: finances, isPending, isError, error } = useProjectFinances(project.id);
  const update = useUpdateContractTerms();

  const [form, setForm] = useState<FormState | null>(null);
  const [variationOpen, setVariationOpen] = useState(false);

  useEffect(() => {
    if (finances) setForm(toForm(finances));
  }, [finances]);

  const patch = useMemo(() => {
    if (!form || !finances) return null;
    return diffToPatch(form, finances);
  }, [form, finances]);

  const dirty = patch !== null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
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
        onSuccess: () => {
          toast("Contract terms saved", "success");
        },
        onError: (err) => {
          toast(getApiErrorMessage(err), "error");
        },
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
      <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
        <Breadcrumbs
          items={[
            { label: "Finances", to: `/project/${project.id}/finances` },
            { label: "Contract" },
          ]}
          className="mb-4"
        />
        <PageHeader
          title="Contract"
          description="Set contract type, retention, advance amortisation and payment terms for this project."
        />
        <Card padding="lg" className="mt-8 text-center text-sm text-red-600">
          {getApiErrorMessage(error, "Failed to load contract terms.")}
        </Card>
      </div>
    );
  }

  const disabled = !canManage || update.isPending;

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Finances", to: `/project/${project.id}/finances` },
          { label: "Contract" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Contract"
        description="Set contract type, retention, advance amortisation and payment terms. These values drive how retention accrues, how advances are recovered, and how invoices are aged."
      />

      <Section
        title="Contract sum"
        description="The base contract value agreed with the contractor before variations. Adjusted contract = contract sum + variations."
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
                {formatCurrency(
                  Math.abs(finances.variationsTotal),
                  finances.currency,
                )}
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
        {canManage && (
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setVariationOpen(true)}
            >
              Record variation
            </Button>
          </div>
        )}
      </Section>

      <Section
        title="Contract type"
        description="Which pricing structure governs this contract? This affects how variations and certifications are handled."
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
      </Section>

      <Section
        title="Retention"
        description="Percentage held from each certified payment as security against defects."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="retention-rate">Retention rate</Label>
            <div className="relative">
              <input
                id="retention-rate"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={form.retentionRatePercent}
                onChange={(e) => set("retentionRatePercent", e.target.value)}
                disabled={disabled}
                className={numericInputClass}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-gray-500">
                %
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Typical range 3% – 10%. Held per certification until released.
            </p>
          </div>
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
      </Section>

      <Section
        title="Advance / mobilisation"
        description="Up-front payment made to the contractor for mobilisation, recovered from later certifications."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="advance-percentage">Advance percentage</Label>
            <div className="relative">
              <input
                id="advance-percentage"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={form.advancePercentagePercent}
                onChange={(e) => set("advancePercentagePercent", e.target.value)}
                disabled={disabled}
                className={numericInputClass}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-gray-500">
                %
              </span>
            </div>
            <p className="text-xs text-gray-400">
              % of adjusted contract sum released as mobilisation. Typical 10% – 20%.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="advance-recovery-rate">
              Recovery {form.advanceRecoveryMode === "percentage" ? "rate" : "amount"}
            </Label>
            <div className="relative">
              <input
                id="advance-recovery-rate"
                type="number"
                min={0}
                step={form.advanceRecoveryMode === "percentage" ? 0.1 : 1}
                value={form.advanceRecoveryRate}
                onChange={(e) => set("advanceRecoveryRate", e.target.value)}
                disabled={disabled}
                className={numericInputClass}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-gray-500">
                {form.advanceRecoveryMode === "percentage" ? "%" : finances.currency}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {form.advanceRecoveryMode === "percentage"
                ? "% deducted from every certified payment until the advance is recovered."
                : `Fixed ${finances.currency} amount deducted per certification.`}
            </p>
          </div>
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
      </Section>

      <Section
        title="Payment terms"
        description="Timelines that govern when invoices are due and how long retention is held after completion."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-days">Payment terms</Label>
            <div className="relative">
              <input
                id="payment-days"
                type="number"
                min={0}
                step={1}
                value={form.paymentTermsDays}
                onChange={(e) => set("paymentTermsDays", e.target.value)}
                disabled={disabled}
                className={numericInputClass}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-gray-500">
                days
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Net-{form.paymentTermsDays || 0} — days until an invoice is considered overdue.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="defects-days">Defects liability</Label>
            <div className="relative">
              <input
                id="defects-days"
                type="number"
                min={0}
                step={1}
                value={form.defectsLiabilityDays}
                onChange={(e) => set("defectsLiabilityDays", e.target.value)}
                disabled={disabled}
                className={numericInputClass}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-gray-500">
                days
              </span>
            </div>
            <p className="text-xs text-gray-400">
              How long the contractor is responsible for defects after practical completion.
            </p>
          </div>
        </div>
      </Section>

      <Section
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
      </Section>

      {canManage && (
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            onClick={handleReset}
            disabled={!dirty || update.isPending}
          >
            Discard changes
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty}
            loading={update.isPending}
          >
            Save contract terms
          </Button>
        </div>
      )}

      {!canManage && (
        <Card padding="md" className="mt-6 text-xs text-gray-500">
          You have read-only access. Contact a finance manager to change contract
          terms.
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
    </div>
  );
}
