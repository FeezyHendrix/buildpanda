import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useOnboardingContext } from "@/layouts/onboarding-layout";
import { Label, Input } from "@/components/atoms";
import { CountrySelect } from "@/components/atoms/country-select";
import { SearchableSelect } from "@/components/atoms/searchable-select";
import { FormField } from "@/components/molecules/form-field";
import { Button } from "@/components/atoms/button";
import { nigerianStates } from "@/lib/nigerian-states";

const COMPANY_SIZES = ["Just me", "2-10", "11-50", "51-200", "200+"] as const;

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-8 flex items-center gap-1.5 text-[13px] font-medium text-[#767676] transition-colors hover:text-[#1E1E1E]"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 12L6 8l4-4" />
      </svg>
      Back
    </button>
  );
}

export default function OnboardingCompanyInfo() {
  const { data, update } = useOnboardingContext();
  const navigate = useNavigate();
  const { companyName, country, state, companySize } = data;

  const isNigeria = country?.code === "NG";
  const canContinue = Boolean(companyName.trim() && country && companySize);

  return (
    <div>
      <BackButton onClick={() => navigate("/auth/sign-in")} />

      <h1 className="font-heading text-[28px] font-bold leading-tight text-[#1E1E1E]">
        Tell us about your business
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[#767676]">
        Your workspace will use this information across proposals, projects and documents
      </p>

      <div className="mt-8 space-y-5">
        <FormField
          label="Company Name"
          placeholder="Shalom Inc."
          value={companyName}
          onChange={(e) => update({ companyName: e.target.value })}
        />

        {/* Country + State side-by-side */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-caption-l text-black-500">Country</Label>
            <CountrySelect
              value={country}
              onChange={(c) => update({ country: c, state: null })}
              className='h-[46px]'
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-caption-l text-black-500">State</Label>
            {isNigeria ? (
              <SearchableSelect
                items={nigerianStates}
                value={state}
                onChange={(s) => update({ state: s })}
                placeholder="Select State"
                searchPlaceholder="Search states"
                className='h-[46px]'
              />
            ) : (
              <Input
                placeholder="Select State"
                value={state ?? ""}
                onChange={(e) => update({ state: e.target.value })}
                disabled={!country}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-caption-l text-black-500">Company Size</Label>
          <div className="flex flex-wrap gap-2">
            {COMPANY_SIZES.map((size) => (
              <Button
                key={size}
                variant='outline'
                onClick={() => update({ companySize: size })}
                className={cn(
                  "px-5 py-2 text-caption-l h-[36px] font-medium transition-colors hover:bg-transparent",
                  companySize === size
                    ? "border-none bg-primary-50 text-primary hover:bg-hover"
                    : "border border-border bg-white text-black-500",
                )}
              >
                {size}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <Button
          className="w-full h-[46px] disabled:bg-grey-50 disabled:text-black-500"
          disabled={!canContinue}
          onClick={() => navigate("/onboarding/representative")}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
