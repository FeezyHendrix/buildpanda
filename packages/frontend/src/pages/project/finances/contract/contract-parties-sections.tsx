import {
  CONTRACT_FORMS,
  VALUATION_FREQUENCIES,
  type ContractForm,
  type ValuationFrequency,
} from "@/lib/project-types";
import {
  CONTRACT_FORM_LABELS,
  VALUATION_FREQUENCY_LABELS,
  type ContractTermsForm,
} from "./contract-terms-model";
import { TermsSection, TermsSelectField, TermsTextField, UnitNumberField } from "./contract-terms-fields";

/**
 * The contractual facts a QS needs on file beyond the money: who the parties
 * are, which standard form governs, the contract period, the liquidated
 * damages that bite when it is overrun, and how often the works are valued.
 *
 * Every rate here is a percentage on screen; the model converts it to the
 * fraction the API stores. Liquidated damages are money per calendar day.
 */

interface SectionProps {
  form: ContractTermsForm;
  set: <K extends keyof ContractTermsForm>(key: K, value: ContractTermsForm[K]) => void;
  disabled: boolean;
  currency: string;
}

const CONTRACT_FORM_OPTIONS: readonly { value: ContractForm | ""; label: string }[] = [
  { value: "", label: "Not recorded" },
  ...CONTRACT_FORMS.map((form) => ({ value: form, label: CONTRACT_FORM_LABELS[form] })),
];

const VALUATION_OPTIONS: readonly { value: ValuationFrequency; label: string }[] =
  VALUATION_FREQUENCIES.map((frequency) => ({
    value: frequency,
    label: VALUATION_FREQUENCY_LABELS[frequency],
  }));

export function ContractPartiesSection({ form, set, disabled }: SectionProps) {
  return (
    <TermsSection
      title="Parties and form"
      description="Who the contract is between and which standard form governs it. The employer is the party being certified to; the contractor is the party carrying out the works."
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <TermsTextField
          id="employer-name"
          label="Employer / client"
          value={form.employerName}
          onChange={(v) => set("employerName", v)}
          disabled={disabled}
          placeholder="e.g. Lagos State Ministry of Works"
          maxLength={200}
          hint="The party the works are certified to and who pays the certificates."
        />
        <TermsTextField
          id="contractor-name"
          label="Contractor"
          value={form.contractorName}
          onChange={(v) => set("contractorName", v)}
          disabled={disabled}
          placeholder="e.g. Ikorodu Civil Works Ltd"
          maxLength={200}
          hint="The party carrying out the works and raising the certificates."
        />
        <TermsSelectField<ContractForm>
          id="contract-form"
          label="Contract form"
          value={(form.contractForm as ContractForm | "") ?? ""}
          onChange={(v) => set("contractForm", v)}
          disabled={disabled}
          options={CONTRACT_FORM_OPTIONS}
          hint="The standard form the conditions come from."
        />
        <TermsSelectField<ValuationFrequency>
          id="valuation-frequency"
          label="Valuation frequency"
          value={form.valuationFrequency}
          onChange={(v) => set("valuationFrequency", (v || "monthly") as ValuationFrequency)}
          disabled={disabled}
          options={VALUATION_OPTIONS}
          hint="How often the works are measured and an interim certificate is raised."
        />
      </div>
    </TermsSection>
  );
}

ContractPartiesSection.displayName = "ContractPartiesSection";

export function ContractPeriodSection({ form, set, disabled, currency }: SectionProps) {
  return (
    <TermsSection
      title="Contract period and liquidated damages"
      description="The dates the works run between, and the damages the employer may levy for each day of culpable delay beyond completion. An approved extension of time moves the date lateness is measured against."
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <TermsTextField
          id="commencement-date"
          label="Commencement date"
          type="date"
          value={form.commencementDate}
          onChange={(v) => set("commencementDate", v)}
          disabled={disabled}
          hint="Date of possession / commencement under the contract."
        />
        <TermsTextField
          id="contract-completion-date"
          label="Contract completion date"
          type="date"
          value={form.completionDate}
          onChange={(v) => set("completionDate", v)}
          disabled={disabled}
          hint="The original completion date, before any extension of time."
        />
        <UnitNumberField
          id="ld-rate"
          label="Liquidated damages"
          value={form.liquidatedDamagesRate}
          onChange={(v) => set("liquidatedDamagesRate", v)}
          disabled={disabled}
          unit={`${currency}/day`}
          step={1000}
          hint="Money per calendar day late. 0 means no LDs are recorded on this contract."
        />
        <UnitNumberField
          id="ld-cap"
          label="Liquidated damages cap"
          value={form.liquidatedDamagesCapPercent}
          onChange={(v) => set("liquidatedDamagesCapPercent", v)}
          disabled={disabled}
          unit="%"
          max={100}
          step={0.5}
          hint="LDs stop accruing at this share of the adjusted contract. 0 = uncapped."
        />
      </div>
    </TermsSection>
  );
}

ContractPeriodSection.displayName = "ContractPeriodSection";

export function ContractTaxSection({ form, set, disabled }: SectionProps) {
  return (
    <TermsSection
      title="VAT and defects"
      description="The VAT rate every certificate raised under this contract inherits, and how long the contractor stays responsible for defects after practical completion."
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <UnitNumberField
          id="vat-rate"
          label="VAT rate"
          value={form.vatRatePercent}
          onChange={(v) => set("vatRatePercent", v)}
          disabled={disabled}
          unit="%"
          max={100}
          step={0.1}
          hint="Applied to interim certificates seeded from this contract."
        />
        <UnitNumberField
          id="defects-months"
          label="Defects liability period"
          value={form.defectsPeriodMonths}
          onChange={(v) => set("defectsPeriodMonths", v)}
          disabled={disabled}
          unit="months"
          hint="Contracts express this in months — 12 months is the common figure."
        />
      </div>
    </TermsSection>
  );
}

ContractTaxSection.displayName = "ContractTaxSection";
