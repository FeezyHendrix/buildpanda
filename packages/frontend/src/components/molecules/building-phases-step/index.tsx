import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { PhaseAccordion } from "./phase-accordion";
import {
  addStage,
  newPhase,
  removeStage,
  renamePhase,
  updateStage,
  type PhaseDraft,
} from "./phase-draft";

export { phasesFromTemplate, type PhaseDraft, type StageDraft } from "./phase-draft";

/**
 * Step 2: the building phases and the stages inside them, with a start and a
 * target date for each stage. The first phase starts open; a phase added here
 * opens straight into rename mode.
 */
export function BuildingPhasesStep({
  phases,
  onChange,
}: {
  phases: PhaseDraft[];
  onChange: (phases: PhaseDraft[]) => void;
}) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set(phases[0] ? [phases[0].id] : []));
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  function toggle(phaseId: string): void {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }

  function handleAddPhase(): void {
    const phase = newPhase();
    onChange([...phases, phase]);
    setJustAddedId(phase.id);
    setOpenIds((current) => new Set(current).add(phase.id));
  }

  return (
    <div>
      <h1 className="text-[36px] font-bold leading-[44px] tracking-[-0.04em] text-[#1E1E1E]">Building Phases</h1>
      <p className="mt-[4px] text-[14px] leading-[20px] text-[#737373]">
        Group your stages into phases and set their dates. You can change this later.
      </p>

      <div className="mt-[40px]">
        {phases.map((phase) => (
          <PhaseAccordion
            key={phase.id}
            phase={phase}
            open={openIds.has(phase.id)}
            startEditing={phase.id === justAddedId}
            onToggle={() => toggle(phase.id)}
            onRename={(name) => onChange(renamePhase(phases, phase.id, name))}
            onAddStage={() => onChange(addStage(phases, phase.id))}
            onUpdateStage={(stageId, patch) => onChange(updateStage(phases, phase.id, stageId, patch))}
            onRemoveStage={(stageId) => onChange(removeStage(phases, phase.id, stageId))}
          />
        ))}

        <div className="mt-[8px] flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleAddPhase}
            className="h-[46px] gap-[8px] border border-[#004DE7] px-[16px] text-[#004DE7] hover:bg-[#E6EDFD]"
          >
            <Plus className="size-[18px]" strokeWidth={1.5} aria-hidden />
            Add Building Phase
          </Button>
        </div>
      </div>
    </div>
  );
}

BuildingPhasesStep.displayName = "BuildingPhasesStep";
