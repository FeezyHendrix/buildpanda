import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/atoms/button";
import type { PreconProgrammeTask, ProgrammeDependency } from "@/api/precon";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

// Dependencies are the part of a drafted programme a planner most often has
// to fix, so they get a full editor: pick the task, the link type, the lag.
// Every change is committed at once; the server re-plans and rejects loops.

const DEPENDENCY_TYPES: { value: ProgrammeDependency["type"]; label: string }[] = [
  { value: "FS", label: "Finish → start" },
  { value: "SS", label: "Start → start" },
  { value: "FF", label: "Finish → finish" },
  { value: "SF", label: "Start → finish" },
];

const inputClass = cn(INPUT_SM_CLASS, "w-auto");

interface Props {
  task: PreconProgrammeTask;
  tasks: PreconProgrammeTask[];
  disabled?: boolean;
  onChange: (predecessors: ProgrammeDependency[]) => void;
}

export function ProgrammePredecessorEditor({ task, tasks, disabled, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [draftTaskId, setDraftTaskId] = useState("");
  const candidates = tasks.filter((t) => t.id !== task.id && t.status !== "rejected");
  const nameById = new Map(tasks.map((t) => [t.id, t.name]));

  const commit = (next: ProgrammeDependency[]) => onChange(next);

  const setLink = (index: number, patch: Partial<ProgrammeDependency>) =>
    commit(task.predecessors.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const removeLink = (index: number) => commit(task.predecessors.filter((_, i) => i !== index));

  const addLink = () => {
    if (!draftTaskId) return;
    commit([...task.predecessors.filter((p) => p.taskId !== draftTaskId), { taskId: draftTaskId, type: "FS", lagDays: 0 }]);
    setDraftTaskId("");
    setAdding(false);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase text-ink-muted">Depends on</p>
      {task.predecessors.length === 0 && !adding ? (
        <p className="text-xs text-gray-400">No predecessors. This task can start on day one.</p>
      ) : null}
      <ul className="space-y-1">
        {task.predecessors.map((link, index) => (
          <li key={`${link.taskId}-${index}`} className="flex flex-wrap items-center gap-1.5">
            <select
              className={inputClass + " max-w-[220px] flex-1"}
              value={link.taskId}
              disabled={disabled}
              aria-label="Predecessor task"
              onChange={(e) => setLink(index, { taskId: e.target.value })}
            >
              {!candidates.some((c) => c.id === link.taskId) ? (
                <option value={link.taskId}>{nameById.get(link.taskId) ?? "Unknown task"}</option>
              ) : null}
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={link.type}
              disabled={disabled}
              aria-label="Link type"
              onChange={(e) => setLink(index, { type: e.target.value as ProgrammeDependency["type"] })}
            >
              {DEPENDENCY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-gray-500">
              lag
              <input
                className={inputClass + " w-16 text-right"}
                inputMode="numeric"
                defaultValue={link.lagDays}
                disabled={disabled}
                aria-label="Lag in working days"
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value !== link.lagDays) setLink(index, { lagDays: Math.round(value) });
                }}
              />
              d
            </label>
            <button
              type="button"
              disabled={disabled}
              aria-label="Remove dependency"
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              onClick={() => removeLink(index)}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="flex items-center gap-1.5">
          <select className={inputClass + " max-w-[220px] flex-1"} value={draftTaskId} onChange={(e) => setDraftTaskId(e.target.value)} aria-label="Task to depend on">
            <option value="">Choose a task…</option>
            {candidates
              .filter((c) => !task.predecessors.some((p) => p.taskId === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <Button size="sm" onClick={addLink} disabled={!draftTaskId}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" disabled={disabled || candidates.length === 0} onClick={() => setAdding(true)}>
          <Plus className="mr-1 size-3.5" aria-hidden="true" />
          Add dependency
        </Button>
      )}
    </div>
  );
}
ProgrammePredecessorEditor.displayName = "ProgrammePredecessorEditor";
