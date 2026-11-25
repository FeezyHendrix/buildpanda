import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/atoms/tooltip";
import { DateInputField } from "@/components/molecules/date-input-field";
import { nigerianStates } from "@/lib/nigerian-states";
import { SearchableSelect } from "@/components/atoms/searchable-select";
import { Select } from "@/components/atoms/select";
import { MoneyInput } from "@/components/atoms/money-input";
import { currencySymbol } from "@/lib/formatters";
import CardBg from '@/assets/images/card-bg.png';
import { FormSection } from "../atoms/form-section";
import { TextInput } from "../atoms/text-input";

// ── Data ──────────────────────────────────────────────────────────────────────

const CURRENCIES = ["NGN", "USD", "CAD", "EUR", "GBP"] as const;
export type InfoCurrency = (typeof CURRENCIES)[number];

/** `hint` is the contract form in a sentence, for the ⓘ beside each card. */
export const CONSTRUCTION_TYPES = [
  {
    id: "lump-sum",
    title: "Lump Sum",
    description: "Fixed total price for a fully defined scope",
    hint: "One agreed price for the whole defined scope. Anything outside that scope is priced as a variation.",
  },
  {
    id: "cost-plus",
    title: "Cost-Plus",
    description: "Contractor bills cost + agreed fee or markup",
    hint: "You pay the contractor's actual cost plus an agreed fee or markup, so the final price is not fixed in advance.",
  },
  {
    id: "unit-rate",
    title: "Unit Rate / Re-measurement",
    description: "Price per measured unit; final total known at completion.",
    hint: "Work is priced per measured unit (rate × quantity). The total is only known once it has been measured at completion.",
  },
  {
    id: "guaranteed-max",
    title: "Guaranteed Maximum Price",
    description: "Cost-plus with a cap agreed up-front",
    hint: "Cost-plus, but the total cannot pass a cap agreed up front. The contractor carries any overrun.",
  },
  {
    id: "design-build",
    title: "Design Build",
    description: "Single party responsible for design and construction",
    hint: "One party takes responsibility for both the design and the construction under a single contract.",
  },
  {
    id: "target-cost",
    title: "Target Cost",
    description: "Shared pain / gain against an agreed target price.",
    hint: "A target price is agreed up front. Savings or overruns against it are shared between the parties.",
  },
] as const;

/** Presets for the length of the build; a start and end date can be given instead. */
export const CONSTRUCTION_TIMELINES = [
  { id: "lt-12m", label: "< 12 months" },
  { id: "12-28m", label: "12 - 28 months" },
  { id: "12-40m", label: "12 - 40 months" },
] as const;

export type ConstructionType = (typeof CONSTRUCTION_TYPES)[number]["id"];
export type ConstructionTimeline = (typeof CONSTRUCTION_TIMELINES)[number]["id"];

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ProjectInfoStepProps {
  projectName: string;
  onProjectNameChange: (v: string) => void;
  address: string;
  onAddressChange: (v: string) => void;
  state: string | null;
  onStateChange: (v: string | null) => void;
  city: string;
  onCityChange: (v: string) => void;
  currency: InfoCurrency;
  onCurrencyChange: (v: InfoCurrency) => void;
  contractSum: string;
  onContractSumChange: (v: string) => void;
  constructionType: ConstructionType | null;
  onConstructionTypeChange: (v: ConstructionType) => void;
  timeline: ConstructionTimeline | null;
  onTimelineChange: (v: ConstructionTimeline) => void;
  startDate: string;
  onStartDateChange: (v: string) => void;
  endDate: string;
  onEndDateChange: (v: string) => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────


const FIELD_LABEL = "text-[12px] font-semibold leading-[16px] text-[#1E1E1E]";
const FIELD_CLASS = "h-[45px] border border-[#EEEEEE] text-[14px]";
const GROUP_LABEL = "text-[14px] font-medium leading-[20px] text-[#1E1E1E]";

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn("size-[14px] shrink-0", className)} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const CARD_BASE = "w-full text-left transition-colors bg-cover bg-center bg-no-repeat outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/20";

/**
 * A contract form to pick. The ⓘ explains it on hover; it is not a second
 * button (a button cannot sit inside one), so the same sentence is also in the
 * card's text for screen readers.
 */
function ContractTypeCard({
  title,
  description,
  hint,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        CARD_BASE,
        "flex min-h-[72px] flex-col justify-center px-[16px] py-[8px]",
        selected ? "border-2 border-[#004DE7] px-[15px]" : "border border-[#EEEEEE] bg-white hover:border-[#CCCCCC]",
      )}
      style={{ backgroundImage: selected ? `url(${CardBg})` : undefined }}
    >
      <span className={cn("flex items-center gap-[8px] text-[14px] font-semibold leading-[20px]", selected ? "text-white" : "text-[#1E1E1E]")}>
        {title}
        <Tooltip content={hint} side="top" align="start">
          <span aria-hidden className={cn("inline-flex cursor-help", selected ? "text-white" : "text-[#004DE7]")}>
            <InfoIcon />
          </span>
        </Tooltip>
      </span>
      <span className={cn("text-[12px] leading-[16px]", selected ? "text-white" : "text-[#737373]")}>{description}</span>
      <span className="sr-only">{hint}</span>
    </button>
  );
}

function TimelineOption({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        CARD_BASE,
        "h-[36px] px-[12px] text-center text-[14px]",
        selected ? "border-2 border-[#004DE7] text-white" : "border border-[#EEEEEE] bg-white text-[#1E1E1E] hover:border-[#CCCCCC]",
      )}
      style={{ backgroundImage: selected ? `url(${CardBg})` : undefined }}
    >
      {label}
    </button>
  );
}

// ── Step ──────────────────────────────────────────────────────────────────────

function ProjectInfoStep({
  projectName,
  onProjectNameChange,
  address,
  onAddressChange,
  state,
  onStateChange,
  city,
  onCityChange,
  currency,
  onCurrencyChange,
  contractSum,
  onContractSumChange,
  constructionType,
  onConstructionTypeChange,
  timeline,
  onTimelineChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
}: ProjectInfoStepProps) {
  const sectionHeader = "bg-[#F5F5F5] px-[40px] py-[8px]";
  const sectionBody = "space-y-[24px] px-[40px] pb-[38px] pt-[22px]";

  return (
    <div>
      <h1 className="text-[36px] font-bold leading-[44px] tracking-[-0.04em] text-[#1E1E1E]">
        Tell us about your project
      </h1>
      <p className="mt-[4px] text-[14px] leading-[20px] text-[#737373]">
        Tell us where your next dream project is located.
      </p>

      <div className="mt-[40px] space-y-[25px]">
        {/* ── General Information ─────────────────────────────────────────── */}
        <FormSection title="General Information" className="border-[#EEEEEE]" headerClassName={sectionHeader} bodyClassName={sectionBody}>
          <TextInput
            label="Project Name"
            placeholder="Give a name to your project"
            value={projectName}
            onChange={onProjectNameChange}
            labelClassName={FIELD_LABEL}
            className={FIELD_CLASS}
          />

          <TextInput
            label="Address"
            placeholder="Enter your address"
            value={address}
            onChange={onAddressChange}
            labelClassName={FIELD_LABEL}
            className={FIELD_CLASS}
          />

          <div className="grid grid-cols-1 gap-[24px] sm:grid-cols-2">
            {/* State select */}
            <div className="flex flex-col gap-1.5">
              <label className={FIELD_LABEL}>State</label>
              <SearchableSelect
                items={nigerianStates}
                value={state}
                onChange={onStateChange}
                placeholder="Select State"
                searchPlaceholder="Search states"
                className="h-[45px] border-[#EEEEEE]"
              />
            </div>

            {/* City / Area */}
            <TextInput
              label="City / Area"
              placeholder="Give a name to your project"
              value={city}
              onChange={onCityChange}
              optional
              labelClassName={FIELD_LABEL}
              className={FIELD_CLASS}
            />
          </div>
        </FormSection>

        {/* ── Project Information ──────────────────────────────────────────── */}
        <FormSection title="Project Information" className="border-[#EEEEEE]" headerClassName={sectionHeader} bodyClassName={sectionBody}>
          {/* Contract Sum */}
          <div className="flex flex-col gap-1.5">
            <label className={FIELD_LABEL}>Contract Sum</label>
            <div className="flex h-[45px] border border-[#EEEEEE] bg-white focus-within:border-[#004DE7]">
              <div className="w-[77px] shrink-0 border-r border-[#EEEEEE]">
                <Select
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  value={currency}
                  onChange={(v) => v && onCurrencyChange(v as InfoCurrency)}
                  className="h-full border-0 bg-transparent px-[16px] font-semibold focus-visible:ring-0"
                />
              </div>
              <div className="min-w-0 flex-1 [&>div]:h-full">
                <MoneyInput
                  placeholder="Enter Contract Sum"
                  value={contractSum}
                  onChange={onContractSumChange}
                  // The symbol appears with the first digit; the empty field shows only its hint.
                  currencySymbol={contractSum ? currencySymbol(currency) : undefined}
                  className={cn(
                    "h-full w-full rounded-none bg-transparent text-left text-[14px] text-[#1E1E1E] outline-none lg:text-[14px] placeholder:text-[#B0B0B0]",
                    contractSum ? "pl-[36px] pr-[16px]" : "px-[16px]",
                  )}
                />
              </div>
            </div>
          </div>

          {/* Contract Type */}
          <div>
            <p className={cn(GROUP_LABEL, "mb-[5px]")}>Contract Type</p>
            <div className="grid grid-cols-1 gap-x-[8px] gap-y-[10px] sm:grid-cols-2">
              {CONSTRUCTION_TYPES.map((type) => (
                <ContractTypeCard
                  key={type.id}
                  title={type.title}
                  description={type.description}
                  hint={type.hint}
                  selected={constructionType === type.id}
                  onClick={() => onConstructionTypeChange(type.id)}
                />
              ))}
            </div>
          </div>

          {/* Construction Timeline: a preset, or the dates themselves */}
          <div>
            <p className={cn(GROUP_LABEL, "mb-[5px]")}>Construction Timeline</p>
            <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-3">
              {CONSTRUCTION_TIMELINES.map((t) => (
                <TimelineOption key={t.id} label={t.label} selected={timeline === t.id} onClick={() => onTimelineChange(t.id)} />
              ))}
            </div>

            <div className="mx-[31px] my-[32px] flex items-center gap-[16px]" role="separator" aria-label="or">
              <span className="h-px flex-1 bg-[#EEEEEE]" />
              <span className="text-[12px] leading-[16px] text-[#737373]">Or</span>
              <span className="h-px flex-1 bg-[#EEEEEE]" />
            </div>

            <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="project-start-date" className={FIELD_LABEL}>Start Date</label>
                <DateInputField
                  id="project-start-date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={onStartDateChange}
                  className={cn(FIELD_CLASS, startDate ? "text-[#1E1E1E]" : "text-[#B0B0B0]")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="project-end-date" className={FIELD_LABEL}>End Date</label>
                <DateInputField
                  id="project-end-date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={onEndDateChange}
                  className={cn(FIELD_CLASS, endDate ? "text-[#1E1E1E]" : "text-[#B0B0B0]")}
                />
              </div>
            </div>
          </div>
        </FormSection>
      </div>
    </div>
  );
}

ProjectInfoStep.displayName = "ProjectInfoStep";

export { ProjectInfoStep };
