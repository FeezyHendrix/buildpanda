import { useCallback, useMemo, useRef } from "react";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { useQueryClient } from "@tanstack/react-query";
import type { PreconProgramme, PreconProgrammeTask } from "@/api/precon";
import { preconKeys } from "@/hooks/query-keys";
import { useUpdatePreconProgrammeTask } from "@/hooks/use-precon";
import { GANTT_ZOOM, SCALES } from "@/pages/project/schedule/schedule-utils";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import {
  GANTT_LINK_TO_DEPENDENCY,
  buildProgrammeGantt,
  type ProgrammeGanttTask,
  parseLinkId,
  workingDaysBetween,
} from "./programme-gantt-data";

// The chart is the same rows as the table. Dragging a bar edits the task's
// duration; drawing a link adds a predecessor; deleting a link removes one.
// Start dates are never set directly — they come from dependencies — so a bar
// moved without resizing snaps back with a note saying where to change it.

interface GanttApi {
  on: (event: string, handler: (ev: Record<string, unknown>) => void) => void;
  intercept?: (event: string, handler: (ev: Record<string, unknown>) => boolean | void) => void;
}

interface TaskEvent {
  id?: string | number;
  inProgress?: boolean;
  task?: { start?: Date; end?: Date };
}

interface LinkEvent {
  id?: string | number;
  link?: { source?: string | number; target?: string | number; type?: string };
}

interface Props {
  sessionId: string;
  programme: PreconProgramme;
  editable: boolean;
  onSelectTask?: (taskId: string) => void;
}

const sameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

// The grid beside the bars shows the same working days the table and the
// scheduler use; the library's own duration column counts calendar days.
const DurationCell = ({ row }: { row: unknown }) => {
  const task = row as ProgrammeGanttTask;
  return <span>{task.isMilestone ? "—" : `${task.durationDays} d`}</span>;
};
DurationCell.displayName = "DurationCell";

const COLUMNS = [
  { id: "text", header: "Task", flexgrow: 1 },
  { id: "start", header: "Start", align: "center" as const, width: 110 },
  { id: "duration", header: "Duration", align: "center" as const, width: 100, cell: DurationCell },
  { id: "action", header: "", width: 50, align: "center" as const },
];

export function ProgrammeChart({ sessionId, programme, editable, onSelectTask }: Props) {
  const qc = useQueryClient();
  const update = useUpdatePreconProgrammeTask(sessionId);
  const tasksRef = useRef<PreconProgrammeTask[]>(programme.tasks);
  tasksRef.current = programme.tasks;
  const selectRef = useRef(onSelectTask);
  selectRef.current = onSelectTask;

  const { tasks, links, rangeStart, rangeEnd } = useMemo(() => buildProgrammeGantt(programme.tasks), [programme.tasks]);
  const markers = useMemo(() => [{ start: new Date(), text: "Today" }], []);

  const refetch = useCallback(() => void qc.invalidateQueries({ queryKey: preconKeys.programme(sessionId) }), [qc, sessionId]);

  const fail = useCallback(
    (error: unknown) => {
      toast(getApiErrorMessage(error, "Could not update the programme."), "error");
      refetch();
    },
    [refetch],
  );

  const attach = useCallback(
    (api: GanttApi) => {
      const onTaskChange = (raw: Record<string, unknown>) => {
        const ev = raw as TaskEvent;
        if (ev.inProgress || typeof ev.id !== "string") return;
        const task = tasksRef.current.find((t) => t.id === ev.id);
        const start = ev.task?.start;
        const end = ev.task?.end;
        if (!task || !(start instanceof Date) || !(end instanceof Date)) return;
        const currentStart = new Date(task.startAt);
        const durationDays = task.isMilestone ? 0 : workingDaysBetween(start, end);
        if (!task.isMilestone && durationDays !== task.durationDays) {
          update.mutate({ taskId: task.id, input: { version: task.version, durationDays } }, { onError: fail });
          return;
        }
        if (!sameDay(start, currentStart)) {
          toast("Start dates come from dependencies. Change a predecessor or its lag to move this task.", "info");
          refetch();
        }
      };
      api.on("update-task", onTaskChange);
      api.on("drag-task", onTaskChange);

      api.on("select-task", (raw) => {
        const id = (raw as { id?: unknown }).id;
        if (typeof id === "string") selectRef.current?.(id);
      });

      api.intercept?.("add-link", (raw) => {
        const ev = raw as LinkEvent;
        const source = ev.link?.source;
        const target = ev.link?.target;
        if (typeof source !== "string" || typeof target !== "string" || source === target) return false;
        const task = tasksRef.current.find((t) => t.id === target);
        if (!task) return false;
        const type = GANTT_LINK_TO_DEPENDENCY[ev.link?.type ?? "e2s"] ?? "FS";
        const predecessors = [...task.predecessors.filter((p) => p.taskId !== source), { taskId: source, type, lagDays: 0 }];
        update.mutate({ taskId: task.id, input: { version: task.version, predecessors } }, { onError: fail });
        return false;
      });

      api.intercept?.("delete-link", (raw) => {
        const ev = raw as LinkEvent;
        const parsed = typeof ev.id === "string" ? parseLinkId(ev.id) : null;
        if (!parsed) return false;
        const task = tasksRef.current.find((t) => t.id === parsed.targetId);
        if (!task) return false;
        const predecessors = task.predecessors.filter((p) => p.taskId !== parsed.sourceId);
        update.mutate({ taskId: task.id, input: { version: task.version, predecessors } }, { onError: fail });
        return false;
      });
    },
    [fail, refetch, update],
  );

  if (tasks.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-gray-500">Nothing to chart yet.</p>;
  }

  return (
    <div className="bp-gantt flex min-h-[420px] w-full flex-1 flex-col overflow-hidden [&_.wx-willow-theme]:flex [&_.wx-willow-theme]:min-h-0 [&_.wx-willow-theme]:flex-1 [&_.wx-willow-theme]:flex-col">
      {editable ? (
        <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
          Drag a bar's edge to change its duration, drag from one bar to another to add a link, and click a link to remove
          it. Red bars are the critical path.
        </p>
      ) : null}
      <Willow>
        <Gantt
          tasks={tasks}
          links={links}
          columns={COLUMNS}
          scales={SCALES}
          start={rangeStart}
          end={rangeEnd}
          cellWidth={90}
          cellHeight={36}
          zoom={GANTT_ZOOM}
          markers={markers}
          readonly={!editable}
          init={editable ? attach : undefined}
        />
      </Willow>
    </div>
  );
}
ProgrammeChart.displayName = "ProgrammeChart";
