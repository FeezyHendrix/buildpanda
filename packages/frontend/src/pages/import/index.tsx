import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { WizardLayout } from "@/components/organisms/wizard-modal";
import { StartStep } from "@/components/molecules/import-wizard/start-step";
import { ProgrammeStep } from "@/components/molecules/import-wizard/programme-step";
import { DetailsStep } from "@/components/molecules/import-wizard/details-step";
import { TimelineStep } from "@/components/molecules/import-wizard/timeline-step";
import { BoqStep } from "@/components/molecules/import-wizard/boq-step";
import { ModelsStep } from "@/components/molecules/import-wizard/models-step";
import { DrawingsStep } from "@/components/molecules/import-wizard/drawings-step";
import { ReviewStep } from "@/components/molecules/import-wizard/review-step";
import { useCreateImportSession } from "@/hooks/use-import-session";

export type ImportMode = "programme" | "shell" | null;

const ALL_STEPS = [
  { id: "start", path: "both" },
  { id: "programme", path: "programme" },
  { id: "details", path: "shell" },
  { id: "boq", path: "both" },
  { id: "models", path: "both" },
  { id: "drawings", path: "both" },
  { id: "timeline", path: "shell" },
  { id: "review", path: "both" },
] as const;

export default function ImportWizardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("step");
  
  const [mode, setMode] = useState<ImportMode>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  
  const activeSteps = ALL_STEPS.filter(s => s.path === "both" || s.path === mode);
  const totalSteps = activeSteps.length || 7; 
  
  const stepIndex = raw ? Math.max(1, Math.min(totalSteps, Number(raw) || 1)) : 1;
  const currentStepDef = activeSteps[stepIndex - 1] || ALL_STEPS[0];

  const setStep = useCallback(
    (next: number) => {
      const clamped = Math.max(1, Math.min(totalSteps, next));
      setSearchParams({ step: String(clamped) }, { replace: true });
    },
    [setSearchParams, totalSteps]
  );

  const createSession = useCreateImportSession();

  const handleStart = async (selectedMode: "programme" | "shell") => {
    setMode(selectedMode);
    if (!sessionId) {
      const session = await createSession.mutateAsync();
      setSessionId(session.id);
    }
    setStep(2);
  };

  const handleNext = () => {
    if (stepIndex < totalSteps) {
      setStep(stepIndex + 1);
    } else {
      if (projectId) navigate(`/project/${projectId}/overview`);
      else navigate(`/dashboard`);
    }
  };

  const handleBack = () => {
    if (stepIndex > 1) {
      setStep(stepIndex - 1);
    } else {
      navigate(-1);
    }
  };

  let continueDisabled = false;
  let continueLabel = "Continue";
  let hideStepper = false;

  if (currentStepDef.id === "start") {
    continueDisabled = true;
    hideStepper = true;
  } else if (currentStepDef.id === "review") {
    continueLabel = "Go to project";
    continueDisabled = !projectId;
  } else if (["timeline", "boq", "models", "drawings"].includes(currentStepDef.id)) {
    continueLabel = "Skip";
  } else if (currentStepDef.id === "programme" || currentStepDef.id === "details") {
    continueDisabled = !projectId; 
  }

  return (
    <WizardLayout
      currentStep={stepIndex}
      totalSteps={totalSteps}
      onCancel={handleBack}
      onContinue={handleNext}
      continueDisabled={continueDisabled}
      continueLabel={continueLabel}
      hideStepper={hideStepper}
    >
      {currentStepDef.id === "start" && (
        <StartStep onSelect={handleStart} isCreating={createSession.isPending} />
      )}
      {currentStepDef.id === "programme" && sessionId && (
        <ProgrammeStep 
          sessionId={sessionId} 
          onProjectCreated={setProjectId} 
          onNext={handleNext} 
        />
      )}
      {currentStepDef.id === "details" && sessionId && (
        <DetailsStep 
          sessionId={sessionId} 
          onProjectCreated={setProjectId} 
          onNext={handleNext}
        />
      )}
      {currentStepDef.id === "timeline" && projectId && (
        <TimelineStep projectId={projectId} onNext={handleNext} />
      )}
      {currentStepDef.id === "boq" && sessionId && projectId && (
        <BoqStep sessionId={sessionId} projectId={projectId} onNext={handleNext} />
      )}
      {currentStepDef.id === "models" && sessionId && projectId && (
        <ModelsStep sessionId={sessionId} projectId={projectId} onNext={handleNext} />
      )}
      {currentStepDef.id === "drawings" && sessionId && projectId && (
        <DrawingsStep sessionId={sessionId} projectId={projectId} onNext={handleNext} />
      )}
      {currentStepDef.id === "review" && sessionId && (
        <ReviewStep sessionId={sessionId} />
      )}
    </WizardLayout>
  );
}
