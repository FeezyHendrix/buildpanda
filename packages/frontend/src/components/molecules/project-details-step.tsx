import { RadioCard, TimelinePicker, type TimelineOption } from "@/components/atoms";
import { cn } from "@/lib/utils";
import type { ProjectType } from "./project-type-step";

const CURRENCIES = ["NGN", "USD", "CAD", "EUR", "GBP"] as const;
type Currency = (typeof CURRENCIES)[number];

const CURRENCY_SYMBOL: Record<Currency, string> = {
  NGN: "₦",
  USD: "$",
  CAD: "CA$",
  EUR: "€",
  GBP: "£",
};

const BUDGET_PRESETS = [
  { min: 0, max: 50_000 },
  { min: 50_000, max: 100_000 },
  { min: 100_000, max: 250_000 },
  { min: 250_000, max: 500_000 },
  { min: 500_000, max: 1_000_000 },
  { min: 1_000_000, max: 0 },
] as const;

function formatK(n: number): string {
  return n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1_000}K`;
}

function presetLabel(preset: (typeof BUDGET_PRESETS)[number], symbol: string): string {
  if (preset.min === 0) return `<${symbol}${formatK(preset.max)}`;
  if (preset.max === 0) return `${symbol}${formatK(preset.min)}+`;
  return `${symbol}${formatK(preset.min)} - ${symbol}${formatK(preset.max)}`;
}

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

const RENOVATION_TYPES = [
  {
    id: "residential",
    title: "Home Renovation",
    description: "Apartment, duplex, or family home upgrades",
  },
  {
    id: "commercial",
    title: "Commercial Fit-out",
    description: "Retail, office, hospitality, or workspace refresh",
  },
  {
    id: "industrial",
    title: "Facility Upgrade",
    description: "Warehouse, workshop, or production space improvements",
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

const RENOVATION_TIMELINES: TimelineOption[] = [
  { id: "0-3", label: "Under 3 months" },
  { id: "3-6", label: "3 – 6 months" },
  { id: "6-12", label: "6 – 12 months" },
  { id: "12-18", label: "12 – 18 months" },
  { id: "12-24", label: "12 – 24 months" },
];

function buildingTypesForProjectType(projectType: ProjectType | null) {
  return projectType === "renovate" ? RENOVATION_TYPES : BUILDING_TYPES;
}

function timelineOptionsForProjectType(projectType: ProjectType | null): TimelineOption[] {
  return projectType === "renovate" ? RENOVATION_TIMELINES : TIMELINES;
}

type BuildingType = (typeof BUILDING_TYPES)[number]["id"];
type FundingMethod = (typeof FUNDING_METHODS)[number]["id"];

interface ProjectDetailsStepProps {
  projectType: ProjectType | null;
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
  projectType,
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
  const buildingTypes = buildingTypesForProjectType(projectType);
  const timelineOptions = timelineOptionsForProjectType(projectType);
  const isRenovation = projectType === "renovate";
  const symbol = CURRENCY_SYMBOL[currency as Currency] ?? currency;
  const activePreset = BUDGET_PRESETS.find(
    (p) => p.min === budget[0] && p.max === budget[1],
  ) ?? null;

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
        {isRenovation
          ? "Define the scope, budget, and schedule for the renovation work."
          : "Define the core parameters and scope for your construction project in your home country."}
      </p>

      <div className="mt-10 space-y-12">
        <section>
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            {isRenovation ? "What are you renovating?" : "What are you building?"}
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {buildingTypes.map((type) => (
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
            {/* Currency tabs + Min/Max inputs on the same row */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between w-full">
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onCurrencyChange(c)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-center text-[12px] font-medium transition-colors",
                      currency === c
                        ? "border-primary bg-primary-50 text-primary rounded-lg"
                        : "border-none bg-[#F6F6F6] text-black-500 hover:bg-[#F6F6F6]",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 lg:w-[40%] w-full">
                <CustomBudgetInput
                  label="Minimum"
                  symbol={symbol}
                  value={budget[0]}
                  onChange={(raw) => setBudgetField(0, raw)}
                />
                <CustomBudgetInput
                  label="Maximum"
                  symbol={symbol}
                  value={budget[1]}
                  onChange={(raw) => setBudgetField(1, raw)}
                />
              </div>
            </div>

            {/* Preset range chips — equal width, full row */}
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-6 mt-8">
              {BUDGET_PRESETS.map((preset) => {
                const isActive =
                  activePreset?.min === preset.min &&
                  activePreset?.max === preset.max;
                return (
                  <button
                    key={`${preset.min}-${preset.max}`}
                    type="button"
                    onClick={() => onBudgetChange([preset.min, preset.max])}
                    className={cn(
                      "rounded-lg border px-3 py-3 text-center text-[12px] font-medium transition-colors",
                      isActive
                        ? "border-primary bg-primary-50 text-primary rounded-lg"
                        : "border-none bg-[#F6F6F6] text-black-500 hover:bg-[#F6F6F6]",
                    )}
                  >
                    {presetLabel(preset, symbol)}
                  </button>
                );
              })}
            </div>

            {budget[1] > 0 && budget[1] < budget[0] && (
              <p className="text-xs text-[#C72525]">
                Maximum budget should be greater than the minimum.
              </p>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-base font-semibold text-gray-900">
              {isRenovation ? "Renovation Timeline" : "Project Timeline"}
          </h3>
          <TimelinePicker
            options={timelineOptions}
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
  symbol,
  value,
  onChange,
}: {
  label: string;
  symbol: string;
  value: number;
  onChange: (raw: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-500">{label}</span>
      <div className="flex h-12 items-center rounded-lg border border-[#EDEDED] bg-white px-3 focus-within:ring-2 focus-within:ring-gray-900/10">
        <span className="mr-2 shrink-0 text-sm font-medium text-gray-400">{symbol}</span>
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
  RENOVATION_TYPES,
  FUNDING_METHODS,
  TIMELINES,
  RENOVATION_TIMELINES,
  buildingTypesForProjectType,
  timelineOptionsForProjectType,
};
