import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PhaseDraft, StageDraft } from "./phase-draft";
import { STAGE_GRID, StageRow } from "./stage-row";

const ICON_BUTTON =
  "flex size-[24px] items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

/**
 * One building phase: a grey bar with its name, a pencil to rename it in place
 * (Enter or leaving the box keeps it, Escape cancels) and a chevron that opens
 * the table of its stages.
 */
export function PhaseAccordion({
  phase,
  open,
  startEditing,
  onToggle,
  onRename,
  onAddStage,
  onUpdateStage,
  onRemoveStage,
}: {
  phase: PhaseDraft;
  open: boolean;
  /** Open in rename mode, as a freshly added phase does. */
  startEditing?: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onAddStage: () => void;
  onUpdateStage: (stageId: string, patch: Partial<StageDraft>) => void;
  onRemoveStage: (stageId: string) => void;
}) {
  const panelId = useId();
  const [editing, setEditing] = useState(Boolean(startEditing));
  const [draftName, setDraftName] = useState(phase.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function beginEdit(): void {
    setDraftName(phase.name);
    setEditing(true);
  }

  function commit(): void {
    const name = draftName.trim();
    if (name) onRename(name);
    setEditing(false);
  }

  return (
    <section className="mb-[15px]">
      <div className="flex h-[54px] items-center border border-[#EEEEEE] bg-[#F5F5F5] pl-[24px] pr-[24px]">
        {editing ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label="Phase name"
            maxLength={80}
            className="h-[36px] min-w-0 flex-1 border border-[#1E1E1E] bg-white px-[12px] text-[16px] font-semibold text-[#1E1E1E] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            className="h-full min-w-0 flex-1 truncate text-left text-[16px] font-semibold leading-[24px] text-[#1E1E1E] outline-none focus-visible:underline"
          >
            {phase.name || "Untitled phase"}
          </button>
        )}
        {!editing ? (
          <div className="ml-[10px] flex shrink-0 items-center gap-[10px]">
            <button
              type="button"
              aria-label={`Rename ${phase.name || "phase"}`}
              onClick={beginEdit}
              className={cn(ICON_BUTTON, "text-[#A3A3A3] hover:text-[#1E1E1E]")}
            >
              <Pencil className="size-[16px]" strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={open ? `Collapse ${phase.name}` : `Expand ${phase.name}`}
              aria-expanded={open}
              aria-controls={panelId}
              onClick={onToggle}
              className={cn(ICON_BUTTON, "text-[#1E1E1E]")}
            >
              {open ? <ChevronUp className="size-[18px]" aria-hidden /> : <ChevronDown className="size-[18px]" aria-hidden />}
            </button>
          </div>
        ) : null}
      </div>

      {open ? (
        <div id={panelId} className="pr-[5px] pt-[24px]">
          {phase.stages.length > 0 ? (
            <>
              <div className={cn(STAGE_GRID, "text-[12px] font-medium leading-[16px] text-[#737373]")}>
                <span className="px-[16px]">Build Stage</span>
                <span className="px-[16px]">Start date</span>
                <span className="px-[16px]">Target date</span>
              </div>
              <div className="mt-[9px] flex flex-col gap-[16px]">
                {phase.stages.map((stage) => (
                  <StageRow
                    key={stage.id}
                    stage={stage}
                    onChange={(patch) => onUpdateStage(stage.id, patch)}
                    onRemove={() => onRemoveStage(stage.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-[14px] leading-[20px] text-[#737373]">No stages in this phase yet.</p>
          )}
          <div className="flex justify-end pb-[14px] pt-[30px] pr-[13px]">
            <button
              type="button"
              onClick={onAddStage}
              className="flex items-center gap-[8px] text-[14px] font-semibold leading-[20px] text-[#004DE7] outline-none hover:underline focus-visible:underline"
            >
              <Plus className="size-[18px]" strokeWidth={1.5} aria-hidden />
              Add Stage
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

PhaseAccordion.displayName = "PhaseAccordion";
