import { useState } from "react";
import {
  RadioCard,
  BudgetSlider,
  TimelinePicker,
  type TimelineOption,
} from "@/components/atoms";

// Budgets are in Naira only. Beyond the slider ceiling, a custom amount is used.
const CURRENCY = "NGN";
const SLIDER_MAX = 10_000_000_000;

const BUILDING_TYPES = [
  {
    id: "residential",
    title: "Residential Home",
    description: "Single family or multi-unit housing",
  },
  {
    id: "commercial",
    title: "Commercial Complex",
    description: "Retail spaces or office buildings",
  },
  {
    id: "industrial",
    title: "Industrial Facility",
    description: "Warehouses or production plants",
  },
] as const;

const FUNDING_METHODS = [
  {
    id: "full",
    title: "Full Funding",
    description:
      "Capital is available upfront for the entire project scope.",
  },
  {
    id: "phased",
    title: "Phased Funding",
    description:
      "Funding will be released in stages based on project milestones.",
  },
] as const;

const TIMELINES: TimelineOption[] = [
  { id: "12-18", label: "12 – 18 months" },
  { id: "12-24", label: "12 – 24 months" },
  { id: "12-28", label: "12 – 28 months" },
  { id: "12-32", label: "12 – 32 months" },
  { id: "12-36", label: "12 – 36 months" },
  { id: "12-40", label: "12 – 40 months" },
];

type BuildingType = (typeof BUILDING_TYPES)[number]["id"];
type FundingMethod = (typeof FUNDING_METHODS)[number]["id"];

interface ProjectDetailsStepProps {
  buildingType: string | null;
  currency: string;
  budget: [number, number];
  fundingMethod: string | null;
  timeline: string | null;
  onBuildingTypeChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onBudgetChange: (value: [number, number]) => void;
  onFundingMethodChange: (value: string) => void;
  onTimelineChange: (value: string) => void;
}

function ProjectDetailsStep({
  buildingType,
  budget,
  fundingMethod,
  timeline,
  onBuildingTypeChange,
  onBudgetChange,
  onFundingMethodChange,
  onTimelineChange,
}: ProjectDetailsStepProps) {
  // Default to custom entry when the budget is beyond the slider's range
  // (e.g. a ₦45M house build doesn't fit the preset slider).
  const [custom, setCustom] = useState(
    () => budget[0] > SLIDER_MAX || budget[1] > SLIDER_MAX,
  );

  function setBudgetField(index: 0 | 1, raw: string): void {
    const amount = Math.max(0, Math.round(Number(raw.replace(/[^0-9.]/g, "")) || 0));
    const next: [number, number] = index === 0 ? [amount, budget[1]] : [budget[0], amount];
    onBudgetChange(next);
  }

  return (
    <div>
      <h2 className="text-center text-[25px] font-bold text-gray-900 text-balance">
        Tell us about your project
      </h2>
      <p className="mt-2 text-center text-sm text-[#929292] text-pretty">
        Define the core parameters and scope for your construction project in
        your home country.
      </p>

      <div className="mt-10 space-y-12">
        <section>
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            What are you building?
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {BUILDING_TYPES.map((type) => (
              <RadioCard
                key={type.id}
                title={type.title}
                description={type.description}
                selected={buildingType === type.id}
                onClick={() => onBuildingTypeChange(type.id)}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              Estimated Budget
            </h3>
            <button
              type="button"
              onClick={() => setCustom((c) => !c)}
              className="text-sm font-medium text-[#004DE7] hover:text-[#0041c4]"
            >
              {custom ? "Use the slider" : "Enter a custom amount"}
            </button>
          </div>
          <div className="space-y-4">
            {custom ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <CustomBudgetInput
                  label="Minimum"
                  currency={CURRENCY}
                  value={budget[0]}
                  onChange={(raw) => setBudgetField(0, raw)}
                />
                <CustomBudgetInput
                  label="Maximum"
                  currency={CURRENCY}
                  value={budget[1]}
                  onChange={(raw) => setBudgetField(1, raw)}
                />
              </div>
            ) : (
              <BudgetSlider
                value={budget}
                onChange={onBudgetChange}
                currency={CURRENCY}
              />
            )}
            {custom && budget[1] < budget[0] && (
              <p className="text-xs text-[#C72525]">
                Maximum budget should be greater than the minimum.
              </p>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Project Timeline
          </h3>
          <TimelinePicker
            options={TIMELINES}
            value={timeline}
            onChange={onTimelineChange}
          />
        </section>

        <section>
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Funding Method
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {FUNDING_METHODS.map((method) => (
              <RadioCard
                key={method.id}
                title={method.title}
                description={method.description}
                selected={fundingMethod === method.id}
                onClick={() => onFundingMethodChange(method.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function CustomBudgetInput({
  label,
  currency,
  value,
  onChange,
}: {
  label: string;
  currency: string;
  value: number;
  onChange: (raw: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <div className="flex h-12 items-center rounded-lg border border-[#EDEDED] bg-white px-3 focus-within:ring-2 focus-within:ring-gray-900/10">
        <span className="mr-2 shrink-0 text-sm font-medium text-gray-500">{currency}</span>
        <input
          type="text"
          inputMode="numeric"
          value={value ? value.toLocaleString("en-US") : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full bg-transparent text-sm text-gray-900 outline-none"
        />
      </div>
    </label>
  );
}

ProjectDetailsStep.displayName = "ProjectDetailsStep";

export {
  ProjectDetailsStep,
  type ProjectDetailsStepProps,
  type BuildingType,
  type FundingMethod,
  BUILDING_TYPES,
  FUNDING_METHODS,
  TIMELINES,
};
