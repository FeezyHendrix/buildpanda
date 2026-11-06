import { createContext, useContext } from "react";
import { Redo2, Undo2 } from "lucide-react";
import type { IColumnConfig } from "@svar-ui/react-gantt";

/** What the chart's header needs to undo and redo a drag, supplied by the page. */
export interface ScheduleHistory {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const ScheduleHistoryContext = createContext<ScheduleHistory | null>(null);

const HISTORY_BUTTON =
  "flex items-center gap-[8px] text-[14px] text-[#737373] outline-none transition-colors hover:text-[#1E1E1E] focus-visible:text-[#1E1E1E] disabled:cursor-not-allowed disabled:opacity-40";

/** Undo and Redo, in the first header row of the task grid. */
function UndoRedoHeader() {
  const history = useContext(ScheduleHistoryContext);
  if (!history) return null;
  return (
    <div className="flex h-full items-center gap-[18px] pl-[16px]">
      <button type="button" onClick={history.undo} disabled={!history.canUndo} className={HISTORY_BUTTON}>
        <Undo2 className="size-[16px]" strokeWidth={1.5} />
        Undo
      </button>
      <button type="button" onClick={history.redo} disabled={!history.canRedo} className={HISTORY_BUTTON}>
        Redo
        <Redo2 className="size-[16px]" strokeWidth={1.5} />
      </button>
    </div>
  );
}

/** The blue "+" over the add-task column; the chart reads `data-action` to add a row. */
function AddTaskHeader() {
  return (
    <div className="flex h-full items-center justify-center">
      <i
        data-action="add-task"
        aria-label="Add task"
        className="wx-action-icon wxi-plus flex size-[18px] cursor-pointer items-center justify-center rounded-full bg-[#004DE7] text-[12px] text-white"
      />
    </div>
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `13 - 06 - 2026`, the way the programme writes its dates. */
export function formatProgrammeDate(date: Date): string {
  return `${pad(date.getDate())} - ${pad(date.getMonth() + 1)} - ${date.getFullYear()}`;
}

function StartCell({ row }: { row: { start?: Date } }) {
  return <span>{row.start ? formatProgrammeDate(row.start) : ""}</span>;
}

function DurationCell({ row }: { row: { duration?: number } }) {
  const days = row.duration ?? 0;
  return <span>{`${days} ${days === 1 ? "day" : "days"}`}</span>;
}

/**
 * Task Name, Start Date, Duration and (when the viewer can edit) the add-task
 * column. Undo/Redo live in the first header row, spanning every column.
 */
export function scheduleColumns(canEdit: boolean): IColumnConfig[] {
  const span = canEdit ? 4 : 3;
  const columns: IColumnConfig[] = [
    {
      id: "text",
      header: [{ text: "", colspan: span, cell: canEdit ? UndoRedoHeader : undefined }, { text: "Task Name" }],
      width: canEdit ? 225 : 232,
    },
    { id: "start", header: [{}, { text: "Start Date" }], width: 128, align: "left", cell: StartCell },
    { id: "duration", header: [{}, { text: "Duration" }], width: canEdit ? 90 : 129, align: "left", cell: DurationCell },
  ] as IColumnConfig[];
  if (canEdit) {
    columns.push({ id: "add-task", header: [{}, { text: "", cell: AddTaskHeader }], width: 46, align: "center" } as IColumnConfig);
  }
  return columns;
}
