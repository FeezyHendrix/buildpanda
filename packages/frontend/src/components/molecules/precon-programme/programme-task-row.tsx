import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, IndentDecrease, IndentIncrease, Plus, Trash2 } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Switcher } from "@/components/atoms/switcher";
import { cn } from "@/lib/utils";
import type { PreconProgrammeTask, PreconRowStatus, ProgrammeDependency, UpdateProgrammeTaskInput } from "@/api/precon";
import { ProgrammePredecessorEditor } from "./programme-predecessor-editor";

const STATUS_META: Record<PreconRowStatus, { label: string; tone: BadgeTone; mark: string }> = {
  ai_generated: { label: "AI draft", tone: "info", mark: "◇" },
  needs_review: { label: "Needs review", tone: "warning", mark: "▲" },
  verified: { label: "Verified", tone: "success", mark: "✓" },
  rejected: { label: "Rejected", tone: "danger", mark: "✕" },
};

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
const formatDay = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dayMonth.format(date);
};

const INDENT: Record<number, string> = { 1: "pl-2", 2: "pl-7", 3: "pl-12", 4: "pl-16", 5: "pl-20" };
const inputClass =
  "h-8 w-full rounded-lg border-0 bg-[#F6F6F6] px-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-100 disabled:text-gray-400";

export interface TaskRowActions {
  update: (taskId: string, input: Omit<UpdateProgrammeTaskInput, "version">, version: number) => void;
  verify: (task: PreconProgrammeTask) => void;
  reject: (task: PreconProgrammeTask) => void;
  remove: (task: PreconProgrammeTask) => void;
  addBelow: (task: PreconProgrammeTask) => void;
  busy: boolean;
  editable: boolean;
}

interface Props {
  task: PreconProgrammeTask;
  tasks: PreconProgrammeTask[];
  index: number;
  isParent: boolean;
  selected: boolean;
  onSelect: (taskId: string) => void;
  actions: TaskRowActions;
}

export function ProgrammeTaskRow({ task, tasks, index, isParent, selected, onSelect, actions }: Props) {
  const [open, setOpen] = useState(false);
  const status = STATUS_META[task.status];
  const canEdit = actions.editable && !actions.busy;
  const patch = (input: Omit<UpdateProgrammeTaskInput, "version">) => actions.update(task.id, input, task.version);

  const commitText = (field: "name" | "basis") => (e: React.FocusEvent<HTMLInputElement>) => {
    const next = e.target.value.trim();
    if (field === "name" && (!next || next === task.name)) return;
    if (field === "basis" && next === (task.basis ?? "")) return;
    patch({ [field]: next });
  };

  const commitDuration = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (!Number.isFinite(value) || value < 0 || value === task.durationDays) return;
    patch({ durationDays: Math.round(value) });
  };

  return (
    <li
      className={cn(
        "border-b border-gray-100 last:border-b-0",
        selected && "bg-primary-50/60",
        task.status === "rejected" && "opacity-60",
      )}
    >
      <div
        className={cn("grid grid-cols-[1fr_72px_120px_64px_112px] items-center gap-2 py-1.5 pr-2 text-sm", INDENT[task.outlineLevel] ?? "pl-20")}
        onClick={() => onSelect(task.id)}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={open ? "Collapse task" : "Expand task"}
            aria-expanded={open}
            className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            {open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
          </button>
          {task.isMilestone ? <span aria-hidden="true" className="shrink-0 text-amber-600">◆</span> : null}
          <span className={cn("truncate", isParent ? "font-semibold text-gray-900" : "text-gray-800", task.status === "rejected" && "line-through")}>
            {task.name}
          </span>
          {task.origin !== "ai" ? (
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
              {task.origin === "prompt" ? "Prompted" : "Edited"}
            </span>
          ) : null}
        </div>
        <span className="text-right text-xs tabular-nums text-gray-600">{task.isMilestone ? "—" : `${task.durationDays} d`}</span>
        <span className="text-right text-xs tabular-nums text-gray-500">
          {formatDay(task.startAt)} → {formatDay(task.finishAt)}
        </span>
        <span className="text-right text-xs tabular-nums">
          {task.isCritical ? (
            <span className="font-semibold text-red-600">critical</span>
          ) : task.totalFloatDays === null ? (
            "—"
          ) : (
            <span className="text-gray-500">{task.totalFloatDays} d float</span>
          )}
        </span>
        <span className="text-right">
          <Badge tone={status.tone}>
            <span aria-hidden="true">{status.mark}</span>
            {status.label}
          </Badge>
        </span>
      </div>

      {open ? (
        <div className={cn("space-y-3 border-t border-gray-100 bg-gray-50 py-3 pr-3", INDENT[task.outlineLevel] ?? "pl-20")}>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_140px]">
            <label className="text-xs text-gray-500">
              Task name
              <input className={inputClass + " mt-1"} defaultValue={task.name} disabled={!canEdit} onBlur={commitText("name")} />
            </label>
            <label className="text-xs text-gray-500">
              Duration (working days)
              <input
                className={inputClass + " mt-1 text-right"}
                inputMode="numeric"
                defaultValue={task.durationDays}
                disabled={!canEdit || task.isMilestone}
                onBlur={commitDuration}
              />
            </label>
            <div className="text-xs text-gray-500">
              Milestone
              <Switcher
                className="mt-1"
                value={task.isMilestone ? "yes" : "no"}
                onChange={(v) => canEdit && v !== (task.isMilestone ? "yes" : "no") && patch({ isMilestone: v === "yes" })}
              />
            </div>
          </div>
          <label className="block text-xs text-gray-500">
            Basis for the duration
            <input className={inputClass + " mt-1"} defaultValue={task.basis ?? ""} disabled={!canEdit} placeholder="e.g. 186 m² of blockwork at 12 m²/day, two gangs" onBlur={commitText("basis")} />
          </label>

          <ProgrammePredecessorEditor
            task={task}
            tasks={tasks}
            disabled={!canEdit}
            onChange={(predecessors: ProgrammeDependency[]) => patch({ predecessors })}
          />

          <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-200 pt-3">
            <Button size="sm" variant="ghost" disabled={!canEdit || index === 0} onClick={() => patch({ sort: index - 1 })} aria-label="Move up">
              <ArrowUp className="size-3.5" aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" disabled={!canEdit || index >= tasks.length - 1} onClick={() => patch({ sort: index + 1 })} aria-label="Move down">
              <ArrowDown className="size-3.5" aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" disabled={!canEdit || task.outlineLevel <= 1} onClick={() => patch({ outlineLevel: task.outlineLevel - 1 })} aria-label="Outdent">
              <IndentDecrease className="size-3.5" aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" disabled={!canEdit || task.outlineLevel >= 5} onClick={() => patch({ outlineLevel: task.outlineLevel + 1 })} aria-label="Indent">
              <IndentIncrease className="size-3.5" aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => actions.addBelow(task)}>
              <Plus className="mr-1 size-3.5" aria-hidden="true" />
              Add below
            </Button>
            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" disabled={!canEdit} onClick={() => actions.remove(task)}>
              <Trash2 className="mr-1 size-3.5" aria-hidden="true" />
              Delete
            </Button>
            <span className="ml-auto flex items-center gap-1.5">
              <Button size="sm" variant="secondary" disabled={!actions.editable || task.status === "rejected"} onClick={() => actions.reject(task)}>
                Reject
              </Button>
              <Button size="sm" disabled={!actions.editable || task.status === "verified"} onClick={() => actions.verify(task)}>
                {task.status === "verified" ? "Verified" : "Verify"}
              </Button>
            </span>
          </div>
        </div>
      ) : null}
    </li>
  );
}
ProgrammeTaskRow.displayName = "ProgrammeTaskRow";
