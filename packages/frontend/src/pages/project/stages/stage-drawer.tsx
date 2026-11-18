import { useEffect, useState } from "react";
import type { BuildingPhase } from "@/api/building-phases";
import type { StageInput } from "@/api/stages";
import { Select } from "@/components/atoms/select";
import { TextInput } from "@/components/atoms/text-input";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useCreateBuildingPhase } from "@/hooks/use-building-phases";
import { errorMessage } from "@/lib/api-error";
import type { Stage, StageStatus } from "@/lib/project-types";

const STATUS_OPTIONS = [
  { value: "Pending", label: "Not started" },
  { value: "InProgress", label: "In progress" },
  { value: "Done", label: "Completed" },
];

const LABEL = "text-[13px] font-medium text-[#1E1E1E]";
const DATE_INPUT =
  "h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10";

interface StageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  buildingId?: string;
  /** Present when editing; absent when adding a stage. */
  stage?: Stage | null;
  phases: BuildingPhase[];
  onSubmit: (values: StageInput) => void;
  isSubmitting: boolean;
  error: string | null;
}

/** Add and edit a build stage in one drawer; "Add Building Phase" swaps the body in place. */
export function StageDrawer({
  open,
  onOpenChange,
  projectId,
  buildingId,
  stage,
  phases,
  onSubmit,
  isSubmitting,
  error,
}: StageDrawerProps) {
  const createPhase = useCreateBuildingPhase(projectId);
  const resetCreatePhase = createPhase.reset;
  const [view, setView] = useState<"form" | "addPhase">("form");
  const [phaseId, setPhaseId] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<StageStatus>("Pending");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [newPhaseName, setNewPhaseName] = useState("");

  useEffect(() => {
    if (!open) return;
    setView("form");
    setPhaseId(stage?.buildingPhaseId ?? "");
    setName(stage?.name ?? "");
    setStatus(stage?.status ?? "Pending");
    setStartDate(stage?.startDate ?? "");
    setEndDate(stage?.endDate ?? "");
    setNewPhaseName("");
    resetCreatePhase();
  }, [open, stage, resetCreatePhase]);

  if (view === "addPhase") {
    return (
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Add Building Phase"
        description=""
        submitLabel="Save"
        submitDisabled={!newPhaseName.trim()}
        submitting={createPhase.isPending}
        error={createPhase.error ? errorMessage(createPhase.error) : null}
        onSubmit={() =>
          createPhase.mutate(
            { name: newPhaseName.trim(), buildingId },
            {
              onSuccess: (phase) => {
                setPhaseId(phase.id);
                setNewPhaseName("");
                setView("form");
              },
            },
          )
        }
        footerVariant="stacked"
      >
        <button
          type="button"
          onClick={() => setView("form")}
          className="flex items-center gap-1 self-start text-sm font-medium text-[#111827] hover:underline"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Go Back
        </button>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>Building Stage</label>
          <TextInput
            value={newPhaseName}
            onChange={setNewPhaseName}
            placeholder="Placeholder"
            maxLength={80}
            autoFocus
          />
        </div>
      </FormDrawer>
    );
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={stage ? "Build Stage" : "Add New Stage"}
      description={
        stage
          ? ""
          : "Create a new project stage to organize tasks, milestones, and progress. You can update or reorder stages later."
      }
      submitLabel={stage ? "Save Changes" : "Create New Stage"}
      submitDisabled={!name.trim() || !phaseId}
      submitting={isSubmitting}
      error={error}
      onSubmit={() =>
        onSubmit({
          name: name.trim(),
          buildingPhaseId: phaseId,
          status,
          startDate: startDate || null,
          endDate: endDate || null,
          progressPercent: stage
            ? stage.progressPercent
            : status === "Done"
              ? 100
              : status === "InProgress"
                ? 50
                : 0,
        })
      }
      footerVariant="stacked"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className={LABEL}>Building Phase</label>
          <button
            type="button"
            onClick={() => setView("addPhase")}
            className="text-xs font-medium text-[#004DE7] hover:underline"
          >
            + Add Building Phase
          </button>
        </div>
        <Select
          options={phases.map((phase) => ({ value: phase.id, label: phase.name }))}
          value={phaseId || null}
          onChange={(v) => setPhaseId(v ?? "")}
          placeholder="Select Phase"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>Building Stage</label>
        <TextInput value={name} onChange={setName} placeholder="Placeholder" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>Status</label>
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => v && setStatus(v as StageStatus)}
          placeholder="Select Status"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="DD/MM/YYYY"
            className={DATE_INPUT}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="DD/MM/YYYY"
            className={DATE_INPUT}
          />
        </div>
      </div>
    </FormDrawer>
  );
}
StageDrawer.displayName = "StageDrawer";
