import { RETENTION_RELEASE_MODES, ADVANCE_RECOVERY_MODES } from "@/lib/project-types";
import {
  ADVANCE_MODE_LABELS,
  RETENTION_MODE_LABELS,
  type ContractTermsForm,
} from "./contract-terms-model";
import { RadioCard, TermsSection, UnitNumberField } from "./contract-terms-fields";

/**
 * Retention, how it is released, the mobilisation advance and how it is
 * recovered, and the payment terms: the clauses that decide when money is held
 * back and when it falls due. All recorded figures; nothing here moves money.
 */

interface SectionProps {
  form: ContractTermsForm;
  set: <K extends keyof ContractTermsForm>(key: K, value: ContractTermsForm[K]) => void;
  disabled: boolean;
  currency: string;
}

const TWO_UP = "grid grid-cols-1 gap-x-[16px] gap-y-[20px] sm:grid-cols-2";

export function RetentionSections({ form, set, disabled }: SectionProps) {
  return (
    <>
      <TermsSection
        title="Retention"
        description="Percentage held from each approved payment as security against defects."
      >
        <div className={TWO_UP}>
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
          <UnitNumberField
            id="retention-cap"
            label="Retention limit"
            value={form.retentionCapPercent}
            onChange={(v) => set("retentionCapPercent", v)}
            disabled={disabled}
            unit="%"
            max={100}
            step={0.1}
            hint="Retention stops accruing once the held sum reaches this share of the contract. 0 = uncapped."
          />
        </div>
      </TermsSection>

      <TermsSection title="Release schedule">
        <div role="radiogroup" aria-label="Release schedule" className="flex flex-col gap-[12px]">
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
      </TermsSection>
    </>
  );
}

RetentionSections.displayName = "RetentionSections";

export function AdvanceSections({ form, set, disabled, currency }: SectionProps) {
  const isPercentRecovery = form.advanceRecoveryMode === "percentage";

  return (
    <>
      <TermsSection
        title="Advance / mobilisation"
        description="Up-front payment made to the contractor for mobilisation, recovered from later payments."
      >
        <div className="flex flex-col gap-[20px]">
          <div className={TWO_UP}>
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
              unit={isPercentRecovery ? "%" : currency}
              step={isPercentRecovery ? 0.1 : 1}
              hint={
                isPercentRecovery
                  ? "% deducted from every certified payment until the advance is recovered."
                  : `Fixed ${currency} amount deducted per certification.`
              }
            />
          </div>
          <UnitNumberField
            id="advance-recovery-from"
            label="Recovery starts from certificate"
            value={form.advanceRecoveryFromCertificate}
            onChange={(v) => set("advanceRecoveryFromCertificate", v)}
            disabled={disabled}
            unit="IPC"
            min={1}
            hint="Recovery is deducted from this certificate onwards — typically IPC 2, so the mobilisation certificate itself is not clawed back."
          />
        </div>
      </TermsSection>

      <TermsSection title="Recovery mode">
        <div role="radiogroup" aria-label="Recovery mode" className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
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
      </TermsSection>
    </>
  );
}

AdvanceSections.displayName = "AdvanceSections";

export function PaymentTermsSection({ form, set, disabled }: SectionProps) {
  return (
    <TermsSection
      title="Payment terms"
      description="Timelines that govern when invoices are due and how long retention is held after completion."
    >
      <UnitNumberField
        id="payment-days"
        label="Payment terms"
        value={form.paymentTermsDays}
        onChange={(v) => set("paymentTermsDays", v)}
        disabled={disabled}
        unit="Days"
        hint={`Net-${form.paymentTermsDays || 0} — days until an invoice is considered overdue.`}
      />
    </TermsSection>
  );
}

PaymentTermsSection.displayName = "PaymentTermsSection";
