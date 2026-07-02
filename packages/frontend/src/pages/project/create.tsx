import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { useOrgProfile } from "@/hooks/use-org-profile";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
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
import { ProjectTemplateStep } from "@/components/molecules/project-template-step";
import { ProjectTitleStep } from "@/components/molecules/project-title-step";
import { ProjectSummaryStep } from "@/components/molecules/project-summary-step";
import { useCreateProject } from "@/hooks/use-projects";
import { api } from "@/api/client";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

// 1 type · 2 template · 3 location · 4 details · 5 management · 6 title
const TOTAL_STEPS = 6;

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

  // null = "Start blank"; templates seed stages + starter tasks server-side.
  const [templateId, setTemplateId] = useState<string | null>(null);

  const [locationState, setLocationState] = useState<string | null>(null);
  const [city, setCity] = useState("");

  const [bimFiles, setBimFiles] = useState<FileList | null>(null);
  const { data: orgProfile } = useOrgProfile();
  const { data: flagsData } = useFeatureFlags();
  const bimEnabled = useMemo(() => {
    const flag = (flagsData?.flags ?? []).find((f) => f.key === "projects.bim");
    return flag ? flag.enabled : true;
  }, [flagsData]);
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

  const { data: session } = authClient.useSession();
  const accountType =
    (session?.user as { accountType?: string } | undefined)?.accountType ?? null;
  // Contractors and project managers run their own delivery, so the
  // "level of involvement" question doesn't apply — default it and skip the step.
  const skipInvolvementStep =
    accountType === "construction_company" || accountType === "project_manager";

  const [involvementLevel, setInvolvementLevel] =
    useState<InvolvementLevel | null>(null);
  const [riskOptions, setRiskOptions] =
    useState<RiskOption[]>(DEFAULT_RISK_OPTIONS);

  useEffect(() => {
    if (skipInvolvementStep && involvementLevel === null) {
      setInvolvementLevel("contractors");
    }
  }, [skipInvolvementStep, involvementLevel]);

  // Contractors and project managers skip the management step entirely, so the
  // wizard runs on the active step ids rather than a fixed 1..N range.
  const steps = skipInvolvementStep ? [1, 2, 3, 4, 6] : [1, 2, 3, 4, 5, 6];
  const stepIndex = steps.indexOf(step);
  const displayStep = stepIndex === -1 ? steps.length : stepIndex + 1;
  const isLastStep = step === steps[steps.length - 1];

  useEffect(() => {
    if (!isReview && stepIndex === -1) setStep(4);
  }, [isReview, stepIndex, setStep]);

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
    if (step === 2) return true; // template is optional — blank is a valid choice
    if (step === 3) return !!locationState && city.trim() !== "";
    if (step === 4) return !!buildingType && !!timeline && !!fundingMethod;
    if (step === 5) return skipInvolvementStep || !!involvementLevel;
    if (step === 6) return !!projectTitle.trim();
    return false;
  };

  async function seedBimModel(projectId: string, files: FileList): Promise<void> {
    try {
      const file = files[0];
      if (!file || !/\.ifc$/i.test(file.name)) return;
      const { data: ticket } = await api.post<{
        mode: string;
        storagePath: string;
        url?: string;
      }>(`/projects/${projectId}/bim/upload-url`, {
        fileName: file.name,
        sizeBytes: file.size,
      });
      if (ticket.mode !== "single" || !ticket.url) return;
      await fetch(ticket.url, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      await api.post(`/projects/${projectId}/bim/models`, {
        name: file.name.replace(/\.ifc$/i, ""),
        fileName: file.name,
        storagePath: ticket.storagePath,
        sizeBytes: file.size,
      });
    } catch {
      void 0;
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
        templateId: templateId ?? undefined,
        location: {
          state: locationState,
          city: city.trim(),
          ownsLand: true,
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
      if (bimEnabled && bimFiles && bimFiles.length > 0) {
        await seedBimModel(project.id, bimFiles);
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
    } else if (isLastStep) {
      setStep("review");
    } else {
      setStep(steps[stepIndex + 1]!);
    }
  };

  const handleBack = () => {
    if (submitting) return;
    if (isReview) {
      setStep(steps[steps.length - 1]!);
    } else if (stepIndex <= 0) {
      navigate("/dashboard");
    } else {
      setStep(steps[stepIndex - 1]!);
    }
  };

  return (
    <WizardLayout
      currentStep={displayStep}
      totalSteps={steps.length}
      onCancel={handleBack}
      onContinue={handleContinue}
      continueDisabled={!canContinue() || submitting}
      continueLabel={
        isReview ? (submitting ? "Creating…" : "Finish") : "Continue"
      }
      hideStepper={isReview}
      hideContinue={isReview}
    >
      {!isReview && step === 1 && (
        <ProjectTypeStep selected={projectType} onSelect={setProjectType} />
      )}
      {!isReview && step === 2 && (
        <ProjectTemplateStep selected={templateId} onSelect={setTemplateId} />
      )}
      {!isReview && step === 3 && (
        <LocationStep
          state={locationState}
          city={city}
          onStateChange={setLocationState}
          onCityChange={setCity}
          onBimFileChange={setBimFiles}
          showBim={bimEnabled}
        />
      )}
      {!isReview && step === 4 && (
        <ProjectDetailsStep
          projectType={projectType}
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
      {!isReview && step === 5 && (
        <ManagementStep
          involvementLevel={involvementLevel}
          riskOptions={riskOptions}
          onInvolvementChange={setInvolvementLevel}
          onRiskOptionToggle={handleRiskToggle}
        />
      )}
      {!isReview && step === 6 && (
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
            buildingType,
          currency,
            budget,
            timeline,
            fundingMethod,
            involvementLevel,
            riskOptions,
          }}
          onEdit={(s) => setStep(s)}
          onStart={handleContinue}
          isStarting={createProject.isPending}
          hideManagement={skipInvolvementStep}
        />
      )}
    </WizardLayout>
  );
}
