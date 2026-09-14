import { useState, useEffect } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Badge } from "@/components/atoms/badge";
import { INPUT_CLASS } from "@/components/atoms/input";
import {
  useStages,
  useCreateStage,
  useUpdateStage,
  useDeleteStage,
} from "@/hooks/use-stages";
import { useDetectPhases, type DetectedPhase } from "@/hooks/use-panda-ai";
import { getApiErrorMessage } from "@/lib/api-error";

interface TimelineStepProps {
  projectId: string;
  onNext: () => void;
}

interface PhaseRow {
  id: string | null;
  name: string;
  startDate: string;
  endDate: string;
}

const fieldClass = INPUT_CLASS;

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function rowsFromDetected(phases: DetectedPhase[]): PhaseRow[] {
  const today = new Date();
  let cursor = 0;
  return phases.map((phase) => {
    const startDate = addDays(today, cursor);
    const span = Math.max(1, phase.durationWeeks) * 7;
    const endDate = addDays(today, cursor + span - 1);
    cursor += span;
    return { id: null, name: phase.name, startDate, endDate };
  });
}

export function TimelineStep({ projectId, onNext }: TimelineStepProps) {
  const { data: stages = [] } = useStages(projectId);
  const detect = useDetectPhases(projectId, true);
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();

  const [rows, setRows] = useState<PhaseRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [usedAi, setUsedAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (hydrated || detect.isPending) return;
    const detected = detect.data;
    if (detected && detected.phases.length > 0) {
      setRows(rowsFromDetected(detected.phases));
      setUsedAi(detected.usedAi);
    } else {
      setRows(
        stages.map((stage) => ({
          id: stage.id,
          name: stage.name,
          startDate: stage.startDate ?? "",
          endDate: stage.endDate ?? "",
        })),
      );
    }
    setHydrated(true);
  }, [hydrated, detect.isPending, detect.data, stages]);

  function updateRow(index: number, patch: Partial<PhaseRow>): void {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow(): void {
    setRows((prev) => [...prev, { id: null, name: "", startDate: "", endDate: "" }]);
  }

  function removeRow(index: number): void {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(): Promise<void> {
    setErrorMsg("");
    setSaving(true);
    try {
      const kept = rows.filter((row) => row.name.trim());
      const keptIds = new Set(kept.map((row) => row.id).filter(Boolean));

      for (const stage of stages) {
        if (!keptIds.has(stage.id)) {
          await deleteStage.mutateAsync({ projectId, stageId: stage.id });
        }
      }

      for (const row of kept) {
        const payload = {
          name: row.name.trim(),
          startDate: row.startDate || null,
          endDate: row.endDate || null,
        };
        if (row.id) {
          await updateStage.mutateAsync({ projectId, stageId: row.id, ...payload });
        } else {
          await createStage.mutateAsync({ projectId, ...payload });
        }
      }
      onNext();
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, "Could not save the timeline."));
      setSaving(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <Spinner className="h-8 w-8 text-primary-500" />
        <div>
          <p className="text-sm font-medium text-ink">Panda AI is building your timeline</p>
          <p className="text-xs text-ink-muted">Reading your documents to suggest the build phases…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-2xl mx-auto mt-4 gap-8 pb-12">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl font-semibold text-ink">Project timeline</h2>
          {usedAi && (
            <Badge tone="info">Suggested by Panda AI</Badge>
          )}
        </div>
        <p className="text-ink-muted">
          {usedAi
            ? "Panda AI suggested these phases from your documents. Adjust the names and dates, remove what you don't need, or add your own. You can change this anytime later."
            : "We've added a starting set of phases. Rename them, set dates, remove what you don't need, or add your own. You can change this anytime later."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="hidden md:grid grid-cols-[1fr_150px_150px_40px] gap-3 px-1 text-xs font-medium text-ink-muted">
          <span>Phase</span>
          <span>Start</span>
          <span>Target end</span>
          <span />
        </div>

        {rows.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-1 md:grid-cols-[1fr_150px_150px_40px] gap-3 items-center"
          >
            <input
              type="text"
              value={row.name}
              placeholder="e.g. Foundation & Substructure"
              onChange={(e) => updateRow(index, { name: e.target.value })}
              className={fieldClass}
            />
            <input
              type="date"
              value={row.startDate}
              onChange={(e) => updateRow(index, { startDate: e.target.value })}
              className={fieldClass}
            />
            <input
              type="date"
              value={row.endDate}
              onChange={(e) => updateRow(index, { endDate: e.target.value })}
              className={fieldClass}
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label="Remove phase"
              className="flex size-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-black/5 hover:text-negative-500"
            >
              &times;
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="mt-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary-500 py-2.5 text-sm font-medium text-primary-500 transition-colors hover:bg-primary-500/5"
        >
          + Add phase
        </button>
      </div>

      {errorMsg && <p className="text-sm text-negative-500">{errorMsg}</p>}

      <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
        {saving ? "Saving timeline…" : "Save timeline"}
      </Button>
    </div>
  );
}
