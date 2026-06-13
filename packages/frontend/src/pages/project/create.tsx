import { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useOrgProfile } from "@/hooks/use-org-profile";
import type { Currency } from "@/lib/project-types";
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
import { useCreateProject } from "@/hooks/use-projects";
import { uploadFileRequest } from "@/hooks/use-files";
import { api } from "@/api/client";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import type { DocumentCategory } from "@/lib/project-types";

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
  const createProject = useCreateProject();
  const [submitting, setSubmitting] = useState(false);

  const [projectType, setProjectType] = useState<ProjectType | null>(null);

  const [locationState, setLocationState] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [ownsLand, setOwnsLand] = useState<SwitcherValue>("no");
  const [landFiles, setLandFiles] = useState<FileList | null>(null);

  const { data: orgProfile } = useOrgProfile();
  const [buildingType, setBuildingType] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  useEffect(() => {
    if (!currencyTouched && orgProfile?.defaultCurrency) {
      setCurrency(orgProfile.defaultCurrency as Currency);
    }
  }, [orgProfile?.defaultCurrency, currencyTouched]);
  const [budget, setBudget] = useState<[number, number]>([10_000_000, 50_000_000]);
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

  // Best-effort: attach the land documents the user uploaded in step 2 to the
  // new project's "Land Documents" category. The project already exists, so a
  // failure here must not block navigation — the user can re-upload from the
  // Documents page.
  async function uploadLandDocuments(
    projectId: string,
    files: FileList,
  ): Promise<void> {
    try {
      const { data: categories } = await api.get<DocumentCategory[]>(
        `/projects/${projectId}/documents/categories`,
      );
      const landCategory = categories.find((c) => c.name === "Land Documents");
      if (!landCategory) return;
      for (const file of Array.from(files)) {
        const uploaded = await uploadFileRequest(file);
        await api.post(`/projects/${projectId}/documents`, {
          categoryId: landCategory.id,
          fileId: uploaded.id,
        });
      }
    } catch {
      // swallow — see note above
    }
  }

  async function handleFinish(): Promise<void> {
    if (
      !projectType ||
      !locationState ||
      !buildingType ||
      !timeline ||
      !fundingMethod ||
      !involvementLevel
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const project = await createProject.mutateAsync({
        title: projectTitle.trim(),
        projectType,
        location: {
          state: locationState,
          city: city.trim(),
          ownsLand: ownsLand === "yes",
        },
        details: {
          buildingType,
          currency,
          budgetMin: budget[0],
          budgetMax: budget[1],
          timeline,
          fundingMethod,
        },
        management: {
          involvementLevel,
          riskOptions: riskOptions.filter((r) => r.enabled).map((r) => r.id),
        },
      });
      if (landFiles && landFiles.length > 0) {
        await uploadLandDocuments(project.id, landFiles);
      }
      navigate(`/project/${project.id}/overview`);
    } catch (err) {
      toast(
        getApiErrorMessage(err, "Could not create the project. Please try again."),
        "error",
      );
      setSubmitting(false);
    }
  }

  const handleContinue = () => {
    if (isReview) {
      void handleFinish();
    } else if (step === TOTAL_STEPS) {
      setStep("review");
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (submitting) return;
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
      continueDisabled={!canContinue() || submitting}
      continueLabel={
        isReview ? (submitting ? "Creating…" : "Finish") : "Continue"
      }
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
          onFilesChange={setLandFiles}
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
          onCurrencyChange={(c) => {
            setCurrencyTouched(true);
            setCurrency(c as Currency);
          }}
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
