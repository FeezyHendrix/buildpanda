import { useMemo, type ReactNode } from "react";
import { Move } from "lucide-react";
import { Gantt, Willow, type IApi, type ILink, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { GANTT_ZOOM } from "./schedule-utils";
import { ScheduleHistoryContext, scheduleColumns, type ScheduleHistory } from "./schedule-columns";

const ROW_HEIGHT = 48;
/** Each of the two header rows; together they make the 90px header. */
const SCALE_ROW_HEIGHT = 45;

/** Month over week, written out the way the programme reads: APRIL 2026 over "April 5". */
const SCHEDULE_SCALES = [
  { unit: "month", step: 1, format: (date: Date) => date.toLocaleString("en-US", { month: "long", year: "numeric" }) },
  { unit: "week", step: 1, format: (date: Date) => date.toLocaleString("en-US", { month: "long", day: "numeric" }) },
];

function Hint() {
  return (
    <p className="flex items-center gap-[10px] text-[14px] text-[#737373]">
      <Move className="size-[16px] shrink-0" strokeWidth={1.5} />
      Drag bars to reschedule. Changes save automatically.
    </p>
  );
}

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-[8px]">
      {swatch}
      {label}
    </span>
  );
}

/** What the three bar styles mean. */
function Legend() {
  return (
    <div className="flex items-center gap-[18px] text-[14px] text-[#737373]" aria-label="Chart legend">
      <LegendItem swatch={<span className="size-[14px] bg-[#053DAB]" />} label="Milestone" />
      <LegendItem swatch={<span className="size-[14px] bg-[#00A63E]" />} label="Task" />
      <LegendItem swatch={<span className="size-[14px] border border-[#F59E0B] bg-white" />} label="Delay" />
    </div>
  );
}

/**
 * The programme chart in its frame: a hint and legend above, the task grid with
 * its timeline, and the hint again below. Editing (drag, undo, add) is only wired
 * for viewers who may change the schedule.
 */
export function ScheduleChart({
  tasks,
  links,
  rangeStart,
  rangeEnd,
  markers,
  canEdit,
  attach,
  history,
}: {
  tasks: ITask[];
  links: ILink[];
  rangeStart: Date | undefined;
  rangeEnd: Date | undefined;
  markers: { start: Date; text: string }[];
  canEdit: boolean;
  attach: (api: IApi) => void;
  history: ScheduleHistory;
}) {
  const columns = useMemo(() => scheduleColumns(canEdit), [canEdit]);
  // Tall enough for every row up to most of the screen; beyond that the chart scrolls inside its frame.
  const height = `min(${tasks.length * ROW_HEIGHT + SCALE_ROW_HEIGHT * 2 + 2}px, 70dvh)`;

  return (
    <div className="bp-gantt bp-schedule border border-[#DDDDDD] bg-white">
      <div className="flex h-[44px] items-center justify-between border-b border-[#DDDDDD] px-[12px]">
        {canEdit ? <Hint /> : <span />}
        <Legend />
      </div>
      <div style={{ height }} className="min-h-[240px] [&_.wx-willow-theme]:h-full">
        <ScheduleHistoryContext.Provider value={history}>
          <Willow>
            <Gantt
              tasks={tasks}
              links={links}
              scales={SCHEDULE_SCALES as never}
              columns={columns as never}
              start={rangeStart}
              end={rangeEnd}
              cellWidth={100}
              cellHeight={ROW_HEIGHT}
              scaleHeight={SCALE_ROW_HEIGHT}
              baselines
              zoom={GANTT_ZOOM}
              markers={markers}
              readonly={!canEdit}
              init={canEdit ? attach : undefined}
            />
          </Willow>
        </ScheduleHistoryContext.Provider>
      </div>
      {canEdit ? (
        <div className="flex h-[45px] items-center border-t border-[#DDDDDD] px-[12px]">
          <Hint />
        </div>
      ) : null}
    </div>
  );
}

ScheduleChart.displayName = "ScheduleChart";
