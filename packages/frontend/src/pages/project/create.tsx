import { useDraftFiles } from "@/hooks/use-draft-files";
import { useDraftState, clearDraftGroup } from "@/hooks/use-draft-state";
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
import {
  ProjectTitleStep,
  type ProjectContractDetails,
} from "@/components/molecules/project-title-step";
import { projectsApi } from "@/api/projects";
import { ProjectSummaryStep } from "@/components/molecules/project-summary-step";
import { useCreateProject, useProjectTemplates } from "@/hooks/use-projects";
import { useUploadBimModel } from "@/hooks/use-bim";
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
  const uploadBimModel = useUploadBimModel();
  const [submitting, setSubmitting] = useState(false);

  const [projectType, setProjectType] = useDraftState<ProjectType | null>("project-create:projectType", null);

  // null = "Start blank"; templates seed stages + starter tasks server-side.
  const [templateId, setTemplateId] = useDraftState<string | null>("project-create:templateId", null);
  const { data: templates = [] } = useProjectTemplates();
  const selectedTemplate = templates.find(template => template.id === templateId && template.projectType === projectType);

  const [country, setCountry] = useDraftState<string | null>("project-create:country", null);
  const [locationState, setLocationState] = useDraftState<string | null>("project-create:locationState", null);
  const [city, setCity] = useDraftState("project-create:city", "");

  const bimDraft = useDraftFiles("project-create:bim");
  const bimFiles = bimDraft.files;
  const setBimFiles = (files: FileList | null) => bimDraft.setFiles(Array.from(files ?? []));
  const { data: orgProfile } = useOrgProfile();
  const { data: flagsData } = useFeatureFlags();
  const bimEnabled = useMemo(() => {
    const flag = (flagsData?.flags ?? []).find((f) => f.key === "projects.bim");
    return flag ? flag.enabled : true;
  }, [flagsData]);
  const [buildingType, setBuildingType] = useDraftState<string | null>("project-create:buildingType", null);
  const [currency, setCurrency] = useDraftState<Currency>("project-create:currency", "NGN");
  const [currencyTouched, setCurrencyTouched] = useDraftState("project-create:currencyTouched", false);
  useEffect(() => {
    if (!currencyTouched && orgProfile?.defaultCurrency) {
      setCurrency(orgProfile.defaultCurrency as Currency);
    }
  }, [orgProfile?.defaultCurrency, currencyTouched]);
  const [budget, setBudget] = useDraftState<[number, number]>("project-create:budget", [10_000_000, 50_000_000]);
  const [timeline, setTimeline] = useDraftState<string | null>("project-create:timeline", null);
  const [fundingMethod, setFundingMethod] = useDraftState<string | null>("project-create:fundingMethod", null);

  const { data: session } = authClient.useSession();
  const accountType =
    (session?.user as { accountType?: string } | undefined)?.accountType ?? null;
  // Contractors and project managers run their own delivery, so the
  // "level of involvement" question doesn't apply — default it and skip the step.
  const skipInvolvementStep =
    accountType === "construction_company" || accountType === "project_manager";

  const [involvementLevel, setInvolvementLevel] =
    useDraftState<InvolvementLevel | null>("project-create:involvementLevel", null);
  const [riskOptions, setRiskOptions] =
    useDraftState<RiskOption[]>("project-create:riskOptions", DEFAULT_RISK_OPTIONS);

  useEffect(() => {
    if (skipInvolvementStep && involvementLevel === null) {
      setInvolvementLevel("contractors");
    }
  }, [skipInvolvementStep, involvementLevel]);

  // Civil projects have no matching templates; continue directly to location.
  const steps = [1, 2, 3, 4, 5, 6].filter(id =>
    !(id === 2 && projectType === "civil") && !(id === 5 && skipInvolvementStep));
  const stepIndex = steps.indexOf(step);
  const displayStep = stepIndex === -1 ? steps.length : stepIndex + 1;
  const isLastStep = step === steps[steps.length - 1];

  useEffect(() => {
    if (!projectType && step > 1) setStep(1);
    else if (step > 3 && (!country || !city.trim())) setStep(3);
    else if (!isReview && stepIndex === -1) setStep(step === 2 ? 3 : 4);
  }, [projectType, country, city, step, isReview, stepIndex, setStep]);

  const [projectTitle, setProjectTitle] = useDraftState("project-create:projectTitle", "");
  // The contract frame. Creation does not take these yet, so they are applied
  // to the new project's profile immediately after it exists (finding #8).
  const [contract, setContract] = useDraftState<ProjectContractDetails>("project-create:contract", {
    clientName: "",
    startDate: "",
    completionDate: "",
  });

  const handleRiskToggle = (id: string) => {
    setRiskOptions((prev) =>
      prev.map((opt) =>
        opt.id === id ? { ...opt, enabled: !opt.enabled } : opt,
      ),
    );
  };

  function selectProjectType(next: ProjectType) {
    if (next === projectType) return;
    setProjectType(next);
    setTemplateId(null);
    setBuildingType(null);
    setTimeline(null);
  }

  function selectCountry(next: string | null) {
    if (next === country) return;
    setCountry(next);
    setLocationState(null);
    setCity("");
  }

  const canContinue = () => {
    if (isReview) return true;
    if (step === 1) return !!projectType;
    if (step === 2) return true; // template is optional — blank is a valid choice
    if (step === 3) return !!country && city.trim() !== "";
    if (step === 4) return !!buildingType && !!timeline && !!fundingMethod;
    if (step === 5) return skipInvolvementStep || !!involvementLevel;
    if (step === 6) return !!projectTitle.trim();
    return false;
  };

  /** Best effort: a failed profile PATCH must not lose the created project. */
  async function applyContractDetails(projectId: string): Promise<void> {
    const patch: Record<string, string | null> = {};
    if (contract.clientName.trim()) patch["clientName"] = contract.clientName.trim();
    if (contract.startDate) patch["startDate"] = contract.startDate;
    if (contract.completionDate) patch["completionDate"] = contract.completionDate;
    if (projectType === "civil") patch["projectType"] = "civil";
    if (Object.keys(patch).length === 0) return;
    try {
      await projectsApi.updateProfile(projectId, patch);
    } catch {
      toast("The project was created, but its contract dates could not be saved. Set them in Settings.");
    }
  }

  async function seedBimModel(projectId: string, files: File[]): Promise<void> {
    const file = files[0];
    if (!file || !/\.ifc$/i.test(file.name)) return;
    try {
      await uploadBimModel.mutateAsync({
        projectId,
        name: file.name.replace(/\.ifc$/i, ""),
        file,
      });
    } catch {
      void 0;
    }
  }

  async function handleFinish(): Promise<void> {
    if (
      !projectType ||
      !country ||
      !city.trim() ||
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
        templateId: selectedTemplate?.id,
        location: {
          country,
          state: locationState?.trim() ?? "",
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
      await applyContractDetails(project.id);
      if (bimEnabled && bimFiles && bimFiles.length > 0) {
        await seedBimModel(project.id, bimFiles);
      }
      await bimDraft.clear();
      clearDraftGroup(session?.user.id ?? "anonymous", "project-create:");
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
      className={!isReview && step === 3 ? "max-w-3xl" : undefined}
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
        <ProjectTypeStep selected={projectType} onSelect={selectProjectType} />
      )}
      {!isReview && step === 2 && (
        <ProjectTemplateStep projectType={projectType} selected={selectedTemplate?.id ?? null} onSelect={setTemplateId} />
      )}
      {!isReview && step === 3 && (
        <LocationStep
          country={country}
          state={locationState}
          city={city}
          onCountryChange={selectCountry}
          onStateChange={setLocationState}
          onCityChange={setCity}
          onBimFileChange={setBimFiles}
          bimFile={bimFiles[0]}
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
          contract={contract}
          onTitleChange={setProjectTitle}
          onContractChange={setContract}
          onSubmit={() => setStep("review")}
        />
      )}
      {isReview && (
        <ProjectSummaryStep
          data={{
            projectTitle,
            projectType,
            country,
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
