import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import type { PreconProgramme, PreconProgrammeTask, UpdateProgrammeTaskInput } from "@/api/precon";
import {
  isVersionConflict,
  useCreatePreconProgrammeTask,
  useDeletePreconProgrammeTask,
  useRejectPreconProgrammeTask,
  useUpdatePreconProgrammeTask,
  useVerifyPreconProgrammeTask,
} from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { ProgrammeTaskRow, type TaskRowActions } from "./programme-task-row";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

const inputClass = cn(INPUT_SM_CLASS, "w-auto");

interface Props {
  sessionId: string;
  programme: PreconProgramme;
  editable: boolean;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

function NewTaskForm({ onCreate, creating, onClose }: { onCreate: (name: string, durationDays: number) => void; creating: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("5");
  const valid = name.trim().length > 0 && Number.isFinite(Number(duration)) && Number(duration) >= 0;
  return (
    <form
      className="flex flex-wrap items-center gap-2 border-t border-line-hair bg-gray-50 px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onCreate(name.trim(), Math.round(Number(duration)));
      }}
    >
      <input className={inputClass + " min-w-[200px] flex-1"} placeholder="Task name" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      <label className="flex items-center gap-1 text-xs text-gray-500">
        <input className={inputClass + " w-16 text-right"} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Duration in working days" />
        days
      </label>
      <Button size="sm" type="submit" loading={creating} disabled={!valid}>
        Add task
      </Button>
      <Button size="sm" variant="ghost" type="button" onClick={onClose}>
        Cancel
      </Button>
    </form>
  );
}
NewTaskForm.displayName = "NewTaskForm";

export function ProgrammeTable({ sessionId, programme, editable, selectedTaskId, onSelectTask }: Props) {
  const update = useUpdatePreconProgrammeTask(sessionId);
  const create = useCreatePreconProgrammeTask(sessionId);
  const remove = useDeletePreconProgrammeTask(sessionId);
  const verify = useVerifyPreconProgrammeTask(sessionId);
  const reject = useRejectPreconProgrammeTask(sessionId);
  const [adding, setAdding] = useState<{ afterTaskId?: string } | null>(null);
  const [deleting, setDeleting] = useState<PreconProgrammeTask | null>(null);

  const onError = (error: unknown) =>
    toast(
      isVersionConflict(error)
        ? "Someone else changed this task. The programme has been refreshed; apply your change again."
        : getApiErrorMessage(error, "Could not update the programme."),
      "error",
    );

  const tasks = programme.tasks;
  const parentIds = new Set(tasks.flatMap((t) => (t.parentTaskId ? [t.parentTaskId] : [])));

  const actions: TaskRowActions = {
    editable,
    busy: update.isPending || create.isPending || remove.isPending,
    update: (taskId: string, input: Omit<UpdateProgrammeTaskInput, "version">, version: number) =>
      update.mutate({ taskId, input: { version, ...input } }, { onError }),
    verify: (task) => verify.mutate({ taskId: task.id, version: task.version }, { onError }),
    reject: (task) => reject.mutate({ taskId: task.id, version: task.version }, { onError }),
    remove: (task) => setDeleting(task),
    addBelow: (task) => setAdding({ afterTaskId: task.id }),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-[1fr_72px_120px_64px_112px] gap-2 border-b border-line-hair bg-gray-50 px-3 py-2 text-xs font-medium uppercase text-ink-muted">
        <span>Task</span>
        <span className="text-right">Duration</span>
        <span className="text-right">Start → finish</span>
        <span className="text-right">Float</span>
        <span className="text-right">Status</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {tasks.map((task, index) => (
          <ProgrammeTaskRow
            key={task.id}
            task={task}
            tasks={tasks}
            index={index}
            isParent={parentIds.has(task.id)}
            selected={task.id === selectedTaskId}
            onSelect={onSelectTask}
            actions={actions}
          />
        ))}
      </ul>
      {adding ? (
        <NewTaskForm
          creating={create.isPending}
          onClose={() => setAdding(null)}
          onCreate={(name, durationDays) =>
            create.mutate(
              { name, durationDays, afterTaskId: adding.afterTaskId },
              {
                onSuccess: () => setAdding(null),
                onError,
              },
            )
          }
        />
      ) : editable ? (
        <div className="border-t border-line-hair px-3 py-2">
          <Button size="sm" variant="ghost" onClick={() => setAdding({})}>
            + Add task at the end
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        variant="danger"
        title="Delete this task?"
        description={deleting ? `"${deleting.name}" is removed from the programme. Tasks that depended on it lose that link; the dates re-plan.` : undefined}
        confirmLabel="Delete task"
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null), onError });
        }}
      />
    </div>
  );
}
ProgrammeTable.displayName = "ProgrammeTable";
