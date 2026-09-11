import { Menu } from "@base-ui/react/menu";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { CalendarIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { cn } from "@/lib/utils";
import {
  formatDayDate,
  formatHours,
  formatWeekday,
  WEATHER_LABEL,
  WEATHER_TONE,
  type DailyLogRow,
} from "./daily-log-helpers";

export interface DailyLogRowActions {
  onView: (logDate: string) => void;
  onConditions: (logDate: string) => void;
  onAddLog: (logDate: string) => void;
  onDownload: (logDate: string) => void;
  onEmail: (logDate: string) => void;
}

interface DailyLogTableProps {
  rows: readonly DailyLogRow[];
  isPending: boolean;
  /** True when the loaded range has no logs at all (vs. filters hiding them). */
  hasAnyDays: boolean;
  canCreateEntry: boolean;
  canGenerateReport: boolean;
  actions: DailyLogRowActions;
}

const HEAD_CELL = "h-11 px-4 py-0 text-[11px] font-semibold text-black-300 capitalize whitespace-nowrap";
const CELL = "px-4 py-2 align-middle";
const CLAMP = "line-clamp-2 [overflow-wrap:anywhere]";
const STICKY = "sticky right-0 z-[1]";
const COLUMN_COUNT = 8;

const MENU_ITEM =
  "flex w-full cursor-default select-none items-center rounded-lg px-3 py-2 text-left text-[13px] text-gray-700 outline-none data-[highlighted]:bg-[#F6F6F6] data-[highlighted]:text-gray-900";

function DailyLogTable({ rows, isPending, hasAnyDays, canCreateEntry, canGenerateReport, actions }: DailyLogTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#F0F0F0] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-[#EDEDED] bg-[#FAFAFA]">
            <tr>
              <th className={HEAD_CELL}>Date</th>
              <th className={HEAD_CELL}>Logged by</th>
              <th className={HEAD_CELL}>Crew</th>
              <th className={HEAD_CELL}>Hours</th>
              <th className={HEAD_CELL}>Weather</th>
              <th className={HEAD_CELL}>Activities</th>
              <th className={HEAD_CELL}>Entries</th>
              <th className={cn(HEAD_CELL, STICKY, "w-28 bg-[#FAFAFA] text-right")}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4">
                  <div className="flex justify-center py-16">
                    <Spinner size="md" />
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4">
                  <EmptyState
                    variant="inline"
                    icon={<CalendarIcon />}
                    title={hasAnyDays ? "No days match these filters" : "No daily logs yet"}
                    description={
                      hasAnyDays
                        ? "Adjust the search, filter or date range to see more days."
                        : "Add your first log to start the project diary, which anyone on the team can contribute to."
                    }
                    action={
                      !hasAnyDays && canCreateEntry
                        ? { label: "Add my log", onClick: () => actions.onAddLog(""), icon: <PlusIcon /> }
                        : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <DailyLogTableRow
                  key={row.logDate}
                  row={row}
                  canCreateEntry={canCreateEntry}
                  canGenerateReport={canGenerateReport}
                  actions={actions}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

DailyLogTable.displayName = "DailyLogTable";

interface RowProps {
  row: DailyLogRow;
  canCreateEntry: boolean;
  canGenerateReport: boolean;
  actions: DailyLogRowActions;
}

function DailyLogTableRow({ row, canCreateEntry, canGenerateReport, actions }: RowProps) {
  const { day, missed, voided } = row;
  const rowTone = missed ? "bg-error-50 text-error-700" : voided ? "bg-white text-black-200" : "bg-white text-black-500";
  const stickyBg = missed ? "bg-error-50" : "bg-white";

  return (
    <tr
      className={cn("h-[61px] border-b border-[#F0F0F0] transition-colors", rowTone, !missed && "cursor-pointer hover:bg-[#FAFAFA]")}
      onClick={missed ? undefined : () => actions.onView(row.logDate)}
    >
      <td className={CELL}>
        <p className="whitespace-nowrap font-medium">{formatDayDate(row.logDate)}</p>
        <p className={cn("text-[12px]", missed ? "text-error-600" : "text-black-300")}>{formatWeekday(row.logDate)}</p>
      </td>
      <td className={CELL}>
        {missed ? (
          <span className="font-semibold text-error-600">Missed report</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className={cn(CLAMP, "font-medium")}>{row.loggedBy ?? "—"}</span>
            {voided ? (
              <Badge tone="danger" size="sm">Voided</Badge>
            ) : null}
          </div>
        )}
      </td>
      <td className={cn(CELL, "tabular-nums")}>{day ? `${day.workersPresent}/${day.workersExpected}` : "—"}</td>
      <td className={cn(CELL, "tabular-nums")}>{day ? formatHours(day.totalHours) : "—"}</td>
      <td className={CELL}>
        {day?.weatherCondition ? (
          <Badge tone={WEATHER_TONE[day.weatherCondition]} size="sm">
            {WEATHER_LABEL[day.weatherCondition]}
            {day.temperatureC !== null ? ` · ${day.temperatureC}°C` : ""}
          </Badge>
        ) : (
          "—"
        )}
      </td>
      <td className={cn(CELL, "tabular-nums")}>
        {day ? (
          <>
            <p>{day.activities.length}</p>
            <p className="text-[12px] text-black-300">{formatHours(row.activityHours)} logged</p>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className={cn(CELL, "tabular-nums")}>{day ? day.entries.length : "—"}</td>
      <td className={cn(CELL, STICKY, stickyBg, "text-right")} onClick={(e) => e.stopPropagation()}>
        {missed ? (
          canCreateEntry ? (
            <Button type="button" variant="ghost" size="sm" className="whitespace-nowrap text-error-700 hover:bg-error-100" onClick={() => actions.onAddLog(row.logDate)}>
              <PlusIcon className="size-3.5" />
              Add log
            </Button>
          ) : null
        ) : (
          <DailyLogRowMenu logDate={row.logDate} canCreateEntry={canCreateEntry} canGenerateReport={canGenerateReport} actions={actions} />
        )}
      </td>
    </tr>
  );
}

interface MenuProps {
  logDate: string;
  canCreateEntry: boolean;
  canGenerateReport: boolean;
  actions: DailyLogRowActions;
}

/** The ⋮ menu on a logged row. Four actions, so the two-item RowActionsMenu is not enough. */
function DailyLogRowMenu({ logDate, canCreateEntry, canGenerateReport, actions }: MenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Actions for ${formatDayDate(logDate)}`}
        className="inline-flex size-8 items-center justify-center rounded-lg text-gray-400 outline-none transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[60]">
          <Menu.Popup className="min-w-[160px] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5 outline-none">
            <Menu.Item className={MENU_ITEM} onClick={() => actions.onView(logDate)}>
              View
            </Menu.Item>
            {canCreateEntry ? (
              <Menu.Item className={MENU_ITEM} onClick={() => actions.onConditions(logDate)}>
                Conditions
              </Menu.Item>
            ) : null}
            {canGenerateReport ? (
              <Menu.Item className={MENU_ITEM} onClick={() => actions.onDownload(logDate)}>
                Download report
              </Menu.Item>
            ) : null}
            {canGenerateReport ? (
              <Menu.Item className={MENU_ITEM} onClick={() => actions.onEmail(logDate)}>
                Email me
              </Menu.Item>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export { DailyLogTable, type DailyLogTableProps };
