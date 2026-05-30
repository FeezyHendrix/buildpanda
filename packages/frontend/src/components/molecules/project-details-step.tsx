import {
  RadioCard,
  CurrencyPicker,
  BudgetSlider,
  TimelinePicker,
  type TimelineOption,
} from "@/components/atoms";

const CURRENCIES = ["NGN", "USD", "CAD", "EUR", "GBP"] as const;

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
  currency,
  budget,
  fundingMethod,
  timeline,
  onBuildingTypeChange,
  onCurrencyChange,
  onBudgetChange,
  onFundingMethodChange,
  onTimelineChange,
}: ProjectDetailsStepProps) {
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
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Estimated Budget
          </h3>
          <div className="space-y-4">
            <CurrencyPicker
              currencies={CURRENCIES}
              value={currency}
              onChange={onCurrencyChange}
            />
            <BudgetSlider
              value={budget}
              onChange={onBudgetChange}
              currency={currency}
            />
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
