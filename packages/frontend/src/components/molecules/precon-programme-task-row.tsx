import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import {
  isVersionConflict,
  useRejectPreconProgrammeTask,
  useUpdatePreconProgrammeTask,
  useVerifyPreconProgrammeTask,
} from "@/hooks/use-precon";
import type { PreconProgrammeTask, PreconRowStatus, ProgrammeDependency } from "@/api/precon";

const STATUS_META: Record<PreconRowStatus, { label: string; tone: BadgeTone; mark: string }> = {
  ai_generated: { label: "AI draft", tone: "info", mark: "◇" },
  needs_review: { label: "Needs review", tone: "warning", mark: "▲" },
  verified: { label: "Verified", tone: "success", mark: "✓" },
  rejected: { label: "Rejected", tone: "danger", mark: "✕" },
};

const DEPENDENCY_LABEL: Record<ProgrammeDependency["type"], string> = {
  FS: "after the finish of",
  SS: "with the start of",
  FF: "with the finish of",
  SF: "before the start of",
};

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dayMonth.format(date);
}

function indentClass(outlineLevel: number): string {
  if (outlineLevel <= 1) return "pl-3";
  if (outlineLevel === 2) return "pl-9";
  return "pl-14";
}

function describeLink(link: ProgrammeDependency, name: string | undefined): string {
  const lag = link.lagDays === 0 ? "" : link.lagDays > 0 ? ` + ${link.lagDays}d` : ` − ${Math.abs(link.lagDays)}d`;
  return `Starts ${DEPENDENCY_LABEL[link.type]} ${name ?? "an earlier task"}${lag}`;
}

interface TaskRowProps {
  task: PreconProgrammeTask;
  sessionId: string;
  nameById: Map<string, string>;
  onConflict: (message: string) => void;
}

export function PreconProgrammeTaskRow({ task, sessionId, nameById, onConflict }: TaskRowProps) {
  const [open, setOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [durationDraft, setDurationDraft] = useState<string | null>(null);
  const verify = useVerifyPreconProgrammeTask(sessionId);
  const reject = useRejectPreconProgrammeTask(sessionId);
  const update = useUpdatePreconProgrammeTask(sessionId);

  const status = STATUS_META[task.status];
  const isPhase = task.outlineLevel <= 1;

  const handleError = (error: unknown) => {
    onConflict(
      isVersionConflict(error)
        ? `"${task.name}" was changed by someone else — the programme has been refreshed, please reapply your change.`
        : error instanceof Error
          ? error.message
          : "Update failed",
    );
  };

  const commitName = () => {
    const next = nameDraft?.trim();
    setNameDraft(null);
    if (!next || next === task.name) return;
    update.mutate({ taskId: task.id, input: { version: task.version, name: next } }, { onError: handleError });
  };

  const commitDuration = () => {
    const raw = durationDraft;
    setDurationDraft(null);
    if (raw === null) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value === task.durationDays) return;
    update.mutate(
      { taskId: task.id, input: { version: task.version, durationDays: value } },
      { onError: handleError },
    );
  };

  return (
    <li className={cn("border-b border-grey-50 last:border-b-0", task.status === "rejected" && "opacity-60")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-start gap-3 py-2 pr-3 text-left hover:bg-primary-50",
          indentClass(task.outlineLevel),
          isPhase && "bg-grey-50",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            {task.wbsCode ? (
              <span className="shrink-0 font-mono text-xs text-grey-300">{task.wbsCode}</span>
            ) : null}
            {task.isMilestone ? (
              <span aria-hidden="true" className="shrink-0 text-primary-500">
                ◆
              </span>
            ) : null}
            <span
              className={cn(
                "min-w-0 truncate",
                isPhase ? "text-sm font-bold uppercase tracking-wide text-black-500" : "text-sm text-black-400",
                task.status === "rejected" && "line-through",
              )}
            >
              {task.name}
            </span>
          </span>
          {task.basis && !open ? (
            <span className="mt-0.5 block truncate text-xs text-grey-400">{task.basis}</span>
          ) : null}
        </span>

        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-grey-500">
          {task.isMilestone ? "Milestone" : `${task.durationDays} d`}
        </span>
        <span className="hidden w-44 shrink-0 text-right text-xs tabular-nums text-grey-400 sm:block">
          {formatDay(task.startAt)} → {formatDay(task.finishAt)}
        </span>
        <span className="w-28 shrink-0 text-right">
          <Badge tone={status.tone}>
            <span aria-hidden="true">{status.mark}</span>
            {status.label}
          </Badge>
        </span>
      </button>

      {open ? (
        <div className={cn("space-y-3 border-t border-grey-50 bg-grey-50 py-3 pr-3", indentClass(task.outlineLevel))}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">Why this duration</p>
              <p className="mt-1 text-xs text-grey-500">
                {task.basis ?? "Panda AI gave no justification for this duration — check it before you rely on it."}
              </p>
            </div>
            {task.confidence ? (
              <Badge tone={task.confidence === "high" ? "success" : "warning"}>
                {task.confidence === "high" ? "High confidence" : "Low confidence"}
              </Badge>
            ) : null}
          </div>

          {task.predecessors.length > 0 ? (
            <ul className="space-y-0.5">
              {task.predecessors.map((link) => (
                <li key={`${link.taskId}-${link.type}`} className="text-xs text-grey-400">
                  {describeLink(link, nameById.get(link.taskId))}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 text-xs text-grey-500">
              Task name
              <input
                className="mt-1 h-8 w-full border border-grey-50 bg-white px-2 text-sm text-black-500 outline-none focus:border-primary-300"
                value={nameDraft ?? task.name}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
              />
            </label>
            <label className="w-28 text-xs text-grey-500">
              Duration (days)
              <input
                className="mt-1 h-8 w-full border border-grey-50 bg-white px-2 text-sm text-black-500 outline-none focus:border-primary-300 disabled:text-grey-300"
                inputMode="numeric"
                disabled={task.isMilestone}
                value={durationDraft ?? task.durationDays}
                onChange={(e) => setDurationDraft(e.target.value)}
                onBlur={commitDuration}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              loading={verify.isPending}
              disabled={task.status === "verified"}
              onClick={() => verify.mutate({ taskId: task.id, version: task.version }, { onError: handleError })}
            >
              {task.status === "verified" ? "Verified" : "Verify"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={reject.isPending}
              disabled={task.status === "rejected"}
              onClick={() => reject.mutate({ taskId: task.id, version: task.version }, { onError: handleError })}
            >
              Reject
            </Button>
            <span className="text-xs text-grey-300">
              {formatDay(task.startAt)} → {formatDay(task.finishAt)}
              {task.status === "verified" && task.verifiedAt ? ` · reviewed ${formatDay(task.verifiedAt)}` : ""}
            </span>
          </div>
        </div>
      ) : null}
    </li>
  );
}
PreconProgrammeTaskRow.displayName = "PreconProgrammeTaskRow";
