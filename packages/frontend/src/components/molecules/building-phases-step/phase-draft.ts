import type { ProjectTemplateSummary } from "@/hooks/use-projects";

/**
 * The wizard's working copy of a project's building phases and the stages in
 * them. It lives in the wizard, not the database: nothing here exists until the
 * project is created (see docs/build-stages-phases-backend.md §10).
 */
export interface StageDraft {
  id: string;
  name: string;
  /** yyyy-mm-dd or "". */
  startDate: string;
  targetDate: string;
}

export interface PhaseDraft {
  id: string;
  name: string;
  stages: StageDraft[];
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

export function newStage(): StageDraft {
  return { id: newId(), name: "", startDate: "", targetDate: "" };
}

export function newPhase(name = ""): PhaseDraft {
  return { id: newId(), name, stages: [] };
}

/**
 * A template's own stages are what its card calls "N Phases", so each becomes a
 * phase here. The template does not say what sits inside a phase yet, so the
 * phases start empty and stages are added by hand. A blank start has no phases.
 */
export function phasesFromTemplate(template: Pick<ProjectTemplateSummary, "stages"> | null): PhaseDraft[] {
  return template ? template.stages.map((stage) => newPhase(stage.name)) : [];
}

export function renamePhase(phases: PhaseDraft[], phaseId: string, name: string): PhaseDraft[] {
  return phases.map((phase) => (phase.id === phaseId ? { ...phase, name } : phase));
}

export function addStage(phases: PhaseDraft[], phaseId: string): PhaseDraft[] {
  return phases.map((phase) => (phase.id === phaseId ? { ...phase, stages: [...phase.stages, newStage()] } : phase));
}

export function updateStage(phases: PhaseDraft[], phaseId: string, stageId: string, patch: Partial<StageDraft>): PhaseDraft[] {
  return phases.map((phase) =>
    phase.id === phaseId
      ? { ...phase, stages: phase.stages.map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage)) }
      : phase,
  );
}

export function removeStage(phases: PhaseDraft[], phaseId: string, stageId: string): PhaseDraft[] {
  return phases.map((phase) =>
    phase.id === phaseId ? { ...phase, stages: phase.stages.filter((stage) => stage.id !== stageId) } : phase,
  );
}
