import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/atoms/button";
import type { MethodStatement, MethodStatementInput, MethodStep } from "@/api/precon-safety";
import { cn } from "@/lib/utils";
import { DraftStateChip, StringListEditor, cellInputClass, cellTextareaClass } from "./safety-shared";

interface ProgrammeTaskOption {
  id: string;
  name: string;
}

interface Props {
  statement: MethodStatement;
  programmeTasks: ProgrammeTaskOption[];
  saving: boolean;
  onSave: (body: MethodStatementInput) => void;
  onConfirm: () => void;
  onDelete: () => void;
}

const blankStep = (order: number): MethodStep => ({ order, text: "", controls: "", ppe: "" });

function renumber(steps: MethodStep[]): MethodStep[] {
  return steps.map((s, i) => ({ ...s, order: i + 1 }));
}

// The editor holds the whole statement as a draft and saves explicitly: a
// method statement is briefed to a gang as one document, so half-saved steps
// would be worse than an unsaved one. The header shows when there are edits.
export function MethodStatementEditor({ statement, programmeTasks, saving, onSave, onConfirm, onDelete }: Props) {
  const [activityName, setActivityName] = useState(statement.activityName);
  const [programmeTaskId, setProgrammeTaskId] = useState<string | null>(statement.programmeTaskId);
  const [hazards, setHazards] = useState<string[]>(statement.hazards);
  const [steps, setSteps] = useState<MethodStep[]>(statement.steps);

  useEffect(() => {
    setActivityName(statement.activityName);
    setProgrammeTaskId(statement.programmeTaskId);
    setHazards(statement.hazards);
    setSteps(statement.steps);
  }, [statement.id, statement.updatedAt, statement.activityName, statement.programmeTaskId, statement.hazards, statement.steps]);

  const dirty =
    activityName !== statement.activityName ||
    programmeTaskId !== statement.programmeTaskId ||
    JSON.stringify(hazards) !== JSON.stringify(statement.hazards) ||
    JSON.stringify(steps) !== JSON.stringify(statement.steps);

  const updateStep = (index: number, patch: Partial<MethodStep>) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const moveStep = (index: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return renumber(next);
    });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DraftStateChip state={statement.status} />
          {dirty ? <span className="text-caption-m text-warning-500">Unsaved changes</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-error-500 hover:bg-error-50" onClick={onDelete}>
            Delete
          </Button>
          {statement.status !== "confirmed" && !dirty ? (
            <Button size="sm" variant="secondary" loading={saving} onClick={onConfirm}>
              Confirm
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={!dirty || !activityName.trim()}
            loading={saving}
            onClick={() =>
              onSave({
                activityName: activityName.trim(),
                programmeTaskId,
                hazards: hazards.map((h) => h.trim()).filter(Boolean),
                steps: renumber(steps.filter((s) => s.text.trim())),
              })
            }
          >
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-caption-m font-medium text-ink-subtle">
          Activity
          <input className={cn(cellInputClass, "mt-1")} value={activityName} onChange={(e) => setActivityName(e.target.value)} />
        </label>
        <label className="text-caption-m font-medium text-ink-subtle">
          Programme task
          <select
            className={cn(cellInputClass, "mt-1")}
            value={programmeTaskId ?? ""}
            onChange={(e) => setProgrammeTaskId(e.target.value || null)}
          >
            <option value="">Not linked</option>
            {programmeTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <p className="mb-1 text-caption-m font-medium text-ink-subtle">Hazards</p>
        <StringListEditor values={hazards} onChange={setHazards} placeholder="e.g. Collapse of trench sides" addLabel="Add hazard" />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-caption-m font-medium text-ink-subtle">Sequence of work</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-primary-700"
            onClick={() => setSteps((prev) => [...prev, blankStep(prev.length + 1)])}
          >
            + Add step
          </Button>
        </div>
        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <li key={index} className="grid grid-cols-[28px_minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] items-start gap-2 rounded-none border border-line-hair p-2">
              <span className="pt-1.5 text-center text-caption-m font-medium text-black-300">{index + 1}</span>
              <textarea aria-label="Step" className={cellTextareaClass} placeholder="What is done" value={step.text} onChange={(e) => updateStep(index, { text: e.target.value })} />
              <textarea aria-label="Controls" className={cellTextareaClass} placeholder="Control measures" value={step.controls} onChange={(e) => updateStep(index, { controls: e.target.value })} />
              <textarea aria-label="PPE" className={cellTextareaClass} placeholder="PPE" value={step.ppe} onChange={(e) => updateStep(index, { ppe: e.target.value })} />
              <div className="flex flex-col gap-1">
                <Button type="button" size="sm" variant="ghost" aria-label="Move up" className="h-7 w-7 px-0 text-black-300" disabled={index === 0} onClick={() => moveStep(index, -1)}>
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button type="button" size="sm" variant="ghost" aria-label="Move down" className="h-7 w-7 px-0 text-black-300" disabled={index === steps.length - 1} onClick={() => moveStep(index, 1)}>
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button type="button" size="sm" variant="ghost" aria-label="Remove step" className="h-7 w-7 px-0 text-black-300 hover:text-error-500" onClick={() => setSteps((prev) => renumber(prev.filter((_, i) => i !== index)))}>
                  ×
                </Button>
              </div>
            </li>
          ))}
          {steps.length === 0 ? <li className="text-caption-l text-ink-muted">No steps yet.</li> : null}
        </ol>
      </div>
    </div>
  );
}
MethodStatementEditor.displayName = "MethodStatementEditor";
