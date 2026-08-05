import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WizardLayout } from "@/components/organisms/wizard-modal";
import { ProjectTemplateStep } from "@/components/molecules/project-template-step";
import {
  ProjectInfoStep,
  type InfoCurrency,
  type ConstructionType,
  type ConstructionTimeline,
} from "@/components/molecules/project-info-step";
import { useCreateProject } from "@/hooks/use-projects";
import { useOrgProfile } from "@/hooks/use-org-profile";
import { RISK_OPTIONS_CONFIG } from "@/components/molecules/management-step";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

type Step = 1 | 2;

// All non-coming-soon risk options submitted by default (UI no longer exposes them).
const DEFAULT_RISK_IDS = RISK_OPTIONS_CONFIG
  .filter((o) => !o.comingSoon)
  .map((o) => o.id);

export default function CreateProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const createProject = useCreateProject();
  const [submitting, setSubmitting] = useState(false);

  // ── Step 1: template ────────────────────────────────────────────────────────
  const [templateId, setTemplateId] = useState<string | null>(null);

  // ── Step 2: project information ─────────────────────────────────────────────
  const [projectName, setProjectName] = useState("");
  const [address, setAddress] = useState("");
  const [locationState, setLocationState] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const { data: orgProfile } = useOrgProfile();
  const [currency, setCurrency] = useState<InfoCurrency>("NGN");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  useEffect(() => {
    if (!currencyTouched && orgProfile?.defaultCurrency) {
      setCurrency(orgProfile.defaultCurrency as InfoCurrency);
    }
  }, [orgProfile?.defaultCurrency, currencyTouched]);
  const [contractSum, setContractSum] = useState("");
  const [constructionType, setConstructionType] = useState<ConstructionType | null>(null);
  const [timeline, setTimeline] = useState<ConstructionTimeline | null>(null);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const handleCancel = () => navigate("/dashboard");
  const handlePrev = () => setStep(1);

  const canContinue = () => {
    if (step === 1) return true; // template is optional
    return (
      projectName.trim() !== "" &&
      !!locationState &&
      !!constructionType &&
      !!timeline
    );
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else {
      void handleFinish();
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleFinish(): Promise<void> {
    if (!locationState || !constructionType || !timeline) return;

    setSubmitting(true);
    try {
      const sumValue = contractSum ? Number(contractSum) : 0;
      const project = await createProject.mutateAsync({
        title: projectName.trim(),
        projectType: "build",
        templateId: templateId ?? undefined,
        location: {
          state: locationState,
          city: [address, city].filter(Boolean).join(", ") || locationState,
          ownsLand: true,
        },
        details: {
          buildingType: constructionType,
          currency,
          budgetMin: sumValue,
          budgetMax: sumValue,
          timeline,
          fundingMethod: "full",
        },
        management: {
          involvementLevel: "contractors",
          riskOptions: DEFAULT_RISK_IDS,
        },
      });
      navigate(`/project/${project.id}/overview`);
    } catch (err) {
      toast(
        getApiErrorMessage(err, "Could not create the project. Please try again."),
        "error",
      );
      setSubmitting(false);
    }
  }

  return (
    <WizardLayout
      currentStep={step}
      totalSteps={2}
      onCancel={handleCancel}
      onBack={handlePrev}
      onContinue={handleNext}
      continueDisabled={!canContinue() || submitting}
      continueLabel={step === 2 ? (submitting ? "Creating…" : "Next") : "Next"}
      backLabel={step === 2 ? "Previous" : undefined}
      title="Create New Project"
      namedSteps={["Project Template", "Project Information"]}
      activeNamedStep={step === 1 ? 0 : 1}
    >
      {step === 1 && (
        <ProjectTemplateStep selected={templateId} onSelect={setTemplateId} />
      )}
      {step === 2 && (
        <ProjectInfoStep
          projectName={projectName}
          onProjectNameChange={setProjectName}
          address={address}
          onAddressChange={setAddress}
          state={locationState}
          onStateChange={setLocationState}
          city={city}
          onCityChange={setCity}
          currency={currency}
          onCurrencyChange={(c) => {
            setCurrencyTouched(true);
            setCurrency(c);
          }}
          contractSum={contractSum}
          onContractSumChange={setContractSum}
          constructionType={constructionType}
          onConstructionTypeChange={setConstructionType}
          timeline={timeline}
          onTimelineChange={setTimeline}
        />
      )}
    </WizardLayout>
  );
}
