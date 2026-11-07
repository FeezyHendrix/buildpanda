import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { WizardLayout } from "@/components/organisms/wizard-modal";
import { ProjectTemplateStep } from "@/components/molecules/project-template-step";
import {
  ProjectInfoStep,
  type InfoCurrency,
  type ConstructionType,
  type ConstructionTimeline,
} from "@/components/molecules/project-info-step";
import { useCreateProject, useProjects } from "@/hooks/use-projects";
import { useOrgProfile } from "@/hooks/use-org-profile";
import { RISK_OPTIONS_CONFIG } from "@/components/molecules/management-step";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import logo from "@/assets/images/logo.svg";
import illustration from "@/assets/images/createProjectIllustration.png";
import { OptionCard } from "@/components/atoms/option-card";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";

type Step = "choice" | "template" | "info";

// All non-coming-soon risk options submitted by default (UI no longer exposes them).
const DEFAULT_RISK_IDS = RISK_OPTIONS_CONFIG
  .filter((o) => !o.comingSoon)
  .map((o) => o.id);

export default function CreateProject() {
  const navigate = useNavigate();
  const { data: existingProjects, isPending: isProjectsPending } = useProjects();
  // The choice screen (new vs. import) is only for a workspace's very first
  // project — once there's at least one project, "New Project" always means
  // starting from scratch (importing has its own entry point on the dashboard).
  const hasExistingProjects = (existingProjects?.length ?? 0) > 0;
  const [manualStep, setManualStep] = useState<Step | null>(null);
  const step: Step | null =
    manualStep ?? (isProjectsPending ? null : hasExistingProjects ? "template" : "choice");
  const setStep = setManualStep;
  const [creationType, setCreationType] = useState<"new" | "import" | null>(null);
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
  const handlePrev = () => setStep("template");

  const canContinue = () => {
    if (step === "template") return true; // template is optional
    return (
      projectName.trim() !== "" &&
      !!locationState &&
      !!constructionType &&
      !!timeline
    );
  };

  const handleNext = () => {
    if (step === "template") {
      setStep("info");
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

  if (step === null) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white">
        <Spinner size="lg" />
      </div>
    );
  }

  if (step === "choice") {
    return (
      <div className="flex h-dvh flex-col bg-white">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center border-b border-[#F0F0F0] bg-white px-8">
          <Link to="/" className="shrink-0">
            <img src={logo} alt="BuildPanda" className="h-8 lg:h-9" />
          </Link>
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-caption-l font-semibold text-black">
            Create New Project
          </span>
        </header>
        <div
          className="flex-1 bg-cover bg-center bg-no-repeat flex items-center justify-center p-6"
          style={{ backgroundImage: `url(${illustration})` }}
        >
          <div className="border border-black-500 bg-white p-12 max-w-[462px] w-full flex flex-col gap-10 shadow-sm">
            <h4 className="text-h4 font-bold text-grey-800">Create Project</h4>

            <div className="flex flex-col gap-4">
              <OptionCard
                icon={<ReactSVG src={icons2.folderAdd} />}
                title="Start a New Project"
                subtitle="Spin up a new construction project from scratch"
                selected={creationType === "new"}
                onClick={() => setCreationType("new")}
              />
              <OptionCard
                icon={<ReactSVG src={icons2.folderImport} />}
                title="Import a Project"
                subtitle="Import a programme, BOQ, drawings or BIM and we'll build the project for you"
                selected={creationType === "import"}
                onClick={() => setCreationType("import")}
              />
            </div>

            <div className='flex flex-col gap-4'>
              <Button
                variant="primary"
                size="lg"
                className="w-full h-11 cursor-pointer"
                disabled={!creationType}
                onClick={() => {
                  if (creationType === "new") {
                    setStep("template");
                  } else if (creationType === "import") {
                    navigate("/import");
                  }
                }}
              >
                Continue
              </Button>

              <Button
                type="button"
                variant='ghost'
                className="w-full h-11 cursor-pointer"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <WizardLayout
      currentStep={step === "template" ? 1 : 2}
      totalSteps={2}
      onCancel={hasExistingProjects ? handleCancel : () => setStep("choice")}
      onBack={handlePrev}
      onContinue={handleNext}
      continueDisabled={!canContinue() || submitting}
      continueLabel={step === "info" ? (submitting ? "Creating…" : "Next") : "Next"}
      backLabel={step === "info" ? "Previous" : undefined}
      title="Create New Project"
      namedSteps={["Project Template", "Project Information"]}
      activeNamedStep={step === "template" ? 0 : 1}
    >
      {step === "template" && (
        <ProjectTemplateStep selected={templateId} onSelect={setTemplateId} />
      )}
      {step === "info" && (
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
