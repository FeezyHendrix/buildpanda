import { ImportProgress } from "./import-progress";
import { useDraftState } from "@/hooks/use-draft-state";
import { useImportSession } from "@/hooks/use-import-session";
import { QueryError } from "@/components/molecules/query-error";
import { Spinner } from "@/components/atoms/spinner";
import { useCallback } from "react";
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
import { ProjectFileStep } from "@/components/molecules/import-wizard/project-file-step";
import { useCreateImportSession } from "@/hooks/use-import-session";
import { useFeatureFlag } from "@/hooks/use-feature-flags";
import { toast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/api-error";

export type ImportMode = "programme" | "shell" | "file" | null;

const ALL_STEPS = [
  { id: "start", path: "both" },
  { id: "projectfile", path: "file" },
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
  const [savedStep, setSavedStep] = useDraftState("import:step", 1);
  const raw = searchParams.get("step") ?? String(savedStep);
  
  const [mode, setMode] = useDraftState<ImportMode>("import:mode", null);
  const [sessionId, setSessionId] = useDraftState<string | null>("import:session", null);
  const [savedProjectId, setProjectId] = useDraftState<string | null>("import:project", null);
  const session = useImportSession(sessionId);
  const projectId = session.data?.projectId ?? savedProjectId;

  const isProgrammeImportEnabled = useFeatureFlag("ai.programmeImport");
  const isProjectFileImportEnabled = useFeatureFlag("ai.projectFileImport");
  
  const activeSteps = ALL_STEPS.filter(s => s.path === "both" || s.path === mode);
  const totalSteps = activeSteps.length || 7; 
  
  const stepIndex = raw ? Math.max(1, Math.min(totalSteps, Number(raw) || 1)) : 1;
  const currentStepDef = activeSteps[stepIndex - 1] || ALL_STEPS[0];

  const setStep = useCallback(
    (next: number) => {
      const clamped = Math.max(1, Math.min(totalSteps, next));
      setSavedStep(clamped);
      setSearchParams({ step: String(clamped) }, { replace: true });
    },
    [setSearchParams, totalSteps, setSavedStep]
  );

  const createSession = useCreateImportSession();

  function startAgain() {
    setMode(null);
    setSessionId(null);
    setProjectId(null);
    setStep(1);
  }

  const handleStart = async (selectedMode: "programme" | "shell" | "file") => {
    try {
      if (!sessionId) {
        const session = await createSession.mutateAsync();
        setSessionId(session.id);
      }
      setMode(selectedMode);
      setStep(2);
    } catch (error) {
      toast(getApiErrorMessage(error, "Could not start your import. Please try again."));
    }
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
  const restoring = Boolean(sessionId) && session.isPending;
  const canShowStep = !restoring && !session.error;

  if (currentStepDef.id === "start") {
    continueDisabled = true;
    hideStepper = true;
  } else if (currentStepDef.id === "review") {
    continueLabel = "Go to project";
    continueDisabled = !projectId;
  } else if (["timeline", "boq", "models", "drawings"].includes(currentStepDef.id)) {
    continueLabel = "Skip";
  } else if (currentStepDef.id === "programme" || currentStepDef.id === "projectfile") {
    continueDisabled = true;
  } else if (currentStepDef.id === "details") {
    continueDisabled = !projectId || session.data?.projectId !== projectId;
  }

  return (
    <WizardLayout
      currentStep={stepIndex}
      totalSteps={totalSteps}
      onCancel={handleBack}
      onContinue={handleNext}
      continueDisabled={continueDisabled || (Boolean(sessionId) && (session.isPending || session.isError))}
      continueLabel={continueLabel}
      hideStepper={hideStepper}
    >
      {sessionId ? <ImportProgress projectId={projectId} onRestart={startAgain} /> : null}
      {restoring ? <Spinner size="md" /> : null}
      {session.error ? <QueryError error={session.error} retry={session.refetch} noun="saved import" /> : null}
      {canShowStep ? <>
      {currentStepDef.id === "start" && (
        <StartStep onSelect={handleStart} isCreating={createSession.isPending} />
      )}
      {currentStepDef.id === "projectfile" && sessionId && isProjectFileImportEnabled && (
        <ProjectFileStep
          sessionId={sessionId}
          projectId={projectId}
          onProjectCreated={setProjectId}
          onNext={handleNext}
        />
      )}
      {currentStepDef.id === "programme" && sessionId && isProgrammeImportEnabled && (
        <ProgrammeStep 
          sessionId={sessionId} 
          projectId={projectId}
          onProjectCreated={setProjectId} 
          onNext={handleNext} 
        />
      )}
      {currentStepDef.id === "details" && sessionId && (
        <DetailsStep 
          sessionId={sessionId} 
          projectId={projectId}
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
        <ReviewStep sessionId={sessionId} onRetry={kind => {
          const step = kind === "project_file" ? "projectfile" : kind === "ifc" ? "models" : kind === "drawing" ? "drawings" : kind;
          const index = activeSteps.findIndex(candidate => candidate.id === step);
          if (index >= 0) setStep(index + 1);
        }} />
      )}
      </> : null}
    </WizardLayout>
  );
}
