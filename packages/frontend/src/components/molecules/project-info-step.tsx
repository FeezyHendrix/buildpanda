import { cn } from "@/lib/utils";
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

export const CONSTRUCTION_TYPES = [
  { id: "lump-sum", title: "Lump Sum", description: "Fixed total price for a fully defined scope" },
  { id: "cost-plus", title: "Cost-Plus", description: "Contractor bills cost + agreed fee or markup" },
  { id: "unit-rate", title: "Unit Rate / Re-measurement", description: "Price per measured unit; final total known at completion." },
  { id: "guaranteed-max", title: "Guaranteed Maximum Price", description: "Cost-plus with a cap agreed up-front" },
  { id: "design-build", title: "Design Build", description: "Single party responsible for design and construction" },
  { id: "target-cost", title: "Target Cost", description: "Shared pain / gain against an agreed target price." },
] as const;

export const CONSTRUCTION_TIMELINES = [
  { id: "lt-6m", label: "< 6 months" },
  { id: "6-12m", label: "6 to 12 months" },
  { id: "12-18m", label: "12 to 18 months" },
  { id: "gt-18m", label: "> 18 months" },
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
}

// ── Sub-components ────────────────────────────────────────────────────────────


function SelectionCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full p-4 text-left transition-colors bg-cover bg-center bg-no-repeat",
        selected
          ? "border-2 border-[#004DE7]"
          : "border border-[#EBEBEB] bg-white hover:border-[#CCCCCC]",
      )}
      style={{ backgroundImage: selected ? `url(${CardBg})` : undefined }}
    >
      <span className={cn("block text-caption-l font-semibold", selected ? "text-white" : "text-black")}>
        {title}
      </span>
      {description && (
        <span className={cn("mt-0.5 block text-caption-m", selected ? "text-white" : "text-grey-450")}>
          {description}
        </span>
      )}
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
}: ProjectInfoStepProps) {
  return (
    <div>
      <h2 className="font-heading text-h4 font-bold text-black-500">
        Tell us about your project
      </h2>
      <p className="mt-2 text-[14px] text-[#767676]">
        Tell us where your next dream project is located.
      </p>

      <div className="mt-8 space-y-5">
        {/* ── General Information ─────────────────────────────────────────── */}
        <FormSection title="General Information">
          <TextInput
            label="Project Name"
            placeholder="Give a name to your project"
            value={projectName}
            onChange={onProjectNameChange}
          />

          <TextInput
            label="Address"
            placeholder="Enter your address"
            value={address}
            onChange={onAddressChange}
          />

          <div className="grid grid-cols-2 gap-4">
            {/* State select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#1E1E1E]">State</label>
              <SearchableSelect
                items={nigerianStates}
                value={state}
                onChange={onStateChange}
                placeholder="Select State"
                searchPlaceholder="Search states"
              />
            </div>

            {/* City / Area */}
            <TextInput
              label="City / Area"
              placeholder="Give a name to your project"
              value={city}
              onChange={onCityChange}
              optional
            />
          </div>
        </FormSection>

        {/* ── Project Information ──────────────────────────────────────────── */}
        <FormSection title="Project Information">
          {/* Contract Sum */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#1E1E1E]">Contract Sum</label>
            <div className="flex">
              <div className="w-28 shrink-0">
                <Select
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  value={currency}
                  onChange={(v) => v && onCurrencyChange(v as InfoCurrency)}
                />
              </div>
              <div className="flex-1">
                <MoneyInput
                  placeholder="Enter Contract Sum"
                  value={contractSum}
                  onChange={onContractSumChange}
                  currencySymbol={currencySymbol(currency)}
                  className="rounded-none indent-4 border border-border bg-white px-3.5 text-[14px] text-left text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none transition-colors focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
                />
              </div>
            </div>
          </div>

          {/* Construction Type */}
          <div>
            <p className="mb-3 text-[13px] font-medium text-[#1E1E1E]">Construction Type</p>
            <div className="grid grid-cols-2 gap-3">
              {CONSTRUCTION_TYPES.map((type) => (
                <SelectionCard
                  key={type.id}
                  title={type.title}
                  description={type.description}
                  selected={constructionType === type.id}
                  onClick={() => onConstructionTypeChange(type.id)}
                />
              ))}
            </div>
          </div>

          {/* Construction Timeline */}
          <div>
            <p className="mb-3 text-[13px] font-medium text-[#1E1E1E]">Construction Timeline</p>
            <div className="grid grid-cols-2 gap-3">
              {CONSTRUCTION_TIMELINES.map((t) => (
                <SelectionCard
                  key={t.id}
                  title={t.label}
                  selected={timeline === t.id}
                  onClick={() => onTimelineChange(t.id)}
                />
              ))}
            </div>
          </div>
        </FormSection>
      </div>
    </div>
  );
}

ProjectInfoStep.displayName = "ProjectInfoStep";

export { ProjectInfoStep };
