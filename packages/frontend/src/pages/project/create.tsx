import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { WizardLayout } from "@/components/organisms/wizard-modal";
import {
  ProjectTypeStep,
  type ProjectType,
} from "@/components/molecules/project-type-step";
import { LocationStep } from "@/components/molecules/location-step";
import { ProjectDetailsStep } from "@/components/molecules/project-details-step";
import {
  ManagementStep,
  type InvolvementLevel,
  type RiskOption,
  RISK_OPTIONS_CONFIG,
} from "@/components/molecules/management-step";
import { ProjectTitleStep } from "@/components/molecules/project-title-step";
import { ProjectSummaryStep } from "@/components/molecules/project-summary-step";
import type { SwitcherValue } from "@/components/atoms";

const TOTAL_STEPS = 5;

const DEFAULT_RISK_OPTIONS: RiskOption[] = RISK_OPTIONS_CONFIG.map((opt) => ({
  id: opt.id,
  enabled: !opt.comingSoon,
}));

function useWizardStep() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("step");
  const isReview = raw === "review";
  const step = isReview
    ? TOTAL_STEPS
    : raw
      ? Math.max(1, Math.min(TOTAL_STEPS, Number(raw) || 1))
      : 1;

  const setStep = useCallback(
    (next: number | "review") => {
      if (next === "review") {
        setSearchParams({ step: "review" }, { replace: true });
      } else {
        const clamped = Math.max(1, Math.min(TOTAL_STEPS, next));
        setSearchParams({ step: String(clamped) }, { replace: true });
      }
    },
    [setSearchParams],
  );

  return [step, isReview, setStep] as const;
}

export default function CreateProject() {
  const navigate = useNavigate();
  const [step, isReview, setStep] = useWizardStep();

  const [projectType, setProjectType] = useState<ProjectType | null>(null);

  const [locationState, setLocationState] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [ownsLand, setOwnsLand] = useState<SwitcherValue>("no");
  const [_files, setFiles] = useState<FileList | null>(null);

  const [buildingType, setBuildingType] = useState<string | null>(null);
  const [currency, setCurrency] = useState("NGN");
  const [budget, setBudget] = useState<[number, number]>([25_000, 350_000]);
  const [timeline, setTimeline] = useState<string | null>(null);
  const [fundingMethod, setFundingMethod] = useState<string | null>(null);

  const [involvementLevel, setInvolvementLevel] =
    useState<InvolvementLevel | null>(null);
  const [riskOptions, setRiskOptions] =
    useState<RiskOption[]>(DEFAULT_RISK_OPTIONS);

  const [projectTitle, setProjectTitle] = useState("");

  const handleRiskToggle = (id: string) => {
    setRiskOptions((prev) =>
      prev.map((opt) =>
        opt.id === id ? { ...opt, enabled: !opt.enabled } : opt,
      ),
    );
  };

  const canContinue = () => {
    if (isReview) return true;
    if (step === 1) return !!projectType;
    if (step === 2) return !!locationState && city.trim() !== "";
    if (step === 3) return !!buildingType && !!timeline && !!fundingMethod;
    if (step === 4) return !!involvementLevel;
    if (step === 5) return !!projectTitle.trim();
    return false;
  };

  const handleContinue = () => {
    if (isReview) {
      navigate("/dashboard");
    } else if (step === TOTAL_STEPS) {
      setStep("review");
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (isReview) {
      setStep(TOTAL_STEPS);
    } else if (step === 1) {
      navigate("/dashboard");
    } else {
      setStep(step - 1);
    }
  };

  return (
    <WizardLayout
      currentStep={step}
      totalSteps={TOTAL_STEPS}
      onCancel={handleBack}
      onContinue={handleContinue}
      continueDisabled={!canContinue()}
      continueLabel={isReview ? "Finish" : "Continue"}
      hideStepper={isReview}
    >
      {!isReview && step === 1 && (
        <ProjectTypeStep selected={projectType} onSelect={setProjectType} />
      )}
      {!isReview && step === 2 && (
        <LocationStep
          state={locationState}
          city={city}
          ownsLand={ownsLand}
          onStateChange={setLocationState}
          onCityChange={setCity}
          onOwnsLandChange={setOwnsLand}
          onFilesChange={setFiles}
        />
      )}
      {!isReview && step === 3 && (
        <ProjectDetailsStep
          buildingType={buildingType}
          currency={currency}
          budget={budget}
          timeline={timeline}
          fundingMethod={fundingMethod}
          onBuildingTypeChange={setBuildingType}
          onCurrencyChange={setCurrency}
          onBudgetChange={setBudget}
          onTimelineChange={setTimeline}
          onFundingMethodChange={setFundingMethod}
        />
      )}
      {!isReview && step === 4 && (
        <ManagementStep
          involvementLevel={involvementLevel}
          riskOptions={riskOptions}
          onInvolvementChange={setInvolvementLevel}
          onRiskOptionToggle={handleRiskToggle}
        />
      )}
      {!isReview && step === 5 && (
        <ProjectTitleStep
          title={projectTitle}
          onTitleChange={setProjectTitle}
          onSubmit={() => setStep("review")}
        />
      )}
      {isReview && (
        <ProjectSummaryStep
          data={{
            projectTitle,
            projectType,
            locationState,
            city,
            ownsLand,
            buildingType,
            currency,
            budget,
            timeline,
            fundingMethod,
            involvementLevel,
            riskOptions,
          }}
          onEdit={(s) => setStep(s)}
        />
      )}
    </WizardLayout>
  );
}
