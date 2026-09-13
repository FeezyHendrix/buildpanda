import { Menu } from "@base-ui/react/menu";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
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

const CLAMP = "line-clamp-2 [overflow-wrap:anywhere]";
const STICKY = "sticky right-0 z-[1]";
const COLUMN_COUNT = 8;

const MENU_ITEM =
  "flex w-full cursor-default select-none items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 outline-none data-[highlighted]:bg-surface-alt data-[highlighted]:text-gray-900";

function DailyLogTable({ rows, isPending, hasAnyDays, canCreateEntry, canGenerateReport, actions }: DailyLogTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[960px]">
        <TableHead>
          <tr>
            <TableHeaderCell className="whitespace-nowrap">Date</TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap">Logged by</TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap">Crew</TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap">Hours</TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap">Weather</TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap">Activities</TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap">Entries</TableHeaderCell>
            <TableHeaderCell align="right" className={cn(STICKY, "w-28 bg-surface-alt")}>
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {isPending ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <div className="flex justify-center py-16">
                <Spinner size="md" />
              </div>
            </TableEmptyRow>
          ) : rows.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
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
            </TableEmptyRow>
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
        </TableBody>
      </Table>
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
  const tone = missed ? "danger" : voided ? "muted" : "default";
  const stickyBg = missed ? "bg-error-50" : "bg-white";

  return (
    <TableRow
      tone={tone}
      className={cn("h-[61px] transition-colors", !missed && "bg-white hover:bg-surface-alt")}
      onClick={missed ? undefined : () => actions.onView(row.logDate)}
    >
      <TableCell className="py-2">
        <p className="whitespace-nowrap font-medium">{formatDayDate(row.logDate)}</p>
        <p className={cn("text-xs", missed ? "text-error-600" : "text-black-300")}>{formatWeekday(row.logDate)}</p>
      </TableCell>
      <TableCell className="py-2">
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
      </TableCell>
      <TableCell className="py-2 tabular-nums">{day ? `${day.workersPresent}/${day.workersExpected}` : "—"}</TableCell>
      <TableCell className="py-2 tabular-nums">{day ? formatHours(day.totalHours) : "—"}</TableCell>
      <TableCell className="py-2">
        {day?.weatherCondition ? (
          <Badge tone={WEATHER_TONE[day.weatherCondition]} size="sm">
            {WEATHER_LABEL[day.weatherCondition]}
            {day.temperatureC !== null ? ` · ${day.temperatureC}°C` : ""}
          </Badge>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="py-2 tabular-nums">
        {day ? (
          <>
            <p>{day.activities.length}</p>
            <p className="text-xs text-black-300">{formatHours(row.activityHours)} logged</p>
          </>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="py-2 tabular-nums">{day ? day.entries.length : "—"}</TableCell>
      <TableCell align="right" className={cn("py-2", STICKY, stickyBg)} onClick={(e) => e.stopPropagation()}>
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
      </TableCell>
    </TableRow>
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
        onMouseDown={(event) => event.preventBaseUIHandler()}
        className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted outline-none transition-colors hover:bg-black/5 hover:text-ink focus-visible:shadow-focus"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[60]">
          <Menu.Popup className="min-w-[160px] rounded-lg border border-line bg-white p-1.5 shadow-card outline-none">
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
